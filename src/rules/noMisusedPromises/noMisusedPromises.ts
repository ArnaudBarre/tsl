import {
  getPropertyOfType,
  isTypeFlagSet,
  unionConstituents,
} from "ts-api-utils";
import ts, { SyntaxKind, TypeFlags } from "typescript";
import {
  hasModifier,
  isArrayMethodCallWithPredicate,
  isAssignmentExpression,
  isFunction,
  isLogicalExpression,
  run,
} from "../_utils/index.ts";
import { createRule } from "../../index.ts";
import type { AST, Context } from "../../types.ts";

export const messages = {
  conditional: "Expected non-Promise value in a boolean conditional.",
  predicate: "Expected a non-Promise value to be returned.",
  spread: "Expected a non-Promise value to be spreaded in an object.",
  voidReturnArgument:
    "Promise returned in function argument where a void return was expected.",
  voidReturnAttribute:
    "Promise-returning function provided to attribute where a void return was expected.",
  voidReturnInheritedMethod: (params: { heritageTypeName: string }) =>
    `Promise-returning method provided where a void return was expected by extended/implemented type '${params.heritageTypeName}'.`,
  voidReturnProperty:
    "Promise-returning function provided to property where a void return was expected.",
  voidReturnReturnValue:
    "Promise-returning function provided to return value where a void return was expected.",
  voidReturnVariable:
    "Promise-returning function provided to variable where a void return was expected.",
};

export type NoMisusedPromisesOptions = {
  /**
   * Whether to warn when a Promise is provided to conditional statements.
   * @default true
   */
  checksConditionals?: boolean;
  /**
   * Whether to warn when `...` spreading a `Promise`.
   * @default true
   */
  checksSpreads?: boolean;
  /**
   * Whether to warn when a Promise is returned from a function typed as returning `void`.
   * `true` enables checking all cases.
   * @default true
   */
  checksVoidReturn?:
    | boolean
    | {
        /** Disables checking an asynchronous function passed as argument where the parameter type expects a function that returns `void`. */
        arguments?: boolean;
        /** Disables checking an asynchronous function passed as a JSX attribute expected to be a function that returns `void`. */
        attributes?: boolean;
        /** Disables checking an asynchronous method in a type that extends or implements another type expecting that method to return `void`. */
        inheritedMethods?: boolean;
        /** Disables checking an asynchronous function passed as an object property expected to be a function that returns `void`. */
        properties?: boolean;
        /** Disables checking an asynchronous function returned in a function whose return type is a function that returns `void`. */
        returns?: boolean;
        /** Disables checking an asynchronous function used as a variable whose return type is a function that returns `void`. */
        variables?: boolean;
      };
};

const createData = () => ({ checkedNodes: new Set<ts.Node>() });
type Data = ReturnType<typeof createData>;
export const noMisusedPromises = createRule(
  (_options?: NoMisusedPromisesOptions) => {
    const options = {
      checksConditionals: _options?.checksConditionals ?? true,
      checksSpreads: _options?.checksSpreads ?? true,
      checksVoidReturn: run(() => {
        switch (_options?.checksVoidReturn) {
          case false:
            return false as const;
          case true:
          case undefined:
            return {
              arguments: true,
              attributes: true,
              inheritedMethods: true,
              properties: true,
              returns: true,
              variables: true,
            };
          default:
            return {
              arguments: _options?.checksVoidReturn.arguments ?? true,
              attributes: _options?.checksVoidReturn.attributes ?? true,
              inheritedMethods:
                _options?.checksVoidReturn.inheritedMethods ?? true,
              properties: _options?.checksVoidReturn.properties ?? true,
              returns: _options?.checksVoidReturn.returns ?? true,
              variables: _options?.checksVoidReturn.variables ?? true,
            };
        }
      }),
    };

    const conditionalChecks: AST.Visitor<Data> = options.checksConditionals
      ? {
          CallExpression(node, context) {
            if (node.expression.kind === SyntaxKind.PropertyAccessExpression) {
              checkArrayPredicates(context, node.expression);
            }
          },
          ConditionalExpression(node, context) {
            checkConditional(node.condition, true, context);
          },
          DoStatement(node, context) {
            checkConditional(node.expression, true, context);
          },
          ForStatement(node, context) {
            if (node.condition) checkConditional(node.condition, true, context);
          },
          IfStatement(node, context) {
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
            checkConditional(node.expression, true, context);
          },
        }
      : {};

    const voidReturnChecks: AST.Visitor<Data> = options.checksVoidReturn
      ? {
          ...(options.checksVoidReturn.arguments
            && ({
              CallExpression: checkArguments,
              NewExpression: checkArguments,
            } satisfies AST.Visitor<Data>)),
          ...(options.checksVoidReturn.attributes
            && ({
              JsxAttribute: checkJSXAttribute,
            } satisfies AST.Visitor<Data>)),
          ...(options.checksVoidReturn.inheritedMethods
            && ({
              ClassDeclaration: checkClassLikeOrInterfaceNode,
              ClassExpression: checkClassLikeOrInterfaceNode,
              InterfaceDeclaration: checkClassLikeOrInterfaceNode,
            } satisfies AST.Visitor<Data>)),
          ...(options.checksVoidReturn.properties
            && ({
              PropertyAssignment: checkPropertyAssignment,
              ShorthandPropertyAssignment: checkShorthandPropertyAssignment,
              MethodDeclaration: checkMethodDeclaration,
            } satisfies AST.Visitor<Data>)),
          ...(options.checksVoidReturn.returns
            && ({
              ReturnStatement: checkReturnStatement,
            } satisfies AST.Visitor<Data>)),
          ...(options.checksVoidReturn.variables
            && ({
              BinaryExpression: checkAssignment,
              VariableDeclaration: checkVariableDeclaration,
            } satisfies AST.Visitor<Data>)),
        }
      : {};

    const spreadChecks: AST.Visitor<Data> = options.checksSpreads
      ? { SpreadAssignment: checkSpread }
      : {};

    return {
      name: "core/noMisusedPromises",
      createData: () => ({ checkedNodes: new Set<ts.Node>() }),
      visitor: {
        ...conditionalChecks,
        ...voidReturnChecks,
        ...spreadChecks,
        BinaryExpression(node, context) {
          conditionalChecks.BinaryExpression?.(node, context);
          voidReturnChecks.BinaryExpression?.(node, context);
        },
        CallExpression(node, context) {
          conditionalChecks.CallExpression?.(node, context);
          voidReturnChecks.CallExpression?.(node, context);
        },
      },
    };
  },
);

/**
 * This function analyzes the type of a node and checks if it is a Promise in a boolean conditional.
 * It uses recursion when checking nested logical operators.
 * @param node The AST node to check.
 * @param isTestExpr Whether the node is a descendant of a test expression.
 * @param context The context object.
 */
function checkConditional(
  node: AST.Expression,
  isTestExpr: boolean,
  context: Context<Data>,
): void {
  if (
    node.kind === SyntaxKind.BinaryExpression
    && isLogicalExpression(node.operatorToken)
  ) {
    // ignore the left operand for nullish coalescing expressions not in a context of a test expression
    if (
      node.operatorToken.kind !== SyntaxKind.QuestionQuestionToken
      || isTestExpr
    ) {
      checkConditional(node.left, isTestExpr, context);
    }
    // we ignore the right operand when not in a context of a test expression
    if (isTestExpr) {
      checkConditional(node.right, isTestExpr, context);
    }
    return;
  }
  if (isAlwaysThenable(context, node)) {
    context.report({ node, message: messages.conditional });
  }
}

function checkArrayPredicates(
  context: Context<Data>,
  node: AST.MemberExpression,
): void {
  const parent = node.parent;
  if (parent.kind === SyntaxKind.CallExpression) {
    const callback = parent.arguments.at(0);
    if (callback && isArrayMethodCallWithPredicate(context, parent)) {
      if (returnsThenable(context, callback)) {
        context.report({ node: callback, message: messages.predicate });
      }
    }
  }
}

function checkArguments(
  node: AST.CallExpression | AST.NewExpression,
  context: Context<Data>,
): void {
  const voidArgs = voidFunctionArguments(context, node);
  if (voidArgs.size === 0) {
    return;
  }

  if (!node.arguments) return;

  for (const [index, argument] of node.arguments.entries()) {
    if (!voidArgs.has(index)) {
      continue;
    }

    if (returnsThenable(context, argument)) {
      context.report({ node: argument, message: messages.voidReturnArgument });
    }
  }
}

function checkAssignment(
  node: AST.BinaryExpression,
  context: Context<Data>,
): void {
  if (!isAssignmentExpression(node.operatorToken)) return;
  const varType = context.checker.getTypeAtLocation(node.left);
  if (!isVoidReturningFunctionType(context, node.left, varType)) {
    return;
  }

  if (returnsThenable(context, node.right)) {
    context.report({ node: node.right, message: messages.voidReturnVariable });
  }
}

function checkVariableDeclaration(
  node: AST.VariableDeclaration,
  context: Context<Data>,
): void {
  if (node.initializer === undefined) {
    return;
  }

  const varType = context.checker.getTypeAtLocation(node.name);
  if (!isVoidReturningFunctionType(context, node.initializer, varType)) {
    return;
  }

  if (returnsThenable(context, node.initializer)) {
    context.report({
      node: node.initializer,
      message: messages.voidReturnVariable,
    });
  }
}

export function checkPropertyAssignment(
  node: AST.PropertyAssignment,
  context: Context<Data>,
) {
  const contextualType = context.checker.getContextualType(node.initializer);
  if (
    contextualType !== undefined
    && isVoidReturningFunctionType(context, node.initializer, contextualType)
    && returnsThenable(context, node.initializer)
  ) {
    const reportNode = run(() => {
      if (!isFunction(node.initializer)) return node.initializer;
      if (node.initializer.type) return node.initializer.type;
      const asyncModifier = node.initializer.modifiers?.find(
        (m) => m.kind === SyntaxKind.AsyncKeyword,
      );
      if (asyncModifier) return asyncModifier;
      return node.initializer;
    });
    context.report({ node: reportNode, message: messages.voidReturnProperty });
  }
}

export function checkShorthandPropertyAssignment(
  node: AST.ShorthandPropertyAssignment,
  context: Context<Data>,
) {
  const contextualType = context.checker.getContextualType(node.name);
  if (
    contextualType !== undefined
    && isVoidReturningFunctionType(context, node.name, contextualType)
    && returnsThenable(context, node.name)
  ) {
    context.report({ node, message: messages.voidReturnProperty });
  }
}

export function checkMethodDeclaration(
  node: AST.MethodDeclaration,
  context: Context<Data>,
) {
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

  if (!returnsThenable(context, node)) {
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

  if (isVoidReturningFunctionType(context, node.name, contextualType)) {
    context.report({
      node:
        node.type
        ?? node.modifiers?.find((m) => m.kind === SyntaxKind.AsyncKeyword)
        ?? node,
      message: messages.voidReturnProperty,
    });
  }
  return;
}

function checkReturnStatement(
  node: AST.ReturnStatement,
  context: Context<Data>,
): void {
  if (!node.expression) return;
  const contextualType = context.checker.getContextualType(node.expression);
  if (
    contextualType !== undefined
    && isVoidReturningFunctionType(context, node.expression, contextualType)
    && returnsThenable(context, node.expression)
  ) {
    context.report({
      node: node.expression,
      message: messages.voidReturnReturnValue,
    });
  }
}

function checkClassLikeOrInterfaceNode(
  node: AST.ClassDeclaration | AST.ClassExpression | AST.InterfaceDeclaration,
  context: Context<Data>,
): void {
  const heritageTypes = getHeritageTypes(context, node);
  if (!heritageTypes?.length) {
    return;
  }

  for (const nodeMember of node.members) {
    const memberName = nodeMember.name?.getText();
    if (memberName === undefined) {
      // Call/construct/index signatures don't have names. TS allows call signatures to mismatch,
      // and construct signatures can't be async.
      // TODO - Once we're able to use `checker.isTypeAssignableTo` (v8), we can check an index
      // signature here against its compatible index signatures in `heritageTypes`
      continue;
    }
    if (!returnsThenable(context, nodeMember)) {
      continue;
    }

    if (isStaticMember(nodeMember)) {
      continue;
    }

    for (const heritageType of heritageTypes) {
      checkHeritageTypeForMemberReturningVoid(
        context,
        nodeMember,
        heritageType,
        memberName,
      );
    }
  }
}

/**
 * Checks `heritageType` for a member named `memberName` that returns void; reports the
 * 'voidReturnInheritedMethod' message if found.
 * @param context The context object
 * @param nodeMember Node member that returns a Promise
 * @param heritageType Heritage type to check against
 * @param memberName Name of the member to check for
 */
function checkHeritageTypeForMemberReturningVoid(
  context: Context<Data>,
  nodeMember: AST.AnyNode,
  heritageType: ts.Type,
  memberName: string,
): void {
  const heritageMember = getMemberIfExists(heritageType, memberName);
  if (heritageMember === undefined) {
    return;
  }
  const memberType = context.checker.getTypeOfSymbolAtLocation(
    heritageMember,
    nodeMember,
  );
  if (!isVoidReturningFunctionType(context, nodeMember, memberType)) {
    return;
  }
  context.report({
    node: nodeMember,
    message: messages.voidReturnInheritedMethod({
      heritageTypeName: context.checker.typeToString(heritageType),
    }),
  });
}

function checkJSXAttribute(
  node: AST.JsxAttribute,
  context: Context<Data>,
): void {
  if (
    node.initializer == null
    || node.initializer.kind !== SyntaxKind.JsxExpression
  ) {
    return;
  }
  const expressionContainer = node.initializer;
  const expression = node.initializer.expression;
  const contextualType = context.checker.getContextualType(expressionContainer);
  if (
    contextualType !== undefined
    && isVoidReturningFunctionType(context, expressionContainer, contextualType)
    && returnsThenable(context, expression!)
  ) {
    context.report({
      node: node.initializer,
      message: messages.voidReturnAttribute,
    });
  }
}

function checkSpread(node: AST.SpreadAssignment, context: Context<Data>): void {
  if (isSometimesThenable(context, node.expression)) {
    context.report({
      node: node.expression,
      message: messages.spread,
    });
  }
}

function isSometimesThenable(
  context: Context<Data>,
  node: AST.AnyNode,
): boolean {
  const type = context.checker.getTypeAtLocation(node);

  for (const subType of unionConstituents(
    context.checker.getApparentType(type),
  )) {
    if (context.utils.isThenableType(node, subType)) {
      return true;
    }
  }

  return false;
}

// Variation on the thenable check which requires all forms of the type (read:
// alternates in a union) to be thenable. Otherwise, you might be trying to
// check if something is defined or undefined and get caught because one of the
// branches is thenable.
function isAlwaysThenable(context: Context<Data>, node: AST.AnyNode): boolean {
  const type = context.checker.getTypeAtLocation(node);

  for (const subType of unionConstituents(
    context.checker.getApparentType(type),
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
    const thenType = context.checker.getTypeOfSymbolAtLocation(thenProp, node);
    let hasThenableSignature = false;
    for (const subType of unionConstituents(thenType)) {
      for (const signature of subType.getCallSignatures()) {
        if (
          signature.parameters.length !== 0
          && isFunctionParam(context, signature.parameters[0], node)
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
  context: Context<Data>,
  param: ts.Symbol,
  node: AST.AnyNode,
): boolean {
  const type: ts.Type | undefined = context.checker.getApparentType(
    context.checker.getTypeOfSymbolAtLocation(param, node),
  );
  for (const subType of unionConstituents(type)) {
    if (subType.getCallSignatures().length !== 0) {
      return true;
    }
  }
  return false;
}

function checkThenableOrVoidArgument(
  context: Context<Data>,
  node: AST.CallExpression | AST.NewExpression,
  type: ts.Type,
  index: number,
  thenableReturnIndices: Set<number>,
  voidReturnIndices: Set<number>,
): void {
  if (isThenableReturningFunctionType(context, node.expression, type)) {
    thenableReturnIndices.add(index);
  } else if (
    isVoidReturningFunctionType(context, node.expression, type)
    // If a certain argument accepts both thenable and void returns,
    // a promise-returning function is valid
    && !thenableReturnIndices.has(index)
  ) {
    voidReturnIndices.add(index);
  }
  const contextualType = context.checker.getContextualTypeForArgumentAtIndex(
    node,
    index,
  );
  if (contextualType !== type) {
    checkThenableOrVoidArgument(
      context,
      node,
      contextualType,
      index,
      thenableReturnIndices,
      voidReturnIndices,
    );
  }
}

// Get the positions of arguments which are void functions (and not also
// thenable functions). These are the candidates for the void-return check at
// the current call site.
// If the function parameters end with a 'rest' parameter, then we consider
// the array type parameter (e.g. '...args:Array<SomeType>') when determining
// if trailing arguments are candidates.
function voidFunctionArguments(
  context: Context<Data>,
  node: AST.CallExpression | AST.NewExpression,
): Set<number> {
  // 'new' can be used without any arguments, as in 'let b = new Object;'
  // In this case, there are no argument positions to check, so return early.
  if (!node.arguments) {
    return new Set<number>();
  }
  const thenableReturnIndices = new Set<number>();
  const voidReturnIndices = new Set<number>();
  const type = context.checker.getTypeAtLocation(node.expression);

  // We can't use checker.getResolvedSignature because it prefers an early '() => void' over a later '() => Promise<void>'
  // See https://github.com/microsoft/TypeScript/issues/48077

  for (const subType of unionConstituents(type)) {
    // Standard function calls and `new` have two different types of signatures
    const signatures = ts.isCallExpression(node)
      ? subType.getCallSignatures()
      : subType.getConstructSignatures();
    for (const signature of signatures) {
      for (const [index, parameter] of signature.parameters.entries()) {
        const decl = parameter.valueDeclaration;
        let type = context.checker.getTypeOfSymbolAtLocation(
          parameter,
          node.expression,
        );

        // If this is a array 'rest' parameter, check all of the argument indices
        // from the current argument to the end.
        if (decl && ts.isParameter(decl) && decl.dotDotDotToken) {
          if (context.checker.isArrayType(type)) {
            // Unwrap 'Array<MaybeVoidFunction>' to 'MaybeVoidFunction',
            // so that we'll handle it in the same way as a non-rest
            // 'param: MaybeVoidFunction'
            type = context.checker.getTypeArguments(type)[0];
            for (let i = index; i < node.arguments.length; i++) {
              checkThenableOrVoidArgument(
                context,
                node,
                type,
                i,
                thenableReturnIndices,
                voidReturnIndices,
              );
            }
          } else if (context.checker.isTupleType(type)) {
            // Check each type in the tuple - for example, [boolean, () => void] would
            // add the index of the second tuple parameter to 'voidReturnIndices'
            const typeArgs = context.checker.getTypeArguments(type);
            for (
              let i = index;
              i < node.arguments.length && i - index < typeArgs.length;
              i++
            ) {
              checkThenableOrVoidArgument(
                context,
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
            context,
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
  context: Context<Data>,
  node: ts.Node,
  type: ts.Type,
): boolean {
  for (const signature of type.getCallSignatures()) {
    const returnType = signature.getReturnType();
    if (context.utils.isThenableType(node, returnType)) {
      return true;
    }
  }

  return false;
}

/**
 * @returns Whether type is a thenable-returning function.
 */
function isThenableReturningFunctionType(
  context: Context<Data>,
  node: ts.Node,
  type: ts.Type,
): boolean {
  for (const subType of unionConstituents(type)) {
    if (anySignatureIsThenableType(context, node, subType)) {
      return true;
    }
  }

  return false;
}

/**
 * @returns Whether type is a void-returning function.
 */
function isVoidReturningFunctionType(
  context: Context<Data>,
  node: ts.Node,
  type: ts.Type,
): boolean {
  let hadVoidReturn = false;

  for (const subType of unionConstituents(type)) {
    for (const signature of subType.getCallSignatures()) {
      const returnType = signature.getReturnType();

      // If a certain positional argument accepts both thenable and void returns,
      // a promise-returning function is valid
      if (context.utils.isThenableType(node, returnType)) {
        return false;
      }

      hadVoidReturn ||= isTypeFlagSet(returnType, TypeFlags.Void);
    }
  }

  return hadVoidReturn;
}

/**
 * @returns Whether expression is a function that returns a thenable.
 */
function returnsThenable(context: Context<Data>, node: ts.Node): boolean {
  const type = context.checker.getApparentType(
    context.checker.getTypeAtLocation(node),
  );
  return unionConstituents(type).some((t) =>
    anySignatureIsThenableType(context, node, t),
  );
}

function getHeritageTypes(
  context: Context<Data>,
  tsNode: AST.ClassDeclaration | AST.ClassExpression | AST.InterfaceDeclaration,
): ts.Type[] | undefined {
  return tsNode.heritageClauses
    ?.flatMap((clause) => clause.types)
    .map((typeExpression) => context.checker.getTypeAtLocation(typeExpression));
}

/**
 * @returns The member with the given name in `type`, if it exists.
 */
function getMemberIfExists(
  type: ts.Type,
  memberName: string,
): ts.Symbol | undefined {
  const escapedMemberName = ts.escapeLeadingUnderscores(memberName);
  const symbolMemberMatch = type.getSymbol()?.members?.get(escapedMemberName);
  return symbolMemberMatch ?? getPropertyOfType(type, escapedMemberName);
}

function isStaticMember(node: AST.AnyNode): boolean {
  return (
    (node.kind === SyntaxKind.MethodDeclaration
      || node.kind === SyntaxKind.PropertyDeclaration)
    && hasModifier(node, SyntaxKind.StaticKeyword)
  );
}
