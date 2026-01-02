import { expect, test } from "bun:test";
import { ruleTester } from "../../ruleTester.ts";
import {
  messages,
  noConfusingVoidExpression,
} from "./noConfusingVoidExpression.ts";

test("noConfusingVoidExpression", () => {
  const hasError = ruleTester({
    ruleFn: noConfusingVoidExpression,
    valid: [
      "() => Math.random();",
      "console.log('foo');",
      "foo && console.log(foo);",
      "foo || console.log(foo);",
      "foo ? console.log(true) : console.log(false);",
      "console?.log('foo');",
      {
        options: { ignoreArrowShorthand: true },
        code: `
        () => console.log('foo');
      `,
      },
      {
        options: { ignoreArrowShorthand: true },
        code: `
        foo => foo && console.log(foo);
      `,
      },
      {
        options: { ignoreArrowShorthand: true },
        code: `
        foo => foo || console.log(foo);
      `,
      },
      {
        options: { ignoreArrowShorthand: true },
        code: `
        foo => (foo ? console.log(true) : console.log(false));
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        !void console.log('foo');
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        +void (foo && console.log(foo));
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        -void (foo || console.log(foo));
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        () => void ((foo && void console.log(true)) || console.log(false));
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        const x = void (foo ? console.log(true) : console.log(false));
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        !(foo && void console.log(foo));
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        !!(foo || void console.log(foo));
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        const x = (foo && void console.log(true)) || void console.log(false);
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        () => (foo ? void console.log(true) : void console.log(false));
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        return void console.log('foo');
      `,
      },
      `
function cool(input: string) {
  return console.log(input), input;
}
    `,
      {
        code: `
function cool(input: string) {
  return input, console.log(input), input;
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): void {
  return console.log('bar');
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const test = (): void => {
  return console.log('bar');
};
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const test = (): void => console.log('bar');
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): void {
  {
    return console.log('foo');
  }
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const obj = {
  test(): void {
    return console.log('foo');
  },
};
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
class Foo {
  test(): void {
    return console.log('foo');
  }
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test() {
  function nestedTest(): void {
    return console.log('foo');
  }
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = () => void;
const test = (() => console.log()) as Foo;
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = {
  foo: () => void;
};
const test: Foo = {
  foo: () => console.log(),
};
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const test = {
  foo: () => console.log(),
} as {
  foo: () => void;
};
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const test: {
  foo: () => void;
} = {
  foo: () => console.log(),
};
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = {
  foo: { bar: () => void };
};

const test = {
  foo: { bar: () => console.log() },
} as Foo;
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = {
  foo: { bar: () => void };
};

const test: Foo = {
  foo: { bar: () => console.log() },
};
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type MethodType = () => void;

class App {
  private method: MethodType = () => console.log();
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
interface Foo {
  foo: () => void;
}

function bar(): Foo {
  return {
    foo: () => console.log(),
  };
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = () => () => () => void;
const x: Foo = () => () => () => console.log();
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = {
  foo: () => void;
};

const test = {
  foo: () => console.log(),
} as Foo;
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = () => void;
const test: Foo = () => console.log('foo');
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        tsx: true,
        code: "const foo = <button onClick={() => console.log()} />;",
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
declare function foo(arg: () => void): void;
foo(() => console.log());
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
declare function foo(arg: (() => void) | (() => string)): void;
foo(() => console.log());
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
declare function foo(arg: (() => void) | (() => string) | string): void;
foo(() => console.log());
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
declare function foo(arg: () => void | string): void;
foo(() => console.log());
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
declare function foo(options: { cb: () => void }): void;
foo({ cb: () => console.log() });
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const obj = {
  foo: { bar: () => console.log() },
} as {
  foo: { bar: () => void };
};
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): void & void {
  return console.log('foo');
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = void;

declare function foo(): Foo;

function test(): Foo {
  return foo();
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = void;
const test = (): Foo => console.log('err');
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const test: () => any = (): void => console.log();
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): void | string {
  return console.log('bar');
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
export function makeDate(): Date;
export function makeDate(m: number): void;
export function makeDate(m?: number): Date | void {
  if (m !== undefined) {
    return console.log('123');
  }
  return new Date();
}

declare const test: (cb: () => void) => void;

test((() => {
  return console.log('123');
}) as typeof makeDate | (() => string));
      `,
      },
    ],
    invalid: [
      {
        code: `
        const x = console.log('foo');
      `,
        errors: [
          {
            column: 19,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        const x = console?.log('foo');
      `,
        errors: [
          {
            column: 19,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        console.error(console.log('foo'));
      `,
        errors: [
          {
            column: 23,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        [console.log('foo')];
      `,
        errors: [
          {
            column: 10,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        ({ x: console.log('foo') });
      `,
        errors: [
          {
            column: 15,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        void console.log('foo');
      `,
        errors: [
          {
            column: 14,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        console.log('foo') ? true : false;
      `,
        errors: [
          {
            column: 9,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        (console.log('foo') && true) || false;
      `,
        errors: [
          {
            column: 10,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        (cond && console.log('ok')) || console.log('error');
      `,
        errors: [
          {
            column: 18,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        !console.log('foo');
      `,
        errors: [
          {
            column: 10,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
function notcool(input: string) {
  return input, console.log(input);
}
      `,
        errors: [
          {
            column: 17,
            line: 3,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
function notcool(input: string) {
  input, console.log(input);
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: "() => console.log('foo');",
        errors: [
          {
            column: 7,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        code: "foo => foo && console.log(foo);",
        errors: [
          {
            column: 15,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        code: "(foo: undefined) => foo && console.log(foo);",
        errors: [
          {
            column: 28,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        code: "foo => foo || console.log(foo);",
        errors: [
          {
            column: 15,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        code: "(foo: undefined) => foo || console.log(foo);",
        errors: [
          {
            column: 28,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        code: "(foo: void) => foo || console.log(foo);",
        errors: [
          {
            column: 23,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        code: "foo => (foo ? console.log(true) : console.log(false));",
        errors: [
          {
            column: 15,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
          {
            column: 35,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        code: `
        function f() {
          return console.log('foo');
          console.log('bar');
        }
      `,
        errors: [
          {
            column: 18,
            line: 3,
            message: messages.invalidVoidExprReturn,
            suggestions: [
              {
                message: messages.moveBeforeReturn,
                output: `
        function f() {
          console.log('foo'); return;
          console.log('bar');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f() {
          console.log('foo')
          return ['bar', 'baz'].forEach(console.log)
          console.log('quux')
        }
      `,
        errors: [
          {
            column: 18,
            line: 4,
            message: messages.invalidVoidExprReturn,
            suggestions: [
              {
                message: messages.moveBeforeReturn,
                output: `
        function f() {
          console.log('foo')
          ;['bar', 'baz'].forEach(console.log); return;
          console.log('quux')
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f() {
          console.log('foo');
          return console.log('bar');
        }
      `,
        errors: [
          {
            column: 18,
            line: 4,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
        function f() {
          console.log('foo');
          console.log('bar');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f() {
          console.log('foo')
          return ['bar', 'baz'].forEach(console.log)
        }
      `,
        errors: [
          {
            column: 18,
            line: 4,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
        function f() {
          console.log('foo')
          ;['bar', 'baz'].forEach(console.log);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        const f = () => {
          if (cond) {
            return console.error('foo');
          }
          console.log('bar');
        };
      `,
        errors: [
          {
            column: 20,
            line: 4,
            message: messages.invalidVoidExprReturn,
            suggestions: [
              {
                message: messages.moveBeforeReturn,
                output: `
        const f = () => {
          if (cond) {
            console.error('foo'); return;
          }
          console.log('bar');
        };
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        const f = function () {
          if (cond) return console.error('foo');
          console.log('bar');
        };
      `,
        errors: [
          {
            column: 28,
            line: 3,
            message: messages.invalidVoidExprReturn,
            suggestions: [
              {
                message: messages.moveBeforeReturn,
                output: `
        const f = function () {
          if (cond) { console.error('foo'); return; }
          console.log('bar');
        };
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        const f = function () {
          let num = 1;
          return num ? console.log('foo') : num;
        };
      `,
        errors: [
          {
            column: 24,
            line: 4,
            message: messages.invalidVoidExprReturnLast,
          },
        ],
      },
      {
        code: `
        const f = function () {
          let undef = undefined;
          return undef ? console.log('foo') : undef;
        };
      `,
        errors: [
          {
            column: 26,
            line: 4,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
        const f = function () {
          let undef = undefined;
          undef ? console.log('foo') : undef;
        };
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        const f = function () {
          let num = 1;
          return num || console.log('foo');
        };
      `,
        errors: [
          {
            column: 25,
            line: 4,
            message: messages.invalidVoidExprReturnLast,
          },
        ],
      },
      {
        code: `
        const f = function () {
          let bar = void 0;
          return bar || console.log('foo');
        };
      `,
        errors: [
          {
            column: 25,
            line: 4,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
        const f = function () {
          let bar = void 0;
          bar || console.log('foo');
        };
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        let num = 1;
        const foo = () => (num ? console.log('foo') : num);
      `,
        errors: [
          {
            column: 34,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        code: `
        let bar = void 0;
        const foo = () => (bar ? console.log('foo') : bar);
      `,
        errors: [
          {
            column: 34,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "return console.log('foo');",
        errors: [
          {
            column: 8,
            line: 1,
            message: messages.invalidVoidExprReturnWrapVoid,
            suggestions: [
              {
                message: messages.voidExprWrapVoid,
                output: "return void console.log('foo');",
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "console.error(console.log('foo'));",
        errors: [
          {
            column: 15,
            line: 1,
            message: messages.invalidVoidExprWrapVoid,
            suggestions: [
              {
                message: messages.voidExprWrapVoid,
                output: "console.error(void console.log('foo'));",
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "console.log('foo') ? true : false;",
        errors: [
          {
            column: 1,
            line: 1,
            message: messages.invalidVoidExprWrapVoid,
            suggestions: [
              {
                message: messages.voidExprWrapVoid,
                output: "void console.log('foo') ? true : false;",
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "const x = foo ?? console.log('foo');",
        errors: [
          {
            column: 18,
            line: 1,
            message: messages.invalidVoidExprWrapVoid,
            suggestions: [
              {
                message: messages.voidExprWrapVoid,
                output: "const x = foo ?? void console.log('foo');",
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "foo => foo || console.log(foo);",
        errors: [
          {
            column: 15,
            line: 1,
            message: messages.invalidVoidExprArrowWrapVoid,
            suggestions: [
              {
                message: messages.voidExprWrapVoid,
                output: "foo => foo || void console.log(foo);",
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "!!console.log('foo');",
        errors: [
          {
            column: 3,
            line: 1,
            message: messages.invalidVoidExprWrapVoid,
            suggestions: [
              {
                message: messages.voidExprWrapVoid,
                output: "!!void console.log('foo');",
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test() {
  return console.log('foo');
}
      `,
        errors: [
          {
            column: 10,
            line: 3,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
function test() {
  console.log('foo');
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: "const test = () => console.log('foo');",
        errors: [
          {
            column: 20,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const test = () => {
  return console.log('foo');
};
      `,
        errors: [
          {
            column: 10,
            line: 3,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
const test = () => {
  console.log('foo');
};
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function foo(): void {
  const bar = () => {
    return console.log();
  };
}
      `,
        errors: [
          {
            column: 12,
            line: 4,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
function foo(): void {
  const bar = () => {
    console.log();
  };
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
        (): any => console.log('foo');
      `,
        errors: [
          {
            column: 20,
            line: 2,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
        (): unknown => console.log('foo');
      `,
        errors: [
          {
            column: 24,
            line: 2,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): void {
  () => () => console.log();
}
      `,
        errors: [
          {
            column: 15,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = any;
(): Foo => console.log();
      `,
        errors: [
          {
            column: 12,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = unknown;
(): Foo => console.log();
      `,
        errors: [
          {
            column: 12,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): any {
  () => () => console.log();
}
      `,
        errors: [
          {
            column: 15,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): unknown {
  return console.log();
}
      `,
        errors: [
          {
            column: 10,
            line: 3,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
function test(): unknown {
  console.log();
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): any {
  return console.log();
}
      `,
        errors: [
          {
            column: 10,
            line: 3,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
function test(): any {
  console.log();
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = () => any;
(): Foo => () => console.log();
      `,
        errors: [
          {
            column: 18,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = () => unknown;
(): Foo => () => console.log();
      `,
        errors: [
          {
            column: 18,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = () => any;
const test: Foo = () => console.log();
      `,
        errors: [
          {
            column: 25,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = () => unknown;
const test: Foo = () => console.log();
      `,
        errors: [
          {
            column: 25,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = () => void;

const foo: Foo = function () {
  function bar() {
    return console.log();
  }
};
      `,
        errors: [
          {
            column: 12,
            line: 6,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
type Foo = () => void;

const foo: Foo = function () {
  function bar() {
    console.log();
  }
};
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const foo = function () {
  function bar() {
    return console.log();
  }
};
      `,
        errors: [
          {
            column: 12,
            line: 4,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
const foo = function () {
  function bar() {
    console.log();
  }
};
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): void;
function test(arg: string): any;
function test(arg?: string): any | void {
  if (arg) {
    return arg;
  }
  return console.log();
}
      `,
        errors: [
          {
            column: 10,
            line: 8,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
function test(): void;
function test(arg: string): any;
function test(arg?: string): any | void {
  if (arg) {
    return arg;
  }
  console.log();
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(arg: string): any;
function test(): void;
function test(arg?: string): any | void {
  if (arg) {
    return arg;
  }
  return console.log();
}
      `,
        errors: [
          {
            column: 10,
            line: 8,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
function test(arg: string): any;
function test(): void;
function test(arg?: string): any | void {
  if (arg) {
    return arg;
  }
  console.log();
}
      `,
              },
            ],
          },
        ],
      },
    ],
  });
  expect(hasError).toEqual(false);
});
