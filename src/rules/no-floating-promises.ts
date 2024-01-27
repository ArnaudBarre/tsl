import { unionTypeParts } from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Checker, Infer } from "../types.ts";
import { isLogicalExpression } from "../utils.ts";

const messageBase =
  "Promises must be awaited, end with a call to .catch, or end with a call to .then with a rejection handler.";
const messageBaseVoid =
  "Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler" +
  " or be explicitly marked as ignored with the `void` operator.";
const messageRejectionHandler =
  "A rejection handler that is not a function will be ignored.";
const messagePromiseArray =
  "An array of Promises may be unintentional. Consider handling the promises' fulfillment or rejection with Promise.all or similar.";
const messagePromiseArrayVoid =
  "An array of Promises may be unintentional. Consider handling the promises' fulfillment or rejection with Promise.all or similar," +
  " or explicitly marking the expression as ignored with the `void` operator.";
const messages = {
  floating: messageBase,
  floatingFixAwait: "Add await operator.",
  floatingVoid: messageBaseVoid,
  floatingFixVoid: "Add void operator to ignore.",
  floatingUselessRejectionHandler: messageBase + " " + messageRejectionHandler,
  floatingUselessRejectionHandlerVoid:
    messageBaseVoid + " " + messageRejectionHandler,
  floatingPromiseArray: messagePromiseArray,
  floatingPromiseArrayVoid: messagePromiseArrayVoid,
};

type Context = Infer<typeof noFloatingPromises>["Context"];

export const noFloatingPromises = createRule({
  name: "no-floating-promises",
  parseOptions: (options?: { ignoreVoid?: boolean; ignoreIIFE?: boolean }) => ({
    ignoreVoid: true,
    ignoreIIFE: false,
    ...options,
  }),
  visitor: (options) => ({
    ExpressionStatement(node, context) {
      if (options.ignoreIIFE && isAsyncIife(node)) return;

      const { isUnhandled, nonFunctionHandler, promiseArray } =
        isUnhandledPromise(context.checker, node.expression, context);

      if (isUnhandled) {
        if (promiseArray) {
          context.report({
            node,
            message: options.ignoreVoid
              ? messages.floatingPromiseArrayVoid
              : messages.floatingPromiseArray,
          });
        } else if (options.ignoreVoid) {
          context.report({
            node,
            message: nonFunctionHandler
              ? messages.floatingUselessRejectionHandlerVoid
              : messages.floatingVoid,
          });
        } else {
          context.report({
            node,
            message: nonFunctionHandler
              ? messages.floatingUselessRejectionHandler
              : messages.floating,
          });
        }
      }
    },
  }),
});

function isAsyncIife(node: AST.ExpressionStatement): boolean {
  if (node.expression.kind !== SyntaxKind.CallExpression) {
    return false;
  }
  if (node.expression.expression.kind !== SyntaxKind.ParenthesizedExpression) {
    return false;
  }
  return (
    node.expression.expression.expression.kind === SyntaxKind.ArrowFunction ||
    node.expression.expression.expression.kind === SyntaxKind.FunctionExpression
  );
}

function isValidRejectionHandler(
  rejectionHandler: ts.Node,
  context: Context,
): boolean {
  return (
    context.checker.getTypeAtLocation(rejectionHandler).getCallSignatures()
      .length > 0
  );
}

function isUnhandledPromise(
  checker: Checker,
  node: AST.AnyNode,
  context: Context,
): {
  isUnhandled: boolean;
  nonFunctionHandler?: boolean;
  promiseArray?: boolean;
} {
  // First, check expressions whose resulting types may not be promise-like
  if (
    node.kind === SyntaxKind.BinaryExpression &&
    node.operatorToken.kind === SyntaxKind.CommaToken
  ) {
    // Any child in a comma expression could return a potentially unhandled
    // promise, so we check them all regardless of whether the final returned
    // value is promise-like.
    const leftResult = isUnhandledPromise(checker, node.left, context);
    if (leftResult.isUnhandled) {
      return leftResult;
    }
    return isUnhandledPromise(checker, node.right, context);
  }

  if (!context.options.ignoreVoid && node.kind === SyntaxKind.VoidExpression) {
    // Similarly, a `void` expression always returns undefined, so we need to
    // see what's inside it without checking the type of the overall expression.
    return isUnhandledPromise(checker, node.expression, context);
  }

  // Check the type. At this point it can't be unhandled if it isn't a promise
  // or array thereof.

  if (isPromiseArray(checker, node)) {
    return { isUnhandled: true, promiseArray: true };
  }

  if (!isPromiseLike(checker, node)) {
    return { isUnhandled: false };
  }

  if (node.kind === SyntaxKind.CallExpression) {
    // If the outer expression is a call, a `.catch()` or `.then()` with
    // rejection handler handles the promise.

    const catchRejectionHandler = getRejectionHandlerFromCatchCall(node);
    if (catchRejectionHandler) {
      if (isValidRejectionHandler(catchRejectionHandler, context)) {
        return { isUnhandled: false };
      }
      return { isUnhandled: true, nonFunctionHandler: true };
    }

    const thenRejectionHandler = getRejectionHandlerFromThenCall(node);
    if (thenRejectionHandler) {
      if (isValidRejectionHandler(thenRejectionHandler, context)) {
        return { isUnhandled: false };
      }
      return { isUnhandled: true, nonFunctionHandler: true };
    }

    // `x.finally()` is transparent to resolution of the promise, so check `x`.
    // ("object" in this context is the `x` in `x.finally()`)
    const promiseFinallyObject = getObjectFromFinallyCall(node);
    if (promiseFinallyObject) {
      return isUnhandledPromise(checker, promiseFinallyObject, context);
    }

    // All other cases are unhandled.
    return { isUnhandled: true };
  } else if (node.kind === SyntaxKind.ConditionalExpression) {
    // We must be getting the promise-like value from one of the branches of the
    // ternary. Check them directly.
    const alternateResult = isUnhandledPromise(
      checker,
      node.whenFalse,
      context,
    );
    if (alternateResult.isUnhandled) {
      return alternateResult;
    }
    return isUnhandledPromise(checker, node.whenTrue, context);
  } else if (
    node.kind === SyntaxKind.ElementAccessExpression ||
    node.kind === SyntaxKind.PropertyAccessExpression ||
    node.kind === SyntaxKind.Identifier ||
    node.kind === SyntaxKind.NewExpression
  ) {
    // If it is just a property access chain or a `new` call (e.g. `foo.bar` or
    // `new Promise()`), the promise is not handled because it doesn't have the
    // necessary then/catch call at the end of the chain.
    return { isUnhandled: true };
  } else if (
    node.kind === SyntaxKind.BinaryExpression &&
    isLogicalExpression(node.operatorToken)
  ) {
    const leftResult = isUnhandledPromise(checker, node.left, context);
    if (leftResult.isUnhandled) {
      return leftResult;
    }
    return isUnhandledPromise(checker, node.right, context);
  }

  // We conservatively return false for all other types of expressions because
  // we don't want to accidentally fail if the promise is handled internally but
  // we just can't tell.
  return { isUnhandled: false };
}

function isPromiseArray(checker: Checker, node: ts.Node): boolean {
  const type = checker.getTypeAtLocation(node);
  for (const ty of unionTypeParts(type).map((t) =>
    checker.getApparentType(t),
  )) {
    if (checker.isArrayType(ty)) {
      const arrayType = checker.getTypeArguments(ty)[0];
      if (isPromiseLike(checker, node, arrayType)) {
        return true;
      }
    }

    if (checker.isTupleType(ty)) {
      for (const tupleElementType of checker.getTypeArguments(ty)) {
        if (isPromiseLike(checker, node, tupleElementType)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Modified from tsutils.isThenable() to only consider thenables which can be
// rejected/caught via a second parameter. Original source (MIT licensed):
//
//   https://github.com/ajafff/tsutils/blob/49d0d31050b44b81e918eae4fbaf1dfe7b7286af/util/type.ts#L95-L125
function isPromiseLike(
  checker: Checker,
  node: ts.Node,
  type?: ts.Type,
): boolean {
  type ??= checker.getTypeAtLocation(node);
  for (const ty of unionTypeParts(checker.getApparentType(type))) {
    const then = ty.getProperty("then");
    if (then === undefined) {
      continue;
    }

    const thenType = checker.getTypeOfSymbolAtLocation(then, node);
    if (
      hasMatchingSignature(
        thenType,
        (signature) =>
          signature.parameters.length >= 2 &&
          isFunctionParam(checker, signature.parameters[0], node) &&
          isFunctionParam(checker, signature.parameters[1], node),
      )
    ) {
      return true;
    }
  }
  return false;
}

function hasMatchingSignature(
  type: ts.Type,
  matcher: (signature: ts.Signature) => boolean,
): boolean {
  for (const t of unionTypeParts(type)) {
    if (t.getCallSignatures().some(matcher)) {
      return true;
    }
  }

  return false;
}

function isFunctionParam(
  checker: Checker,
  param: ts.Symbol,
  node: ts.Node,
): boolean {
  const type: ts.Type | undefined = checker.getApparentType(
    checker.getTypeOfSymbolAtLocation(param, node),
  );
  for (const t of unionTypeParts(type)) {
    if (t.getCallSignatures().length !== 0) {
      return true;
    }
  }
  return false;
}

function getRejectionHandlerFromCatchCall(
  expression: AST.CallExpression,
): AST.Expression | undefined {
  if (
    expression.expression.kind === SyntaxKind.PropertyAccessExpression &&
    expression.expression.name.kind === SyntaxKind.Identifier &&
    expression.expression.name.text === "catch" &&
    expression.arguments.length >= 1
  ) {
    return expression.arguments[0];
  }
  return undefined;
}

function getRejectionHandlerFromThenCall(
  expression: AST.CallExpression,
): AST.Expression | undefined {
  if (
    expression.expression.kind === SyntaxKind.PropertyAccessExpression &&
    expression.expression.name.kind === SyntaxKind.Identifier &&
    expression.expression.name.text === "then" &&
    expression.arguments.length >= 2
  ) {
    return expression.arguments[1];
  }
  return undefined;
}

function getObjectFromFinallyCall(
  expression: AST.CallExpression,
): AST.LeftHandSideExpression | undefined {
  return expression.expression.kind === SyntaxKind.PropertyAccessExpression &&
    expression.expression.name.kind === SyntaxKind.Identifier &&
    expression.expression.name.text === "finally"
    ? expression.expression.expression
    : undefined;
}

/** Tests */

export const test = () =>
  ruleTester({
    rule: noFloatingPromises,
    valid: [
      `
async function test() {
  await Promise.resolve('value');
  Promise.resolve('value').then(
    () => {},
    () => {},
  );
  Promise.resolve('value')
    .then(() => {})
    .catch(() => {});
  Promise.resolve('value')
    .then(() => {})
    .catch(() => {})
    .finally(() => {});
  Promise.resolve('value').catch(() => {});
  return Promise.resolve('value');
}
    `,
      {
        options: { ignoreVoid: true },
        code: `
async function test() {
  void Promise.resolve('value');
}
      `,
      },
      `
async function test() {
  await Promise.reject(new Error('message'));
  Promise.reject(new Error('message')).then(
    () => {},
    () => {},
  );
  Promise.reject(new Error('message'))
    .then(() => {})
    .catch(() => {});
  Promise.reject(new Error('message'))
    .then(() => {})
    .catch(() => {})
    .finally(() => {});
  Promise.reject(new Error('message')).catch(() => {});
  return Promise.reject(new Error('message'));
}
    `,
      `
async function test() {
  await (async () => true)();
  (async () => true)().then(
    () => {},
    () => {},
  );
  (async () => true)()
    .then(() => {})
    .catch(() => {});
  (async () => true)()
    .then(() => {})
    .catch(() => {})
    .finally(() => {});
  (async () => true)().catch(() => {});
  return (async () => true)();
}
    `,
      `
async function test() {
  async function returnsPromise() {}
  await returnsPromise();
  returnsPromise().then(
    () => {},
    () => {},
  );
  returnsPromise()
    .then(() => {})
    .catch(() => {});
  returnsPromise()
    .then(() => {})
    .catch(() => {})
    .finally(() => {});
  returnsPromise().catch(() => {});
  return returnsPromise();
}
    `,
      `
async function test() {
  const x = Promise.resolve();
  const y = x.then(() => {});
  y.catch(() => {});
}
    `,
      `
async function test() {
  Math.random() > 0.5 ? Promise.resolve().catch(() => {}) : null;
}
    `,
      `
async function test() {
  Promise.resolve().catch(() => {}), 123;
  123,
    Promise.resolve().then(
      () => {},
      () => {},
    );
  123,
    Promise.resolve().then(
      () => {},
      () => {},
    ),
    123;
}
    `,
      `
async function test() {
  void Promise.resolve().catch(() => {});
}
    `,
      `
async function test() {
  Promise.resolve().catch(() => {}) ||
    Promise.resolve().then(
      () => {},
      () => {},
    );
}
    `,
      `
async function test() {
  declare const promiseValue: Promise<number>;

  await promiseValue;
  promiseValue.then(
    () => {},
    () => {},
  );
  promiseValue.then(() => {}).catch(() => {});
  promiseValue
    .then(() => {})
    .catch(() => {})
    .finally(() => {});
  promiseValue.catch(() => {});
  return promiseValue;
}
    `,
      `
async function test() {
  declare const promiseUnion: Promise<number> | number;

  await promiseUnion;
  promiseUnion.then(
    () => {},
    () => {},
  );
  promiseUnion.then(() => {}).catch(() => {});
  promiseUnion
    .then(() => {})
    .catch(() => {})
    .finally(() => {});
  promiseUnion.catch(() => {});
  promiseValue.finally(() => {});
  return promiseUnion;
}
    `,
      `
async function test() {
  declare const promiseIntersection: Promise<number> & number;

  await promiseIntersection;
  promiseIntersection.then(
    () => {},
    () => {},
  );
  promiseIntersection.then(() => {}).catch(() => {});
  promiseIntersection.catch(() => {});
  return promiseIntersection;
}
    `,
      `
async function test() {
  class CanThen extends Promise<number> {}
  const canThen: CanThen = Foo.resolve(2);

  await canThen;
  canThen.then(
    () => {},
    () => {},
  );
  canThen.then(() => {}).catch(() => {});
  canThen
    .then(() => {})
    .catch(() => {})
    .finally(() => {});
  canThen.catch(() => {});
  return canThen;
}
    `,
      `
async function test() {
  await (Math.random() > 0.5 ? numberPromise : 0);
  await (Math.random() > 0.5 ? foo : 0);
  await (Math.random() > 0.5 ? bar : 0);

  declare const intersectionPromise: Promise<number> & number;
  await intersectionPromise;
}
    `,
      `
async function test() {
  class Thenable {
    then(callback: () => void): Thenable {
      return new Thenable();
    }
  }
  const thenable = new Thenable();

  await thenable;
  thenable;
  thenable.then(() => {});
  return thenable;
}
    `,
      `
async function test() {
  class NonFunctionParamThenable {
    then(param: string, param2: number): NonFunctionParamThenable {
      return new NonFunctionParamThenable();
    }
  }
  const thenable = new NonFunctionParamThenable();

  await thenable;
  thenable;
  thenable.then('abc', 'def');
  return thenable;
}
    `,
      `
async function test() {
  class NonFunctionThenable {
    then: number;
  }
  const thenable = new NonFunctionThenable();

  thenable;
  thenable.then;
  return thenable;
}
    `,
      `
async function test() {
  class CatchableThenable {
    then(callback: () => void, callback: () => void): CatchableThenable {
      return new CatchableThenable();
    }
  }
  const thenable = new CatchableThenable();

  await thenable;
  return thenable;
}
    `,
      `
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/promise-polyfill/index.d.ts
// Type definitions for promise-polyfill 6.0
// Project: https://github.com/taylorhakes/promise-polyfill
// Definitions by: Steve Jenkins <https://github.com/skysteve>
//                 Daniel Cassidy <https://github.com/djcsdy>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

interface PromisePolyfillConstructor extends PromiseConstructor {
  _immediateFn?: (handler: (() => void) | string) => void;
}

declare const PromisePolyfill: PromisePolyfillConstructor;

async function test() {
  const promise = new PromisePolyfill(() => {});

  await promise;
  promise.then(
    () => {},
    () => {},
  );
  promise.then(() => {}).catch(() => {});
  promise
    .then(() => {})
    .catch(() => {})
    .finally(() => {});
  promise.catch(() => {});
  return promise;
}
    `,

      // optional chaining
      `
async function test() {
  declare const returnsPromise: () => Promise<void> | null;
  await returnsPromise?.();
  returnsPromise()?.then(
    () => {},
    () => {},
  );
  returnsPromise()
    ?.then(() => {})
    ?.catch(() => {});
  returnsPromise()?.catch(() => {});
  return returnsPromise();
}
    `,
      `
const doSomething = async (
  obj1: { a?: { b?: { c?: () => Promise<void> } } },
  obj2: { a?: { b?: { c: () => Promise<void> } } },
  obj3: { a?: { b: { c?: () => Promise<void> } } },
  obj4: { a: { b: { c?: () => Promise<void> } } },
  obj5: { a?: () => { b?: { c?: () => Promise<void> } } },
  obj6?: { a: { b: { c?: () => Promise<void> } } },
  callback?: () => Promise<void>,
): Promise<void> => {
  await obj1.a?.b?.c?.();
  await obj2.a?.b?.c();
  await obj3.a?.b.c?.();
  await obj4.a.b.c?.();
  await obj5.a?.().b?.c?.();
  await obj6?.a.b.c?.();

  return callback?.();
};

void doSomething();
    `,
      // ignoreIIFE
      {
        code: `
        (async () => {
          await something();
        })();
      `,
        options: { ignoreIIFE: true },
      },
      {
        code: `
        (async () => {
          something();
        })();
      `,
        options: { ignoreIIFE: true },
      },
      {
        code: "(async function foo() {})();",
        options: { ignoreIIFE: true },
      },
      {
        code: `
        function foo() {
          (async function bar() {})();
        }
      `,
        options: { ignoreIIFE: true },
      },
      {
        code: `
        const foo = () =>
          new Promise(res => {
            (async function () {
              await res(1);
            })();
          });
      `,
        options: { ignoreIIFE: true },
      },
      {
        code: `
        (async function () {
          await res(1);
        })();
      `,
        options: { ignoreIIFE: true },
      },
      {
        code: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;
  void (condition && myPromise());
}
      `,
      },
      {
        code: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;
  await (condition && myPromise());
}
      `,
        options: { ignoreVoid: false },
      },
      {
        code: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;
  condition && void myPromise();
}
      `,
      },
      {
        code: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;
  condition && (await myPromise());
}
      `,
        options: { ignoreVoid: false },
      },
      {
        code: `
async function foo() {
  const myPromise = async () => void 0;
  let condition = false;
  condition && myPromise();
  condition = true;
  condition || myPromise();
  condition ?? myPromise();
}
      `,
        options: { ignoreVoid: false },
      },
      {
        code: `
declare const definitelyCallable: () => void;
Promise.reject().catch(definitelyCallable);
      `,
        options: { ignoreVoid: false },
      },
      {
        code: `
Promise.reject()
  .catch(() => {})
  .finally(() => {});
      `,
      },
      {
        code: `
Promise.reject()
  .catch(() => {})
  .finally(() => {})
  .finally(() => {});
      `,
        options: { ignoreVoid: false },
      },
      {
        code: `
Promise.reject()
  .catch(() => {})
  .finally(() => {})
  .finally(() => {})
  .finally(() => {});
      `,
      },
      {
        code: `
await Promise.all([Promise.resolve(), Promise.resolve()]);
      `,
      },
      {
        code: `
declare const promiseArray: Array<Promise<unknown>>;
void promiseArray;
      `,
      },
      {
        code: `
[Promise.reject(), Promise.reject()].then(() => {});
      `,
      },
      {
        // Expressions aren't checked by this rule, so this just becomes an array
        // of number | undefined, which is fine regardless of the ignoreVoid setting.
        code: `
[1, 2, void Promise.reject(), 3];
      `,
        options: { ignoreVoid: false },
      },
      {
        code: `
['I', 'am', 'just', 'an', 'array'];
      `,
      },
    ],

    invalid: [
      {
        code: `
async function test() {
  Promise.resolve('value');
  Promise.resolve('value').then(() => {});
  Promise.resolve('value').catch();
  Promise.resolve('value').finally();
}
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
          },
          {
            line: 4,
            message: messages.floatingVoid,
          },
          {
            line: 5,
            message: messages.floatingVoid,
          },
          {
            line: 6,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
const doSomething = async (
  obj1: { a?: { b?: { c?: () => Promise<void> } } },
  obj2: { a?: { b?: { c: () => Promise<void> } } },
  obj3: { a?: { b: { c?: () => Promise<void> } } },
  obj4: { a: { b: { c?: () => Promise<void> } } },
  obj5: { a?: () => { b?: { c?: () => Promise<void> } } },
  obj6?: { a: { b: { c?: () => Promise<void> } } },
  callback?: () => Promise<void>,
): Promise<void> => {
  obj1.a?.b?.c?.();
  obj2.a?.b?.c();
  obj3.a?.b.c?.();
  obj4.a.b.c?.();
  obj5.a?.().b?.c?.();
  obj6?.a.b.c?.();

  callback?.();
};

doSomething();
      `,
        errors: [
          {
            line: 11,
            message: messages.floatingVoid,
          },
          {
            line: 12,
            message: messages.floatingVoid,
          },
          {
            line: 13,
            message: messages.floatingVoid,
          },
          {
            line: 14,
            message: messages.floatingVoid,
          },
          {
            line: 15,
            message: messages.floatingVoid,
          },
          {
            line: 16,
            message: messages.floatingVoid,
          },
          {
            line: 18,
            message: messages.floatingVoid,
          },
          {
            line: 21,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        options: { ignoreVoid: true },
        code: `
async function test() {
  Promise.resolve('value');
}
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function test() {
  Promise.reject(new Error('message'));
  Promise.reject(new Error('message')).then(() => {});
  Promise.reject(new Error('message')).catch();
  Promise.reject(new Error('message')).finally();
}
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
          },
          {
            line: 4,
            message: messages.floatingVoid,
          },
          {
            line: 5,
            message: messages.floatingVoid,
          },
          {
            line: 6,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function test() {
  (async () => true)();
  (async () => true)().then(() => {});
  (async () => true)().catch();
}
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
          },
          {
            line: 4,
            message: messages.floatingVoid,
          },
          {
            line: 5,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function test() {
  async function returnsPromise() {}

  returnsPromise();
  returnsPromise().then(() => {});
  returnsPromise().catch();
  returnsPromise().finally();
}
      `,
        errors: [
          {
            line: 5,
            message: messages.floatingVoid,
          },
          {
            line: 6,
            message: messages.floatingVoid,
          },
          {
            line: 7,
            message: messages.floatingVoid,
          },
          {
            line: 8,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function test() {
  Math.random() > 0.5 ? Promise.resolve() : null;
  Math.random() > 0.5 ? null : Promise.resolve();
}
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
          },
          {
            line: 4,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function test() {
  Promise.resolve(), 123;
  123, Promise.resolve();
  123, Promise.resolve(), 123;
}
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
          },
          {
            line: 4,
            message: messages.floatingVoid,
          },
          {
            line: 5,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function test() {
  void Promise.resolve();
}
      `,
        options: { ignoreVoid: false },
        errors: [
          {
            line: 3,
            message: messages.floating,
          },
        ],
      },
      {
        code: `
async function test() {
  const promise = new Promise((resolve, reject) => resolve('value'));
  promise;
}
      `,
        options: { ignoreVoid: false },
        errors: [
          {
            line: 4,
            message: messages.floating,
          },
        ],
      },
      {
        code: `
async function returnsPromise() {
  return 'value';
}
void returnsPromise();
      `,
        options: { ignoreVoid: false },
        errors: [
          {
            line: 5,
            message: messages.floating,
          },
        ],
      },
      {
        // eslint-disable-next-line @typescript-eslint/internal/plugin-test-formatting
        code: `
async function returnsPromise() {
  return 'value';
}
void /* ... */ returnsPromise();
      `,
        options: { ignoreVoid: false },
        errors: [
          {
            line: 5,
            message: messages.floating,
          },
        ],
      },
      {
        code: `
async function returnsPromise() {
  return 'value';
}
1, returnsPromise();
      `,
        options: { ignoreVoid: false },
        errors: [
          {
            line: 5,
            message: messages.floating,
          },
        ],
      },
      {
        code: `
async function returnsPromise() {
  return 'value';
}
bool ? returnsPromise() : null;
      `,
        options: { ignoreVoid: false },
        errors: [
          {
            line: 5,
            message: messages.floating,
          },
        ],
      },
      {
        code: `
async function test() {
  const obj = { foo: Promise.resolve() };
  obj.foo;
}
      `,
        errors: [
          {
            line: 4,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function test() {
  new Promise(resolve => resolve());
}
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function test() {
  declare const promiseValue: Promise<number>;

  promiseValue;
  promiseValue.then(() => {});
  promiseValue.catch();
  promiseValue.finally();
}
      `,
        errors: [
          {
            line: 5,
            message: messages.floatingVoid,
          },
          {
            line: 6,
            message: messages.floatingVoid,
          },
          {
            line: 7,
            message: messages.floatingVoid,
          },
          {
            line: 8,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function test() {
  declare const promiseUnion: Promise<number> | number;

  promiseUnion;
}
      `,
        errors: [
          {
            line: 5,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function test() {
  declare const promiseIntersection: Promise<number> & number;

  promiseIntersection;
  promiseIntersection.then(() => {});
  promiseIntersection.catch();
}
      `,
        errors: [
          {
            line: 5,
            message: messages.floatingVoid,
          },
          {
            line: 6,
            message: messages.floatingVoid,
          },
          {
            line: 7,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function test() {
  class CanThen extends Promise<number> {}
  const canThen: CanThen = Foo.resolve(2);

  canThen;
  canThen.then(() => {});
  canThen.catch();
  canThen.finally();
}
      `,
        errors: [
          {
            line: 6,
            message: messages.floatingVoid,
          },
          {
            line: 7,
            message: messages.floatingVoid,
          },
          {
            line: 8,
            message: messages.floatingVoid,
          },
          {
            line: 9,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function test() {
  class CatchableThenable {
    then(callback: () => void, callback: () => void): CatchableThenable {
      return new CatchableThenable();
    }
  }
  const thenable = new CatchableThenable();

  thenable;
  thenable.then(() => {});
}
      `,
        errors: [
          {
            line: 10,
            message: messages.floatingVoid,
          },
          {
            line: 11,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/promise-polyfill/index.d.ts
// Type definitions for promise-polyfill 6.0
// Project: https://github.com/taylorhakes/promise-polyfill
// Definitions by: Steve Jenkins <https://github.com/skysteve>
//                 Daniel Cassidy <https://github.com/djcsdy>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

interface PromisePolyfillConstructor extends PromiseConstructor {
  _immediateFn?: (handler: (() => void) | string) => void;
}

declare const PromisePolyfill: PromisePolyfillConstructor;

async function test() {
  const promise = new PromisePolyfill(() => {});

  promise;
  promise.then(() => {});
  promise.catch();
}
      `,
        errors: [
          {
            line: 18,
            message: messages.floatingVoid,
          },
          {
            line: 19,
            message: messages.floatingVoid,
          },
          {
            line: 20,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
        (async () => {
          await something();
        })();
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
        (async () => {
          something();
        })();
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: "(async function foo() {})();",
        errors: [
          {
            line: 1,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
        function foo() {
          (async function bar() {})();
        }
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
        const foo = () =>
          new Promise(res => {
            (async function () {
              await res(1);
            })();
          });
      `,
        errors: [
          {
            line: 4,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
        (async function () {
          await res(1);
        })();
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
        (async function () {
          Promise.resolve();
        })();
      `,
        options: { ignoreIIFE: true },
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
        (async function () {
          declare const promiseIntersection: Promise<number> & number;
          promiseIntersection;
          promiseIntersection.then(() => {});
          promiseIntersection.catch();
          promiseIntersection.finally();
        })();
      `,
        options: { ignoreIIFE: true },
        errors: [
          {
            line: 4,
            message: messages.floatingVoid,
          },
          {
            line: 5,
            message: messages.floatingVoid,
          },
          {
            line: 6,
            message: messages.floatingVoid,
          },
          {
            line: 7,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;

  void condition || myPromise();
}
      `,
        errors: [
          {
            line: 6,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;

  (await condition) && myPromise();
}
      `,
        options: { ignoreVoid: false },
        errors: [
          {
            line: 6,
            message: messages.floating,
          },
        ],
      },
      {
        code: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;

  condition && myPromise();
}
      `,
        errors: [
          {
            line: 6,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = false;

  condition || myPromise();
}
      `,
        errors: [
          {
            line: 6,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = null;

  condition ?? myPromise();
}
      `,
        errors: [
          {
            line: 6,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
async function foo() {
  const myPromise = Promise.resolve(true);
  let condition = true;
  condition && myPromise;
}
      `,
        options: { ignoreVoid: false },
        errors: [
          {
            line: 5,
            message: messages.floating,
          },
        ],
      },
      {
        code: `
async function foo() {
  const myPromise = Promise.resolve(true);
  let condition = false;
  condition || myPromise;
}
      `,
        options: { ignoreVoid: false },
        errors: [
          {
            line: 5,
            message: messages.floating,
          },
        ],
      },
      {
        code: `
async function foo() {
  const myPromise = Promise.resolve(true);
  let condition = null;
  condition ?? myPromise;
}
      `,
        options: { ignoreVoid: false },
        errors: [
          {
            line: 5,
            message: messages.floating,
          },
        ],
      },
      {
        code: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = false;

  condition || condition || myPromise();
}
      `,
        errors: [
          {
            line: 6,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
Promise.resolve().then(() => {}, 3);
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
        errors: [
          {
            line: 4,
            message: messages.floatingUselessRejectionHandlerVoid,
          },
          {
            line: 5,
            message: messages.floatingUselessRejectionHandlerVoid,
          },
          {
            line: 6,
            message: messages.floatingUselessRejectionHandlerVoid,
          },
          {
            line: 7,
            message: messages.floatingUselessRejectionHandlerVoid,
          },
          {
            line: 10,
            message: messages.floatingUselessRejectionHandlerVoid,
          },
          {
            line: 11,
            message: messages.floatingUselessRejectionHandlerVoid,
          },
          {
            line: 12,
            message: messages.floatingUselessRejectionHandlerVoid,
          },
          {
            line: 13,
            message: messages.floatingUselessRejectionHandlerVoid,
          },
        ],
      },
      {
        code: `
Promise.reject() || 3;
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingVoid,
          },
        ],
      },
      {
        code: `
void Promise.resolve().then(() => {}, undefined);
      `,
        options: { ignoreVoid: false },
        errors: [
          {
            line: 2,
            message: messages.floatingUselessRejectionHandler,
          },
        ],
      },
      {
        code: `
declare const maybeCallable: string | (() => void);
Promise.resolve().then(() => {}, maybeCallable);
      `,
        options: { ignoreVoid: false },
        errors: [
          {
            line: 3,
            message: messages.floatingUselessRejectionHandler,
          },
        ],
      },
      {
        code: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
Promise.resolve().then(() => {}, 3);
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
        options: { ignoreVoid: false },
        errors: [
          {
            line: 4,
            message: messages.floatingUselessRejectionHandler,
          },
          {
            line: 5,
            message: messages.floatingUselessRejectionHandler,
          },
          {
            line: 6,
            message: messages.floatingUselessRejectionHandler,
          },
          {
            line: 7,
            message: messages.floatingUselessRejectionHandler,
          },
          {
            line: 10,
            message: messages.floatingUselessRejectionHandler,
          },
          {
            line: 11,
            message: messages.floatingUselessRejectionHandler,
          },
          {
            line: 12,
            message: messages.floatingUselessRejectionHandler,
          },
          {
            line: 13,
            message: messages.floatingUselessRejectionHandler,
          },
        ],
      },
      {
        code: `
Promise.reject() || 3;
      `,
        options: { ignoreVoid: false },
        errors: [
          {
            line: 2,
            message: messages.floating,
          },
        ],
      },
      {
        code: `
Promise.reject().finally(() => {});
      `,
        errors: [{ line: 2, message: messages.floatingVoid }],
      },
      {
        code: `
Promise.reject()
  .finally(() => {})
  .finally(() => {});
      `,
        options: { ignoreVoid: false },
        errors: [{ line: 2, message: messages.floating }],
      },
      {
        code: `
Promise.reject()
  .finally(() => {})
  .finally(() => {})
  .finally(() => {});
      `,
        errors: [{ line: 2, message: messages.floatingVoid }],
      },
      {
        code: `
Promise.reject()
  .then(() => {})
  .finally(() => {});
      `,
        errors: [{ line: 2, message: messages.floatingVoid }],
      },
      {
        code: `
declare const returnsPromise: () => Promise<void> | null;
returnsPromise()?.finally(() => {});
      `,
        errors: [{ line: 3, message: messages.floatingVoid }],
      },
      {
        code: `
const promiseIntersection: Promise<number> & number;
promiseIntersection.finally(() => {});
      `,
        errors: [{ line: 3, message: messages.floatingVoid }],
      },
      {
        code: `
Promise.resolve().finally(() => {}), 123;
      `,
        errors: [{ line: 2, message: messages.floatingVoid }],
      },
      {
        code: `
(async () => true)().finally();
      `,
        errors: [{ line: 2, message: messages.floatingVoid }],
      },
      {
        code: `
Promise.reject(new Error('message')).finally(() => {});
      `,
        errors: [{ line: 2, message: messages.floatingVoid }],
      },
      {
        code: `
function _<T, S extends Array<T | Promise<T>>>(
  maybePromiseArray: S | undefined,
): void {
  maybePromiseArray?.[0];
}
      `,
        errors: [{ line: 5, message: messages.floatingVoid }],
      },
      {
        code: `
[1, 2, 3].map(() => Promise.reject());
      `,
        errors: [{ line: 2, message: messages.floatingPromiseArrayVoid }],
      },
      {
        code: `
declare const array: unknown[];
array.map(() => Promise.reject());
      `,
        errors: [{ line: 3, message: messages.floatingPromiseArrayVoid }],
      },
      {
        code: `
declare const promiseArray: Array<Promise<unknown>>;
void promiseArray;
      `,
        options: { ignoreVoid: false },
        errors: [{ line: 3, message: messages.floatingPromiseArray }],
      },
      {
        code: `
[1, 2, Promise.reject(), 3];
      `,
        errors: [{ line: 2, message: messages.floatingPromiseArrayVoid }],
      },
      {
        code: `
[1, 2, Promise.reject().catch(() => {}), 3];
      `,
        errors: [{ line: 2, message: messages.floatingPromiseArrayVoid }],
      },
      {
        code: `
const data = ['test'];
data.map(async () => {
  await new Promise((_res, rej) => setTimeout(rej, 1000));
});
      `,
        errors: [{ line: 3, message: messages.floatingPromiseArrayVoid }],
      },
      {
        code: `
function _<T, S extends Array<T | Array<T | Promise<T>>>>(
  maybePromiseArrayArray: S | undefined,
): void {
  maybePromiseArrayArray?.[0];
}
      `,
        errors: [{ line: 5, message: messages.floatingPromiseArrayVoid }],
      },
      {
        code: `
function f<T extends Array<Promise<number>>>(a: T): void {
  a;
}
      `,
        errors: [{ line: 3, message: messages.floatingPromiseArrayVoid }],
      },
      {
        code: `
declare const a: Array<Promise<number>> | undefined;
a;
      `,
        errors: [{ line: 3, message: messages.floatingPromiseArrayVoid }],
      },
      {
        code: `
function f<T extends Array<Promise<number>>>(a: T | undefined): void {
  a;
}
      `,
        errors: [{ line: 3, message: messages.floatingPromiseArrayVoid }],
      },
      {
        code: `
[Promise.reject()] as const;
      `,
        errors: [{ line: 2, message: messages.floatingPromiseArrayVoid }],
      },
      {
        code: `
declare function cursed(): [Promise<number>, Promise<string>];
cursed();
      `,
        errors: [{ line: 3, message: messages.floatingPromiseArrayVoid }],
      },
      {
        code: `
[
  'Type Argument number ',
  1,
  'is not',
  Promise.resolve(),
  'but it still is flagged',
] as const;
      `,
        errors: [{ line: 2, message: messages.floatingPromiseArrayVoid }],
      },
      {
        code: `
        declare const arrayOrPromiseTuple:
          | Array<number>
          | [number, number, Promise<unknown>, string];
        arrayOrPromiseTuple;
      `,
        errors: [{ line: 5, message: messages.floatingPromiseArrayVoid }],
      },
      {
        code: `
        declare const okArrayOrPromiseArray: Array<number> | Array<Promise<unknown>>;
        okArrayOrPromiseArray;
      `,
        errors: [{ line: 3, message: messages.floatingPromiseArrayVoid }],
      },
    ],
  });
