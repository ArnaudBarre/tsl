import { getPropertyOfType, isTypeFlagSet, unionTypeParts } from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Infer } from "../types.ts";
import {
  isArrayMethodCallWithPredicate,
  isAssignmentExpression,
  isFunction,
  isLogicalExpression,
  run,
} from "./utils";

const messages = {
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

interface ChecksVoidReturnOptions {
  arguments?: boolean;
  attributes?: boolean;
  inheritedMethods?: boolean;
  properties?: boolean;
  returns?: boolean;
  variables?: boolean;
}

const parseOptions = (options?: {
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
          inheritedMethods: true,
          properties: true,
          returns: true,
          variables: true,
        };
      default:
        return {
          arguments: options?.checksVoidReturn.arguments ?? true,
          attributes: options?.checksVoidReturn.attributes ?? true,
          inheritedMethods: options?.checksVoidReturn.inheritedMethods ?? true,
          properties: options?.checksVoidReturn.properties ?? true,
          returns: options?.checksVoidReturn.returns ?? true,
          variables: options?.checksVoidReturn.variables ?? true,
        };
    }
  });
  return {
    checksConditionals: options?.checksConditionals ?? true,
    checksVoidReturn,
    checksSpreads: options?.checksSpreads ?? true,
  };
};

type RuleVisitor = AST.Visitor<ReturnType<typeof parseOptions>>;
type Context = Infer<typeof noMisusedPromises>["Context"];
export const noMisusedPromises = createRule({
  name: "no-misused-promises",
  parseOptions,
  createData: () => ({ checkedNodes: new Set<ts.Node>() }),
  visitor: (options): RuleVisitor => {
    const conditionalChecks: RuleVisitor = options.checksConditionals
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
          ...(options.checksVoidReturn.inheritedMethods &&
            ({
              ClassDeclaration: checkClassLikeOrInterfaceNode,
              ClassExpression: checkClassLikeOrInterfaceNode,
              InterfaceDeclaration: checkClassLikeOrInterfaceNode,
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
      ? { SpreadAssignment: checkSpread }
      : {};

    return {
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
    };
  },
});

/**
 * This function analyzes the type of a node and checks if it is a Promise in a boolean conditional.
 * It uses recursion when checking nested logical operators.
 * @param node The AST node to check.
 * @param isTestExpr Whether the node is a descendant of a test expression.
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
  if (isAlwaysThenable(context, node)) {
    context.report({ node, message: messages.conditional });
  }
}

function checkArrayPredicates(
  context: Context,
  node: AST.MemberExpression,
): void {
  const parent = node.parent;
  if (parent.kind === SyntaxKind.CallExpression) {
    const callback = parent.arguments.at(0);
    if (callback && isArrayMethodCallWithPredicate(context, parent)) {
      const type = callback;
      if (returnsThenable(context, type)) {
        context.report({ node: callback, message: messages.predicate });
      }
    }
  }
}

function checkArguments(
  node: AST.CallExpression | AST.NewExpression,
  context: Context,
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

function checkAssignment(node: AST.BinaryExpression, context: Context): void {
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
  context: Context,
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
  context: Context,
) {
  const contextualType = context.checker.getContextualType(node.initializer);
  if (
    contextualType !== undefined &&
    isVoidReturningFunctionType(context, node.initializer, contextualType) &&
    returnsThenable(context, node.initializer)
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
  context: Context,
) {
  const contextualType = context.checker.getContextualType(node.name);
  if (
    contextualType !== undefined &&
    isVoidReturningFunctionType(context, node.name, contextualType) &&
    returnsThenable(context, node.name)
  ) {
    context.report({ node, message: messages.voidReturnProperty });
  }
}

export function checkMethodDeclaration(
  node: AST.MethodDeclaration,
  context: Context,
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
        node.type ??
        node.modifiers?.find((m) => m.kind === SyntaxKind.AsyncKeyword) ??
        node,
      message: messages.voidReturnProperty,
    });
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
    isVoidReturningFunctionType(context, node.expression, contextualType) &&
    returnsThenable(context, node.expression)
  ) {
    context.report({
      node: node.expression,
      message: messages.voidReturnReturnValue,
    });
  }
}

function checkClassLikeOrInterfaceNode(
  node: AST.ClassDeclaration | AST.ClassExpression | AST.InterfaceDeclaration,
  context: Context,
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
 * @param nodeMember Node member that returns a Promise
 * @param heritageType Heritage type to check against
 * @param memberName Name of the member to check for
 */
function checkHeritageTypeForMemberReturningVoid(
  context: Context,
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

function checkJSXAttribute(node: AST.JsxAttribute, context: Context): void {
  if (
    node.initializer == null ||
    node.initializer.kind !== SyntaxKind.JsxExpression
  ) {
    return;
  }
  const expressionContainer = node.initializer;
  const expression = node.initializer.expression;
  const contextualType = context.checker.getContextualType(expressionContainer);
  if (
    contextualType !== undefined &&
    isVoidReturningFunctionType(context, expressionContainer, contextualType) &&
    returnsThenable(context, expression!)
  ) {
    context.report({
      node: node.initializer,
      message: messages.voidReturnAttribute,
    });
  }
}

function checkSpread(node: AST.SpreadAssignment, context: Context): void {
  if (isSometimesThenable(context, node.expression)) {
    context.report({
      node: node.expression,
      message: messages.spread,
    });
  }
}

function isSometimesThenable(context: Context, node: AST.AnyNode): boolean {
  const type = context.checker.getTypeAtLocation(node);

  for (const subType of unionTypeParts(context.checker.getApparentType(type))) {
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
function isAlwaysThenable(context: Context, node: AST.AnyNode): boolean {
  const type = context.checker.getTypeAtLocation(node);

  for (const subType of unionTypeParts(context.checker.getApparentType(type))) {
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
    for (const subType of unionTypeParts(thenType)) {
      for (const signature of subType.getCallSignatures()) {
        if (
          signature.parameters.length !== 0 &&
          isFunctionParam(context, signature.parameters[0], node)
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
  context: Context,
  param: ts.Symbol,
  node: AST.AnyNode,
): boolean {
  const type: ts.Type | undefined = context.checker.getApparentType(
    context.checker.getTypeOfSymbolAtLocation(param, node),
  );
  for (const subType of unionTypeParts(type)) {
    if (subType.getCallSignatures().length !== 0) {
      return true;
    }
  }
  return false;
}

function checkThenableOrVoidArgument(
  context: Context,
  node: AST.CallExpression | AST.NewExpression,
  type: ts.Type,
  index: number,
  thenableReturnIndices: Set<number>,
  voidReturnIndices: Set<number>,
): void {
  if (isThenableReturningFunctionType(context, node.expression, type)) {
    thenableReturnIndices.add(index);
  } else if (
    isVoidReturningFunctionType(context, node.expression, type) &&
    // If a certain argument accepts both thenable and void returns,
    // a promise-returning function is valid
    !thenableReturnIndices.has(index)
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
  context: Context,
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

  for (const subType of unionTypeParts(type)) {
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
  context: Context,
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
  context: Context,
  node: ts.Node,
  type: ts.Type,
): boolean {
  for (const subType of unionTypeParts(type)) {
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
  context: Context,
  node: ts.Node,
  type: ts.Type,
): boolean {
  let hadVoidReturn = false;

  for (const subType of unionTypeParts(type)) {
    for (const signature of subType.getCallSignatures()) {
      const returnType = signature.getReturnType();

      // If a certain positional argument accepts both thenable and void returns,
      // a promise-returning function is valid
      if (context.utils.isThenableType(node, returnType)) {
        return false;
      }

      hadVoidReturn ||= isTypeFlagSet(returnType, ts.TypeFlags.Void);
    }
  }

  return hadVoidReturn;
}

/**
 * @returns Whether expression is a function that returns a thenable.
 */
function returnsThenable(context: Context, node: ts.Node): boolean {
  const type = context.checker.getApparentType(
    context.checker.getTypeAtLocation(node),
  );
  return unionTypeParts(type).some((t) =>
    anySignatureIsThenableType(context, node, t),
  );
}

function getHeritageTypes(
  context: Context,
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
    (node.kind === SyntaxKind.MethodDeclaration ||
      node.kind === SyntaxKind.PropertyDeclaration) &&
    (node.modifiers?.some((m) => m.kind === SyntaxKind.StaticKeyword) ?? false)
  );
}

export const test = () =>
  ruleTester({
    rule: noMisusedPromises,
    valid: [
      `
if (true) {
}
    `,
      {
        options: { checksConditionals: false },
        code: `
if (Promise.resolve()) {
}
      `,
      },
      `
if (true) {
} else if (false) {
} else {
}
    `,
      {
        options: { checksConditionals: false },
        code: `
if (Promise.resolve()) {
} else if (Promise.resolve()) {
} else {
}
      `,
      },
      "for (;;) {}",
      "for (let i; i < 10; i++) {}",
      {
        options: { checksConditionals: false },
        code: "for (let i; Promise.resolve(); i++) {}",
      },
      "do {} while (true);",
      {
        options: { checksConditionals: false },
        code: "do {} while (Promise.resolve());",
      },
      "while (true) {}",
      {
        options: { checksConditionals: false },
        code: "while (Promise.resolve()) {}",
      },
      "true ? 123 : 456;",
      {
        options: { checksConditionals: false },
        code: "Promise.resolve() ? 123 : 456;",
      },
      `
if (!true) {
}
    `,
      {
        options: { checksConditionals: false },
        code: `
if (!Promise.resolve()) {
}
      `,
      },
      "(await Promise.resolve()) || false;",
      {
        options: { checksConditionals: false },
        code: "Promise.resolve() || false;",
      },
      "(true && (await Promise.resolve())) || false;",
      {
        options: { checksConditionals: false },
        code: "(true && Promise.resolve()) || false;",
      },
      "false || (true && Promise.resolve());",
      `
async function test() {
  if (await Promise.resolve()) {
  }
}
    `,
      `
async function test() {
  const mixed: Promise | undefined = Promise.resolve();
  if (mixed) {
    await mixed;
  }
}
    `,
      `
interface NotQuiteThenable {
  then(param: string): void;
  then(): void;
}
const value: NotQuiteThenable = { then() {} };
if (value) {
}
    `,
      "[1, 2, 3].forEach(val => {});",
      {
        options: { checksVoidReturn: false },
        code: "[1, 2, 3].forEach(async val => {});",
      },
      "new Promise((resolve, reject) => resolve());",
      {
        options: { checksVoidReturn: false },
        code: "new Promise(async (resolve, reject) => resolve());",
      },
      `
Promise.all(
  ['abc', 'def'].map(async val => {
    await val;
  }),
);
    `,
      `
const fn: (arg: () => Promise<void> | void) => void = () => {};
fn(() => Promise.resolve());
    `,
      `
declare const returnsPromise: (() => Promise<void>) | null;
if (returnsPromise?.()) {
}
    `,
      `
declare const returnsPromise: { call: () => Promise<void> } | null;
if (returnsPromise?.call()) {
}
    `,
      "Promise.resolve() ?? false;",
      `
function test(a: Promise<void> | undefinded) {
  const foo = a ?? Promise.reject();
}
    `,
      `
function test(p: Promise<boolean> | undefined, bool: boolean) {
  if (p ?? bool) {
  }
}
    `,
      `
async function test(p: Promise<boolean | undefined>, bool: boolean) {
  if ((await p) ?? bool) {
  }
}
    `,
      `
async function test(p: Promise<boolean> | undefined) {
  if (await (p ?? Promise.reject())) {
  }
}
    `,
      `
let f;
f = async () => 10;
    `,
      `
let f: () => Promise<void>;
f = async () => 10;
const g = async () => 0;
const h: () => Promise<void> = async () => 10;
    `,
      `
const obj = {
  f: async () => 10,
};
    `,
      `
const f = async () => 123;
const obj = {
  f,
};
    `,
      `
const obj = {
  async f() {
    return 0;
  },
};
    `,
      `
type O = { f: () => Promise<void>; g: () => Promise<void> };
const g = async () => 0;
const obj: O = {
  f: async () => 10,
  g,
};
    `,
      `
type O = { f: () => Promise<void> };
const name = 'f';
const obj: O = {
  async [name]() {
    return 10;
  },
};
    `,
      `
const obj: number = {
  g() {
    return 10;
  },
};
    `,
      `
const obj = {
  f: async () => 'foo',
  async g() {
    return 0;
  },
};
    `,
      `
function f() {
  return async () => 0;
}
function g() {
  return;
}
    `,
      {
        tsx: true,
        code: `
type O = {
  bool: boolean;
  func: () => Promise<void>;
};
const Component = (obj: O) => null;
<Component bool func={async () => 10} />;
      `,
      },
      {
        tsx: true,
        code: `
const Component: any = () => null;
<Component func={async () => 10} />;
      `,
      },
      {
        code: `
interface ItLike {
  (name: string, callback: () => Promise<void>): void;
  (name: string, callback: () => void): void;
}

declare const it: ItLike;

it('', async () => {});
      `,
      },
      {
        code: `
interface ItLike {
  (name: string, callback: () => void): void;
  (name: string, callback: () => Promise<void>): void;
}

declare const it: ItLike;

it('', async () => {});
      `,
      },
      {
        code: `
interface ItLike {
  (name: string, callback: () => void): void;
}
interface ItLike {
  (name: string, callback: () => Promise<void>): void;
}

declare const it: ItLike;

it('', async () => {});
      `,
      },
      {
        code: `
interface ItLike {
  (name: string, callback: () => Promise<void>): void;
}
interface ItLike {
  (name: string, callback: () => void): void;
}

declare const it: ItLike;

it('', async () => {});
      `,
      },
      {
        tsx: true,
        code: `
interface Props {
  onEvent: (() => void) | (() => Promise<void>);
}

declare function Component(props: Props): any;

const _ = <Component onEvent={async () => {}} />;
      `,
      },
      `
console.log({ ...(await Promise.resolve({ key: 42 })) });
    `,
      `
const getData = () => Promise.resolve({ key: 42 });

console.log({
  someData: 42,
  ...(await getData()),
});
    `,
      `
declare const condition: boolean;

console.log({ ...(condition && (await Promise.resolve({ key: 42 }))) });
console.log({ ...(condition || (await Promise.resolve({ key: 42 }))) });
console.log({ ...(condition ? {} : await Promise.resolve({ key: 42 })) });
console.log({ ...(condition ? await Promise.resolve({ key: 42 }) : {}) });
    `,
      `
console.log([...(await Promise.resolve(42))]);
    `,
      {
        options: { checksSpreads: false },
        code: `
console.log({ ...Promise.resolve({ key: 42 }) });
      `,
      },
      {
        options: { checksSpreads: false },
        code: `
const getData = () => Promise.resolve({ key: 42 });

console.log({
  someData: 42,
  ...getData(),
});
      `,
      },
      {
        options: { checksSpreads: false },
        code: `
declare const condition: boolean;

console.log({ ...(condition && Promise.resolve({ key: 42 })) });
console.log({ ...(condition || Promise.resolve({ key: 42 })) });
console.log({ ...(condition ? {} : Promise.resolve({ key: 42 })) });
console.log({ ...(condition ? Promise.resolve({ key: 42 }) : {}) });
      `,
      },
      {
        options: { checksSpreads: false },
        code: `
// This is invalid Typescript, but it shouldn't trigger this linter specifically
console.log([...Promise.resolve(42)]);
      `,
      },
      `
function spreadAny(..._args: any): void {}

spreadAny(
  true,
  () => Promise.resolve(1),
  () => Promise.resolve(false),
);
    `,
      `
function spreadArrayAny(..._args: Array<any>): void {}

spreadArrayAny(
  true,
  () => Promise.resolve(1),
  () => Promise.resolve(false),
);
    `,
      `
function spreadArrayUnknown(..._args: Array<unknown>): void {}

spreadArrayUnknown(() => Promise.resolve(true), 1, 2);

function spreadArrayFuncPromise(
  ..._args: Array<() => Promise<undefined>>
): void {}

spreadArrayFuncPromise(
  () => Promise.resolve(undefined),
  () => Promise.resolve(undefined),
);
    `, // Prettier adds a () but this tests arguments being undefined, not []
      // eslint-disable-next-line @typescript-eslint/internal/plugin-test-formatting
      `
class TakeCallbacks {
  constructor(...callbacks: Array<() => void>) {}
}

new TakeCallbacks;
new TakeCallbacks();
new TakeCallbacks(
  () => 1,
  () => true,
);
    `,
      `
class Foo {
  public static doThing(): void {}
}

class Bar extends Foo {
  public async doThing(): Promise<void> {}
}
    `,
      `
class Foo {
  public doThing(): void {}
}

class Bar extends Foo {
  public static async doThing(): Promise<void> {}
}
    `,
      `
class Foo {
  public doThing = (): void => {};
}

class Bar extends Foo {
  public static doThing = async (): Promise<void> => {};
}
    `,
      `
function restTuple(...args: []): void;
function restTuple(...args: [string]): void;
function restTuple(..._args: string[]): void {}

restTuple();
restTuple('Hello');
    `,
      `
      let value: Record<string, () => void>;
      value.sync = () => {};
    `,
      `
      type ReturnsRecord = () => Record<string, () => void>;

      const test: ReturnsRecord = () => {
        return { sync: () => {} };
      };
    `,
      `
      type ReturnsRecord = () => Record<string, () => void>;

      function sync() {}

      const test: ReturnsRecord = () => {
        return { sync };
      };
    `,
      `
      function withTextRecurser<Text extends string>(
        recurser: (text: Text) => void,
      ): (text: Text) => void {
        return (text: Text): void => {
          if (text.length) {
            return;
          }

          return recurser(node);
        };
      }
    `,
      `
declare function foo(cb: undefined | (() => void));
declare const bar: undefined | (() => void);
foo(bar);
    `, // https://github.com/typescript-eslint/typescript-eslint/issues/6637
      {
        options: { checksVoidReturn: { attributes: true } },
        tsx: true,
        code: `
        type OnSelectNodeFn = (node: string | null) => void;

        interface ASTViewerBaseProps {
          readonly onSelectNode?: OnSelectNodeFn;
        }

        declare function ASTViewer(props: ASTViewerBaseProps): null;
        declare const onSelectFn: OnSelectNodeFn;

        <ASTViewer onSelectNode={onSelectFn} />;
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
class MyClass {
  setThing(): void {
    return;
  }
}

class MySubclassExtendsMyClass extends MyClass {
  setThing(): void {
    return;
  }
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
class MyClass {
  async setThing(): Promise<void> {
    await Promise.resolve();
  }
}

class MySubclassExtendsMyClass extends MyClass {
  async setThing(): Promise<void> {
    await Promise.resolve();
  }
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: false } },
        code: `
class MyClass {
  setThing(): void {
    return;
  }
}

class MySubclassExtendsMyClass extends MyClass {
  async setThing(): Promise<void> {
    await Promise.resolve();
  }
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
class MyClass {
  setThing(): void {
    return;
  }
}

abstract class MyAbstractClassExtendsMyClass extends MyClass {
  abstract setThing(): void;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: false } },
        code: `
class MyClass {
  setThing(): void {
    return;
  }
}

abstract class MyAbstractClassExtendsMyClass extends MyClass {
  abstract setThing(): Promise<void>;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
class MyClass {
  setThing(): void {
    return;
  }
}

interface MyInterfaceExtendsMyClass extends MyClass {
  setThing(): void;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: false } },
        code: `
class MyClass {
  setThing(): void {
    return;
  }
}

interface MyInterfaceExtendsMyClass extends MyClass {
  setThing(): Promise<void>;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
abstract class MyAbstractClass {
  abstract setThing(): void;
}

class MySubclassExtendsMyAbstractClass extends MyAbstractClass {
  setThing(): void {
    return;
  }
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: false } },
        code: `
abstract class MyAbstractClass {
  abstract setThing(): void;
}

class MySubclassExtendsMyAbstractClass extends MyAbstractClass {
  async setThing(): Promise<void> {
    await Promise.resolve();
  }
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
abstract class MyAbstractClass {
  abstract setThing(): void;
}

abstract class MyAbstractSubclassExtendsMyAbstractClass extends MyAbstractClass {
  abstract setThing(): void;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: false } },
        code: `
abstract class MyAbstractClass {
  abstract setThing(): void;
}

abstract class MyAbstractSubclassExtendsMyAbstractClass extends MyAbstractClass {
  abstract setThing(): Promise<void>;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
abstract class MyAbstractClass {
  abstract setThing(): void;
}

interface MyInterfaceExtendsMyAbstractClass extends MyAbstractClass {
  setThing(): void;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: false } },
        code: `
abstract class MyAbstractClass {
  abstract setThing(): void;
}

interface MyInterfaceExtendsMyAbstractClass extends MyAbstractClass {
  setThing(): Promise<void>;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
interface MyInterface {
  setThing(): void;
}

interface MySubInterfaceExtendsMyInterface extends MyInterface {
  setThing(): void;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: false } },
        code: `
interface MyInterface {
  setThing(): void;
}

interface MySubInterfaceExtendsMyInterface extends MyInterface {
  setThing(): Promise<void>;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
interface MyInterface {
  setThing(): void;
}

class MyClassImplementsMyInterface implements MyInterface {
  setThing(): void {
    return;
  }
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: false } },
        code: `
interface MyInterface {
  setThing(): void;
}

class MyClassImplementsMyInterface implements MyInterface {
  async setThing(): Promise<void> {
    await Promise.resolve();
  }
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
interface MyInterface {
  setThing(): void;
}

abstract class MyAbstractClassImplementsMyInterface implements MyInterface {
  abstract setThing(): void;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: false } },
        code: `
interface MyInterface {
  setThing(): void;
}

abstract class MyAbstractClassImplementsMyInterface implements MyInterface {
  abstract setThing(): Promise<void>;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
type MyTypeLiteralsIntersection = { setThing(): void } & { thing: number };

class MyClass implements MyTypeLiteralsIntersection {
  thing = 1;
  setThing(): void {
    return;
  }
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: false } },
        code: `
type MyTypeLiteralsIntersection = { setThing(): void } & { thing: number };

class MyClass implements MyTypeLiteralsIntersection {
  thing = 1;
  async setThing(): Promise<void> {
    await Promise.resolve();
  }
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
type MyGenericType<IsAsync extends boolean = true> = IsAsync extends true
  ? { setThing(): Promise<void> }
  : { setThing(): void };

interface MyAsyncInterface extends MyGenericType {
  setThing(): Promise<void>;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: false } },
        code: `
type MyGenericType<IsAsync extends boolean = true> = IsAsync extends true
  ? { setThing(): Promise<void> }
  : { setThing(): void };

interface MyAsyncInterface extends MyGenericType<false> {
  setThing(): Promise<void>;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
interface MyInterface {
  setThing(): void;
}

interface MyOtherInterface {
  setThing(): void;
}

interface MyThirdInterface extends MyInterface, MyOtherInterface {
  setThing(): void;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
class MyClass {
  setThing(): void {
    return;
  }
}

class MyOtherClass {
  setThing(): void {
    return;
  }
}

interface MyInterface extends MyClass, MyOtherClass {
  setThing(): void;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
interface MyInterface {
  setThing(): void;
}

interface MyOtherInterface {
  setThing(): void;
}

class MyClass {
  setThing(): void {
    return;
  }
}

class MySubclass extends MyClass implements MyInterface, MyOtherInterface {
  setThing(): void {
    return;
  }
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
class MyClass {
  setThing(): void {
    return;
  }
}

const MyClassExpressionExtendsMyClass = class extends MyClass {
  setThing(): void {
    return;
  }
};
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
const MyClassExpression = class {
  setThing(): void {
    return;
  }
};

class MyClassExtendsMyClassExpression extends MyClassExpression {
  setThing(): void {
    return;
  }
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
const MyClassExpression = class {
  setThing(): void {
    return;
  }
};
type MyClassExpressionType = typeof MyClassExpression;

interface MyInterfaceExtendsMyClassExpression extends MyClassExpressionType {
  setThing(): void;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
interface MySyncCallSignatures {
  (): void;
  (arg: string): void;
}
interface MyAsyncInterface extends MySyncCallSignatures {
  (): Promise<void>;
  (arg: string): Promise<void>;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
interface MySyncConstructSignatures {
  new (): void;
  new (arg: string): void;
}
interface ThisIsADifferentIssue extends MySyncConstructSignatures {
  new (): Promise<void>;
  new (arg: string): Promise<void>;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
interface MySyncIndexSignatures {
  [key: string]: void;
  [key: number]: void;
}
interface ThisIsADifferentIssue extends MySyncIndexSignatures {
  [key: string]: Promise<void>;
  [key: number]: Promise<void>;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
interface MySyncInterfaceSignatures {
  (): void;
  (arg: string): void;
  new (): void;
  [key: string]: () => void;
  [key: number]: () => void;
}
interface MyAsyncInterface extends MySyncInterfaceSignatures {
  (): Promise<void>;
  (arg: string): Promise<void>;
  new (): Promise<void>;
  [key: string]: () => Promise<void>;
  [key: number]: () => Promise<void>;
}
      `,
      },
      {
        options: { checksVoidReturn: { inheritedMethods: true } },
        code: `
interface MyCall {
  (): void;
  (arg: string): void;
}

interface MyIndex {
  [key: string]: () => void;
  [key: number]: () => void;
}

interface MyConstruct {
  new (): void;
  new (arg: string): void;
}

interface MyMethods {
  doSyncThing(): void;
  doOtherSyncThing(): void;
  syncMethodProperty: () => void;
}
interface MyInterface extends MyCall, MyIndex, MyConstruct, MyMethods {
  (): void;
  (arg: string): void;
  new (): void;
  new (arg: string): void;
  [key: string]: () => void;
  [key: number]: () => void;
  doSyncThing(): void;
  doAsyncThing(): Promise<void>;
  syncMethodProperty: () => void;
}
      `,
      },
      "const notAFn1: string = '';",
      "const notAFn2: number = 1;",
      "const notAFn3: boolean = true;",
      "const notAFn4: { prop: 1 } = { prop: 1 };",
      "const notAFn5: {} = {};",
      `
const array: number[] = [1, 2, 3];
array.filter(a => a > 1);
    `,
      `
type ReturnsPromiseVoid = () => Promise<void>;
declare const useCallback: <T extends (...args: unknown[]) => unknown>(
  fn: T,
) => T;
useCallback<ReturnsPromiseVoid>(async () => {});
    `,
      `
type ReturnsVoid = () => void;
type ReturnsPromiseVoid = () => Promise<void>;
declare const useCallback: <T extends (...args: unknown[]) => unknown>(
  fn: T,
) => T;
useCallback<ReturnsVoid | ReturnsPromiseVoid>(async () => {});
    `,
    ],
    invalid: [
      {
        code: `
if (Promise.resolve()) {
}
      `,
        errors: [{ message: messages.conditional, line: 2 }],
      },
      {
        code: `
if (Promise.resolve()) {
} else if (Promise.resolve()) {
} else {
}
      `,
        errors: [
          { message: messages.conditional, line: 2 },
          { message: messages.conditional, line: 3 },
        ],
      },
      {
        code: "for (let i; Promise.resolve(); i++) {}",
        errors: [{ message: messages.conditional, line: 1 }],
      },
      {
        code: "do {} while (Promise.resolve());",
        errors: [{ message: messages.conditional, line: 1 }],
      },
      {
        code: "while (Promise.resolve()) {}",
        errors: [{ message: messages.conditional, line: 1 }],
      },
      {
        code: "Promise.resolve() ? 123 : 456;",
        errors: [{ message: messages.conditional, line: 1 }],
      },
      {
        code: `
if (!Promise.resolve()) {
}
      `,
        errors: [{ message: messages.conditional, line: 2 }],
      },
      {
        code: "Promise.resolve() || false;",
        errors: [{ message: messages.conditional, line: 1 }],
      },
      {
        code: `
[Promise.resolve(), Promise.reject()].forEach(async val => {
  await val;
});
      `,
        errors: [{ message: messages.voidReturnArgument, line: 2 }],
      },
      {
        code: `
new Promise(async (resolve, reject) => {
  await Promise.resolve();
  resolve();
});
      `,
        errors: [{ message: messages.voidReturnArgument, line: 2 }],
      },
      {
        code: `
const fnWithCallback = (arg: string, cb: (err: any, res: string) => void) => {
  cb(null, arg);
};

fnWithCallback('val', async (err, res) => {
  await res;
});
      `,
        errors: [{ message: messages.voidReturnArgument, line: 6 }],
      },
      {
        code: `
const fnWithCallback = (arg: string, cb: (err: any, res: string) => void) => {
  cb(null, arg);
};

fnWithCallback('val', (err, res) => Promise.resolve(res));
      `,
        errors: [{ message: messages.voidReturnArgument, line: 6 }],
      },
      {
        code: `
const fnWithCallback = (arg: string, cb: (err: any, res: string) => void) => {
  cb(null, arg);
};

fnWithCallback('val', (err, res) => {
  if (err) {
    return 'abc';
  } else {
    return Promise.resolve(res);
  }
});
      `,
        errors: [{ message: messages.voidReturnArgument, line: 6 }],
      },
      {
        code: `
const fnWithCallback:
  | ((arg: string, cb: (err: any, res: string) => void) => void)
  | null = (arg, cb) => {
  cb(null, arg);
};

fnWithCallback?.('val', (err, res) => Promise.resolve(res));
      `,
        errors: [{ message: messages.voidReturnArgument, line: 8 }],
      },
      {
        code: `
const fnWithCallback:
  | ((arg: string, cb: (err: any, res: string) => void) => void)
  | null = (arg, cb) => {
  cb(null, arg);
};

fnWithCallback('val', (err, res) => {
  if (err) {
    return 'abc';
  } else {
    return Promise.resolve(res);
  }
});
      `,
        errors: [{ message: messages.voidReturnArgument, line: 8 }],
      },
      {
        code: `
function test(bool: boolean, p: Promise<void>) {
  if (bool || p) {
  }
}
      `,
        errors: [{ message: messages.conditional, line: 3 }],
      },
      {
        code: `
function test(bool: boolean, p: Promise<void>) {
  if (bool && p) {
  }
}
      `,
        errors: [{ message: messages.conditional, line: 3 }],
      },
      {
        code: `
function test(a: any, p: Promise<void>) {
  if (a ?? p) {
  }
}
      `,
        errors: [{ message: messages.conditional, line: 3 }],
      },
      {
        code: `
function test(p: Promise<void> | undefined) {
  if (p ?? Promise.reject()) {
  }
}
      `,
        errors: [{ message: messages.conditional, line: 3 }],
      },
      {
        code: `
let f: () => void;
f = async () => {
  return 3;
};
      `,
        errors: [{ message: messages.voidReturnVariable, line: 3 }],
      },
      {
        options: { checksVoidReturn: { variables: true } },
        code: `
let f: () => void;
f = async () => {
  return 3;
};
      `,
        errors: [{ message: messages.voidReturnVariable, line: 3 }],
      },
      {
        code: `
const f: () => void = async () => {
  return 0;
};
const g = async () => 1,
  h: () => void = async () => {};
      `,
        errors: [
          { message: messages.voidReturnVariable, line: 2 },
          { message: messages.voidReturnVariable, line: 6 },
        ],
      },
      {
        code: `
const obj: {
  f?: () => void;
} = {};
obj.f = async () => {
  return 0;
};
      `,
        errors: [{ message: messages.voidReturnVariable, line: 5 }],
      },
      {
        code: `
type O = { f: () => void };
const obj: O = {
  f: async () => 'foo',
};
      `,
        errors: [
          {
            message: messages.voidReturnProperty,
            line: 4,
            column: 6,
            endLine: 4,
            endColumn: 11,
          },
        ],
      },
      {
        options: { checksVoidReturn: { properties: true } },
        code: `
type O = { f: () => void };
const obj: O = {
  f: async () => 'foo',
};
      `,
        errors: [
          {
            message: messages.voidReturnProperty,
            line: 4,
            column: 6,
            endLine: 4,
            endColumn: 11,
          },
        ],
      },
      {
        code: `
type O = { f: () => void };
const f = async () => 0;
const obj: O = {
  f,
};
      `,
        errors: [{ message: messages.voidReturnProperty, line: 5 }],
      },
      {
        code: `
type O = { f: () => void };
const obj: O = {
  async f() {
    return 0;
  },
};
      `,
        errors: [
          {
            message: messages.voidReturnProperty,
            line: 4,
            column: 3,
            endLine: 4,
            endColumn: 8,
          },
        ],
      },
      {
        code: `
type O = { f: () => void; g: () => void; h: () => void };
function f(): O {
  const h = async () => 0;
  return {
    async f() {
      return 123;
    },
    g: async () => 0,
    h,
  };
}
      `,
        errors: [
          {
            message: messages.voidReturnProperty,
            line: 6,
            column: 5,
            endLine: 6,
            endColumn: 10,
          },
          {
            message: messages.voidReturnProperty,
            line: 9,
            column: 8,
            endLine: 9,
            endColumn: 13,
          },
          {
            message: messages.voidReturnProperty,
            line: 10,
            column: 5,
            endLine: 10,
            endColumn: 6,
          },
        ],
      },
      {
        code: `
function f(): () => void {
  return async () => 0;
}
      `,
        errors: [{ message: messages.voidReturnReturnValue, line: 3 }],
      },
      {
        options: { checksVoidReturn: { returns: true } },
        code: `
function f(): () => void {
  return async () => 0;
}
      `,
        errors: [{ message: messages.voidReturnReturnValue, line: 3 }],
      },
      {
        tsx: true,
        code: `
type O = {
  func: () => void;
};
const Component = (obj: O) => null;
<Component func={async () => 0} />;
      `,
        errors: [{ message: messages.voidReturnAttribute, line: 6 }],
      },
      {
        options: { checksVoidReturn: { attributes: true } },
        tsx: true,
        code: `
type O = {
  func: () => void;
};
const Component = (obj: O) => null;
<Component func={async () => 0} />;
      `,
        errors: [{ message: messages.voidReturnAttribute, line: 6 }],
      },
      {
        tsx: true,
        code: `
type O = {
  func: () => void;
};
const g = async () => 'foo';
const Component = (obj: O) => null;
<Component func={g} />;
      `,
        errors: [{ message: messages.voidReturnAttribute, line: 7 }],
      },
      {
        code: `
interface ItLike {
  (name: string, callback: () => number): void;
  (name: string, callback: () => void): void;
}

declare const it: ItLike;

it('', async () => {});
      `,
        errors: [{ message: messages.voidReturnArgument, line: 9 }],
      },
      {
        code: `
interface ItLike {
  (name: string, callback: () => number): void;
}
interface ItLike {
  (name: string, callback: () => void): void;
}

declare const it: ItLike;

it('', async () => {});
      `,
        errors: [{ message: messages.voidReturnArgument, line: 11 }],
      },
      {
        code: `
interface ItLike {
  (name: string, callback: () => void): void;
}
interface ItLike {
  (name: string, callback: () => number): void;
}

declare const it: ItLike;

it('', async () => {});
      `,
        errors: [{ message: messages.voidReturnArgument, line: 11 }],
      },
      {
        code: `
console.log({ ...Promise.resolve({ key: 42 }) });
      `,
        errors: [{ message: messages.spread, line: 2 }],
      },
      {
        code: `
const getData = () => Promise.resolve({ key: 42 });

console.log({
  someData: 42,
  ...getData(),
});
      `,
        errors: [{ message: messages.spread, line: 6 }],
      },
      {
        code: `
declare const condition: boolean;

console.log({ ...(condition && Promise.resolve({ key: 42 })) });
console.log({ ...(condition || Promise.resolve({ key: 42 })) });
console.log({ ...(condition ? {} : Promise.resolve({ key: 42 })) });
console.log({ ...(condition ? Promise.resolve({ key: 42 }) : {}) });
      `,
        errors: [
          { message: messages.spread, line: 4 },
          { message: messages.spread, line: 5 },
          { message: messages.spread, line: 6 },
          { message: messages.spread, line: 7 },
        ],
      },
      {
        code: `
function restPromises(first: Boolean, ...callbacks: Array<() => void>): void {}

restPromises(
  true,
  () => Promise.resolve(true),
  () => Promise.resolve(null),
  () => true,
  () => Promise.resolve('Hello'),
);
      `,
        errors: [
          { message: messages.voidReturnArgument, line: 6 },
          { message: messages.voidReturnArgument, line: 7 },
          { message: messages.voidReturnArgument, line: 9 },
        ],
      },
      {
        code: `
type MyUnion = (() => void) | boolean;

function restUnion(first: string, ...callbacks: Array<MyUnion>): void {}
restUnion('Testing', false, () => Promise.resolve(true));
      `,
        errors: [{ message: messages.voidReturnArgument, line: 5 }],
      },
      {
        code: `
function restTupleOne(first: string, ...callbacks: [() => void]): void {}
restTupleOne('My string', () => Promise.resolve(1));
      `,
        errors: [{ message: messages.voidReturnArgument, line: 3 }],
      },
      {
        code: `
function restTupleTwo(
  first: boolean,
  ...callbacks: [undefined, () => void, undefined]
): void {}

restTupleTwo(true, undefined, () => Promise.resolve(true), undefined);
      `,
        errors: [{ message: messages.voidReturnArgument, line: 7 }],
      },
      {
        code: `
function restTupleFour(
  first: number,
  ...callbacks: [() => void, boolean, () => void, () => void]
): void;

restTupleFour(
  1,
  () => Promise.resolve(true),
  false,
  () => {},
  () => Promise.resolve(1),
);
      `,
        errors: [
          { message: messages.voidReturnArgument, line: 9 },
          { message: messages.voidReturnArgument, line: 12 },
        ],
      },
      {
        // Prettier adds a () but this tests arguments being undefined, not []
        // eslint-disable-next-line @typescript-eslint/internal/plugin-test-formatting
        code: `
class TakesVoidCb {
  constructor(first: string, ...args: Array<() => void>);
}

new TakesVoidCb;
new TakesVoidCb();
new TakesVoidCb(
  'Testing',
  () => {},
  () => Promise.resolve(true),
);
      `,
        errors: [{ message: messages.voidReturnArgument, line: 11 }],
      },
      {
        code: `
function restTuple(...args: []): void;
function restTuple(...args: [boolean, () => void]): void;
function restTuple(..._args: any[]): void {}

restTuple();
restTuple(true, () => Promise.resolve(1));
      `,
        errors: [{ message: messages.voidReturnArgument, line: 7 }],
      },
      {
        code: `
type ReturnsRecord = () => Record<string, () => void>;

const test: ReturnsRecord = () => {
  return { asynchronous: async () => {} };
};
      `,
        errors: [
          {
            message: messages.voidReturnProperty,
            line: 5,
            column: 26,
            endLine: 5,
            endColumn: 31,
          },
        ],
      },
      {
        code: `
let value: Record<string, () => void>;
value.asynchronous = async () => {};
      `,
        errors: [{ message: messages.voidReturnVariable, line: 3 }],
      },
      {
        code: `
type ReturnsRecord = () => Record<string, () => void>;

async function asynchronous() {}

const test: ReturnsRecord = () => {
  return { asynchronous };
};
      `,
        errors: [{ message: messages.voidReturnProperty, line: 7 }],
      },
      {
        code: `
declare function foo(cb: undefined | (() => void));
declare const bar: undefined | (() => Promise<void>);
foo(bar);
      `,
        errors: [{ message: messages.voidReturnArgument, line: 4 }],
      },
      {
        code: `
declare function foo(cb: string & (() => void));
declare const bar: string & (() => Promise<void>);
foo(bar);
      `,
        errors: [{ message: messages.voidReturnArgument, line: 4 }],
      },
      {
        code: `
function consume(..._callbacks: Array<() => void>): void {}
let cbs: Array<() => Promise<boolean>> = [
  () => Promise.resolve(true),
  () => Promise.resolve(true),
];
consume(...cbs);
      `,
        errors: [{ message: messages.voidReturnArgument, line: 7 }],
      },
      {
        code: `
function consume(..._callbacks: Array<() => void>): void {}
let cbs = [() => Promise.resolve(true), () => Promise.resolve(true)] as const;
consume(...cbs);
      `,
        errors: [{ message: messages.voidReturnArgument, line: 4 }],
      },
      {
        code: `
function consume(..._callbacks: Array<() => void>): void {}
let cbs = [() => Promise.resolve(true), () => Promise.resolve(true)];
consume(...cbs);
      `,
        errors: [{ message: messages.voidReturnArgument, line: 4 }],
      },
      {
        code: `
class MyClass {
  setThing(): void {
    return;
  }
}

class MySubclassExtendsMyClass extends MyClass {
  async setThing(): Promise<void> {
    await Promise.resolve();
  }
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyClass",
            }),
            line: 9,
          },
        ],
      },
      {
        code: `
class MyClass {
  setThing(): void {
    return;
  }
}

abstract class MyAbstractClassExtendsMyClass extends MyClass {
  abstract setThing(): Promise<void>;
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyClass",
            }),
            line: 9,
          },
        ],
      },
      {
        code: `
class MyClass {
  setThing(): void {
    return;
  }
}

interface MyInterfaceExtendsMyClass extends MyClass {
  setThing(): Promise<void>;
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyClass",
            }),
            line: 9,
          },
        ],
      },
      {
        code: `
abstract class MyAbstractClass {
  abstract setThing(): void;
}

class MySubclassExtendsMyAbstractClass extends MyAbstractClass {
  async setThing(): Promise<void> {
    await Promise.resolve();
  }
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyAbstractClass",
            }),
            line: 7,
          },
        ],
      },
      {
        code: `
abstract class MyAbstractClass {
  abstract setThing(): void;
}

abstract class MyAbstractSubclassExtendsMyAbstractClass extends MyAbstractClass {
  abstract setThing(): Promise<void>;
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyAbstractClass",
            }),
            line: 7,
          },
        ],
      },
      {
        code: `
abstract class MyAbstractClass {
  abstract setThing(): void;
}

interface MyInterfaceExtendsMyAbstractClass extends MyAbstractClass {
  setThing(): Promise<void>;
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyAbstractClass",
            }),
            line: 7,
          },
        ],
      },
      {
        code: `
interface MyInterface {
  setThing(): void;
}

class MyInterfaceSubclass implements MyInterface {
  async setThing(): Promise<void> {
    await Promise.resolve();
  }
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyInterface",
            }),
            line: 7,
          },
        ],
      },
      {
        code: `
interface MyInterface {
  setThing(): void;
}

abstract class MyAbstractClassImplementsMyInterface implements MyInterface {
  abstract setThing(): Promise<void>;
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyInterface",
            }),
            line: 7,
          },
        ],
      },
      {
        code: `
interface MyInterface {
  setThing(): void;
}

interface MySubInterface extends MyInterface {
  setThing(): Promise<void>;
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyInterface",
            }),
            line: 7,
          },
        ],
      },
      {
        code: `
type MyTypeIntersection = { setThing(): void } & { thing: number };

class MyClassImplementsMyTypeIntersection implements MyTypeIntersection {
  thing = 1;
  async setThing(): Promise<void> {
    await Promise.resolve();
  }
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyTypeIntersection",
            }),
            line: 6,
          },
        ],
      },
      {
        code: `
type MyGenericType<IsAsync extends boolean = true> = IsAsync extends true
  ? { setThing(): Promise<void> }
  : { setThing(): void };

interface MyAsyncInterface extends MyGenericType<false> {
  setThing(): Promise<void>;
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "{ setThing(): void; }",
            }),
            line: 7,
          },
        ],
      },
      {
        code: `
interface MyInterface {
  setThing(): void;
}

interface MyOtherInterface {
  setThing(): void;
}

interface MyThirdInterface extends MyInterface, MyOtherInterface {
  setThing(): Promise<void>;
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyInterface",
            }),
            line: 11,
          },
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyOtherInterface",
            }),
            line: 11,
          },
        ],
      },
      {
        code: `
class MyClass {
  setThing(): void {
    return;
  }
}

class MyOtherClass {
  setThing(): void {
    return;
  }
}

interface MyInterface extends MyClass, MyOtherClass {
  setThing(): Promise<void>;
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyClass",
            }),
            line: 15,
          },
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyOtherClass",
            }),
            line: 15,
          },
        ],
      },
      {
        code: `
interface MyAsyncInterface {
  setThing(): Promise<void>;
}

interface MySyncInterface {
  setThing(): void;
}

class MyClass {
  setThing(): void {
    return;
  }
}

class MySubclass extends MyClass implements MyAsyncInterface, MySyncInterface {
  async setThing(): Promise<void> {
    await Promise.resolve();
  }
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyClass",
            }),
            line: 17,
          },
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MySyncInterface",
            }),
            line: 17,
          },
        ],
      },
      {
        code: `
interface MyInterface {
  setThing(): void;
}

const MyClassExpressionExtendsMyClass = class implements MyInterface {
  setThing(): Promise<void> {
    await Promise.resolve();
  }
};
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyInterface",
            }),
            line: 7,
          },
        ],
      },
      {
        code: `
const MyClassExpression = class {
  setThing(): void {
    return;
  }
};

class MyClassExtendsMyClassExpression extends MyClassExpression {
  async setThing(): Promise<void> {
    await Promise.resolve();
  }
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyClassExpression",
            }),
            line: 9,
          },
        ],
      },
      {
        code: `
const MyClassExpression = class {
  setThing(): void {
    return;
  }
};
type MyClassExpressionType = typeof MyClassExpression;

interface MyInterfaceExtendsMyClassExpression extends MyClassExpressionType {
  setThing(): Promise<void>;
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "typeof MyClassExpression",
            }),
            line: 10,
          },
        ],
      },
      {
        code: `
interface MySyncInterface {
  (): void;
  (arg: string): void;
  new (): void;
  [key: string]: () => void;
  [key: number]: () => void;
  myMethod(): void;
}
interface MyAsyncInterface extends MySyncInterface {
  (): Promise<void>;
  (arg: string): Promise<void>;
  new (): Promise<void>;
  [key: string]: () => Promise<void>;
  [key: number]: () => Promise<void>;
  myMethod(): Promise<void>;
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MySyncInterface",
            }),
            line: 16,
          },
        ],
      },
      {
        code: `
interface MyCall {
  (): void;
  (arg: string): void;
}

interface MyIndex {
  [key: string]: () => void;
  [key: number]: () => void;
}

interface MyConstruct {
  new (): void;
  new (arg: string): void;
}

interface MyMethods {
  doSyncThing(): void;
  doOtherSyncThing(): void;
  syncMethodProperty: () => void;
}
interface MyInterface extends MyCall, MyIndex, MyConstruct, MyMethods {
  (): void;
  (arg: string): Promise<void>;
  new (): void;
  new (arg: string): void;
  [key: string]: () => Promise<void>;
  [key: number]: () => void;
  doSyncThing(): Promise<void>;
  doAsyncThing(): Promise<void>;
  syncMethodProperty: () => Promise<void>;
}
      `,
        errors: [
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyMethods",
            }),
            line: 29,
          },
          {
            message: messages.voidReturnInheritedMethod({
              heritageTypeName: "MyMethods",
            }),
            line: 31,
          },
        ],
      },
      {
        code: `
declare function isTruthy(value: unknown): Promise<boolean>;
[0, 1, 2].filter(isTruthy);
      `,
        errors: [{ message: messages.predicate, line: 3 }],
      },
      {
        code: `
const array: number[] = [];
array.every(() => Promise.resolve(true));
      `,
        errors: [{ message: messages.predicate, line: 3 }],
      },
      {
        code: `
const array: (string[] & { foo: 'bar' }) | (number[] & { bar: 'foo' }) = [];
array.every(() => Promise.resolve(true));
      `,
        errors: [{ message: messages.predicate, line: 3 }],
      },
      {
        options: { checksConditionals: true },
        code: `
const tuple: [number, number, number] = [1, 2, 3];
tuple.find(() => Promise.resolve(false));
      `,
        errors: [{ message: messages.predicate, line: 3 }],
      },
      {
        code: `
type ReturnsVoid = () => void;
declare const useCallback: <T extends (...args: unknown[]) => unknown>(
  fn: T,
) => T;
declare const useCallbackReturningVoid: typeof useCallback<ReturnsVoid>;
useCallbackReturningVoid(async () => {});
      `,
        errors: [{ message: messages.voidReturnArgument, line: 7 }],
      },
      {
        code: `
type ReturnsVoid = () => void;
declare const useCallback: <T extends (...args: unknown[]) => unknown>(
  fn: T,
) => T;
useCallback<ReturnsVoid>(async () => {});
      `,
        errors: [{ message: messages.voidReturnArgument, line: 6 }],
      },
      {
        code: `
interface Foo<T> {
  (callback: () => T): void;
  (callback: () => number): void;
}
declare const foo: Foo<void>;

foo(async () => {});
      `,
        errors: [{ message: messages.voidReturnArgument, line: 8 }],
      },
      {
        code: `
declare function tupleFn<T extends (...args: unknown[]) => unknown>(
  ...fns: [T, string, T]
): void;
tupleFn<() => void>(
  async () => {},
  'foo',
  async () => {},
);
      `,
        errors: [
          { message: messages.voidReturnArgument, line: 6 },
          { message: messages.voidReturnArgument, line: 8 },
        ],
      },
      {
        code: `
declare function arrayFn<T extends (...args: unknown[]) => unknown>(
  ...fns: (T | string)[]
): void;
arrayFn<() => void>(
  async () => {},
  'foo',
  async () => {},
);
      `,
        errors: [
          { message: messages.voidReturnArgument, line: 6 },
          { message: messages.voidReturnArgument, line: 8 },
        ],
      },
      {
        code: `
type HasVoidMethod = {
  f(): void;
};

const o: HasVoidMethod = {
  async f() {
    return 3;
  },
};
        `,
        errors: [
          {
            message: messages.voidReturnProperty,
            line: 7,
            column: 3,
            endLine: 7,
            endColumn: 8,
          },
        ],
      },
      {
        code: `
type HasVoidMethod = {
  f(): void;
};
  
const o: HasVoidMethod = {
  async f(): Promise<number> {
    return 3;
  },
};
        `,
        errors: [
          {
            message: messages.voidReturnProperty,
            line: 7,
            column: 14,
            endLine: 7,
            endColumn: 29,
          },
        ],
      },
      {
        code: `
type HasVoidMethod = {
  f(): void;
};
const obj: HasVoidMethod = {
  f() {
    return Promise.resolve('foo');
  },
};
        `,
        errors: [
          {
            message: messages.voidReturnProperty,
            line: 6,
            column: 3,
            endLine: 8,
            endColumn: 4,
          },
        ],
      },
      {
        code: `
type HasVoidMethod = {
  f(): void;
};
const obj: HasVoidMethod = {
  f(): Promise<void> {
    throw new Error();
  },
};
        `,
        errors: [
          {
            message: messages.voidReturnProperty,
            line: 6,
            column: 8,
            endLine: 6,
            endColumn: 21,
          },
        ],
      },
      {
        code: `
type O = { f: () => void };
const asyncFunction = async () => 'foo';
const obj: O = {
  f: asyncFunction,
};
        `,
        errors: [
          {
            message: messages.voidReturnProperty,
            line: 5,
            column: 6,
            endLine: 5,
            endColumn: 19,
          },
        ],
      },
      {
        code: `
type O = { f: () => void };
const obj: O = {
  f: async (): Promise<string> => 'foo',
};
        `,
        errors: [
          {
            message: messages.voidReturnProperty,
            line: 4,
            column: 16,
            endLine: 4,
            endColumn: 31,
          },
        ],
      },
    ],
  });
