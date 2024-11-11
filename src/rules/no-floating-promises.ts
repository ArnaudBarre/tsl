import { unionTypeParts } from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Checker, Infer, Suggestion } from "../types.ts";
import { isLogicalExpression } from "./utils";
import { isBuiltinSymbolLike } from "./utils/isBuiltinSymbolLike.ts";

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
  floatingFixVoid: "Add void operator to ignore.",
  floatingPromiseArray: messagePromiseArray,
  floatingPromiseArrayVoid: messagePromiseArrayVoid,
  floatingUselessRejectionHandler: `${messageBase} ${messageRejectionHandler}`,
  floatingUselessRejectionHandlerVoid: `${messageBaseVoid} ${messageRejectionHandler}`,
  floatingVoid: messageBaseVoid,
};

type Context = Infer<typeof noFloatingPromises>["Context"];

export const noFloatingPromises = createRule({
  name: "no-floating-promises",
  parseOptions: (options?: {
    allowList?: string[];
    ignoreIIFE?: boolean;
    ignoreVoid?: boolean;
  }) => ({
    allowList: [],
    ignoreIIFE: false,
    ignoreVoid: true,
    ...options,
  }),
  visitor: {
    ExpressionStatement(node, context) {
      if (context.options.ignoreIIFE && isAsyncIife(node)) {
        return;
      }

      if (
        node.expression.kind === SyntaxKind.CallExpression &&
        node.expression.expression.kind === SyntaxKind.Identifier &&
        context.options.allowList.includes(node.expression.expression.text)
      ) {
        return;
      }

      const { isUnhandled, nonFunctionHandler, promiseArray } =
        isUnhandledPromise(context.checker, node.expression, context);

      if (isUnhandled) {
        if (promiseArray) {
          context.report({
            node,
            message: context.options.ignoreVoid
              ? messages.floatingPromiseArrayVoid
              : messages.floatingPromiseArray,
          });
        } else if (context.options.ignoreVoid) {
          context.report({
            node,
            message: nonFunctionHandler
              ? messages.floatingUselessRejectionHandlerVoid
              : messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                changes: [
                  {
                    start: node.getStart(),
                    length: 0,
                    newText: "void (",
                  },
                  { start: node.expression.getEnd(), length: 0, newText: ")" },
                ],
              },
              {
                message: messages.floatingFixAwait,
                changes: addAwait(node.expression, node),
              },
            ],
          });
        } else {
          context.report({
            node,
            message: nonFunctionHandler
              ? messages.floatingUselessRejectionHandler
              : messages.floating,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                changes: addAwait(node.expression, node),
              },
            ],
          });
        }
      }
    },
  },
});

function addAwait(
  expression: AST.Expression,
  node: AST.ExpressionStatement,
): Suggestion["changes"] {
  if (expression.kind === SyntaxKind.VoidExpression) {
    return [{ start: node.getStart(), length: 4, newText: "await" }];
  }
  return [
    { start: node.getStart(), length: 0, newText: "await (" },
    { start: node.expression.getEnd(), length: 0, newText: ")" },
  ];
}

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
  node: AST.Expression,
  context: Context,
): {
  isUnhandled: boolean;
  nonFunctionHandler?: boolean;
  promiseArray?: boolean;
} {
  if (
    node.kind === SyntaxKind.BinaryExpression &&
    node.operatorToken.kind === SyntaxKind.FirstAssignment
  ) {
    return { isUnhandled: false };
  }

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

  if (isPromiseArray(node, context)) {
    return { isUnhandled: true, promiseArray: true };
  }

  // await expression addresses promises, but not promise arrays.
  if (node.kind === SyntaxKind.AwaitExpression) {
    // you would think this wouldn't be strictly necessary, since we're
    // anyway checking the type of the expression, but, unfortunately TS
    // reports the result of `await (promise as Promise<number> & number)`
    // as `Promise<number> & number` instead of `number`.
    return { isUnhandled: false };
  }

  if (!isPromiseLike(context, node)) {
    return { isUnhandled: false };
  }

  if (node.kind === SyntaxKind.CallExpression) {
    // If the outer expression is a call, a `.catch()` or `.then()` with
    // rejection handler handles the promise.

    if (
      node.expression.kind === SyntaxKind.PropertyAccessExpression &&
      node.expression.name.kind === SyntaxKind.Identifier
    ) {
      const methodName = node.expression.name.text;
      const catchRejectionHandler =
        methodName === "catch" && node.arguments.length >= 1
          ? node.arguments[0]
          : undefined;
      if (catchRejectionHandler) {
        if (isValidRejectionHandler(catchRejectionHandler, context)) {
          return { isUnhandled: false };
        }
        return { isUnhandled: true, nonFunctionHandler: true };
      }

      const thenRejectionHandler =
        methodName === "then" && node.arguments.length >= 2
          ? node.arguments[1]
          : undefined;
      if (thenRejectionHandler) {
        if (isValidRejectionHandler(thenRejectionHandler, context)) {
          return { isUnhandled: false };
        }
        return { isUnhandled: true, nonFunctionHandler: true };
      }

      // `x.finally()` is transparent to resolution of the promise, so check `x`.
      // ("object" in this context is the `x` in `x.finally()`)
      const promiseFinallyObject =
        methodName === "finally" ? node.expression.expression : undefined;
      if (promiseFinallyObject) {
        return isUnhandledPromise(checker, promiseFinallyObject, context);
      }
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
    node.kind === SyntaxKind.BinaryExpression &&
    isLogicalExpression(node.operatorToken)
  ) {
    const leftResult = isUnhandledPromise(checker, node.left, context);
    if (leftResult.isUnhandled) {
      return leftResult;
    }
    return isUnhandledPromise(checker, node.right, context);
  }

  // Anything else is unhandled.
  return { isUnhandled: true };
}

function isPromiseArray(node: ts.Node, context: Context): boolean {
  const type = context.checker.getTypeAtLocation(node);
  for (const ty of unionTypeParts(type).map((t) =>
    context.checker.getApparentType(t),
  )) {
    if (context.checker.isArrayType(ty)) {
      const arrayType = context.checker.getTypeArguments(ty)[0];
      if (isPromiseLike(context, node, arrayType)) {
        return true;
      }
    }

    if (context.checker.isTupleType(ty)) {
      for (const tupleElementType of context.checker.getTypeArguments(ty)) {
        if (isPromiseLike(context, node, tupleElementType)) {
          return true;
        }
      }
    }
  }
  return false;
}

function isPromiseLike(
  context: Context,
  node: ts.Node,
  type?: ts.Type,
): boolean {
  type ??= context.checker.getTypeAtLocation(node);

  return unionTypeParts(context.checker.getApparentType(type)).some(
    (typePart) => isBuiltinSymbolLike(context.program, typePart, "Promise"),
  );
}

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
        options: {
          ignoreVoid: true,
        },
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
declare const promiseValue: Promise<number>;
async function test() {
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
declare const promiseUnion: Promise<number> | number;
async function test() {
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
declare const promiseIntersection: Promise<number> & number;
async function test() {
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
declare const intersectionPromise: Promise<number> & number;
async function test() {
  await (Math.random() > 0.5 ? numberPromise : 0);
  await (Math.random() > 0.5 ? foo : 0);
  await (Math.random() > 0.5 ? bar : 0);

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
declare const returnsPromise: () => Promise<void> | null;
async function test() {
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
        options: {
          ignoreIIFE: true,
        },
        code: `
        (async () => {
          await something();
        })();
      `,
      },
      {
        options: {
          ignoreIIFE: true,
        },
        code: `
        (async () => {
          something();
        })();
      `,
      },
      {
        options: {
          ignoreIIFE: true,
        },
        code: "(async function foo() {})();",
      },
      {
        options: {
          ignoreIIFE: true,
        },
        code: `
        function foo() {
          (async function bar() {})();
        }
      `,
      },
      {
        options: {
          ignoreIIFE: true,
        },
        code: `
        const foo = () =>
          new Promise(res => {
            (async function () {
              await res(1);
            })();
          });
      `,
      },
      {
        options: {
          ignoreIIFE: true,
        },
        code: `
        (async function () {
          await res(1);
        })();
      `,
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
        options: {
          ignoreVoid: false,
        },
        code: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;
  await (condition && myPromise());
}
      `,
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
        options: {
          ignoreVoid: false,
        },
        code: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;
  condition && (await myPromise());
}
      `,
      },
      {
        options: {
          ignoreVoid: false,
        },
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
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
declare const definitelyCallable: () => void;
Promise.reject().catch(definitelyCallable);
      `,
      },
      {
        code: `
Promise.reject()
  .catch(() => {})
  .finally(() => {});
      `,
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
Promise.reject()
  .catch(() => {})
  .finally(() => {})
  .finally(() => {});
      `,
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
        options: {
          ignoreVoid: false,
        },
        // Expressions aren't checked by this rule, so this just becomes an array
        // of number | undefined, which is fine regardless of the ignoreVoid setting.
        code: `
[1, 2, void Promise.reject(), 3];
      `,
      },
      {
        code: `
['I', 'am', 'just', 'an', 'array'];
      `,
      },
      {
        options: {
          allowList: ["it"],
        },
        code: `
        declare function it(...args: unknown[]): Promise<void>;

        it('...', () => {});
      `,
      },
      {
        code: `
declare const myTag: (strings: TemplateStringsArray) => Promise<void>;
myTag\`abc\`.catch(() => {});
      `,
      },
      {
        code: `
declare const myTag: (strings: TemplateStringsArray) => string;
myTag\`abc\`;
      `,
      },
      {
        code: `
declare let x: any;
declare const promiseArray: Array<Promise<unknown>>;
x = promiseArray;
      `,
      },
      {
        code: `
declare let x: Promise<number>;
x = Promise.resolve(2);
      `,
      },
      {
        code: `
declare const promiseArray: Array<Promise<unknown>>;
async function f() {
  return promiseArray;
}
      `,
      },
      {
        code: `
declare const promiseArray: Array<Promise<unknown>>;
async function* generator() {
  yield* promiseArray;
}
      `,
      },
      {
        code: `
async function* generator() {
  yield Promise.resolve();
}
      `,
      },
      {
        options: {
          allowList: ["it"],
        },
        code: `
        import { it } from 'node:test';

        it('...', () => {});
      `,
      },
      `
declare const createPromiseLike: () => PromiseLike<number>;
createPromiseLike();
    `,
      `
interface MyThenable {
  then(onFulfilled: () => void, onRejected: () => void): MyThenable;
}

declare function createMyThenable(): MyThenable;

createMyThenable();
    `,
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  void (Promise.resolve('value'));
  Promise.resolve('value').then(() => {});
  Promise.resolve('value').catch();
  Promise.resolve('value').finally();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  await (Promise.resolve('value'));
  Promise.resolve('value').then(() => {});
  Promise.resolve('value').catch();
  Promise.resolve('value').finally();
}
      `,
              },
            ],
          },
          {
            line: 4,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  Promise.resolve('value');
  void (Promise.resolve('value').then(() => {}));
  Promise.resolve('value').catch();
  Promise.resolve('value').finally();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  Promise.resolve('value');
  await (Promise.resolve('value').then(() => {}));
  Promise.resolve('value').catch();
  Promise.resolve('value').finally();
}
      `,
              },
            ],
          },
          {
            line: 5,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  Promise.resolve('value');
  Promise.resolve('value').then(() => {});
  void (Promise.resolve('value').catch());
  Promise.resolve('value').finally();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  Promise.resolve('value');
  Promise.resolve('value').then(() => {});
  await (Promise.resolve('value').catch());
  Promise.resolve('value').finally();
}
      `,
              },
            ],
          },
          {
            line: 6,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  Promise.resolve('value');
  Promise.resolve('value').then(() => {});
  Promise.resolve('value').catch();
  void (Promise.resolve('value').finally());
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  Promise.resolve('value');
  Promise.resolve('value').then(() => {});
  Promise.resolve('value').catch();
  await (Promise.resolve('value').finally());
}
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
const doSomething = async (
  obj1: { a?: { b?: { c?: () => Promise<void> } } },
  obj2: { a?: { b?: { c: () => Promise<void> } } },
  obj3: { a?: { b: { c?: () => Promise<void> } } },
  obj4: { a: { b: { c?: () => Promise<void> } } },
  obj5: { a?: () => { b?: { c?: () => Promise<void> } } },
  obj6?: { a: { b: { c?: () => Promise<void> } } },
  callback?: () => Promise<void>,
): Promise<void> => {
  void (obj1.a?.b?.c?.());
  obj2.a?.b?.c();
  obj3.a?.b.c?.();
  obj4.a.b.c?.();
  obj5.a?.().b?.c?.();
  obj6?.a.b.c?.();

  callback?.();
};

doSomething();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
const doSomething = async (
  obj1: { a?: { b?: { c?: () => Promise<void> } } },
  obj2: { a?: { b?: { c: () => Promise<void> } } },
  obj3: { a?: { b: { c?: () => Promise<void> } } },
  obj4: { a: { b: { c?: () => Promise<void> } } },
  obj5: { a?: () => { b?: { c?: () => Promise<void> } } },
  obj6?: { a: { b: { c?: () => Promise<void> } } },
  callback?: () => Promise<void>,
): Promise<void> => {
  await (obj1.a?.b?.c?.());
  obj2.a?.b?.c();
  obj3.a?.b.c?.();
  obj4.a.b.c?.();
  obj5.a?.().b?.c?.();
  obj6?.a.b.c?.();

  callback?.();
};

doSomething();
      `,
              },
            ],
          },
          {
            line: 12,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
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
  void (obj2.a?.b?.c());
  obj3.a?.b.c?.();
  obj4.a.b.c?.();
  obj5.a?.().b?.c?.();
  obj6?.a.b.c?.();

  callback?.();
};

doSomething();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
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
  await (obj2.a?.b?.c());
  obj3.a?.b.c?.();
  obj4.a.b.c?.();
  obj5.a?.().b?.c?.();
  obj6?.a.b.c?.();

  callback?.();
};

doSomething();
      `,
              },
            ],
          },
          {
            line: 13,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
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
  void (obj3.a?.b.c?.());
  obj4.a.b.c?.();
  obj5.a?.().b?.c?.();
  obj6?.a.b.c?.();

  callback?.();
};

doSomething();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
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
  await (obj3.a?.b.c?.());
  obj4.a.b.c?.();
  obj5.a?.().b?.c?.();
  obj6?.a.b.c?.();

  callback?.();
};

doSomething();
      `,
              },
            ],
          },
          {
            line: 14,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
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
  void (obj4.a.b.c?.());
  obj5.a?.().b?.c?.();
  obj6?.a.b.c?.();

  callback?.();
};

doSomething();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
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
  await (obj4.a.b.c?.());
  obj5.a?.().b?.c?.();
  obj6?.a.b.c?.();

  callback?.();
};

doSomething();
      `,
              },
            ],
          },
          {
            line: 15,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
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
  void (obj5.a?.().b?.c?.());
  obj6?.a.b.c?.();

  callback?.();
};

doSomething();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
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
  await (obj5.a?.().b?.c?.());
  obj6?.a.b.c?.();

  callback?.();
};

doSomething();
      `,
              },
            ],
          },
          {
            line: 16,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
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
  void (obj6?.a.b.c?.());

  callback?.();
};

doSomething();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
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
  await (obj6?.a.b.c?.());

  callback?.();
};

doSomething();
      `,
              },
            ],
          },
          {
            line: 18,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
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

  void (callback?.());
};

doSomething();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
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

  await (callback?.());
};

doSomething();
      `,
              },
            ],
          },
          {
            line: 21,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
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

void (doSomething());
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
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

await (doSomething());
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const myTag: (strings: TemplateStringsArray) => Promise<void>;
myTag\`abc\`;
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const myTag: (strings: TemplateStringsArray) => Promise<void>;
void (myTag\`abc\`);
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const myTag: (strings: TemplateStringsArray) => Promise<void>;
await (myTag\`abc\`);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const myTag: (strings: TemplateStringsArray) => Promise<void>;
myTag\`abc\`.then(() => {});
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const myTag: (strings: TemplateStringsArray) => Promise<void>;
void (myTag\`abc\`.then(() => {}));
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const myTag: (strings: TemplateStringsArray) => Promise<void>;
await (myTag\`abc\`.then(() => {}));
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const myTag: (strings: TemplateStringsArray) => Promise<void>;
myTag\`abc\`.finally(() => {});
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const myTag: (strings: TemplateStringsArray) => Promise<void>;
void (myTag\`abc\`.finally(() => {}));
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const myTag: (strings: TemplateStringsArray) => Promise<void>;
await (myTag\`abc\`.finally(() => {}));
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreVoid: true,
        },
        code: `
async function test() {
  Promise.resolve('value');
}
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  void (Promise.resolve('value'));
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  await (Promise.resolve('value'));
}
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  void (Promise.reject(new Error('message')));
  Promise.reject(new Error('message')).then(() => {});
  Promise.reject(new Error('message')).catch();
  Promise.reject(new Error('message')).finally();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  await (Promise.reject(new Error('message')));
  Promise.reject(new Error('message')).then(() => {});
  Promise.reject(new Error('message')).catch();
  Promise.reject(new Error('message')).finally();
}
      `,
              },
            ],
          },
          {
            line: 4,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  Promise.reject(new Error('message'));
  void (Promise.reject(new Error('message')).then(() => {}));
  Promise.reject(new Error('message')).catch();
  Promise.reject(new Error('message')).finally();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  Promise.reject(new Error('message'));
  await (Promise.reject(new Error('message')).then(() => {}));
  Promise.reject(new Error('message')).catch();
  Promise.reject(new Error('message')).finally();
}
      `,
              },
            ],
          },
          {
            line: 5,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  Promise.reject(new Error('message'));
  Promise.reject(new Error('message')).then(() => {});
  void (Promise.reject(new Error('message')).catch());
  Promise.reject(new Error('message')).finally();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  Promise.reject(new Error('message'));
  Promise.reject(new Error('message')).then(() => {});
  await (Promise.reject(new Error('message')).catch());
  Promise.reject(new Error('message')).finally();
}
      `,
              },
            ],
          },
          {
            line: 6,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  Promise.reject(new Error('message'));
  Promise.reject(new Error('message')).then(() => {});
  Promise.reject(new Error('message')).catch();
  void (Promise.reject(new Error('message')).finally());
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  Promise.reject(new Error('message'));
  Promise.reject(new Error('message')).then(() => {});
  Promise.reject(new Error('message')).catch();
  await (Promise.reject(new Error('message')).finally());
}
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  void ((async () => true)());
  (async () => true)().then(() => {});
  (async () => true)().catch();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  await ((async () => true)());
  (async () => true)().then(() => {});
  (async () => true)().catch();
}
      `,
              },
            ],
          },
          {
            line: 4,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  (async () => true)();
  void ((async () => true)().then(() => {}));
  (async () => true)().catch();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  (async () => true)();
  await ((async () => true)().then(() => {}));
  (async () => true)().catch();
}
      `,
              },
            ],
          },
          {
            line: 5,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  (async () => true)();
  (async () => true)().then(() => {});
  void ((async () => true)().catch());
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  (async () => true)();
  (async () => true)().then(() => {});
  await ((async () => true)().catch());
}
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  async function returnsPromise() {}

  void (returnsPromise());
  returnsPromise().then(() => {});
  returnsPromise().catch();
  returnsPromise().finally();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  async function returnsPromise() {}

  await (returnsPromise());
  returnsPromise().then(() => {});
  returnsPromise().catch();
  returnsPromise().finally();
}
      `,
              },
            ],
          },
          {
            line: 6,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  async function returnsPromise() {}

  returnsPromise();
  void (returnsPromise().then(() => {}));
  returnsPromise().catch();
  returnsPromise().finally();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  async function returnsPromise() {}

  returnsPromise();
  await (returnsPromise().then(() => {}));
  returnsPromise().catch();
  returnsPromise().finally();
}
      `,
              },
            ],
          },
          {
            line: 7,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  async function returnsPromise() {}

  returnsPromise();
  returnsPromise().then(() => {});
  void (returnsPromise().catch());
  returnsPromise().finally();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  async function returnsPromise() {}

  returnsPromise();
  returnsPromise().then(() => {});
  await (returnsPromise().catch());
  returnsPromise().finally();
}
      `,
              },
            ],
          },
          {
            line: 8,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  async function returnsPromise() {}

  returnsPromise();
  returnsPromise().then(() => {});
  returnsPromise().catch();
  void (returnsPromise().finally());
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  async function returnsPromise() {}

  returnsPromise();
  returnsPromise().then(() => {});
  returnsPromise().catch();
  await (returnsPromise().finally());
}
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  void (Math.random() > 0.5 ? Promise.resolve() : null);
  Math.random() > 0.5 ? null : Promise.resolve();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  await (Math.random() > 0.5 ? Promise.resolve() : null);
  Math.random() > 0.5 ? null : Promise.resolve();
}
      `,
              },
            ],
          },
          {
            line: 4,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  Math.random() > 0.5 ? Promise.resolve() : null;
  void (Math.random() > 0.5 ? null : Promise.resolve());
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  Math.random() > 0.5 ? Promise.resolve() : null;
  await (Math.random() > 0.5 ? null : Promise.resolve());
}
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  void (Promise.resolve(), 123);
  123, Promise.resolve();
  123, Promise.resolve(), 123;
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  await (Promise.resolve(), 123);
  123, Promise.resolve();
  123, Promise.resolve(), 123;
}
      `,
              },
            ],
          },
          {
            line: 4,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  Promise.resolve(), 123;
  void (123, Promise.resolve());
  123, Promise.resolve(), 123;
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  Promise.resolve(), 123;
  await (123, Promise.resolve());
  123, Promise.resolve(), 123;
}
      `,
              },
            ],
          },
          {
            line: 5,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  Promise.resolve(), 123;
  123, Promise.resolve();
  void (123, Promise.resolve(), 123);
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  Promise.resolve(), 123;
  123, Promise.resolve();
  await (123, Promise.resolve(), 123);
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
async function test() {
  void Promise.resolve();
}
      `,
        errors: [
          {
            line: 3,
            message: messages.floating,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  await Promise.resolve();
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
async function test() {
  const promise = new Promise((resolve, reject) => resolve('value'));
  promise;
}
      `,
        errors: [
          {
            line: 4,
            message: messages.floating,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  const promise = new Promise((resolve, reject) => resolve('value'));
  await (promise);
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
async function returnsPromise() {
  return 'value';
}
void returnsPromise();
      `,
        errors: [
          {
            line: 5,
            message: messages.floating,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
async function returnsPromise() {
  return 'value';
}
await returnsPromise();
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
        // eslint-disable-next-line @typescript-eslint/internal/plugin-test-formatting
        code: `
async function returnsPromise() {
  return 'value';
}
void /* ... */ returnsPromise();
      `,
        errors: [
          {
            line: 5,
            message: messages.floating,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
async function returnsPromise() {
  return 'value';
}
await /* ... */ returnsPromise();
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
async function returnsPromise() {
  return 'value';
}
1, returnsPromise();
      `,
        errors: [
          {
            line: 5,
            message: messages.floating,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
async function returnsPromise() {
  return 'value';
}
await (1, returnsPromise());
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
async function returnsPromise() {
  return 'value';
}
bool ? returnsPromise() : null;
      `,
        errors: [
          {
            line: 5,
            message: messages.floating,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
async function returnsPromise() {
  return 'value';
}
await (bool ? returnsPromise() : null);
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  const obj = { foo: Promise.resolve() };
  void (obj.foo);
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  const obj = { foo: Promise.resolve() };
  await (obj.foo);
}
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  void (new Promise(resolve => resolve()));
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  await (new Promise(resolve => resolve()));
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const promiseValue: Promise<number>;

async function test() {
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseValue: Promise<number>;

async function test() {
  void (promiseValue);
  promiseValue.then(() => {});
  promiseValue.catch();
  promiseValue.finally();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const promiseValue: Promise<number>;

async function test() {
  await (promiseValue);
  promiseValue.then(() => {});
  promiseValue.catch();
  promiseValue.finally();
}
      `,
              },
            ],
          },
          {
            line: 6,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseValue: Promise<number>;

async function test() {
  promiseValue;
  void (promiseValue.then(() => {}));
  promiseValue.catch();
  promiseValue.finally();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const promiseValue: Promise<number>;

async function test() {
  promiseValue;
  await (promiseValue.then(() => {}));
  promiseValue.catch();
  promiseValue.finally();
}
      `,
              },
            ],
          },
          {
            line: 7,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseValue: Promise<number>;

async function test() {
  promiseValue;
  promiseValue.then(() => {});
  void (promiseValue.catch());
  promiseValue.finally();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const promiseValue: Promise<number>;

async function test() {
  promiseValue;
  promiseValue.then(() => {});
  await (promiseValue.catch());
  promiseValue.finally();
}
      `,
              },
            ],
          },
          {
            line: 8,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseValue: Promise<number>;

async function test() {
  promiseValue;
  promiseValue.then(() => {});
  promiseValue.catch();
  void (promiseValue.finally());
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const promiseValue: Promise<number>;

async function test() {
  promiseValue;
  promiseValue.then(() => {});
  promiseValue.catch();
  await (promiseValue.finally());
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const promiseUnion: Promise<number> | number;

async function test() {
  promiseUnion;
}
      `,
        errors: [
          {
            line: 5,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseUnion: Promise<number> | number;

async function test() {
  void (promiseUnion);
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const promiseUnion: Promise<number> | number;

async function test() {
  await (promiseUnion);
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const promiseIntersection: Promise<number> & number;

async function test() {
  promiseIntersection;
  promiseIntersection.then(() => {});
  promiseIntersection.catch();
}
      `,
        errors: [
          {
            line: 5,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseIntersection: Promise<number> & number;

async function test() {
  void (promiseIntersection);
  promiseIntersection.then(() => {});
  promiseIntersection.catch();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const promiseIntersection: Promise<number> & number;

async function test() {
  await (promiseIntersection);
  promiseIntersection.then(() => {});
  promiseIntersection.catch();
}
      `,
              },
            ],
          },
          {
            line: 6,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseIntersection: Promise<number> & number;

async function test() {
  promiseIntersection;
  void (promiseIntersection.then(() => {}));
  promiseIntersection.catch();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const promiseIntersection: Promise<number> & number;

async function test() {
  promiseIntersection;
  await (promiseIntersection.then(() => {}));
  promiseIntersection.catch();
}
      `,
              },
            ],
          },
          {
            line: 7,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseIntersection: Promise<number> & number;

async function test() {
  promiseIntersection;
  promiseIntersection.then(() => {});
  void (promiseIntersection.catch());
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const promiseIntersection: Promise<number> & number;

async function test() {
  promiseIntersection;
  promiseIntersection.then(() => {});
  await (promiseIntersection.catch());
}
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  class CanThen extends Promise<number> {}
  const canThen: CanThen = Foo.resolve(2);

  void (canThen);
  canThen.then(() => {});
  canThen.catch();
  canThen.finally();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  class CanThen extends Promise<number> {}
  const canThen: CanThen = Foo.resolve(2);

  await (canThen);
  canThen.then(() => {});
  canThen.catch();
  canThen.finally();
}
      `,
              },
            ],
          },
          {
            line: 7,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  class CanThen extends Promise<number> {}
  const canThen: CanThen = Foo.resolve(2);

  canThen;
  void (canThen.then(() => {}));
  canThen.catch();
  canThen.finally();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  class CanThen extends Promise<number> {}
  const canThen: CanThen = Foo.resolve(2);

  canThen;
  await (canThen.then(() => {}));
  canThen.catch();
  canThen.finally();
}
      `,
              },
            ],
          },
          {
            line: 8,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  class CanThen extends Promise<number> {}
  const canThen: CanThen = Foo.resolve(2);

  canThen;
  canThen.then(() => {});
  void (canThen.catch());
  canThen.finally();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  class CanThen extends Promise<number> {}
  const canThen: CanThen = Foo.resolve(2);

  canThen;
  canThen.then(() => {});
  await (canThen.catch());
  canThen.finally();
}
      `,
              },
            ],
          },
          {
            line: 9,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  class CanThen extends Promise<number> {}
  const canThen: CanThen = Foo.resolve(2);

  canThen;
  canThen.then(() => {});
  canThen.catch();
  void (canThen.finally());
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  class CanThen extends Promise<number> {}
  const canThen: CanThen = Foo.resolve(2);

  canThen;
  canThen.then(() => {});
  canThen.catch();
  await (canThen.finally());
}
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
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

  void (promise);
  promise.then(() => {});
  promise.catch();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
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

  await (promise);
  promise.then(() => {});
  promise.catch();
}
      `,
              },
            ],
          },
          {
            line: 19,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
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
  void (promise.then(() => {}));
  promise.catch();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
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
  await (promise.then(() => {}));
  promise.catch();
}
      `,
              },
            ],
          },
          {
            line: 20,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
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
  void (promise.catch());
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
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
  await (promise.catch());
}
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        void ((async () => {
          await something();
        })());
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        await ((async () => {
          await something();
        })());
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        void ((async () => {
          something();
        })());
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        await ((async () => {
          something();
        })());
      `,
              },
            ],
          },
        ],
      },
      {
        code: "(async function foo() {})();",
        errors: [
          {
            line: 1,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: "void ((async function foo() {})());",
              },
              {
                message: messages.floatingFixAwait,
                output: "await ((async function foo() {})());",
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        function foo() {
          void ((async function bar() {})());
        }
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        function foo() {
          await ((async function bar() {})());
        }
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        const foo = () =>
          new Promise(res => {
            void ((async function () {
              await res(1);
            })());
          });
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        const foo = () =>
          new Promise(res => {
            await ((async function () {
              await res(1);
            })());
          });
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        void ((async function () {
          await res(1);
        })());
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        await ((async function () {
          await res(1);
        })());
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreIIFE: true,
        },
        code: `
        (async function () {
          Promise.resolve();
        })();
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        (async function () {
          void (Promise.resolve());
        })();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        (async function () {
          await (Promise.resolve());
        })();
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreIIFE: true,
        },
        code: `
declare const promiseIntersection: Promise<number> & number;
(async function () {
  promiseIntersection;
  promiseIntersection.then(() => {});
  promiseIntersection.catch();
  promiseIntersection.finally();
})();
      `,
        errors: [
          {
            line: 4,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseIntersection: Promise<number> & number;
(async function () {
  void (promiseIntersection);
  promiseIntersection.then(() => {});
  promiseIntersection.catch();
  promiseIntersection.finally();
})();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const promiseIntersection: Promise<number> & number;
(async function () {
  await (promiseIntersection);
  promiseIntersection.then(() => {});
  promiseIntersection.catch();
  promiseIntersection.finally();
})();
      `,
              },
            ],
          },
          {
            line: 5,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseIntersection: Promise<number> & number;
(async function () {
  promiseIntersection;
  void (promiseIntersection.then(() => {}));
  promiseIntersection.catch();
  promiseIntersection.finally();
})();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const promiseIntersection: Promise<number> & number;
(async function () {
  promiseIntersection;
  await (promiseIntersection.then(() => {}));
  promiseIntersection.catch();
  promiseIntersection.finally();
})();
      `,
              },
            ],
          },
          {
            line: 6,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseIntersection: Promise<number> & number;
(async function () {
  promiseIntersection;
  promiseIntersection.then(() => {});
  void (promiseIntersection.catch());
  promiseIntersection.finally();
})();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const promiseIntersection: Promise<number> & number;
(async function () {
  promiseIntersection;
  promiseIntersection.then(() => {});
  await (promiseIntersection.catch());
  promiseIntersection.finally();
})();
      `,
              },
            ],
          },
          {
            line: 7,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseIntersection: Promise<number> & number;
(async function () {
  promiseIntersection;
  promiseIntersection.then(() => {});
  promiseIntersection.catch();
  void (promiseIntersection.finally());
})();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const promiseIntersection: Promise<number> & number;
(async function () {
  promiseIntersection;
  promiseIntersection.then(() => {});
  promiseIntersection.catch();
  await (promiseIntersection.finally());
})();
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;

  void (void condition || myPromise());
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;

  await (void condition || myPromise());
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;

  (await condition) && myPromise();
}
      `,
        errors: [
          {
            line: 6,
            message: messages.floating,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;

  await ((await condition) && myPromise());
}
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;

  void (condition && myPromise());
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;

  await (condition && myPromise());
}
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = false;

  void (condition || myPromise());
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = false;

  await (condition || myPromise());
}
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = null;

  void (condition ?? myPromise());
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = null;

  await (condition ?? myPromise());
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
async function foo() {
  const myPromise = Promise.resolve(true);
  let condition = true;
  condition && myPromise;
}
      `,
        errors: [
          {
            line: 5,
            message: messages.floating,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
async function foo() {
  const myPromise = Promise.resolve(true);
  let condition = true;
  await (condition && myPromise);
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
async function foo() {
  const myPromise = Promise.resolve(true);
  let condition = false;
  condition || myPromise;
}
      `,
        errors: [
          {
            line: 5,
            message: messages.floating,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
async function foo() {
  const myPromise = Promise.resolve(true);
  let condition = false;
  await (condition || myPromise);
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
async function foo() {
  const myPromise = Promise.resolve(true);
  let condition = null;
  condition ?? myPromise;
}
      `,
        errors: [
          {
            line: 5,
            message: messages.floating,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
async function foo() {
  const myPromise = Promise.resolve(true);
  let condition = null;
  await (condition ?? myPromise);
}
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = false;

  void (condition || condition || myPromise());
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = false;

  await (condition || condition || myPromise());
}
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
void (Promise.resolve().then(() => {}, undefined));
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
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
await (Promise.resolve().then(() => {}, undefined));
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
              },
            ],
          },
          {
            line: 5,
            message: messages.floatingUselessRejectionHandlerVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
void (Promise.resolve().then(() => {}, null));
Promise.resolve().then(() => {}, 3);
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
await (Promise.resolve().then(() => {}, null));
Promise.resolve().then(() => {}, 3);
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            line: 6,
            message: messages.floatingUselessRejectionHandlerVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
void (Promise.resolve().then(() => {}, 3));
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
await (Promise.resolve().then(() => {}, 3));
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            line: 7,
            message: messages.floatingUselessRejectionHandlerVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
Promise.resolve().then(() => {}, 3);
void (Promise.resolve().then(() => {}, maybeCallable));
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
Promise.resolve().then(() => {}, 3);
await (Promise.resolve().then(() => {}, maybeCallable));
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            line: 10,
            message: messages.floatingUselessRejectionHandlerVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
Promise.resolve().then(() => {}, 3);
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

void (Promise.resolve().catch(undefined));
Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
Promise.resolve().then(() => {}, 3);
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

await (Promise.resolve().catch(undefined));
Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            line: 11,
            message: messages.floatingUselessRejectionHandlerVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
Promise.resolve().then(() => {}, 3);
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
void (Promise.resolve().catch(null));
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
Promise.resolve().then(() => {}, 3);
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
await (Promise.resolve().catch(null));
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            line: 12,
            message: messages.floatingUselessRejectionHandlerVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
Promise.resolve().then(() => {}, 3);
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
Promise.resolve().catch(null);
void (Promise.resolve().catch(3));
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
Promise.resolve().then(() => {}, 3);
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
Promise.resolve().catch(null);
await (Promise.resolve().catch(3));
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            line: 13,
            message: messages.floatingUselessRejectionHandlerVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
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
void (Promise.resolve().catch(maybeCallable));
Promise.resolve().catch(definitelyCallable);
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
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
await (Promise.resolve().catch(maybeCallable));
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
void (Promise.reject() || 3);
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
await (Promise.reject() || 3);
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
void Promise.resolve().then(() => {}, undefined);
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingUselessRejectionHandler,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
await Promise.resolve().then(() => {}, undefined);
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
declare const maybeCallable: string | (() => void);
Promise.resolve().then(() => {}, maybeCallable);
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingUselessRejectionHandler,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
await (Promise.resolve().then(() => {}, maybeCallable));
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
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
            message: messages.floatingUselessRejectionHandler,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
await (Promise.resolve().then(() => {}, undefined));
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
              },
            ],
          },
          {
            line: 5,
            message: messages.floatingUselessRejectionHandler,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
await (Promise.resolve().then(() => {}, null));
Promise.resolve().then(() => {}, 3);
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            line: 6,
            message: messages.floatingUselessRejectionHandler,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
await (Promise.resolve().then(() => {}, 3));
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            line: 7,
            message: messages.floatingUselessRejectionHandler,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
Promise.resolve().then(() => {}, 3);
await (Promise.resolve().then(() => {}, maybeCallable));
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            line: 10,
            message: messages.floatingUselessRejectionHandler,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
Promise.resolve().then(() => {}, 3);
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

await (Promise.resolve().catch(undefined));
Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            line: 11,
            message: messages.floatingUselessRejectionHandler,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
Promise.resolve().then(() => {}, 3);
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
await (Promise.resolve().catch(null));
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            line: 12,
            message: messages.floatingUselessRejectionHandler,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
Promise.resolve().then(() => {}, 3);
Promise.resolve().then(() => {}, maybeCallable);
Promise.resolve().then(() => {}, definitelyCallable);

Promise.resolve().catch(undefined);
Promise.resolve().catch(null);
await (Promise.resolve().catch(3));
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            line: 13,
            message: messages.floatingUselessRejectionHandler,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
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
await (Promise.resolve().catch(maybeCallable));
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
Promise.reject() || 3;
      `,
        errors: [
          {
            line: 2,
            message: messages.floating,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
await (Promise.reject() || 3);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
Promise.reject().finally(() => {});
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
void (Promise.reject().finally(() => {}));
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
await (Promise.reject().finally(() => {}));
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
Promise.reject()
  .finally(() => {})
  .finally(() => {});
      `,
        errors: [
          {
            line: 2,
            message: messages.floating,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
await (Promise.reject()
  .finally(() => {})
  .finally(() => {}));
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
Promise.reject()
  .finally(() => {})
  .finally(() => {})
  .finally(() => {});
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
void (Promise.reject()
  .finally(() => {})
  .finally(() => {})
  .finally(() => {}));
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
await (Promise.reject()
  .finally(() => {})
  .finally(() => {})
  .finally(() => {}));
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
Promise.reject()
  .then(() => {})
  .finally(() => {});
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
void (Promise.reject()
  .then(() => {})
  .finally(() => {}));
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
await (Promise.reject()
  .then(() => {})
  .finally(() => {}));
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const returnsPromise: () => Promise<void> | null;
returnsPromise()?.finally(() => {});
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const returnsPromise: () => Promise<void> | null;
void (returnsPromise()?.finally(() => {}));
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const returnsPromise: () => Promise<void> | null;
await (returnsPromise()?.finally(() => {}));
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const promiseIntersection: Promise<number> & number;
promiseIntersection.finally(() => {});
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
const promiseIntersection: Promise<number> & number;
void (promiseIntersection.finally(() => {}));
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
const promiseIntersection: Promise<number> & number;
await (promiseIntersection.finally(() => {}));
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
Promise.resolve().finally(() => {}), 123;
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
void (Promise.resolve().finally(() => {}), 123);
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
await (Promise.resolve().finally(() => {}), 123);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
(async () => true)().finally();
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
void ((async () => true)().finally());
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
await ((async () => true)().finally());
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
Promise.reject(new Error('message')).finally(() => {});
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
void (Promise.reject(new Error('message')).finally(() => {}));
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
await (Promise.reject(new Error('message')).finally(() => {}));
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
function _<T, S extends Array<T | Promise<T>>>(
  maybePromiseArray: S | undefined,
): void {
  maybePromiseArray?.[0];
}
      `,
        errors: [
          {
            line: 5,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
function _<T, S extends Array<T | Promise<T>>>(
  maybePromiseArray: S | undefined,
): void {
  void (maybePromiseArray?.[0]);
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
function _<T, S extends Array<T | Promise<T>>>(
  maybePromiseArray: S | undefined,
): void {
  await (maybePromiseArray?.[0]);
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
[1, 2, 3].map(() => Promise.reject());
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingPromiseArrayVoid,
          },
        ],
      },
      {
        code: `
declare const array: unknown[];
array.map(() => Promise.reject());
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingPromiseArrayVoid,
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
declare const promiseArray: Array<Promise<unknown>>;
void promiseArray;
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingPromiseArray,
          },
        ],
      },
      {
        options: {
          ignoreVoid: false,
        },
        code: `
declare const promiseArray: Array<Promise<unknown>>;
async function f() {
  await promiseArray;
}
      `,
        errors: [
          {
            line: 4,
            message: messages.floatingPromiseArray,
          },
        ],
      },
      {
        code: `
[1, 2, Promise.reject(), 3];
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingPromiseArrayVoid,
          },
        ],
      },
      {
        code: `
[1, 2, Promise.reject().catch(() => {}), 3];
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingPromiseArrayVoid,
          },
        ],
      },
      {
        code: `
const data = ['test'];
data.map(async () => {
  await new Promise((_res, rej) => setTimeout(rej, 1000));
});
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingPromiseArrayVoid,
          },
        ],
      },
      {
        code: `
function _<T, S extends Array<T | Array<T | Promise<T>>>>(
  maybePromiseArrayArray: S | undefined,
): void {
  maybePromiseArrayArray?.[0];
}
      `,
        errors: [
          {
            line: 5,
            message: messages.floatingPromiseArrayVoid,
          },
        ],
      },
      {
        code: `
function f<T extends Array<Promise<number>>>(a: T): void {
  a;
}
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingPromiseArrayVoid,
          },
        ],
      },
      {
        code: `
declare const a: Array<Promise<number>> | undefined;
a;
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingPromiseArrayVoid,
          },
        ],
      },
      {
        code: `
function f<T extends Array<Promise<number>>>(a: T | undefined): void {
  a;
}
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingPromiseArrayVoid,
          },
        ],
      },
      {
        code: `
[Promise.reject()] as const;
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingPromiseArrayVoid,
          },
        ],
      },
      {
        code: `
declare function cursed(): [Promise<number>, Promise<string>];
cursed();
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingPromiseArrayVoid,
          },
        ],
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
        errors: [
          {
            line: 2,
            message: messages.floatingPromiseArrayVoid,
          },
        ],
      },
      {
        code: `
        declare const arrayOrPromiseTuple:
          | Array<number>
          | [number, number, Promise<unknown>, string];
        arrayOrPromiseTuple;
      `,
        errors: [
          {
            line: 5,
            message: messages.floatingPromiseArrayVoid,
          },
        ],
      },
      {
        code: `
        declare const okArrayOrPromiseArray: Array<number> | Array<Promise<unknown>>;
        okArrayOrPromiseArray;
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingPromiseArrayVoid,
          },
        ],
      },
      {
        options: { allowList: ["it"] },
        code: `
        declare function unsafe(...args: unknown[]): Promise<void>;

        unsafe('...', () => {});
      `,
        errors: [
          {
            line: 4,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        declare function unsafe(...args: unknown[]): Promise<void>;

        void (unsafe('...', () => {}));
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        declare function unsafe(...args: unknown[]): Promise<void>;

        await (unsafe('...', () => {}));
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowList: ["it"] },
        code: `
        declare function it(...args: unknown[]): Promise<void>;

        it('...', () => {}).then(() => {});
      `,
        errors: [
          {
            line: 4,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        declare function it(...args: unknown[]): Promise<void>;

        void (it('...', () => {}).then(() => {}));
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        declare function it(...args: unknown[]): Promise<void>;

        await (it('...', () => {}).then(() => {}));
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowList: ["it"] },
        code: `
        declare function it(...args: unknown[]): Promise<void>;

        it('...', () => {}).finally(() => {});
      `,
        errors: [
          {
            line: 4,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        declare function it(...args: unknown[]): Promise<void>;

        void (it('...', () => {}).finally(() => {}));
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        declare function it(...args: unknown[]): Promise<void>;

        await (it('...', () => {}).finally(() => {}));
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const createPromise: () => Promise<number>;
createPromise();
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const createPromise: () => Promise<number>;
void (createPromise());
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const createPromise: () => Promise<number>;
await (createPromise());
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class MyPromise<T> extends Promise<T> {}
declare const createMyPromise: () => MyPromise<number>;
createMyPromise();
      `,
        errors: [
          {
            line: 4,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
class MyPromise<T> extends Promise<T> {}
declare const createMyPromise: () => MyPromise<number>;
void (createMyPromise());
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
class MyPromise<T> extends Promise<T> {}
declare const createMyPromise: () => MyPromise<number>;
await (createMyPromise());
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const x: any;
function* generator(): Generator<number, void, Promise<number>> {
  yield x;
}
      `,
        errors: [
          {
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const x: any;
function* generator(): Generator<number, void, Promise<number>> {
  void (yield x);
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const x: any;
function* generator(): Generator<number, void, Promise<number>> {
  await (yield x);
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const x: Generator<number, Promise<number>, void>;
function* generator(): Generator<number, void, void> {
  yield* x;
}
      `,
        errors: [
          {
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const x: Generator<number, Promise<number>, void>;
function* generator(): Generator<number, void, void> {
  void (yield* x);
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const x: Generator<number, Promise<number>, void>;
function* generator(): Generator<number, void, void> {
  await (yield* x);
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const value = {};
value as Promise<number>;
      `,
        errors: [
          {
            line: 3,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
const value = {};
void (value as Promise<number>);
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
const value = {};
await (value as Promise<number>);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
({}) as Promise<number> & number;
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
void (({}) as Promise<number> & number);
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
await (({}) as Promise<number> & number);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
({}) as Promise<number> & { yolo?: string };
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
void (({}) as Promise<number> & { yolo?: string });
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
await (({}) as Promise<number> & { yolo?: string });
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
<Promise<number>>{};
      `,
        errors: [
          {
            line: 2,
            message: messages.floatingVoid,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
void (<Promise<number>>{});
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
await (<Promise<number>>{});
      `,
              },
            ],
          },
        ],
      },
    ],
  });
