/* Credits: ts-api-utils, @typescript-eslint */
import ts, { SyntaxKind } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Infer } from "../types.ts";
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
          properties: true,
          returns: true,
          variables: true,
        };
      default:
        return {
          arguments: options?.checksVoidReturn.arguments ?? true,
          attributes: options?.checksVoidReturn.attributes ?? true,
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
      ? { SpreadAssignment: checkSpread }
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
  if (isAlwaysThenable(context, node)) {
    context.report({ node, message: messages.conditional });
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
    isVoidReturningFunctionType(context, node.initializer, contextualType) &&
    returnsThenable(context, node.initializer)
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
    isVoidReturningFunctionType(context, node.name, contextualType) &&
    returnsThenable(context, node.name)
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
    isVoidReturningFunctionType(context, node.expression, contextualType) &&
    returnsThenable(context, node.expression)
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
    context.report({ node: node.expression, message: messages.spread });
  }
}

function isSometimesThenable(context: Context, node: ts.Node): boolean {
  const type = context.checker.getTypeAtLocation(node);

  for (const subType of context.utils.unionTypeParts(
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
function isAlwaysThenable(context: Context, node: ts.Node): boolean {
  const type = context.checker.getTypeAtLocation(node);

  for (const subType of context.utils.unionTypeParts(
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
    for (const subType of context.utils.unionTypeParts(thenType)) {
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
  node: ts.Node,
): boolean {
  const type: ts.Type | undefined = context.checker.getApparentType(
    context.checker.getTypeOfSymbolAtLocation(param, node),
  );
  for (const subType of context.utils.unionTypeParts(type)) {
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
  } else if (isVoidReturningFunctionType(context, node.expression, type)) {
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

  for (const subType of context.utils.unionTypeParts(type)) {
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
        // Note - we currently do not support 'spread' arguments - adding support for them
        // is tracked in https://github.com/typescript-eslint/typescript-eslint/issues/5744
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
  for (const subType of context.utils.unionTypeParts(type)) {
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

  for (const subType of context.utils.unionTypeParts(type)) {
    for (const signature of subType.getCallSignatures()) {
      const returnType = signature.getReturnType();

      // If a certain positional argument accepts both thenable and void returns,
      // a promise-returning function is valid
      if (context.utils.isThenableType(node, returnType)) {
        return false;
      }

      hadVoidReturn ||= context.utils.isTypeFlagSet(
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
function returnsThenable(context: Context, node: ts.Node): boolean {
  const type = context.checker.getApparentType(
    context.checker.getTypeAtLocation(node),
  );

  if (anySignatureIsThenableType(context, node, type)) {
    return true;
  }

  return false;
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
        code: `
if (Promise.resolve()) {
}
      `,
        options: { checksConditionals: false },
      },
      `
if (true) {
} else if (false) {
} else {
}
    `,
      {
        code: `
if (Promise.resolve()) {
} else if (Promise.resolve()) {
} else {
}
      `,
        options: { checksConditionals: false },
      },
      "for (;;) {}",
      "for (let i; i < 10; i++) {}",
      {
        code: "for (let i; Promise.resolve(); i++) {}",
        options: { checksConditionals: false },
      },
      "do {} while (true);",
      {
        code: "do {} while (Promise.resolve());",
        options: { checksConditionals: false },
      },
      "while (true) {}",
      {
        code: "while (Promise.resolve()) {}",
        options: { checksConditionals: false },
      },
      "true ? 123 : 456;",
      {
        code: "Promise.resolve() ? 123 : 456;",
        options: { checksConditionals: false },
      },
      `
if (!true) {
}
    `,
      {
        code: `
if (!Promise.resolve()) {
}
      `,
        options: { checksConditionals: false },
      },
      "(await Promise.resolve()) || false;",
      {
        code: "Promise.resolve() || false;",
        options: { checksConditionals: false },
      },
      "(true && (await Promise.resolve())) || false;",
      {
        code: "(true && Promise.resolve()) || false;",
        options: { checksConditionals: false },
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
        code: "[1, 2, 3].forEach(async val => {});",
        options: { checksVoidReturn: false },
      },
      "new Promise((resolve, reject) => resolve());",
      {
        code: "new Promise(async (resolve, reject) => resolve());",
        options: { checksVoidReturn: false },
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
        code: `
console.log({ ...Promise.resolve({ key: 42 }) });
      `,
        options: { checksSpreads: false },
      },
      {
        code: `
const getData = () => Promise.resolve({ key: 42 });

console.log({
  someData: 42,
  ...getData(),
});
      `,
        options: { checksSpreads: false },
      },
      {
        code: `
declare const condition: boolean;

console.log({ ...(condition && Promise.resolve({ key: 42 })) });
console.log({ ...(condition || Promise.resolve({ key: 42 })) });
console.log({ ...(condition ? {} : Promise.resolve({ key: 42 })) });
console.log({ ...(condition ? Promise.resolve({ key: 42 }) : {}) });
      `,
        options: { checksSpreads: false },
      },
      {
        code: `
// This is invalid Typescript, but it shouldn't trigger this linter specifically
console.log([...Promise.resolve(42)]);
      `,
        options: { checksSpreads: false },
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
    `,
      // Prettier adds a () but this tests arguments being undefined, not []
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
      // https://github.com/typescript-eslint/typescript-eslint/issues/6637
      {
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
        options: { checksVoidReturn: { attributes: true } },
      },
    ],

    invalid: [
      {
        code: `
if (Promise.resolve()) {
}
      `,
        errors: [
          {
            line: 2,
            message: messages.conditional,
          },
        ],
      },
      {
        code: `
if (Promise.resolve()) {
} else if (Promise.resolve()) {
} else {
}
      `,
        errors: [
          {
            line: 2,
            message: messages.conditional,
          },
          {
            line: 3,
            message: messages.conditional,
          },
        ],
      },
      {
        code: "for (let i; Promise.resolve(); i++) {}",
        errors: [
          {
            line: 1,
            message: messages.conditional,
          },
        ],
      },
      {
        code: "do {} while (Promise.resolve());",
        errors: [
          {
            line: 1,
            message: messages.conditional,
          },
        ],
      },
      {
        code: "while (Promise.resolve()) {}",
        errors: [
          {
            line: 1,
            message: messages.conditional,
          },
        ],
      },
      {
        code: "Promise.resolve() ? 123 : 456;",
        errors: [
          {
            line: 1,
            message: messages.conditional,
          },
        ],
      },
      {
        code: `
if (!Promise.resolve()) {
}
      `,
        errors: [
          {
            line: 2,
            message: messages.conditional,
          },
        ],
      },
      {
        code: "Promise.resolve() || false;",
        errors: [
          {
            line: 1,
            message: messages.conditional,
          },
        ],
      },
      {
        code: `
[Promise.resolve(), Promise.reject()].forEach(async val => {
  await val;
});
      `,
        errors: [
          {
            line: 2,
            message: messages.voidReturnArgument,
          },
        ],
      },
      {
        code: `
new Promise(async (resolve, reject) => {
  await Promise.resolve();
  resolve();
});
      `,
        errors: [
          {
            line: 2,
            message: messages.voidReturnArgument,
          },
        ],
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
        errors: [
          {
            line: 6,
            message: messages.voidReturnArgument,
          },
        ],
      },
      {
        code: `
const fnWithCallback = (arg: string, cb: (err: any, res: string) => void) => {
  cb(null, arg);
};

fnWithCallback('val', (err, res) => Promise.resolve(res));
      `,
        errors: [
          {
            line: 6,
            message: messages.voidReturnArgument,
          },
        ],
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
        errors: [
          {
            line: 6,
            message: messages.voidReturnArgument,
          },
        ],
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
        errors: [
          {
            line: 8,
            message: messages.voidReturnArgument,
          },
        ],
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
        errors: [
          {
            line: 8,
            message: messages.voidReturnArgument,
          },
        ],
      },
      {
        code: `
function test(bool: boolean, p: Promise<void>) {
  if (bool || p) {
  }
}
      `,
        errors: [
          {
            line: 3,
            message: messages.conditional,
          },
        ],
      },
      {
        code: `
function test(bool: boolean, p: Promise<void>) {
  if (bool && p) {
  }
}
      `,
        errors: [
          {
            line: 3,
            message: messages.conditional,
          },
        ],
      },
      {
        code: `
function test(a: any, p: Promise<void>) {
  if (a ?? p) {
  }
}
      `,
        errors: [
          {
            line: 3,
            message: messages.conditional,
          },
        ],
      },
      {
        code: `
function test(p: Promise<void> | undefined) {
  if (p ?? Promise.reject()) {
  }
}
      `,
        errors: [
          {
            line: 3,
            message: messages.conditional,
          },
        ],
      },
      {
        code: `
let f: () => void;
f = async () => {
  return 3;
};
      `,
        errors: [
          {
            line: 3,
            message: messages.voidReturnVariable,
          },
        ],
      },
      {
        code: `
let f: () => void;
f = async () => {
  return 3;
};
      `,
        errors: [
          {
            line: 3,
            message: messages.voidReturnVariable,
          },
        ],
        options: { checksVoidReturn: { variables: true } },
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
          {
            line: 2,
            message: messages.voidReturnVariable,
          },
          {
            line: 6,
            message: messages.voidReturnVariable,
          },
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
        errors: [
          {
            line: 5,
            message: messages.voidReturnVariable,
          },
        ],
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
            line: 4,
            message: messages.voidReturnProperty,
          },
        ],
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
            line: 4,
            message: messages.voidReturnProperty,
          },
        ],
        options: { checksVoidReturn: { properties: true } },
      },
      {
        code: `
type O = { f: () => void };
const f = async () => 0;
const obj: O = {
  f,
};
      `,
        errors: [
          {
            line: 5,
            message: messages.voidReturnProperty,
          },
        ],
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
            line: 4,
            message: messages.voidReturnProperty,
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
            line: 6,
            message: messages.voidReturnProperty,
          },
          {
            line: 9,
            message: messages.voidReturnProperty,
          },
          {
            line: 10,
            message: messages.voidReturnProperty,
          },
        ],
      },
      {
        code: `
function f(): () => void {
  return async () => 0;
}
      `,
        errors: [
          {
            line: 3,
            message: messages.voidReturnReturnValue,
          },
        ],
      },
      {
        code: `
function f(): () => void {
  return async () => 0;
}
      `,
        errors: [
          {
            line: 3,
            message: messages.voidReturnReturnValue,
          },
        ],
        options: { checksVoidReturn: { returns: true } },
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
        errors: [
          {
            line: 6,
            message: messages.voidReturnAttribute,
          },
        ],
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

        errors: [
          {
            line: 6,
            message: messages.voidReturnAttribute,
          },
        ],
        options: { checksVoidReturn: { attributes: true } },
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
        errors: [
          {
            line: 7,
            message: messages.voidReturnAttribute,
          },
        ],
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
        errors: [
          {
            line: 9,
            message: messages.voidReturnArgument,
          },
        ],
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
        errors: [
          {
            line: 11,
            message: messages.voidReturnArgument,
          },
        ],
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
        errors: [
          {
            line: 11,
            message: messages.voidReturnArgument,
          },
        ],
      },
      {
        code: `
console.log({ ...Promise.resolve({ key: 42 }) });
      `,
        errors: [
          {
            line: 2,
            message: messages.spread,
          },
        ],
      },
      {
        code: `
const getData = () => Promise.resolve({ key: 42 });

console.log({
  someData: 42,
  ...getData(),
});
      `,
        errors: [
          {
            line: 6,
            message: messages.spread,
          },
        ],
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
          { line: 4, message: messages.spread },
          { line: 5, message: messages.spread },
          { line: 6, message: messages.spread },
          { line: 7, message: messages.spread },
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
          { line: 6, message: messages.voidReturnArgument },
          { line: 7, message: messages.voidReturnArgument },
          { line: 9, message: messages.voidReturnArgument },
        ],
      },
      {
        code: `
type MyUnion = (() => void) | boolean;

function restUnion(first: string, ...callbacks: Array<MyUnion>): void {}
restUnion('Testing', false, () => Promise.resolve(true));
      `,
        errors: [{ line: 5, message: messages.voidReturnArgument }],
      },
      {
        code: `
function restTupleOne(first: string, ...callbacks: [() => void]): void {}
restTupleOne('My string', () => Promise.resolve(1));
      `,
        errors: [{ line: 3, message: messages.voidReturnArgument }],
      },
      {
        code: `
function restTupleTwo(
  first: boolean,
  ...callbacks: [undefined, () => void, undefined]
): void {}

restTupleTwo(true, undefined, () => Promise.resolve(true), undefined);
      `,
        errors: [{ line: 7, message: messages.voidReturnArgument }],
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
          { line: 9, message: messages.voidReturnArgument },
          { line: 12, message: messages.voidReturnArgument },
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
        errors: [{ line: 11, message: messages.voidReturnArgument }],
      },
      {
        code: `
function restTuple(...args: []): void;
function restTuple(...args: [boolean, () => void]): void;
function restTuple(..._args: any[]): void {}

restTuple();
restTuple(true, () => Promise.resolve(1));
      `,
        errors: [{ line: 7, message: messages.voidReturnArgument }],
      },
      {
        code: `
type ReturnsRecord = () => Record<string, () => void>;

const test: ReturnsRecord = () => {
  return { asynchronous: async () => {} };
};
      `,
        errors: [{ line: 5, message: messages.voidReturnProperty }],
      },
      {
        code: `
let value: Record<string, () => void>;
value.asynchronous = async () => {};
      `,
        errors: [{ line: 3, message: messages.voidReturnVariable }],
      },
      {
        code: `
type ReturnsRecord = () => Record<string, () => void>;

async function asynchronous() {}

const test: ReturnsRecord = () => {
  return { asynchronous };
};
      `,
        errors: [{ line: 7, message: messages.voidReturnProperty }],
      },
    ],
  });
