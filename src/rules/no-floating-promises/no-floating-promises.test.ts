import { ruleTester } from "../../ruleTester.ts";
import { messages, noFloatingPromises } from "./no-floating-promises.ts";

export const test = () =>
  ruleTester({
    ruleFn: noFloatingPromises,
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
        options: { ignoreIIFE: true },
        code: `
        (async () => {
          await something();
        })();
      `,
      },
      {
        options: { ignoreIIFE: true },
        code: `
        (async () => {
          something();
        })();
      `,
      },
      {
        options: { ignoreIIFE: true },
        code: "(async function foo() {})();",
      },
      {
        options: { ignoreIIFE: true },
        code: `
        function foo() {
          (async function bar() {})();
        }
      `,
      },
      {
        options: { ignoreIIFE: true },
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
        options: { ignoreIIFE: true },
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
        options: { ignoreVoid: false },
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
        options: { ignoreVoid: false },
        code: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;
  condition && (await myPromise());
}
      `,
      },
      {
        options: { ignoreVoid: false },
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
        options: { ignoreVoid: false },
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
        options: { ignoreVoid: false },
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
        options: { ignoreVoid: false },
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
        options: { allowList: ["it"] },
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
        options: { allowList: ["it"] },
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
            message: messages.floatingVoid,
            line: 3,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  void Promise.resolve('value');
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
  await Promise.resolve('value');
  Promise.resolve('value').then(() => {});
  Promise.resolve('value').catch();
  Promise.resolve('value').finally();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 4,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  Promise.resolve('value');
  void Promise.resolve('value').then(() => {});
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
  await Promise.resolve('value').then(() => {});
  Promise.resolve('value').catch();
  Promise.resolve('value').finally();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 5,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  Promise.resolve('value');
  Promise.resolve('value').then(() => {});
  void Promise.resolve('value').catch();
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
  await Promise.resolve('value').catch();
  Promise.resolve('value').finally();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 6,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  Promise.resolve('value');
  Promise.resolve('value').then(() => {});
  Promise.resolve('value').catch();
  void Promise.resolve('value').finally();
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
  await Promise.resolve('value').finally();
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
            message: messages.floatingVoid,
            line: 11,
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
  void obj1.a?.b?.c?.();
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
  await obj1.a?.b?.c?.();
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
            message: messages.floatingVoid,
            line: 12,
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
  void obj2.a?.b?.c();
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
  await obj2.a?.b?.c();
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
            message: messages.floatingVoid,
            line: 13,
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
  void obj3.a?.b.c?.();
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
  await obj3.a?.b.c?.();
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
            message: messages.floatingVoid,
            line: 14,
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
  void obj4.a.b.c?.();
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
  await obj4.a.b.c?.();
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
            message: messages.floatingVoid,
            line: 15,
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
  void obj5.a?.().b?.c?.();
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
  await obj5.a?.().b?.c?.();
  obj6?.a.b.c?.();

  callback?.();
};

doSomething();
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 16,
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
  void obj6?.a.b.c?.();

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
  await obj6?.a.b.c?.();

  callback?.();
};

doSomething();
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 18,
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

  void callback?.();
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

  await callback?.();
};

doSomething();
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 21,
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

void doSomething();
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

await doSomething();
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
            message: messages.floatingVoid,
            line: 3,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const myTag: (strings: TemplateStringsArray) => Promise<void>;
void myTag\`abc\`;
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const myTag: (strings: TemplateStringsArray) => Promise<void>;
await myTag\`abc\`;
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
            message: messages.floatingVoid,
            line: 3,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const myTag: (strings: TemplateStringsArray) => Promise<void>;
void myTag\`abc\`.then(() => {});
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const myTag: (strings: TemplateStringsArray) => Promise<void>;
await myTag\`abc\`.then(() => {});
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
            message: messages.floatingVoid,
            line: 3,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const myTag: (strings: TemplateStringsArray) => Promise<void>;
void myTag\`abc\`.finally(() => {});
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const myTag: (strings: TemplateStringsArray) => Promise<void>;
await myTag\`abc\`.finally(() => {});
      `,
              },
            ],
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
            message: messages.floatingVoid,
            line: 3,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  void Promise.resolve('value');
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  await Promise.resolve('value');
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
            message: messages.floatingVoid,
            line: 3,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  void Promise.reject(new Error('message'));
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
  await Promise.reject(new Error('message'));
  Promise.reject(new Error('message')).then(() => {});
  Promise.reject(new Error('message')).catch();
  Promise.reject(new Error('message')).finally();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 4,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  Promise.reject(new Error('message'));
  void Promise.reject(new Error('message')).then(() => {});
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
  await Promise.reject(new Error('message')).then(() => {});
  Promise.reject(new Error('message')).catch();
  Promise.reject(new Error('message')).finally();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 5,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  Promise.reject(new Error('message'));
  Promise.reject(new Error('message')).then(() => {});
  void Promise.reject(new Error('message')).catch();
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
  await Promise.reject(new Error('message')).catch();
  Promise.reject(new Error('message')).finally();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 6,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  Promise.reject(new Error('message'));
  Promise.reject(new Error('message')).then(() => {});
  Promise.reject(new Error('message')).catch();
  void Promise.reject(new Error('message')).finally();
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
  await Promise.reject(new Error('message')).finally();
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
            message: messages.floatingVoid,
            line: 3,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  void (async () => true)();
  (async () => true)().then(() => {});
  (async () => true)().catch();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  await (async () => true)();
  (async () => true)().then(() => {});
  (async () => true)().catch();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 4,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  (async () => true)();
  void (async () => true)().then(() => {});
  (async () => true)().catch();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  (async () => true)();
  await (async () => true)().then(() => {});
  (async () => true)().catch();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 5,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  (async () => true)();
  (async () => true)().then(() => {});
  void (async () => true)().catch();
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  (async () => true)();
  (async () => true)().then(() => {});
  await (async () => true)().catch();
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
            message: messages.floatingVoid,
            line: 5,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  async function returnsPromise() {}

  void returnsPromise();
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

  await returnsPromise();
  returnsPromise().then(() => {});
  returnsPromise().catch();
  returnsPromise().finally();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 6,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  async function returnsPromise() {}

  returnsPromise();
  void returnsPromise().then(() => {});
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
  await returnsPromise().then(() => {});
  returnsPromise().catch();
  returnsPromise().finally();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 7,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  async function returnsPromise() {}

  returnsPromise();
  returnsPromise().then(() => {});
  void returnsPromise().catch();
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
  await returnsPromise().catch();
  returnsPromise().finally();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 8,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  async function returnsPromise() {}

  returnsPromise();
  returnsPromise().then(() => {});
  returnsPromise().catch();
  void returnsPromise().finally();
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
  await returnsPromise().finally();
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
            message: messages.floatingVoid,
            line: 3,
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
            message: messages.floatingVoid,
            line: 4,
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
            message: messages.floatingVoid,
            line: 3,
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
            message: messages.floatingVoid,
            line: 4,
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
            message: messages.floatingVoid,
            line: 5,
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
        options: { ignoreVoid: false },
        code: `
async function test() {
  void Promise.resolve();
}
      `,
        errors: [
          {
            message: messages.floating,
            line: 3,
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
        options: { ignoreVoid: false },
        code: `
async function test() {
  const promise = new Promise((resolve, reject) => resolve('value'));
  promise;
}
      `,
        errors: [
          {
            message: messages.floating,
            line: 4,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  const promise = new Promise((resolve, reject) => resolve('value'));
  await promise;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoid: false },
        code: `
async function returnsPromise() {
  return 'value';
}
void returnsPromise();
      `,
        errors: [
          {
            message: messages.floating,
            line: 5,
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
        options: { ignoreVoid: false }, // eslint-disable-next-line @typescript-eslint/internal/plugin-test-formatting
        code: `
async function returnsPromise() {
  return 'value';
}
void /* ... */ returnsPromise();
      `,
        errors: [
          {
            message: messages.floating,
            line: 5,
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
        options: { ignoreVoid: false },
        code: `
async function returnsPromise() {
  return 'value';
}
1, returnsPromise();
      `,
        errors: [
          {
            message: messages.floating,
            line: 5,
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
        options: { ignoreVoid: false },
        code: `
async function returnsPromise() {
  return 'value';
}
bool ? returnsPromise() : null;
      `,
        errors: [
          {
            message: messages.floating,
            line: 5,
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
            message: messages.floatingVoid,
            line: 4,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  const obj = { foo: Promise.resolve() };
  void obj.foo;
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  const obj = { foo: Promise.resolve() };
  await obj.foo;
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
            message: messages.floatingVoid,
            line: 3,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  void new Promise(resolve => resolve());
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
async function test() {
  await new Promise(resolve => resolve());
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
            message: messages.floatingVoid,
            line: 5,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseValue: Promise<number>;

async function test() {
  void promiseValue;
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
  await promiseValue;
  promiseValue.then(() => {});
  promiseValue.catch();
  promiseValue.finally();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 6,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseValue: Promise<number>;

async function test() {
  promiseValue;
  void promiseValue.then(() => {});
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
  await promiseValue.then(() => {});
  promiseValue.catch();
  promiseValue.finally();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 7,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseValue: Promise<number>;

async function test() {
  promiseValue;
  promiseValue.then(() => {});
  void promiseValue.catch();
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
  await promiseValue.catch();
  promiseValue.finally();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 8,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseValue: Promise<number>;

async function test() {
  promiseValue;
  promiseValue.then(() => {});
  promiseValue.catch();
  void promiseValue.finally();
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
  await promiseValue.finally();
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
            message: messages.floatingVoid,
            line: 5,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseUnion: Promise<number> | number;

async function test() {
  void promiseUnion;
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const promiseUnion: Promise<number> | number;

async function test() {
  await promiseUnion;
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
            message: messages.floatingVoid,
            line: 5,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseIntersection: Promise<number> & number;

async function test() {
  void promiseIntersection;
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
  await promiseIntersection;
  promiseIntersection.then(() => {});
  promiseIntersection.catch();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 6,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseIntersection: Promise<number> & number;

async function test() {
  promiseIntersection;
  void promiseIntersection.then(() => {});
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
  await promiseIntersection.then(() => {});
  promiseIntersection.catch();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 7,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseIntersection: Promise<number> & number;

async function test() {
  promiseIntersection;
  promiseIntersection.then(() => {});
  void promiseIntersection.catch();
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
  await promiseIntersection.catch();
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
            message: messages.floatingVoid,
            line: 6,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  class CanThen extends Promise<number> {}
  const canThen: CanThen = Foo.resolve(2);

  void canThen;
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

  await canThen;
  canThen.then(() => {});
  canThen.catch();
  canThen.finally();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 7,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  class CanThen extends Promise<number> {}
  const canThen: CanThen = Foo.resolve(2);

  canThen;
  void canThen.then(() => {});
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
  await canThen.then(() => {});
  canThen.catch();
  canThen.finally();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 8,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
async function test() {
  class CanThen extends Promise<number> {}
  const canThen: CanThen = Foo.resolve(2);

  canThen;
  canThen.then(() => {});
  void canThen.catch();
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
  await canThen.catch();
  canThen.finally();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 9,
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
  void canThen.finally();
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
  await canThen.finally();
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
            message: messages.floatingVoid,
            line: 18,
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

  void promise;
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

  await promise;
  promise.then(() => {});
  promise.catch();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 19,
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
  void promise.then(() => {});
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
  await promise.then(() => {});
  promise.catch();
}
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 20,
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
  void promise.catch();
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
  await promise.catch();
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
            message: messages.floatingVoid,
            line: 2,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        void (async () => {
          await something();
        })();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        await (async () => {
          await something();
        })();
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
            message: messages.floatingVoid,
            line: 2,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        void (async () => {
          something();
        })();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        await (async () => {
          something();
        })();
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
            message: messages.floatingVoid,
            line: 1,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: "void (async function foo() {})();",
              },
              {
                message: messages.floatingFixAwait,
                output: "await (async function foo() {})();",
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
            message: messages.floatingVoid,
            line: 3,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        function foo() {
          void (async function bar() {})();
        }
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        function foo() {
          await (async function bar() {})();
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
            message: messages.floatingVoid,
            line: 4,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        const foo = () =>
          new Promise(res => {
            void (async function () {
              await res(1);
            })();
          });
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        const foo = () =>
          new Promise(res => {
            await (async function () {
              await res(1);
            })();
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
            message: messages.floatingVoid,
            line: 2,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        void (async function () {
          await res(1);
        })();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        await (async function () {
          await res(1);
        })();
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreIIFE: true },
        code: `
        (async function () {
          Promise.resolve();
        })();
      `,
        errors: [
          {
            message: messages.floatingVoid,
            line: 3,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        (async function () {
          void Promise.resolve();
        })();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        (async function () {
          await Promise.resolve();
        })();
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreIIFE: true },
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
            message: messages.floatingVoid,
            line: 4,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseIntersection: Promise<number> & number;
(async function () {
  void promiseIntersection;
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
  await promiseIntersection;
  promiseIntersection.then(() => {});
  promiseIntersection.catch();
  promiseIntersection.finally();
})();
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 5,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseIntersection: Promise<number> & number;
(async function () {
  promiseIntersection;
  void promiseIntersection.then(() => {});
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
  await promiseIntersection.then(() => {});
  promiseIntersection.catch();
  promiseIntersection.finally();
})();
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 6,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseIntersection: Promise<number> & number;
(async function () {
  promiseIntersection;
  promiseIntersection.then(() => {});
  void promiseIntersection.catch();
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
  await promiseIntersection.catch();
  promiseIntersection.finally();
})();
      `,
              },
            ],
          },
          {
            message: messages.floatingVoid,
            line: 7,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const promiseIntersection: Promise<number> & number;
(async function () {
  promiseIntersection;
  promiseIntersection.then(() => {});
  promiseIntersection.catch();
  void promiseIntersection.finally();
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
  await promiseIntersection.finally();
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
            message: messages.floatingVoid,
            line: 6,
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
        options: { ignoreVoid: false },
        code: `
async function foo() {
  const myPromise = async () => void 0;
  const condition = true;

  (await condition) && myPromise();
}
      `,
        errors: [
          {
            message: messages.floating,
            line: 6,
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
            message: messages.floatingVoid,
            line: 6,
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
            message: messages.floatingVoid,
            line: 6,
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
            message: messages.floatingVoid,
            line: 6,
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
        options: { ignoreVoid: false },
        code: `
async function foo() {
  const myPromise = Promise.resolve(true);
  let condition = true;
  condition && myPromise;
}
      `,
        errors: [
          {
            message: messages.floating,
            line: 5,
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
        options: { ignoreVoid: false },
        code: `
async function foo() {
  const myPromise = Promise.resolve(true);
  let condition = false;
  condition || myPromise;
}
      `,
        errors: [
          {
            message: messages.floating,
            line: 5,
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
        options: { ignoreVoid: false },
        code: `
async function foo() {
  const myPromise = Promise.resolve(true);
  let condition = null;
  condition ?? myPromise;
}
      `,
        errors: [
          {
            message: messages.floating,
            line: 5,
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
            message: messages.floatingVoid,
            line: 6,
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
            message: messages.floatingUselessRejectionHandlerVoid,
            line: 4,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
void Promise.resolve().then(() => {}, undefined);
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
await Promise.resolve().then(() => {}, undefined);
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
            message: messages.floatingUselessRejectionHandlerVoid,
            line: 5,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
void Promise.resolve().then(() => {}, null);
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
await Promise.resolve().then(() => {}, null);
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
            message: messages.floatingUselessRejectionHandlerVoid,
            line: 6,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
void Promise.resolve().then(() => {}, 3);
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
await Promise.resolve().then(() => {}, 3);
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
            message: messages.floatingUselessRejectionHandlerVoid,
            line: 7,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
Promise.resolve().then(() => {}, 3);
void Promise.resolve().then(() => {}, maybeCallable);
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
await Promise.resolve().then(() => {}, maybeCallable);
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
            message: messages.floatingUselessRejectionHandlerVoid,
            line: 10,
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

void Promise.resolve().catch(undefined);
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

await Promise.resolve().catch(undefined);
Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            message: messages.floatingUselessRejectionHandlerVoid,
            line: 11,
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
void Promise.resolve().catch(null);
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
await Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            message: messages.floatingUselessRejectionHandlerVoid,
            line: 12,
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
void Promise.resolve().catch(3);
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
await Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            message: messages.floatingUselessRejectionHandlerVoid,
            line: 13,
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
void Promise.resolve().catch(maybeCallable);
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
await Promise.resolve().catch(maybeCallable);
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
            message: messages.floatingVoid,
            line: 2,
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
        options: { ignoreVoid: false },
        code: `
void Promise.resolve().then(() => {}, undefined);
      `,
        errors: [
          {
            message: messages.floatingUselessRejectionHandler,
            line: 2,
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
        options: { ignoreVoid: false },
        code: `
declare const maybeCallable: string | (() => void);
Promise.resolve().then(() => {}, maybeCallable);
      `,
        errors: [
          {
            message: messages.floatingUselessRejectionHandler,
            line: 3,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
await Promise.resolve().then(() => {}, maybeCallable);
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoid: false },
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
            message: messages.floatingUselessRejectionHandler,
            line: 4,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
await Promise.resolve().then(() => {}, undefined);
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
            message: messages.floatingUselessRejectionHandler,
            line: 5,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
await Promise.resolve().then(() => {}, null);
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
            message: messages.floatingUselessRejectionHandler,
            line: 6,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
await Promise.resolve().then(() => {}, 3);
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
            message: messages.floatingUselessRejectionHandler,
            line: 7,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
declare const maybeCallable: string | (() => void);
declare const definitelyCallable: () => void;
Promise.resolve().then(() => {}, undefined);
Promise.resolve().then(() => {}, null);
Promise.resolve().then(() => {}, 3);
await Promise.resolve().then(() => {}, maybeCallable);
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
            message: messages.floatingUselessRejectionHandler,
            line: 10,
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

await Promise.resolve().catch(undefined);
Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            message: messages.floatingUselessRejectionHandler,
            line: 11,
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
await Promise.resolve().catch(null);
Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            message: messages.floatingUselessRejectionHandler,
            line: 12,
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
await Promise.resolve().catch(3);
Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
          {
            message: messages.floatingUselessRejectionHandler,
            line: 13,
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
await Promise.resolve().catch(maybeCallable);
Promise.resolve().catch(definitelyCallable);
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoid: false },
        code: `
Promise.reject() || 3;
      `,
        errors: [
          {
            message: messages.floating,
            line: 2,
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
            message: messages.floatingVoid,
            line: 2,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
void Promise.reject().finally(() => {});
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
await Promise.reject().finally(() => {});
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoid: false },
        code: `
Promise.reject()
  .finally(() => {})
  .finally(() => {});
      `,
        errors: [
          {
            message: messages.floating,
            line: 2,
            suggestions: [
              {
                message: messages.floatingFixAwait,
                output: `
await Promise.reject()
  .finally(() => {})
  .finally(() => {});
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
            message: messages.floatingVoid,
            line: 2,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
void Promise.reject()
  .finally(() => {})
  .finally(() => {})
  .finally(() => {});
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
await Promise.reject()
  .finally(() => {})
  .finally(() => {})
  .finally(() => {});
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
            message: messages.floatingVoid,
            line: 2,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
void Promise.reject()
  .then(() => {})
  .finally(() => {});
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
await Promise.reject()
  .then(() => {})
  .finally(() => {});
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
            message: messages.floatingVoid,
            line: 3,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const returnsPromise: () => Promise<void> | null;
void returnsPromise()?.finally(() => {});
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const returnsPromise: () => Promise<void> | null;
await returnsPromise()?.finally(() => {});
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
            message: messages.floatingVoid,
            line: 3,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
const promiseIntersection: Promise<number> & number;
void promiseIntersection.finally(() => {});
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
const promiseIntersection: Promise<number> & number;
await promiseIntersection.finally(() => {});
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
            message: messages.floatingVoid,
            line: 2,
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
            message: messages.floatingVoid,
            line: 2,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
void (async () => true)().finally();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
await (async () => true)().finally();
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
            message: messages.floatingVoid,
            line: 2,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
void Promise.reject(new Error('message')).finally(() => {});
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
await Promise.reject(new Error('message')).finally(() => {});
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
            message: messages.floatingVoid,
            line: 5,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
function _<T, S extends Array<T | Promise<T>>>(
  maybePromiseArray: S | undefined,
): void {
  void maybePromiseArray?.[0];
}
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
function _<T, S extends Array<T | Promise<T>>>(
  maybePromiseArray: S | undefined,
): void {
  await maybePromiseArray?.[0];
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
        errors: [{ message: messages.floatingPromiseArrayVoid, line: 2 }],
      },
      {
        code: `
declare const array: unknown[];
array.map(() => Promise.reject());
      `,
        errors: [{ message: messages.floatingPromiseArrayVoid, line: 3 }],
      },
      {
        options: { ignoreVoid: false },
        code: `
declare const promiseArray: Array<Promise<unknown>>;
void promiseArray;
      `,
        errors: [{ message: messages.floatingPromiseArray, line: 3 }],
      },
      {
        options: { ignoreVoid: false },
        code: `
declare const promiseArray: Array<Promise<unknown>>;
async function f() {
  await promiseArray;
}
      `,
        errors: [{ message: messages.floatingPromiseArray, line: 4 }],
      },
      {
        code: `
[1, 2, Promise.reject(), 3];
      `,
        errors: [{ message: messages.floatingPromiseArrayVoid, line: 2 }],
      },
      {
        code: `
[1, 2, Promise.reject().catch(() => {}), 3];
      `,
        errors: [{ message: messages.floatingPromiseArrayVoid, line: 2 }],
      },
      {
        code: `
const data = ['test'];
data.map(async () => {
  await new Promise((_res, rej) => setTimeout(rej, 1000));
});
      `,
        errors: [{ message: messages.floatingPromiseArrayVoid, line: 3 }],
      },
      {
        code: `
function _<T, S extends Array<T | Array<T | Promise<T>>>>(
  maybePromiseArrayArray: S | undefined,
): void {
  maybePromiseArrayArray?.[0];
}
      `,
        errors: [{ message: messages.floatingPromiseArrayVoid, line: 5 }],
      },
      {
        code: `
function f<T extends Array<Promise<number>>>(a: T): void {
  a;
}
      `,
        errors: [{ message: messages.floatingPromiseArrayVoid, line: 3 }],
      },
      {
        code: `
declare const a: Array<Promise<number>> | undefined;
a;
      `,
        errors: [{ message: messages.floatingPromiseArrayVoid, line: 3 }],
      },
      {
        code: `
function f<T extends Array<Promise<number>>>(a: T | undefined): void {
  a;
}
      `,
        errors: [{ message: messages.floatingPromiseArrayVoid, line: 3 }],
      },
      {
        code: `
[Promise.reject()] as const;
      `,
        errors: [{ message: messages.floatingPromiseArrayVoid, line: 2 }],
      },
      {
        code: `
declare function cursed(): [Promise<number>, Promise<string>];
cursed();
      `,
        errors: [{ message: messages.floatingPromiseArrayVoid, line: 3 }],
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
        errors: [{ message: messages.floatingPromiseArrayVoid, line: 2 }],
      },
      {
        code: `
        declare const arrayOrPromiseTuple:
          | Array<number>
          | [number, number, Promise<unknown>, string];
        arrayOrPromiseTuple;
      `,
        errors: [{ message: messages.floatingPromiseArrayVoid, line: 5 }],
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
            message: messages.floatingVoid,
            line: 4,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        declare function unsafe(...args: unknown[]): Promise<void>;

        void unsafe('...', () => {});
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        declare function unsafe(...args: unknown[]): Promise<void>;

        await unsafe('...', () => {});
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
            message: messages.floatingVoid,
            line: 4,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        declare function it(...args: unknown[]): Promise<void>;

        void it('...', () => {}).then(() => {});
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        declare function it(...args: unknown[]): Promise<void>;

        await it('...', () => {}).then(() => {});
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
            message: messages.floatingVoid,
            line: 4,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
        declare function it(...args: unknown[]): Promise<void>;

        void it('...', () => {}).finally(() => {});
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
        declare function it(...args: unknown[]): Promise<void>;

        await it('...', () => {}).finally(() => {});
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
            message: messages.floatingVoid,
            line: 3,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
declare const createPromise: () => Promise<number>;
void createPromise();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
declare const createPromise: () => Promise<number>;
await createPromise();
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
            message: messages.floatingVoid,
            line: 4,
            suggestions: [
              {
                message: messages.floatingFixVoid,
                output: `
class MyPromise<T> extends Promise<T> {}
declare const createMyPromise: () => MyPromise<number>;
void createMyPromise();
      `,
              },
              {
                message: messages.floatingFixAwait,
                output: `
class MyPromise<T> extends Promise<T> {}
declare const createMyPromise: () => MyPromise<number>;
await createMyPromise();
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
            message: messages.floatingVoid,
            line: 3,
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
            message: messages.floatingVoid,
            line: 2,
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
            message: messages.floatingVoid,
            line: 2,
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
            message: messages.floatingVoid,
            line: 2,
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
