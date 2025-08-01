import { ruleTester } from "../../ruleTester.ts";
import { messages, restrictPlusOperands } from "./restrictPlusOperands.ts";

export const test = () =>
  ruleTester({
    ruleFn: restrictPlusOperands,
    valid: [
      "let x = 5;",
      "let y = '10';",
      "let z = 8.2;",
      "let w = '6.5';",
      "let foo = 5 + 10;",
      "let foo = '5.5' + '10';",
      "let foo = parseInt('5.5', 10) + 10;",
      "let foo = parseFloat('5.5', 10) + 10;",
      "let foo = 1n + 1n;",
      "let foo = BigInt(1) + 1n;",
      `
      let foo = 1n;
      foo + 2n;
    `,
      `
function test(s: string, n: number): number {
  return 2;
}
let foo = test('5.5', 10) + 10;
    `,
      `
let x = 5;
let z = 8.2;
let foo = x + z;
    `,
      `
let w = '6.5';
let y = '10';
let foo = y + w;
    `,
      "let foo = 1 + 1;",
      "let foo = '1' + '1';",
      `
let pair: { first: number; second: string } = { first: 5, second: '10' };
let foo = pair.first + 10;
    `,
      `
let pair: { first: number; second: string } = { first: 5, second: '10' };
let foo = pair.first + (10 as number);
    `,
      `
let pair: { first: number; second: string } = { first: 5, second: '10' };
let foo = '5.5' + pair.second;
    `,
      `
let pair: { first: number; second: string } = { first: 5, second: '10' };
let foo = ('5.5' as string) + pair.second;
    `,
      `
      const foo =
        'hello' +
        (someBoolean ? 'a' : 'b') +
        (() => (someBoolean ? 'c' : 'd'))() +
        'e';
    `,
      "const balls = true;",
      "balls === true;", // https://github.com/typescript-eslint/typescript-eslint/issues/230
      `
function foo<T extends string>(a: T) {
  return a + '';
}
    `,
      `
function foo<T extends 'a' | 'b'>(a: T) {
  return a + '';
}
    `,
      `
function foo<T extends number>(a: T) {
  return a + 1;
}
    `,
      `
function foo<T extends 1>(a: T) {
  return a + 1;
}
    `,
      `
declare const a: {} & string;
declare const b: string;
const x = a + b;
    `,
      `
declare const a: unknown & string;
declare const b: string;
const x = a + b;
    `,
      `
declare const a: string & string;
declare const b: string;
const x = a + b;
    `,
      `
declare const a: 'string literal' & string;
declare const b: string;
const x = a + b;
    `,
      `
declare const a: {} & number;
declare const b: number;
const x = a + b;
    `,
      `
declare const a: unknown & number;
declare const b: number;
const x = a + b;
    `,
      `
declare const a: number & number;
declare const b: number;
const x = a + b;
    `,
      `
declare const a: 42 & number;
declare const b: number;
const x = a + b;
    `,
      `
declare const a: {} & bigint;
declare const b: bigint;
const x = a + b;
    `,
      `
declare const a: unknown & bigint;
declare const b: bigint;
const x = a + b;
    `,
      `
declare const a: bigint & bigint;
declare const b: bigint;
const x = a + b;
    `,
      `
declare const a: 42n & bigint;
declare const b: bigint;
const x = a + b;
    `,
      `
function A(s: string) {
  return \`a\${s}b\` as const;
}
const b = A('') + '!';
    `,
      `
declare const a: \`template\${string}\`;
declare const b: '';
const x = a + b;
    `,
      `
const a: \`template\${0}\`;
declare const b: '';
const x = a + b;
    `,
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: true,
        },
        code: `
        declare const a: RegExp;
        declare const b: string;
        const x = a + b;
      `,
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: true,
        },
        code: `
        const a = /regexp/;
        declare const b: string;
        const x = a + b;
      `,
      },
      // TypeScript handles this case, so we don't have to
      {
        options: { allowRegExp: true },
        code: `
const f = (a: RegExp, b: RegExp) => a + b;
      `,
      },
      {
        options: { allowNullish: true },
        code: `
let foo: string | undefined;
foo = foo + 'some data';
      `,
      },
      {
        options: { allowNullish: true },
        code: `
let foo: string | null;
foo = foo + 'some data';
      `,
      },
      {
        options: { allowNullish: true },
        code: `
let foo: string | null | undefined;
foo = foo + 'some data';
      `,
      },
      {
        options: { allowAny: true },
        code: `
const f = (a: any, b: any) => a + b;
      `,
      },
      {
        options: { allowAny: true },
        code: `
const f = (a: any, b: string) => a + b;
      `,
      },
      {
        options: { allowAny: true },
        code: `
const f = (a: any, b: bigint) => a + b;
      `,
      },
      {
        options: { allowAny: true },
        code: `
const f = (a: any, b: number) => a + b;
      `,
      },
      {
        options: { allowAny: true, allowBoolean: true },
        code: `
const f = (a: any, b: boolean) => a + b;
      `,
      },
      {
        options: {
          allowAny: true,
          allowBoolean: true,
          allowNullish: true,
          allowNumberAndString: true,
          allowRegExp: true,
        },
        code: `
const f = (a: string, b: string | number) => a + b;
      `,
      },
      {
        options: {
          allowAny: true,
          allowBoolean: true,
          allowNullish: true,
          allowNumberAndString: true,
          allowRegExp: true,
        },
        code: `
const f = (a: string | number, b: number) => a + b;
      `,
      },
      {
        options: {
          allowAny: true,
          allowBoolean: true,
          allowNullish: true,
          allowNumberAndString: true,
          allowRegExp: true,
        },
        code: `
const f = (a: string | number, b: string | number) => a + b;
      `,
      },
      {
        code: "let foo = '1' + 1n;",
        options: { allowNumberAndString: true },
      },
    ],
    invalid: [
      {
        options: { allowNumberAndString: false },
        code: "let foo = '1' + 1;",
        errors: [
          {
            message: messages.mismatched({
              left: '"1"',
              right: "1",
              stringLike: "string, allowing a string + `boolean`",
            }),
            line: 1,
            column: 11,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: "let foo = '1' + 1;",
        errors: [
          {
            message: messages.mismatched({
              left: '"1"',
              right: "1",
              stringLike: "string",
            }),
            line: 1,
            column: 11,
          },
        ],
      },
      {
        code: "let foo = [] + {};",
        errors: [
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`",
              type: "never[]",
            }),
            line: 1,
            column: 11,
            endColumn: 13,
          },
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`",
              type: "{}",
            }),
            line: 1,
            column: 16,
            endColumn: 18,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: "let foo = 5 + '10';",
        errors: [
          {
            message: messages.mismatched({
              left: "5",
              right: '"10"',
              stringLike: "string",
            }),
            line: 1,
            column: 11,
          },
        ],
      },
      {
        code: "let foo = [] + 5;",
        errors: [
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`",
              type: "never[]",
            }),
            line: 1,
            column: 11,
            endColumn: 13,
          },
        ],
      },
      {
        code: "let foo = [] + [];",
        errors: [
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`",
              type: "never[]",
            }),
            line: 1,
            column: 11,
            endColumn: 13,
          },
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`",
              type: "never[]",
            }),
            line: 1,
            column: 16,
            endColumn: 18,
          },
        ],
      },
      {
        code: "let foo = 5 + [3];",
        errors: [
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`",
              type: "number[]",
            }),
            line: 1,
            column: 15,
            endColumn: 18,
          },
        ],
      },
      {
        code: "let foo = '5' + {};",
        errors: [
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`",
              type: "{}",
            }),
            line: 1,
            column: 17,
            endColumn: 19,
          },
        ],
      },
      {
        options: { allowNumberAndString: false },
        code: "let foo = 5.5 + '5';",
        errors: [
          {
            message: messages.mismatched({
              left: "5.5",
              right: '"5"',
              stringLike: "string, allowing a string + `boolean`",
            }),
            line: 1,
            column: 11,
          },
        ],
      },
      {
        options: { allowNumberAndString: false },
        code: "let foo = '5.5' + 5;",
        errors: [
          {
            message: messages.mismatched({
              left: '"5.5"',
              right: "5",
              stringLike: "string, allowing a string + `boolean`",
            }),
            line: 1,
            column: 11,
          },
        ],
      },
      {
        options: { allowNumberAndString: false },
        code: `
let x = 5;
let y = '10';
let foo = x + y;
      `,
        errors: [
          {
            message: messages.mismatched({
              left: "number",
              right: "string",
              stringLike: "string, allowing a string + `boolean`",
            }),
            line: 4,
            column: 11,
          },
        ],
      },
      {
        code: `
let x = 5;
let foo = x + {};
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`",
              type: "{}",
            }),
            line: 3,
            column: 15,
          },
        ],
      },
      {
        code: `
let y = '10';
let foo = [] + y;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`",
              type: "never[]",
            }),
            line: 3,
            column: 11,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
let pair = { first: 5, second: '10' };
let foo = pair + pair;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike: "string",
              type: "{ first: number; second: string; }",
            }),
            line: 3,
            column: 11,
            endColumn: 15,
          },
          {
            message: messages.invalid({
              stringLike: "string",
              type: "{ first: number; second: string; }",
            }),
            line: 3,
            column: 18,
            endColumn: 22,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
type Valued = { value: number };
let value: Valued = { value: 0 };
let combined = value + 0;
      `,
        errors: [
          {
            message: messages.invalid({ stringLike: "string", type: "Valued" }),
            line: 4,
            column: 16,
            endColumn: 21,
          },
        ],
      },
      {
        code: "let foo = 1n + 1;",
        errors: [
          {
            message: messages.bigintAndNumber({
              left: "1n",
              right: "1",
            }),
            line: 1,
            column: 11,
          },
        ],
      },
      {
        code: "let foo = 1 + 1n;",
        errors: [
          {
            message: messages.bigintAndNumber({
              left: "1",
              right: "1n",
            }),
            line: 1,
            column: 11,
          },
        ],
      },
      {
        code: `
        let foo = 1n;
        foo + 1;
      `,
        errors: [
          {
            message: messages.bigintAndNumber({
              left: "bigint",
              right: "1",
            }),
            line: 3,
            column: 9,
          },
        ],
      },
      {
        code: `
        let foo = 1;
        foo + 1n;
      `,
        errors: [
          {
            message: messages.bigintAndNumber({
              left: "number",
              right: "1n",
            }),
            line: 3,
            column: 9,
          },
        ],
      },
      // https://github.com/typescript-eslint/typescript-eslint/issues/230
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
function foo<T extends string>(a: T) {
  return a + 1;
}
      `,
        errors: [
          {
            message: messages.mismatched({
              left: "string",
              right: "1",
              stringLike: "string",
            }),
            line: 3,
            column: 10,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
function foo<T extends 'a' | 'b'>(a: T) {
  return a + 1;
}
      `,
        errors: [
          {
            message: messages.mismatched({
              left: '"a" | "b"',
              right: "1",
              stringLike: "string",
            }),
            line: 3,
            column: 10,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
function foo<T extends number>(a: T) {
  return a + '';
}
      `,
        errors: [
          {
            message: messages.mismatched({
              left: "number",
              right: '""',
              stringLike: "string",
            }),
            line: 3,
            column: 10,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
function foo<T extends 1>(a: T) {
  return a + '';
}
      `,
        errors: [
          {
            message: messages.mismatched({
              left: "1",
              right: '""',
              stringLike: "string",
            }),
            line: 3,
            column: 10,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        declare const a: \`template\${number}\`;
        declare const b: number;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.mismatched({
              left: "`template${number}`",
              right: "number",
              stringLike: "string",
            }),
            line: 4,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        declare const a: never;
        declare const b: string;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({ stringLike: "string", type: "never" }),
            line: 4,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        declare const a: never & string;
        declare const b: string;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({ stringLike: "string", type: "never" }),
            line: 4,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        declare const a: boolean & string;
        declare const b: string;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({ stringLike: "string", type: "never" }),
            line: 4,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        declare const a: any & string;
        declare const b: string;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({ stringLike: "string", type: "any" }),
            line: 4,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        declare const a: { a: 1 } & { b: 2 };
        declare const b: string;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike: "string",
              type: "{ a: 1; } & { b: 2; }",
            }),
            line: 4,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        interface A {
          a: 1;
        }
        declare const a: A;
        declare const b: string;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({ stringLike: "string", type: "A" }),
            line: 7,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        interface A {
          a: 1;
        }
        interface A2 extends A {
          b: 2;
        }
        declare const a: A2;
        declare const b: string;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({ stringLike: "string", type: "A2" }),
            line: 10,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        type A = { a: 1 } & { b: 2 };
        declare const a: A;
        declare const b: string;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({ stringLike: "string", type: "A" }),
            line: 5,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        declare const a: { a: 1 } & { b: 2 };
        declare const b: number;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike: "string",
              type: "{ a: 1; } & { b: 2; }",
            }),
            line: 4,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        declare const a: never;
        declare const b: bigint;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({ stringLike: "string", type: "never" }),
            line: 4,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        declare const a: any;
        declare const b: bigint;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({ stringLike: "string", type: "any" }),
            line: 4,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        declare const a: { a: 1 } & { b: 2 };
        declare const b: bigint;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike: "string",
              type: "{ a: 1; } & { b: 2; }",
            }),
            line: 4,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        declare const a: RegExp;
        declare const b: string;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({ stringLike: "string", type: "RegExp" }),
            line: 4,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        const a = /regexp/;
        declare const b: string;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({ stringLike: "string", type: "RegExp" }),
            line: 4,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        declare const a: Symbol;
        declare const b: string;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({ stringLike: "string", type: "Symbol" }),
            line: 4,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        declare const a: symbol;
        declare const b: string;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({ stringLike: "string", type: "symbol" }),
            line: 4,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        declare const a: unique symbol;
        declare const b: string;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike: "string",
              type: "unique symbol",
            }),
            line: 4,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
        const a = Symbol('');
        declare const b: string;
        const x = a + b;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike: "string",
              type: "unique symbol",
            }),
            line: 4,
            column: 19,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
let foo: string | undefined;
foo += 'some data';
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike: "string",
              type: "string | undefined",
            }),
            line: 3,
            column: 1,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
let foo: string | null;
foo += 'some data';
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike: "string",
              type: "string | null",
            }),
            line: 3,
            column: 1,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
let foo: string = '';
foo += 1;
      `,
        errors: [
          {
            message: messages.mismatched({
              left: "string",
              right: "1",
              stringLike: "string",
            }),
            line: 3,
            column: 1,
          },
        ],
      },
      {
        options: {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
        code: `
let foo = 0;
foo += '';
      `,
        errors: [
          {
            message: messages.mismatched({
              left: "number",
              right: '""',
              stringLike: "string",
            }),
            line: 3,
            column: 1,
          },
        ],
      },
      {
        options: { allowAny: true, allowBoolean: false },
        code: `
const f = (a: any, b: boolean) => a + b;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike: "string, allowing a string + any of: `number`, `any`",
              type: "boolean",
            }),
            line: 2,
            column: 39,
          },
        ],
      },
      {
        options: { allowAny: true },
        code: `
const f = (a: any, b: []) => a + b;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`, `any`",
              type: "[]",
            }),
            line: 2,
            column: 34,
          },
        ],
      },
      {
        options: { allowAny: false, allowBoolean: true },
        code: `
const f = (a: any, b: boolean) => a + b;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`",
              type: "any",
            }),
            line: 2,
            column: 35,
          },
        ],
      },
      {
        options: { allowAny: false },
        code: `
const f = (a: any, b: any) => a + b;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`",
              type: "any",
            }),
            line: 2,
            column: 31,
          },
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`",
              type: "any",
            }),
            line: 2,
            column: 35,
          },
        ],
      },
      {
        options: { allowAny: false },
        code: `
const f = (a: any, b: string) => a + b;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`",
              type: "any",
            }),
            line: 2,
            column: 34,
          },
        ],
      },
      {
        options: { allowAny: false },
        code: `
const f = (a: any, b: bigint) => a + b;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`",
              type: "any",
            }),
            line: 2,
            column: 34,
          },
        ],
      },
      {
        options: { allowAny: false },
        code: `
const f = (a: any, b: number) => a + b;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`",
              type: "any",
            }),
            line: 2,
            column: 34,
          },
        ],
      },
      {
        options: { allowAny: false, allowBoolean: false },
        code: `
const f = (a: any, b: boolean) => a + b;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike: "string, allowing a string + `number`",
              type: "any",
            }),
            line: 2,
            column: 35,
          },
          {
            message: messages.invalid({
              stringLike: "string, allowing a string + `number`",
              type: "boolean",
            }),
            line: 2,
            column: 39,
          },
        ],
      },
      {
        options: { allowRegExp: true },
        code: `
const f = (a: number, b: RegExp) => a + b;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`, `RegExp`",
              type: "RegExp",
            }),
            line: 2,
            column: 41,
          },
        ],
      },
      {
        options: { allowBoolean: false },
        code: `
let foo: string | boolean;
foo = foo + 'some data';
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike: "string, allowing a string + `number`",
              type: "string | boolean",
            }),
            line: 3,
            column: 7,
          },
        ],
      },
      {
        options: { allowBoolean: false },
        code: `
let foo: boolean;
foo = foo + 'some data';
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike: "string, allowing a string + `number`",
              type: "boolean",
            }),
            line: 3,
            column: 7,
          },
        ],
      },
      {
        options: {
          allowAny: true,
          allowBoolean: true,
          allowNullish: true,
          allowRegExp: true,
        },
        code: `
const f = (a: any, b: unknown) => a + b;
      `,
        errors: [
          {
            message: messages.invalid({
              stringLike:
                "string, allowing a string + any of: `number`, `boolean`, `RegExp`, `null`, `undefined`, `any`",
              type: "unknown",
            }),
            line: 2,
            column: 39,
          },
        ],
      },
      {
        code: "let foo = '1' + 1n;",
        options: { allowNumberAndString: false },
        errors: [
          {
            message: messages.mismatched({
              left: '"1"',
              right: "1n",
              stringLike: "string, allowing a string + `boolean`",
            }),
          },
        ],
      },
    ],
  });
