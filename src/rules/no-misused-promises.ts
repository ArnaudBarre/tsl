/* Credits: ts-api-utils, @typescript-eslint */
import ts, { SyntaxKind } from "typescript";
import { createRule } from "../public-utils.ts";
import type { AST, Checker, Infer } from "../types.ts";
import { isAssignmentExpression, isLogicalExpression, run } from "../utils.ts";

interface ChecksVoidReturnOptions {
  arguments?: boolean;
  attributes?: boolean;
  properties?: boolean;
  returns?: boolean;
  variables?: boolean;
}

const messages = {
  voidReturnArgument:
    "Promise returned in function argument where a void return was expected.",
  voidReturnVariable:
    "Promise-returning function provided to variable where a void return was expected.",
  voidReturnProperty:
    "Promise-returning function provided to property where a void return was expected.",
  voidReturnReturnValue:
    "Promise-returning function provided to return value where a void return was expected.",
  voidReturnAttribute:
    "Promise-returning function provided to attribute where a void return was expected.",
  conditional: "Expected non-Promise value in a boolean conditional.",
  spread: "Expected a non-Promise value to be spreaded in an object.",
};

const parseOptions = (options: {
  checksConditionals?: boolean;
  checksVoidReturn?: ChecksVoidReturnOptions | boolean;
  checksSpreads?: boolean;
}) => {
  const checksVoidReturn = run(() => {
    switch (options?.checksVoidReturn) {
      case false:
        return false as const;
      case true:
      case undefined:
        return {
          arguments: true,
          attributes: true,
          properties: true,
          returns: true,
          variables: true,
        };
      default:
        return {
          arguments: options.checksVoidReturn.arguments ?? true,
          attributes: options.checksVoidReturn.attributes ?? true,
          properties: options.checksVoidReturn.properties ?? true,
          returns: options.checksVoidReturn.returns ?? true,
          variables: options.checksVoidReturn.variables ?? true,
        };
    }
  });
  return {
    checksConditionals: options.checksConditionals ?? true,
    checksVoidReturn,
    checksSpreads: options.checksSpreads ?? true,
  };
};

type RuleVisitor = AST.Visitor<ReturnType<typeof parseOptions>>;
type Context = Infer<typeof noMisusedPromises>["Context"];
export const noMisusedPromises = createRule({
  name: "no-misused-promises",
  parseOptions,
  visitor: (options): RuleVisitor => {
    const conditionalChecks: RuleVisitor = options.checksConditionals
      ? {
          ConditionalExpression(node, context) {
            if (node.condition) checkConditional(node.condition, true, context);
          },
          DoStatement(node, context) {
            if (node.expression)
              checkConditional(node.expression, true, context);
          },
          ForStatement(node, context) {
            if (node.condition) checkConditional(node.condition, true, context);
          },
          IfStatement(node, context) {
            if (node.expression)
              checkConditional(node.expression, true, context);
          },
          BinaryExpression(node, context) {
            if (isLogicalExpression(node.operatorToken)) {
              checkConditional(node, false, context);
            }
          },
          PrefixUnaryExpression(node, context) {
            checkConditional(node.operand, true, context);
          },
          WhileStatement(node, context) {
            if (node.expression)
              checkConditional(node.expression, true, context);
          },
        }
      : {};

    const voidReturnChecks: RuleVisitor = options.checksVoidReturn
      ? {
          ...(options.checksVoidReturn.arguments &&
            ({
              CallExpression: checkArguments,
              NewExpression: checkArguments,
            } satisfies RuleVisitor)),
          ...(options.checksVoidReturn.attributes &&
            ({
              JsxAttribute: checkJSXAttribute,
            } satisfies RuleVisitor)),
          ...(options.checksVoidReturn.properties &&
            ({
              PropertyAssignment: checkPropertyAssignment,
              ShorthandPropertyAssignment: checkShorthandPropertyAssignment,
              MethodDeclaration: checkMethodDeclaration,
            } satisfies RuleVisitor)),
          ...(options.checksVoidReturn.returns &&
            ({
              ReturnStatement: checkReturnStatement,
            } satisfies RuleVisitor)),
          ...(options.checksVoidReturn.variables &&
            ({
              BinaryExpression: checkAssignment,
              VariableDeclaration: checkVariableDeclaration,
            } satisfies RuleVisitor)),
        }
      : {};

    const spreadChecks: RuleVisitor = options.checksSpreads
      ? { SpreadElement: checkSpread }
      : {};

    return {
      ...conditionalChecks,
      ...voidReturnChecks,
      ...spreadChecks,
      BinaryExpression(node, context) {
        conditionalChecks?.BinaryExpression?.(node, context);
        voidReturnChecks?.BinaryExpression?.(node, context);
      },
    };
  },
});

/**
 * This function analyzes the type of a node and checks if it is a Promise in a boolean conditional.
 * It uses recursion when checking nested logical operators.
 */
function checkConditional(
  node: AST.Expression,
  isTestExpr: boolean,
  context: Context,
): void {
  if (
    node.kind === SyntaxKind.BinaryExpression &&
    isLogicalExpression(node.operatorToken)
  ) {
    // ignore the left operand for nullish coalescing expressions not in a context of a test expression
    if (
      node.operatorToken.kind !== SyntaxKind.QuestionQuestionToken ||
      isTestExpr
    ) {
      checkConditional(node.left, isTestExpr, context);
    }
    // we ignore the right operand when not in a context of a test expression
    if (isTestExpr) {
      checkConditional(node.right, isTestExpr, context);
    }
    return;
  }
  if (isAlwaysThenable(context.checker, node)) {
    context.report({ node, message: messages.conditional });
  }
}

function checkArguments(
  node: AST.CallExpression | AST.NewExpression,
  context: Context,
): void {
  const voidArgs = voidFunctionArguments(context.checker, node);
  if (voidArgs.size === 0) {
    return;
  }

  if (!node.arguments) return;

  for (const [index, argument] of node.arguments.entries()) {
    if (!voidArgs.has(index)) {
      continue;
    }

    if (returnsThenable(context.checker, argument)) {
      context.report({ node: argument, message: messages.voidReturnArgument });
    }
  }
}

function checkAssignment(node: AST.BinaryExpression, context: Context): void {
  if (!isAssignmentExpression(node.operatorToken)) return;
  const varType = context.checker.getTypeAtLocation(node.left);
  if (!isVoidReturningFunctionType(context.checker, node.left, varType)) {
    return;
  }

  if (returnsThenable(context.checker, node.right)) {
    context.report({ node: node.right, message: messages.voidReturnVariable });
  }
}

function checkVariableDeclaration(
  node: AST.VariableDeclaration,
  context: Context,
): void {
  if (node.initializer === undefined) {
    return;
  }
  const varType = context.checker.getTypeAtLocation(node.name);
  if (
    !isVoidReturningFunctionType(context.checker, node.initializer, varType)
  ) {
    return;
  }

  if (returnsThenable(context.checker, node.initializer)) {
    context.report({ node, message: messages.voidReturnVariable });
  }
}

function checkPropertyAssignment(
  node: AST.PropertyAssignment,
  context: Context,
) {
  const contextualType = context.checker.getContextualType(node.initializer);
  if (
    contextualType !== undefined &&
    isVoidReturningFunctionType(
      context.checker,
      node.initializer,
      contextualType,
    ) &&
    returnsThenable(context.checker, node.initializer)
  ) {
    context.report({
      node: node.initializer,
      message: messages.voidReturnProperty,
    });
  }
}

function checkShorthandPropertyAssignment(
  node: AST.ShorthandPropertyAssignment,
  context: Context,
) {
  const contextualType = context.checker.getContextualType(node.name);
  if (
    contextualType !== undefined &&
    isVoidReturningFunctionType(context.checker, node.name, contextualType) &&
    returnsThenable(context.checker, node.name)
  ) {
    context.report({ node, message: messages.voidReturnProperty });
  }
}

function checkMethodDeclaration(node: AST.MethodDeclaration, context: Context) {
  if (node.name.kind === SyntaxKind.ComputedPropertyName) {
    return;
  }
  const obj = node.parent;

  // Below condition isn't satisfied unless something goes wrong,
  // but is needed for type checking.
  // 'node' does not include class method declaration so 'obj' is
  // always an object literal expression, but after converting 'node'
  // to TypeScript AST, its type includes MethodDeclaration which
  // does include the case of class method declaration.
  if (!ts.isObjectLiteralExpression(obj)) {
    return;
  }

  if (!returnsThenable(context.checker, node)) {
    return;
  }
  const objType = context.checker.getContextualType(obj);
  if (objType === undefined) {
    return;
  }
  const propertySymbol = context.checker.getPropertyOfType(
    objType,
    node.name.text,
  );
  if (propertySymbol === undefined) {
    return;
  }

  const contextualType = context.checker.getTypeOfSymbolAtLocation(
    propertySymbol,
    node.name,
  );

  if (isVoidReturningFunctionType(context.checker, node.name, contextualType)) {
    context.report({ node, message: messages.voidReturnProperty });
  }
  return;
}

function checkReturnStatement(
  node: AST.ReturnStatement,
  context: Context,
): void {
  if (!node.expression) return;
  const contextualType = context.checker.getContextualType(node.expression);
  if (
    contextualType !== undefined &&
    isVoidReturningFunctionType(
      context.checker,
      node.expression,
      contextualType,
    ) &&
    returnsThenable(context.checker, node.expression)
  ) {
    context.report({
      node: node.expression,
      message: messages.voidReturnReturnValue,
    });
  }
}

function checkJSXAttribute(node: AST.JsxAttribute, context: Context): void {
  if (
    node.initializer == null ||
    node.initializer.kind !== SyntaxKind.JsxExpression
  ) {
    return;
  }
  const expressionContainer = node.initializer;
  const expression = node.initializer.expression;
  const contextualType = context.checker.getContextualType(node.initializer);
  if (
    contextualType !== undefined &&
    isVoidReturningFunctionType(
      context.checker,
      expressionContainer,
      contextualType,
    ) &&
    returnsThenable(context.checker, expression!)
  ) {
    context.report({
      node: node.initializer,
      message: messages.voidReturnAttribute,
    });
  }
}

function checkSpread(node: AST.SpreadElement, context: Context): void {
  if (isSometimesThenable(context.checker, node.expression)) {
    context.report({ node: node.expression, message: messages.spread });
  }
}

function isSometimesThenable(checker: Checker, node: ts.Node): boolean {
  const type = checker.getTypeAtLocation(node);

  for (const subType of checker.utils.unionTypeParts(
    checker.getApparentType(type),
  )) {
    if (checker.utils.isThenableType(node, subType)) {
      return true;
    }
  }

  return false;
}

// Variation on the thenable check which requires all forms of the type (read:
// alternates in a union) to be thenable. Otherwise, you might be trying to
// check if something is defined or undefined and get caught because one of the
// branches is thenable.
function isAlwaysThenable(checker: Checker, node: ts.Node): boolean {
  const type = checker.getTypeAtLocation(node);

  for (const subType of checker.utils.unionTypeParts(
    checker.getApparentType(type),
  )) {
    const thenProp = subType.getProperty("then");

    // If one of the alternates has no then property, it is not thenable in all
    // cases.
    if (thenProp === undefined) {
      return false;
    }

    // We walk through each variation of the then property. Since we know it
    // exists at this point, we just need at least one of the alternates to
    // be of the right form to consider it thenable.
    const thenType = checker.getTypeOfSymbolAtLocation(thenProp, node);
    let hasThenableSignature = false;
    for (const subType of checker.utils.unionTypeParts(thenType)) {
      for (const signature of subType.getCallSignatures()) {
        if (
          signature.parameters.length !== 0 &&
          isFunctionParam(checker, signature.parameters[0], node)
        ) {
          hasThenableSignature = true;
          break;
        }
      }

      // We only need to find one variant of the then property that has a
      // function signature for it to be thenable.
      if (hasThenableSignature) {
        break;
      }
    }

    // If no flavors of the then property are thenable, we don't consider the
    // overall type to be thenable
    if (!hasThenableSignature) {
      return false;
    }
  }

  // If all variants are considered thenable (i.e. haven't returned false), we
  // consider the overall type thenable
  return true;
}

function isFunctionParam(
  checker: Checker,
  param: ts.Symbol,
  node: ts.Node,
): boolean {
  const type: ts.Type | undefined = checker.getApparentType(
    checker.getTypeOfSymbolAtLocation(param, node),
  );
  for (const subType of checker.utils.unionTypeParts(type)) {
    if (subType.getCallSignatures().length !== 0) {
      return true;
    }
  }
  return false;
}

function checkThenableOrVoidArgument(
  checker: Checker,
  node: AST.CallExpression | AST.NewExpression,
  type: ts.Type,
  index: number,
  thenableReturnIndices: Set<number>,
  voidReturnIndices: Set<number>,
): void {
  if (isThenableReturningFunctionType(checker, node.expression, type)) {
    thenableReturnIndices.add(index);
  } else if (isVoidReturningFunctionType(checker, node.expression, type)) {
    // If a certain argument accepts both thenable and void returns,
    // a promise-returning function is valid
    if (!thenableReturnIndices.has(index)) {
      voidReturnIndices.add(index);
    }
  }
}

// Get the positions of arguments which are void functions (and not also
// thenable functions). These are the candidates for the void-return check at
// the current call site.
// If the function parameters end with a 'rest' parameter, then we consider
// the array type parameter (e.g. '...args:Array<SomeType>') when determining
// if trailing arguments are candidates.
function voidFunctionArguments(
  checker: Checker,
  node: AST.CallExpression | AST.NewExpression,
): Set<number> {
  // 'new' can be used without any arguments, as in 'let b = new Object;'
  // In this case, there are no argument positions to check, so return early.
  if (!node.arguments) {
    return new Set<number>();
  }
  const thenableReturnIndices = new Set<number>();
  const voidReturnIndices = new Set<number>();
  const type = checker.getTypeAtLocation(node.expression);

  // We can't use checker.getResolvedSignature because it prefers an early '() => void' over a later '() => Promise<void>'
  // See https://github.com/microsoft/TypeScript/issues/48077

  for (const subType of checker.utils.unionTypeParts(type)) {
    // Standard function calls and `new` have two different types of signatures
    const signatures = ts.isCallExpression(node)
      ? subType.getCallSignatures()
      : subType.getConstructSignatures();
    for (const signature of signatures) {
      for (const [index, parameter] of signature.parameters.entries()) {
        const decl = parameter.valueDeclaration;
        let type = checker.getTypeOfSymbolAtLocation(
          parameter,
          node.expression,
        );

        // If this is a array 'rest' parameter, check all of the argument indices
        // from the current argument to the end.
        // Note - we currently do not support 'spread' arguments - adding support for them
        // is tracked in https://github.com/typescript-eslint/typescript-eslint/issues/5744
        if (decl && ts.isParameter(decl) && decl.dotDotDotToken) {
          if (checker.isArrayType(type)) {
            // Unwrap 'Array<MaybeVoidFunction>' to 'MaybeVoidFunction',
            // so that we'll handle it in the same way as a non-rest
            // 'param: MaybeVoidFunction'
            type = checker.getTypeArguments(type)[0];
            for (let i = index; i < node.arguments.length; i++) {
              checkThenableOrVoidArgument(
                checker,
                node,
                type,
                i,
                thenableReturnIndices,
                voidReturnIndices,
              );
            }
          } else if (checker.isTupleType(type)) {
            // Check each type in the tuple - for example, [boolean, () => void] would
            // add the index of the second tuple parameter to 'voidReturnIndices'
            const typeArgs = checker.getTypeArguments(type);
            for (
              let i = index;
              i < node.arguments.length && i - index < typeArgs.length;
              i++
            ) {
              checkThenableOrVoidArgument(
                checker,
                node,
                typeArgs[i - index],
                i,
                thenableReturnIndices,
                voidReturnIndices,
              );
            }
          }
        } else {
          checkThenableOrVoidArgument(
            checker,
            node,
            type,
            index,
            thenableReturnIndices,
            voidReturnIndices,
          );
        }
      }
    }
  }

  for (const index of thenableReturnIndices) {
    voidReturnIndices.delete(index);
  }

  return voidReturnIndices;
}

/**
 * @returns Whether any call signature of the type has a thenable return type.
 */
function anySignatureIsThenableType(
  checker: Checker,
  node: ts.Node,
  type: ts.Type,
): boolean {
  for (const signature of type.getCallSignatures()) {
    const returnType = signature.getReturnType();
    if (checker.utils.isThenableType(node, returnType)) {
      return true;
    }
  }

  return false;
}

/**
 * @returns Whether type is a thenable-returning function.
 */
function isThenableReturningFunctionType(
  checker: Checker,
  node: ts.Node,
  type: ts.Type,
): boolean {
  for (const subType of checker.utils.unionTypeParts(type)) {
    if (anySignatureIsThenableType(checker, node, subType)) {
      return true;
    }
  }

  return false;
}

/**
 * @returns Whether type is a void-returning function.
 */
function isVoidReturningFunctionType(
  checker: Checker,
  node: ts.Node,
  type: ts.Type,
): boolean {
  let hadVoidReturn = false;

  for (const subType of checker.utils.unionTypeParts(type)) {
    for (const signature of subType.getCallSignatures()) {
      const returnType = signature.getReturnType();

      // If a certain positional argument accepts both thenable and void returns,
      // a promise-returning function is valid
      if (checker.utils.isThenableType(node, returnType)) {
        return false;
      }

      hadVoidReturn ||= checker.utils.isTypeFlagSet(
        returnType,
        ts.TypeFlags.Void,
      );
    }
  }

  return hadVoidReturn;
}

/**
 * @returns Whether expression is a function that returns a thenable.
 */
function returnsThenable(checker: Checker, node: ts.Node): boolean {
  const type = checker.getApparentType(checker.getTypeAtLocation(node));

  if (anySignatureIsThenableType(checker, node, type)) {
    return true;
  }

  return false;
}
