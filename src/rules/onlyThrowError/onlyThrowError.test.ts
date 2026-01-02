import { expect, test } from "bun:test";
import { ruleTester } from "../../ruleTester.ts";
import { messages, onlyThrowError } from "./onlyThrowError.ts";

test("onlyThrowError", () => {
  const hasError = ruleTester({
    ruleFn: onlyThrowError,
    valid: [
      "throw new Error();",
      "throw new Error('error');",
      "throw Error('error');",
      `
const e = new Error();
throw e;
    `,
      `
try {
  throw new Error();
} catch (e) {
  throw e;
}
    `,
      `
function foo() {
  return new Error();
}
throw foo();
    `,
      `
const foo = {
  bar: new Error(),
};
throw foo.bar;
    `,
      `
const foo = {
  bar: new Error(),
};

throw foo['bar'];
    `,
      `
const foo = {
  bar: new Error(),
};

const bar = 'bar';
throw foo[bar];
    `,
      `
class CustomError extends Error {}
throw new CustomError();
    `,
      `
class CustomError1 extends Error {}
class CustomError2 extends CustomError1 {}
throw new CustomError2();
    `,
      "throw (foo = new Error());",
      "throw (1, 2, new Error());",
      "throw 'literal' && new Error();",
      "throw new Error() || 'literal';",
      "throw foo ? new Error() : new Error();",
      `
function* foo() {
  let index = 0;
  throw yield index++;
}
    `,
      `
async function foo() {
  throw await bar;
}
    `,
      `
import { Error } from './missing';
throw Error;
    `,
      `
class CustomError<T, C> extends Error {}
throw new CustomError<string, string>();
    `,
      `
class CustomError<T = {}> extends Error {}
throw new CustomError();
    `,
      `
class CustomError<T extends object> extends Error {}
throw new CustomError();
    `,
      `
function foo() {
  throw Object.assign(new Error('message'), { foo: 'bar' });
}
    `,
      `
const foo: Error | SyntaxError = bar();
function bar() {
  throw foo;
}
    `,
      `
declare const foo: Error | string;
throw foo as Error;
    `,
      "throw new Error() as Error;",
      `
declare const nullishError: Error | undefined;
throw nullishError ?? new Error();
    `,
      `
declare const nullishError: Error | undefined;
throw nullishError || new Error();
    `,
      `
declare const nullishError: Error | undefined;
throw nullishError ? nullishError : new Error();
    `,
      `
function fun(value: any) {
  throw value;
}
    `,
      `
function fun(value: unknown) {
  throw value;
}
    `,
      `
function fun<T extends Error>(t: T): void {
  throw t;
}
    `,
      {
        options: {
          allow: ["undefined"],
          allowThrowingAny: false,
          allowThrowingUnknown: false,
        },
        code: `
throw undefined;
      `,
      },
      {
        options: {
          allow: ["CustomError"],
          allowThrowingAny: false,
          allowThrowingUnknown: false,
        },
        code: `
class CustomError implements Error {}
throw new CustomError();
      `,
      },
      {
        options: {
          allow: ["Map"],
          allowThrowingAny: false,
          allowThrowingUnknown: false,
        },
        code: `
throw new Map();
      `,
      },
      {
        options: {
          allow: ["createError"],
          allowThrowingAny: false,
          allowThrowingUnknown: false,
        },
        code: `
        import { createError } from 'errors';
        throw createError();
      `,
      },
      {
        options: {
          allowRethrowing: true,
          allowThrowingAny: false,
          allowThrowingUnknown: false,
        },
        code: `
try {
} catch (e) {
  throw e;
}
      `,
      },
      {
        options: {
          allowRethrowing: true,
          allowThrowingAny: false,
          allowThrowingUnknown: false,
        },
        code: `
Promise.reject('foo').catch(e => {
  throw e;
});
      `,
      },
      {
        options: { allowThrowingAny: false },
        code: `
  async function foo() {
    throw await Promise.resolve(new Error('error'));
  }
        `,
      },
      {
        options: { allowThrowingAny: false },
        code: `
  function* foo(): Generator<number, void, Error> {
    throw yield 303;
  }
        `,
      },
    ],
    invalid: [
      { code: "throw undefined;", errors: [{ message: messages.undef }] },
      { code: "throw new String('');", errors: [{ message: messages.object }] },
      { code: "throw 'error';", errors: [{ message: messages.object }] },
      { code: "throw 0;", errors: [{ message: messages.object }] },
      { code: "throw false;", errors: [{ message: messages.object }] },
      { code: "throw null;", errors: [{ message: messages.object }] },
      { code: "throw {};", errors: [{ message: messages.object }] },
      { code: "throw 'a' + 'b';", errors: [{ message: messages.object }] },
      {
        code: `
const a = '';
throw a + 'b';
      `,
        errors: [{ message: messages.object }],
      },
      {
        code: "throw (foo = 'error');",
        errors: [{ message: messages.object }],
      },
      {
        code: "throw (new Error(), 1, 2, 3);",
        errors: [{ message: messages.object }],
      },
      {
        code: "throw 'literal' && 'not an Error';",
        errors: [{ message: messages.object }],
      },
      {
        code: "throw 'literal' || new Error();",
        errors: [{ message: messages.object }],
      },
      {
        code: "throw new Error() && 'literal';",
        errors: [{ message: messages.object }],
      },
      {
        code: "throw 'literal' ?? new Error();",
        errors: [{ message: messages.object }],
      },
      {
        code: "throw foo ? 'not an Error' : 'literal';",
        errors: [{ message: messages.object }],
      },
      {
        code: "throw foo ? new Error() : 'literal';",
        errors: [{ message: messages.object }],
      },
      {
        code: "throw foo ? 'literal' : new Error();",
        errors: [{ message: messages.object }],
      },
      { code: "throw `${err}`;", errors: [{ message: messages.object }] },
      {
        code: `
const err = 'error';
throw err;
      `,
        errors: [{ message: messages.object }],
      },
      {
        code: `
function foo(msg) {}
throw foo('error');
      `,
        errors: [{ message: messages.object }],
      },
      {
        code: `
const foo = {
  msg: 'error',
};
throw foo.msg;
      `,
        errors: [{ message: messages.object }],
      },
      {
        code: `
const foo = {
  msg: undefined,
};
throw foo.msg;
      `,
        errors: [{ message: messages.undef }],
      },
      {
        code: `
class CustomError {}
throw new CustomError();
      `,
        errors: [{ message: messages.object }],
      },
      {
        code: `
class Foo {}
class CustomError extends Foo {}
throw new CustomError();
      `,
        errors: [{ message: messages.object }],
      },
      {
        code: `
const Error = null;
throw Error;
      `,
        errors: [{ message: messages.object }],
      },
      {
        code: `
class CustomError<T extends object> extends Foo {}
throw new CustomError();
      `,
        errors: [{ message: messages.object, line: 3, column: 7 }],
      },
      {
        code: `
function foo<T>() {
  const res: T;
  throw res;
}
      `,
        errors: [{ message: messages.object, line: 4, column: 9 }],
      },
      {
        code: `
function foo<T>(fn: () => Promise<T>) {
  const promise = fn();
  const res = promise.then(() => {}).catch(() => {});
  throw res;
}
      `,
        errors: [{ message: messages.object, line: 5, column: 9 }],
      },
      {
        code: `
function foo() {
  throw Object.assign({ foo: 'foo' }, { bar: 'bar' });
}
      `,
        errors: [{ message: messages.object }],
      },
      {
        code: `
const foo: Error | { bar: string } = bar();
function bar() {
  throw foo;
}
      `,
        errors: [{ message: messages.object }],
      },
      {
        code: `
declare const foo: Error | string;
throw foo as string;
      `,
        errors: [{ message: messages.object }],
      },
      {
        options: { allowThrowingAny: false },
        code: `
function fun(value: any) {
  throw value;
}
      `,
        errors: [{ message: messages.object }],
      },
      {
        options: { allowThrowingUnknown: false },
        code: `
function fun(value: unknown) {
  throw value;
}
      `,
        errors: [{ message: messages.object }],
      },
      {
        code: `
function fun<T extends number>(t: T): void {
  throw t;
}
      `,
        errors: [{ message: messages.object }],
      },
    ],
  });
  expect(hasError).toEqual(false);
});
