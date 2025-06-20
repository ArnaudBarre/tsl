import { ruleTester } from "../../ruleTester.ts";
import {
  messages,
  strictBooleanExpressions,
} from "./strictBooleanExpressions.ts";

export const test = () =>
  ruleTester({
    ruleFn: strictBooleanExpressions,
    valid: [
      // boolean in boolean context
      "true ? 'a' : 'b';",
      `
if (false) {
}
    `,
      "while (true) {}",
      "for (; false; ) {}",
      "!true;",
      "false || 123;",
      "true && 'foo';",
      "!(false || true);",
      "true && false ? true : false;",
      "(false && true) || false;",
      "(false && true) || [];",
      "(false && 1) || (true && 2);",
      `
declare const x: boolean;
if (x) {
}
    `,
      "(x: boolean) => !x;",
      "<T extends boolean>(x: T) => (x ? 1 : 0);",
      `
declare const x: never;
if (x) {
}
    `, // string in boolean context
      `
if ('') {
}
    `,
      "while ('x') {}",
      "for (; ''; ) {}",
      "('' && '1') || x;",
      `
declare const x: string;
if (x) {
}
    `,
      "(x: string) => !x;",
      "<T extends string>(x: T) => (x ? 1 : 0);", // number in boolean context
      `
if (0) {
}
    `,
      "while (1n) {}",
      "for (; Infinity; ) {}",
      "(0 / 0 && 1 + 2) || x;",
      `
declare const x: number;
if (x) {
}
    `,
      "(x: bigint) => !x;",
      "<T extends number>(x: T) => (x ? 1 : 0);", // nullable object in boolean context
      `
declare const x: null | object;
if (x) {
}
    `,
      "(x?: { a: any }) => !x;",
      "<T extends {} | null | undefined>(x: T) => (x ? 1 : 0);", // nullable boolean in boolean context
      {
        options: { allowNullableBoolean: true },
        code: `
        declare const x: boolean | null;
        if (x) {
        }
      `,
      },
      {
        options: { allowNullableBoolean: true },
        code: `
        (x?: boolean) => !x;
      `,
      },
      {
        options: { allowNullableBoolean: true },
        code: `
        <T extends boolean | null | undefined>(x: T) => (x ? 1 : 0);
      `,
      },
      {
        options: { allowNullableBoolean: true },
        code: `
        const a: (undefined | boolean | null)[] = [true, undefined, null];
        a.some(x => x);
      `,
      },
      // nullable string in boolean context
      {
        options: { allowNullableString: true },
        code: `
        declare const x: string | null;
        if (x) {
        }
      `,
      },
      {
        options: { allowNullableString: true },
        code: `
        (x?: string) => !x;
      `,
      },
      {
        options: { allowNullableString: true },
        code: `
        <T extends string | null | undefined>(x: T) => (x ? 1 : 0);
      `,
      },
      // nullable number in boolean context
      {
        options: { allowNullableNumber: true },
        code: `
        declare const x: number | null;
        if (x) {
        }
      `,
      },
      {
        options: { allowNullableNumber: true },
        code: `
        (x?: number) => !x;
      `,
      },
      {
        options: { allowNullableNumber: true },
        code: `
        <T extends number | null | undefined>(x: T) => (x ? 1 : 0);
      `,
      },
      {
        options: { allowNullableNumber: true },
        code: `
        declare const arrayOfArrays: (null | unknown[])[];
        const isAnyNonEmptyArray1 = arrayOfArrays.some(array => array?.length);
      `,
      },
      // any in boolean context
      {
        options: { allowAny: true },
        code: `
        declare const x: any;
        if (x) {
        }
      `,
      },
      {
        options: { allowAny: true },
        code: `
        x => !x;
      `,
      },
      {
        options: { allowAny: true },
        code: `
        <T extends any>(x: T) => (x ? 1 : 0);
      `,
      },
      {
        options: { allowAny: true },
        code: `
        declare const arrayOfArrays: any[];
        const isAnyNonEmptyArray1 = arrayOfArrays.some(array => array);
      `,
      },
      // logical operator
      {
        options: { allowNumber: true, allowString: true },
        code: `
        1 && true && 'x' && {};
      `,
      },
      {
        options: { allowNumber: true, allowString: true },
        code: `
        let x = 0 || false || '' || null;
      `,
      },
      {
        options: { allowNumber: true, allowString: true },
        code: `
        if (1 && true && 'x') void 0;
      `,
      },
      {
        options: { allowNumber: true, allowString: true },
        code: `
        if (0 || false || '') void 0;
      `,
      },
      {
        options: { allowNumber: true, allowString: true },
        code: `
        1 && true && 'x' ? {} : null;
      `,
      },
      {
        options: { allowNumber: true, allowString: true },
        code: `
        0 || false || '' ? null : {};
      `,
      },
      {
        options: { allowString: true },
        code: `
        declare const arrayOfArrays: string[];
        const isAnyNonEmptyArray1 = arrayOfArrays.some(array => array);
      `,
      },
      {
        options: { allowNumber: true },
        code: `
        declare const arrayOfArrays: number[];
        const isAnyNonEmptyArray1 = arrayOfArrays.some(array => array);
      `,
      },
      {
        options: { allowNullableObject: true },
        code: `
        declare const arrayOfArrays: (null | object)[];
        const isAnyNonEmptyArray1 = arrayOfArrays.some(array => array);
      `,
      },
      // nullable enum in boolean context
      {
        options: { allowNullableEnum: true },
        code: `
        enum ExampleEnum {
          This = 0,
          That = 1,
        }
        const rand = Math.random();
        let theEnum: ExampleEnum | null = null;
        if (rand < 0.3) {
          theEnum = ExampleEnum.This;
        }
        if (theEnum) {
        }
      `,
      },
      {
        options: { allowNullableEnum: true },
        code: `
        enum ExampleEnum {
          This = 0,
          That = 1,
        }
        const rand = Math.random();
        let theEnum: ExampleEnum | null = null;
        if (rand < 0.3) {
          theEnum = ExampleEnum.This;
        }
        if (!theEnum) {
        }
      `,
      },
      {
        options: { allowNullableEnum: true },
        code: `
        enum ExampleEnum {
          This = 1,
          That = 2,
        }
        const rand = Math.random();
        let theEnum: ExampleEnum | null = null;
        if (rand < 0.3) {
          theEnum = ExampleEnum.This;
        }
        if (!theEnum) {
        }
      `,
      },
      {
        options: { allowNullableEnum: true },
        code: `
        enum ExampleEnum {
          This = 'one',
          That = 'two',
        }
        const rand = Math.random();
        let theEnum: ExampleEnum | null = null;
        if (rand < 0.3) {
          theEnum = ExampleEnum.This;
        }
        if (!theEnum) {
        }
      `,
      },
      // nullable mixed enum in boolean context
      {
        options: { allowNullableEnum: true }, // falsy number and truthy string
        code: `
        enum ExampleEnum {
          This = 0,
          That = 'one',
        }
        (value?: ExampleEnum) => (value ? 1 : 0);
      `,
      },
      {
        options: { allowNullableEnum: true }, // falsy string and truthy number
        code: `
        enum ExampleEnum {
          This = '',
          That = 1,
        }
        (value?: ExampleEnum) => (!value ? 1 : 0);
      `,
      },
      {
        options: { allowNullableEnum: true }, // truthy string and truthy number
        code: `
        enum ExampleEnum {
          This = 'this',
          That = 1,
        }
        (value?: ExampleEnum) => (!value ? 1 : 0);
      `,
      },
      {
        options: { allowNullableEnum: true }, // falsy string and falsy number
        code: `
        enum ExampleEnum {
          This = '',
          That = 0,
        }
        (value?: ExampleEnum) => (!value ? 1 : 0);
      `,
      },
      {
        options: { allowNullableEnum: true },
        code: `
        enum ExampleEnum {
          This = '',
          That = 0,
        }
        declare const arrayOfArrays: (ExampleEnum | null)[];
        const isAnyNonEmptyArray1 = arrayOfArrays.some(array => array);
      `,
      },
      `
function f(arg: 'a' | null) {
  if (arg) console.log(arg);
}
    `,
      `
function f(arg: 'a' | 'b' | null) {
  if (arg) console.log(arg);
}
    `,
      {
        options: { allowNumber: true },
        code: `
declare const x: 1 | null;
declare const y: 1;
if (x) {
}
if (y) {
}
      `,
      },
      `
function f(arg: 1 | null) {
  if (arg) console.log(arg);
}
    `,
      `
function f(arg: 1 | 2 | null) {
  if (arg) console.log(arg);
}
    `,
      `
interface Options {
  readonly enableSomething?: true;
}

function f(opts: Options): void {
  if (opts.enableSomething) console.log('Do something');
}
    `,
      `
declare const x: true | null;
if (x) {
}
    `,
      {
        options: { allowString: true },
        code: `
declare const x: 'a' | null;
declare const y: 'a';
if (x) {
}
if (y) {
}
      `,
      },
      `
declare const foo: boolean & { __BRAND: 'Foo' };
if (foo) {
}
    `,
      `
declare const foo: true & { __BRAND: 'Foo' };
if (foo) {
}
    `,
      `
declare const foo: false & { __BRAND: 'Foo' };
if (foo) {
}
    `,
      `
declare function assert(a: number, b: unknown): asserts a;
declare const nullableString: string | null;
declare const boo: boolean;
assert(boo, nullableString);
    `,
      `
declare function assert(a: boolean, b: unknown): asserts b is string;
declare const nullableString: string | null;
declare const boo: boolean;
assert(boo, nullableString);
    `,
      `
declare function assert(a: number, b: unknown): asserts b;
declare const nullableString: string | null;
declare const boo: boolean;
assert(nullableString, boo);
    `,
      `
declare function assert(a: number, b: unknown): asserts b;
declare const nullableString: string | null;
declare const boo: boolean;
assert(...nullableString, nullableString);
    `,
      `
declare function assert(
  this: object,
  a: number,
  b?: unknown,
  c?: unknown,
): asserts c;
declare const nullableString: string | null;
declare const foo: number;
const o: { assert: typeof assert } = {
  assert,
};
o.assert(foo, nullableString);
    `,
      {
        code: `
declare function assert(x: unknown): x is string;
declare const nullableString: string | null;
assert(nullableString);
      `,
      },
      {
        code: `
class ThisAsserter {
  assertThis(this: unknown, arg2: unknown): asserts this {}
}

declare const lol: string | number | unknown | null;

const thisAsserter: ThisAsserter = new ThisAsserter();
thisAsserter.assertThis(lol);
      `,
      },
      {
        code: `
function assert(this: object, a: number, b: unknown): asserts b;
function assert(a: bigint, b: unknown): asserts b;
function assert(this: object, a: string, two: string): asserts two;
function assert(
  this: object,
  a: string,
  assertee: string,
  c: bigint,
  d: object,
): asserts assertee;
function assert(...args: any[]): void;

function assert(...args: any[]) {
  throw new Error('lol');
}

declare const nullableString: string | null;
assert(3 as any, nullableString);
      `,
      },
      // Intentional use of `any` to test a function call with no call signatures.
      `
declare const assert: any;
declare const nullableString: string | null;
assert(nullableString);
    `, // Coverage for absent "test expression".
      // Ensure that no crash or false positive occurs
      `
      for (let x = 0; ; x++) {
        break;
      }
    `,
      `
[true, false].some(function (x) {
  return x;
});
    `,
      `
[true, false].some(function check(x) {
  return x;
});
    `,
      `
[true, false].some(x => {
  return x;
});
    `,
      `
[1, null].filter(function (x) {
  return x != null;
});
    `,
      `
['one', 'two', ''].filter(function (x) {
  return !!x;
});
    `,
      `
['one', 'two', ''].filter(function (x): boolean {
  return !!x;
});
    `,
      `
['one', 'two', ''].filter(function (x): boolean {
  if (x) {
    return true;
  }
});
    `,
      `
['one', 'two', ''].filter(function (x): boolean {
  if (x) {
    return true;
  }

  throw new Error('oops');
});
    `,
      `
declare const predicate: (string) => boolean;
['one', 'two', ''].filter(predicate);
    `,
      `
declare function notNullish<T>(x: T): x is NonNullable<T>;
['one', null].filter(notNullish);
    `,
      `
declare function predicate(x: string | null): x is string;
['one', null].filter(predicate);
    `,
      `
declare function predicate<T extends boolean>(x: string | null): T;
['one', null].filter(predicate);
    `,
      `
declare function f(x: number): boolean;
declare function f(x: string | null): boolean;

[35].filter(f);
    `,
    ],
    invalid: [
      // non-boolean in RHS of test expression
      {
        options: {
          allowNullableObject: false,
          allowNumber: false,
          allowString: false,
        },
        code: `
if (true && 1 + 1) {
}
      `,
        errors: [
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 2,
            column: 13,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: `
if (true && 1 + 1 !== 0) {
}
      `,
              },
              {
                message: messages.conditionFixCompareNaN,
                output: `
if (true && !Number.isNaN(1 + 1)) {
}
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
if (true && Boolean(1 + 1)) {
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowNullableObject: false,
          allowNumber: false,
          allowString: false,
        },
        code: "while (false || 'a' + 'b') {}",
        errors: [
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 1,
            column: 17,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output: "while (false || ('a' + 'b').length > 0) {}",
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: `while (false || 'a' + 'b' !== "") {}`,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "while (false || Boolean('a' + 'b')) {}",
              },
            ],
          },
        ],
      },
      {
        options: {
          allowNullableObject: false,
          allowNumber: false,
          allowString: false,
        },
        code: "(x: object) => (true || false || x ? true : false);",
        errors: [
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 1,
            column: 34,
          },
        ],
      },
      // check if all and only the outermost operands are checked
      {
        options: {
          allowNullableObject: false,
          allowNumber: false,
          allowString: false,
        },
        code: `if (('' && {}) || (0 && void 0)) { }`,
        errors: [
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 1,
            column: 6,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output: `if ((''.length > 0 && {}) || (0 && void 0)) { }`,
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: `if (('' !== "" && {}) || (0 && void 0)) { }`,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `if ((Boolean('') && {}) || (0 && void 0)) { }`,
              },
            ],
          },
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 1,
            column: 12,
          },
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 1,
            column: 20,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: `if (('' && {}) || (0 !== 0 && void 0)) { }`,
              },
              {
                message: messages.conditionFixCompareNaN,
                output: `if (('' && {}) || (!Number.isNaN(0) && void 0)) { }`,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `if (('' && {}) || (Boolean(0) && void 0)) { }`,
              },
            ],
          },
          {
            message: messages.conditionErrorNullish({ context: "conditional" }),
            line: 1,
            column: 25,
          },
        ],
      },
      {
        options: { allowNullableBoolean: true, allowString: false },
        code: `
        declare const array: string[];
        array.some(x => x);
      `,
        errors: [
          {
            message: messages.conditionErrorString({
              context: "array predicate return type",
            }),
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output: `
        declare const array: string[];
        array.some(x => x.length > 0);
      `,
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: `
        declare const array: string[];
        array.some(x => x !== "");
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
        declare const array: string[];
        array.some(x => Boolean(x));
      `,
              },
              {
                message: messages.explicitBooleanReturnType,
                output: `
        declare const array: string[];
        array.some((x): boolean => x);
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowNullableObject: false,
          allowNumber: false,
          allowString: false,
        },
        code: `
declare const foo: true & { __BRAND: 'Foo' };
if (('' && foo) || (0 && void 0)) { }
      `,
        errors: [
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 3,
            column: 6,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output: `
declare const foo: true & { __BRAND: 'Foo' };
if ((''.length > 0 && foo) || (0 && void 0)) { }
      `,
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: `
declare const foo: true & { __BRAND: 'Foo' };
if (('' !== "" && foo) || (0 && void 0)) { }
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare const foo: true & { __BRAND: 'Foo' };
if ((Boolean('') && foo) || (0 && void 0)) { }
      `,
              },
            ],
          },
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 3,
            column: 21,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: `
declare const foo: true & { __BRAND: 'Foo' };
if (('' && foo) || (0 !== 0 && void 0)) { }
      `,
              },
              {
                message: messages.conditionFixCompareNaN,
                output: `
declare const foo: true & { __BRAND: 'Foo' };
if (('' && foo) || (!Number.isNaN(0) && void 0)) { }
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare const foo: true & { __BRAND: 'Foo' };
if (('' && foo) || (Boolean(0) && void 0)) { }
      `,
              },
            ],
          },
          {
            message: messages.conditionErrorNullish({ context: "conditional" }),
            line: 3,
            column: 26,
          },
        ],
      },
      {
        options: {
          allowNullableObject: false,
          allowNumber: false,
          allowString: false,
        },
        code: `
declare const foo: false & { __BRAND: 'Foo' };
if (('' && {}) || (foo && void 0)) { }
      `,
        errors: [
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 3,
            column: 6,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output: `
declare const foo: false & { __BRAND: 'Foo' };
if ((''.length > 0 && {}) || (foo && void 0)) { }
      `,
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: `
declare const foo: false & { __BRAND: 'Foo' };
if (('' !== "" && {}) || (foo && void 0)) { }
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare const foo: false & { __BRAND: 'Foo' };
if ((Boolean('') && {}) || (foo && void 0)) { }
      `,
              },
            ],
          },
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 3,
            column: 12,
          },
          {
            message: messages.conditionErrorNullish({ context: "conditional" }),
            line: 3,
            column: 27,
          },
        ],
      },
      // shouldn't check last logical operand when used for control flow
      {
        options: { allowNumber: false, allowString: false },
        code: "'asd' && 123 && [] && null;",
        errors: [
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 1,
            column: 1,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output: "'asd'.length > 0 && 123 && [] && null;",
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: "'asd' !== \"\" && 123 && [] && null;",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "Boolean('asd') && 123 && [] && null;",
              },
            ],
          },
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 1,
            column: 10,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: "'asd' && 123 !== 0 && [] && null;",
              },
              {
                message: messages.conditionFixCompareNaN,
                output: "'asd' && !Number.isNaN(123) && [] && null;",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "'asd' && Boolean(123) && [] && null;",
              },
            ],
          },
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 1,
            column: 17,
          },
        ],
      },
      {
        options: { allowNumber: false, allowString: false },
        code: "'asd' || 123 || [] || null;",
        errors: [
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 1,
            column: 1,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output: "'asd'.length > 0 || 123 || [] || null;",
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: "'asd' !== \"\" || 123 || [] || null;",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "Boolean('asd') || 123 || [] || null;",
              },
            ],
          },
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 1,
            column: 10,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: "'asd' || 123 !== 0 || [] || null;",
              },
              {
                message: messages.conditionFixCompareNaN,
                output: "'asd' || !Number.isNaN(123) || [] || null;",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "'asd' || Boolean(123) || [] || null;",
              },
            ],
          },
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 1,
            column: 17,
          },
        ],
      },
      {
        options: { allowNumber: false, allowString: false },
        code: "let x = (1 && 'a' && null) || 0 || '' || {};",
        errors: [
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 1,
            column: 10,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: "let x = (1 !== 0 && 'a' && null) || 0 || '' || {};",
              },
              {
                message: messages.conditionFixCompareNaN,
                output:
                  "let x = (!Number.isNaN(1) && 'a' && null) || 0 || '' || {};",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "let x = (Boolean(1) && 'a' && null) || 0 || '' || {};",
              },
            ],
          },
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 1,
            column: 15,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output:
                  "let x = (1 && 'a'.length > 0 && null) || 0 || '' || {};",
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: "let x = (1 && 'a' !== \"\" && null) || 0 || '' || {};",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "let x = (1 && Boolean('a') && null) || 0 || '' || {};",
              },
            ],
          },
          {
            message: messages.conditionErrorNullish({ context: "conditional" }),
            line: 1,
            column: 22,
          },
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 1,
            column: 31,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: "let x = (1 && 'a' && null) || 0 !== 0 || '' || {};",
              },
              {
                message: messages.conditionFixCompareNaN,
                output:
                  "let x = (1 && 'a' && null) || !Number.isNaN(0) || '' || {};",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "let x = (1 && 'a' && null) || Boolean(0) || '' || {};",
              },
            ],
          },
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 1,
            column: 36,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output:
                  "let x = (1 && 'a' && null) || 0 || ''.length > 0 || {};",
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: "let x = (1 && 'a' && null) || 0 || '' !== \"\" || {};",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "let x = (1 && 'a' && null) || 0 || Boolean('') || {};",
              },
            ],
          },
        ],
      },
      {
        options: { allowNumber: false, allowString: false },
        code: "return (1 || 'a' || null) && 0 && '' && {};",
        errors: [
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 1,
            column: 9,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: "return (1 !== 0 || 'a' || null) && 0 && '' && {};",
              },
              {
                message: messages.conditionFixCompareNaN,
                output:
                  "return (!Number.isNaN(1) || 'a' || null) && 0 && '' && {};",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "return (Boolean(1) || 'a' || null) && 0 && '' && {};",
              },
            ],
          },
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 1,
            column: 14,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output:
                  "return (1 || 'a'.length > 0 || null) && 0 && '' && {};",
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: "return (1 || 'a' !== \"\" || null) && 0 && '' && {};",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "return (1 || Boolean('a') || null) && 0 && '' && {};",
              },
            ],
          },
          {
            message: messages.conditionErrorNullish({ context: "conditional" }),
            line: 1,
            column: 21,
          },
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 1,
            column: 30,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: "return (1 || 'a' || null) && 0 !== 0 && '' && {};",
              },
              {
                message: messages.conditionFixCompareNaN,
                output:
                  "return (1 || 'a' || null) && !Number.isNaN(0) && '' && {};",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "return (1 || 'a' || null) && Boolean(0) && '' && {};",
              },
            ],
          },
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 1,
            column: 35,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output:
                  "return (1 || 'a' || null) && 0 && ''.length > 0 && {};",
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: "return (1 || 'a' || null) && 0 && '' !== \"\" && {};",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "return (1 || 'a' || null) && 0 && Boolean('') && {};",
              },
            ],
          },
        ],
      },
      {
        options: { allowNumber: false, allowString: false },
        code: "console.log((1 && []) || ('a' && {}));",
        errors: [
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 1,
            column: 14,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: "console.log((1 !== 0 && []) || ('a' && {}));",
              },
              {
                message: messages.conditionFixCompareNaN,
                output: "console.log((!Number.isNaN(1) && []) || ('a' && {}));",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "console.log((Boolean(1) && []) || ('a' && {}));",
              },
            ],
          },
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 1,
            column: 19,
          },
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 1,
            column: 27,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output: "console.log((1 && []) || ('a'.length > 0 && {}));",
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: "console.log((1 && []) || ('a' !== \"\" && {}));",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "console.log((1 && []) || (Boolean('a') && {}));",
              },
            ],
          },
        ],
      },
      // should check all logical operands when used in a condition
      {
        options: { allowNumber: false, allowString: false },
        code: "if ((1 && []) || ('a' && {})) void 0;",
        errors: [
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 1,
            column: 6,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: "if ((1 !== 0 && []) || ('a' && {})) void 0;",
              },
              {
                message: messages.conditionFixCompareNaN,
                output: "if ((!Number.isNaN(1) && []) || ('a' && {})) void 0;",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "if ((Boolean(1) && []) || ('a' && {})) void 0;",
              },
            ],
          },
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 1,
            column: 11,
          },
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 1,
            column: 19,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output: "if ((1 && []) || ('a'.length > 0 && {})) void 0;",
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: "if ((1 && []) || ('a' !== \"\" && {})) void 0;",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "if ((1 && []) || (Boolean('a') && {})) void 0;",
              },
            ],
          },
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 1,
            column: 26,
          },
        ],
      },
      {
        options: { allowNumber: false, allowString: false },
        code: "let x = null || 0 || 'a' || [] ? {} : undefined;",
        errors: [
          {
            message: messages.conditionErrorNullish({ context: "conditional" }),
            line: 1,
            column: 9,
          },
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 1,
            column: 17,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output:
                  "let x = null || 0 !== 0 || 'a' || [] ? {} : undefined;",
              },
              {
                message: messages.conditionFixCompareNaN,
                output:
                  "let x = null || !Number.isNaN(0) || 'a' || [] ? {} : undefined;",
              },
              {
                message: messages.conditionFixCastBoolean,
                output:
                  "let x = null || Boolean(0) || 'a' || [] ? {} : undefined;",
              },
            ],
          },
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 1,
            column: 22,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output:
                  "let x = null || 0 || 'a'.length > 0 || [] ? {} : undefined;",
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output:
                  "let x = null || 0 || 'a' !== \"\" || [] ? {} : undefined;",
              },
              {
                message: messages.conditionFixCastBoolean,
                output:
                  "let x = null || 0 || Boolean('a') || [] ? {} : undefined;",
              },
            ],
          },
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 1,
            column: 29,
          },
        ],
      },
      {
        options: { allowNumber: false, allowString: false },
        code: "return !(null || 0 || 'a' || []);",
        errors: [
          {
            message: messages.conditionErrorNullish({ context: "conditional" }),
            line: 1,
            column: 10,
          },
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 1,
            column: 18,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: "return !(null || 0 !== 0 || 'a' || []);",
              },
              {
                message: messages.conditionFixCompareNaN,
                output: "return !(null || !Number.isNaN(0) || 'a' || []);",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "return !(null || Boolean(0) || 'a' || []);",
              },
            ],
          },
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 1,
            column: 23,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output: "return !(null || 0 || 'a'.length > 0 || []);",
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: "return !(null || 0 || 'a' !== \"\" || []);",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "return !(null || 0 || Boolean('a') || []);",
              },
            ],
          },
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 1,
            column: 30,
          },
        ],
      },
      // nullish in boolean context
      {
        code: "null || {};",
        errors: [
          {
            message: messages.conditionErrorNullish({ context: "conditional" }),
            line: 1,
            column: 1,
          },
        ],
      },
      {
        code: "undefined && [];",
        errors: [
          {
            message: messages.conditionErrorNullish({ context: "conditional" }),
            line: 1,
            column: 1,
          },
        ],
      },
      {
        code: `
declare const x: null;
if (x) {
}
      `,
        errors: [
          {
            message: messages.conditionErrorNullish({ context: "conditional" }),
            line: 3,
            column: 5,
          },
        ],
      },
      {
        code: "(x: undefined) => !x;",
        errors: [
          {
            message: messages.conditionErrorNullish({ context: "conditional" }),
            line: 1,
            column: 20,
          },
        ],
      },
      {
        code: "<T extends null | undefined>(x: T) => (x ? 1 : 0);",
        errors: [
          {
            message: messages.conditionErrorNullish({ context: "conditional" }),
            line: 1,
            column: 40,
          },
        ],
      },
      {
        code: "<T extends null>(x: T) => (x ? 1 : 0);",
        errors: [
          {
            message: messages.conditionErrorNullish({ context: "conditional" }),
            line: 1,
            column: 28,
          },
        ],
      },
      {
        code: "<T extends undefined>(x: T) => (x ? 1 : 0);",
        errors: [
          {
            message: messages.conditionErrorNullish({ context: "conditional" }),
            line: 1,
            column: 33,
          },
        ],
      },
      // object in boolean context
      {
        code: "[] || 1;",
        errors: [
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 1,
            column: 1,
          },
        ],
      },
      {
        code: "({}) && 'a';",
        errors: [
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 1,
            column: 2,
          },
        ],
      },
      {
        code: `
declare const x: symbol;
if (x) {
}
      `,
        errors: [
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 3,
            column: 5,
          },
        ],
      },
      {
        code: "(x: () => void) => !x;",
        errors: [
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 1,
            column: 21,
          },
        ],
      },
      {
        code: "<T extends object>(x: T) => (x ? 1 : 0);",
        errors: [
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 1,
            column: 30,
          },
        ],
      },
      {
        code: "<T extends Object | Function>(x: T) => (x ? 1 : 0);",
        errors: [
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 1,
            column: 41,
          },
        ],
      },
      {
        code: "<T extends { a: number }>(x: T) => (x ? 1 : 0);",
        errors: [
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 1,
            column: 37,
          },
        ],
      },
      {
        code: "<T extends () => void>(x: T) => (x ? 1 : 0);",
        errors: [
          {
            message: messages.conditionErrorObject({ context: "conditional" }),
            line: 1,
            column: 34,
          },
        ],
      },
      // string in boolean context
      {
        options: { allowString: false },
        code: "while ('') {}",
        errors: [
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 1,
            column: 8,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output: "while (''.length > 0) {}",
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: `while ('' !== "") {}`,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "while (Boolean('')) {}",
              },
            ],
          },
        ],
      },
      {
        options: { allowString: false },
        code: "for (; 'foo'; ) {}",
        errors: [
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 1,
            column: 8,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output: "for (; 'foo'.length > 0; ) {}",
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: `for (; 'foo' !== ""; ) {}`,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "for (; Boolean('foo'); ) {}",
              },
            ],
          },
        ],
      },
      {
        options: { allowString: false },
        code: `
declare const x: string;
if (x) {
}
      `,
        errors: [
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 3,
            column: 5,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output: `
declare const x: string;
if (x.length > 0) {
}
      `,
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: `
declare const x: string;
if (x !== "") {
}
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare const x: string;
if (Boolean(x)) {
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowString: false },
        code: "(x: string) => !x;",
        errors: [
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 1,
            column: 17,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output: "(x: string) => x.length === 0;",
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: '(x: string) => x === "";',
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "(x: string) => !Boolean(x);",
              },
            ],
          },
        ],
      },
      {
        options: { allowString: false },
        code: "<T extends string>(x: T) => (x ? 1 : 0);",
        errors: [
          {
            message: messages.conditionErrorString({ context: "conditional" }),
            line: 1,
            column: 30,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output: "<T extends string>(x: T) => (x.length > 0 ? 1 : 0);",
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: '<T extends string>(x: T) => (x !== "" ? 1 : 0);',
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "<T extends string>(x: T) => (Boolean(x) ? 1 : 0);",
              },
            ],
          },
        ],
      },
      // number in boolean context
      {
        options: { allowNumber: false },
        code: "while (0n) {}",
        errors: [
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 1,
            column: 8,
            suggestions: [
              {
                message: messages.conditionFixCompareZero, // TODO: fix compare zero suggestion for bigint
                output: "while (0n !== 0) {}",
              },
              {
                // TODO: remove check NaN suggestion for bigint
                message: messages.conditionFixCompareNaN,
                output: "while (!Number.isNaN(0n)) {}",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "while (Boolean(0n)) {}",
              },
            ],
          },
        ],
      },
      {
        options: { allowNumber: false },
        code: "for (; 123; ) {}",
        errors: [
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 1,
            column: 8,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: "for (; 123 !== 0; ) {}",
              },
              {
                message: messages.conditionFixCompareNaN,
                output: "for (; !Number.isNaN(123); ) {}",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "for (; Boolean(123); ) {}",
              },
            ],
          },
        ],
      },
      {
        options: { allowNumber: false },
        code: `
declare const x: number;
if (x) {
}
      `,
        errors: [
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 3,
            column: 5,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: `
declare const x: number;
if (x !== 0) {
}
      `,
              },
              {
                message: messages.conditionFixCompareNaN,
                output: `
declare const x: number;
if (!Number.isNaN(x)) {
}
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare const x: number;
if (Boolean(x)) {
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNumber: false },
        code: "(x: bigint) => !x;",
        errors: [
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 1,
            column: 17,
            suggestions: [
              {
                // TODO: fix compare zero suggestion for bigint
                message: messages.conditionFixCompareZero,
                output: "(x: bigint) => x === 0;",
              },
              {
                // TODO: remove check NaN suggestion for bigint
                message: messages.conditionFixCompareNaN,
                output: "(x: bigint) => Number.isNaN(x);",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "(x: bigint) => !Boolean(x);",
              },
            ],
          },
        ],
      },
      {
        options: { allowNumber: false },
        code: "<T extends number>(x: T) => (x ? 1 : 0);",
        errors: [
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 1,
            column: 30,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: "<T extends number>(x: T) => (x !== 0 ? 1 : 0);",
              },
              {
                message: messages.conditionFixCompareNaN,
                output:
                  "<T extends number>(x: T) => (!Number.isNaN(x) ? 1 : 0);",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "<T extends number>(x: T) => (Boolean(x) ? 1 : 0);",
              },
            ],
          },
        ],
      },
      {
        options: { allowNumber: false },
        code: "![]['length']; // doesn't count as array.length when computed",
        errors: [
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 1,
            column: 2,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output:
                  "[]['length'] === 0; // doesn't count as array.length when computed",
              },
              {
                message: messages.conditionFixCompareNaN,
                output:
                  "Number.isNaN([]['length']); // doesn't count as array.length when computed",
              },
              {
                message: messages.conditionFixCastBoolean,
                output:
                  "!Boolean([]['length']); // doesn't count as array.length when computed",
              },
            ],
          },
        ],
      },
      {
        options: { allowNumber: false },
        code: `
declare const a: any[] & { notLength: number };
if (a.notLength) {
}
      `,
        errors: [
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 3,
            column: 5,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: `
declare const a: any[] & { notLength: number };
if (a.notLength !== 0) {
}
      `,
              },
              {
                message: messages.conditionFixCompareNaN,
                output: `
declare const a: any[] & { notLength: number };
if (!Number.isNaN(a.notLength)) {
}
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare const a: any[] & { notLength: number };
if (Boolean(a.notLength)) {
}
      `,
              },
            ],
          },
        ],
      },
      // number (array.length) in boolean context
      {
        options: { allowNumber: false },
        code: `
if (![].length) {
}
      `,
        errors: [
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 2,
            column: 6,
            suggestions: [
              {
                message: messages.conditionFixCompareArrayLengthZero,
                output: `
if ([].length === 0) {
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNumber: false },
        code: `
(a: number[]) => a.length && '...';
      `,
        errors: [
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 2,
            column: 18,
            suggestions: [
              {
                message: messages.conditionFixCompareArrayLengthNonzero, // not technically the same; changes from returning (nonzero) number to returning true
                output: `
(a: number[]) => a.length > 0 && '...';
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNumber: false },
        code: `
<T extends unknown[]>(...a: T) => a.length || 'empty';
      `,
        errors: [
          {
            message: messages.conditionErrorNumber({ context: "conditional" }),
            line: 2,
            column: 35,
            suggestions: [
              {
                message: messages.conditionFixCompareArrayLengthNonzero, // not technically the same; changes from returning (nonzero) number to returning true
                output: `
<T extends unknown[]>(...a: T) => a.length > 0 || 'empty';
      `,
              },
            ],
          },
        ],
      },
      // mixed `string | number` value in boolean context
      {
        options: { allowNumber: true, allowString: true },
        code: `
declare const x: string | number;
if (x) {
}
      `,
        errors: [
          {
            message: messages.conditionErrorOther({ context: "conditional" }),
            line: 3,
            column: 5,
          },
        ],
      },
      {
        options: { allowNumber: true, allowString: true },
        code: "(x: bigint | string) => !x;",
        errors: [
          {
            message: messages.conditionErrorOther({ context: "conditional" }),
            line: 1,
            column: 26,
          },
        ],
      },
      {
        options: { allowNumber: true, allowString: true },
        code: "<T extends number | bigint | string>(x: T) => (x ? 1 : 0);",
        errors: [
          {
            message: messages.conditionErrorOther({ context: "conditional" }),
            line: 1,
            column: 48,
          },
        ],
      },
      // nullable boolean in boolean context
      {
        options: { allowNullableBoolean: false },
        code: `
declare const x: boolean | null;
if (x) {
}
      `,
        errors: [
          {
            message: messages.conditionErrorNullableBoolean({
              context: "conditional",
            }),
            line: 3,
            column: 5,
            suggestions: [
              {
                message: messages.conditionFixDefaultFalse,
                output: `
declare const x: boolean | null;
if (x ?? false) {
}
      `,
              },
              {
                message: messages.conditionFixCompareTrue,
                output: `
declare const x: boolean | null;
if (x === true) {
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNullableBoolean: false },
        code: "(x?: boolean) => !x;",
        errors: [
          {
            message: messages.conditionErrorNullableBoolean({
              context: "conditional",
            }),
            line: 1,
            column: 19,
            suggestions: [
              {
                message: messages.conditionFixDefaultFalse,
                output: "(x?: boolean) => !(x ?? false);",
              },
              {
                message: messages.conditionFixCompareFalse,
                output: "(x?: boolean) => x === false;",
              },
            ],
          },
        ],
      },
      {
        options: { allowNullableBoolean: false },
        code: "<T extends boolean | null | undefined>(x: T) => (x ? 1 : 0);",
        errors: [
          {
            message: messages.conditionErrorNullableBoolean({
              context: "conditional",
            }),
            line: 1,
            column: 50,
            suggestions: [
              {
                message: messages.conditionFixDefaultFalse,
                output:
                  "<T extends boolean | null | undefined>(x: T) => ((x ?? false) ? 1 : 0);",
              },
              {
                message: messages.conditionFixCompareTrue,
                output:
                  "<T extends boolean | null | undefined>(x: T) => (x === true ? 1 : 0);",
              },
            ],
          },
        ],
      },
      // nullable object in boolean context
      {
        options: { allowNullableObject: false },
        code: `
declare const x: object | null;
if (x) {
}
      `,
        errors: [
          {
            message: messages.conditionErrorNullableObject({
              context: "conditional",
            }),
            line: 3,
            column: 5,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
declare const x: object | null;
if (x != null) {
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNullableObject: false },
        code: "(x?: { a: number }) => !x;",
        errors: [
          {
            message: messages.conditionErrorNullableObject({
              context: "conditional",
            }),
            line: 1,
            column: 25,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: "(x?: { a: number }) => x == null;",
              },
            ],
          },
        ],
      },
      {
        options: { allowNullableObject: false },
        code: "<T extends {} | null | undefined>(x: T) => (x ? 1 : 0);",
        errors: [
          {
            message: messages.conditionErrorNullableObject({
              context: "conditional",
            }),
            line: 1,
            column: 45,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output:
                  "<T extends {} | null | undefined>(x: T) => (x != null ? 1 : 0);",
              },
            ],
          },
        ],
      },
      // nullable string in boolean context
      {
        code: `
declare const x: string | null;
if (x) {
}
      `,
        errors: [
          {
            message: messages.conditionErrorNullableString({
              context: "conditional",
            }),
            line: 3,
            column: 5,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
declare const x: string | null;
if (x != null) {
}
      `,
              },
              {
                message: messages.conditionFixDefaultEmptyString,
                output: `
declare const x: string | null;
if (x ?? "") {
}
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare const x: string | null;
if (Boolean(x)) {
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: "(x?: string) => !x;",
        errors: [
          {
            message: messages.conditionErrorNullableString({
              context: "conditional",
            }),
            line: 1,
            column: 18,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: "(x?: string) => x == null;",
              },
              {
                message: messages.conditionFixDefaultEmptyString,
                output: '(x?: string) => !(x ?? "");',
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "(x?: string) => !Boolean(x);",
              },
            ],
          },
        ],
      },
      {
        code: "<T extends string | null | undefined>(x: T) => (x ? 1 : 0);",
        errors: [
          {
            message: messages.conditionErrorNullableString({
              context: "conditional",
            }),
            line: 1,
            column: 49,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output:
                  "<T extends string | null | undefined>(x: T) => (x != null ? 1 : 0);",
              },
              {
                message: messages.conditionFixDefaultEmptyString,
                output:
                  '<T extends string | null | undefined>(x: T) => ((x ?? "") ? 1 : 0);',
              },
              {
                message: messages.conditionFixCastBoolean,
                output:
                  "<T extends string | null | undefined>(x: T) => (Boolean(x) ? 1 : 0);",
              },
            ],
          },
        ],
      },
      {
        code: `
function foo(x: '' | 'bar' | null) {
  if (!x) {
  }
}
      `,
        errors: [
          {
            message: messages.conditionErrorNullableString({
              context: "conditional",
            }),
            line: 3,
            column: 8,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
function foo(x: '' | 'bar' | null) {
  if (x == null) {
  }
}
      `,
              },
              {
                message: messages.conditionFixDefaultEmptyString,
                output: `
function foo(x: '' | 'bar' | null) {
  if (!(x ?? "")) {
  }
}
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
function foo(x: '' | 'bar' | null) {
  if (!Boolean(x)) {
  }
}
      `,
              },
            ],
          },
        ],
      },
      // nullable number in boolean context
      {
        code: `
declare const x: number | null;
if (x) {
}
      `,
        errors: [
          {
            message: messages.conditionErrorNullableNumber({
              context: "conditional",
            }),
            line: 3,
            column: 5,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
declare const x: number | null;
if (x != null) {
}
      `,
              },
              {
                message: messages.conditionFixDefaultZero,
                output: `
declare const x: number | null;
if (x ?? 0) {
}
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare const x: number | null;
if (Boolean(x)) {
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: "(x?: number) => !x;",
        errors: [
          {
            message: messages.conditionErrorNullableNumber({
              context: "conditional",
            }),
            line: 1,
            column: 18,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: "(x?: number) => x == null;",
              },
              {
                message: messages.conditionFixDefaultZero,
                output: "(x?: number) => !(x ?? 0);",
              },
              {
                message: messages.conditionFixCastBoolean,
                output: "(x?: number) => !Boolean(x);",
              },
            ],
          },
        ],
      },
      {
        code: "<T extends number | null | undefined>(x: T) => (x ? 1 : 0);",
        errors: [
          {
            message: messages.conditionErrorNullableNumber({
              context: "conditional",
            }),
            line: 1,
            column: 49,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output:
                  "<T extends number | null | undefined>(x: T) => (x != null ? 1 : 0);",
              },
              {
                message: messages.conditionFixDefaultZero,
                output:
                  "<T extends number | null | undefined>(x: T) => ((x ?? 0) ? 1 : 0);",
              },
              {
                message: messages.conditionFixCastBoolean,
                output:
                  "<T extends number | null | undefined>(x: T) => (Boolean(x) ? 1 : 0);",
              },
            ],
          },
        ],
      },
      {
        code: `
function foo(x: 0 | 1 | null) {
  if (!x) {
  }
}
      `,
        errors: [
          {
            message: messages.conditionErrorNullableNumber({
              context: "conditional",
            }),
            line: 3,
            column: 8,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
function foo(x: 0 | 1 | null) {
  if (x == null) {
  }
}
      `,
              },
              {
                message: messages.conditionFixDefaultZero,
                output: `
function foo(x: 0 | 1 | null) {
  if (!(x ?? 0)) {
  }
}
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
function foo(x: 0 | 1 | null) {
  if (!Boolean(x)) {
  }
}
      `,
              },
            ],
          },
        ],
      },
      // nullable enum in boolean context
      {
        options: { allowNullableEnum: false },
        code: `
        enum ExampleEnum {
          This = 0,
          That = 1,
        }
        const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
        if (theEnum) {
        }
      `,
        errors: [
          {
            message: messages.conditionErrorNullableEnum({
              context: "conditional",
            }),
            line: 7,
            column: 13,
            endLine: 7,
            endColumn: 20,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
        enum ExampleEnum {
          This = 0,
          That = 1,
        }
        const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
        if (theEnum != null) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNullableEnum: false },
        code: `
        enum ExampleEnum {
          This = 0,
          That = 1,
        }
        const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
        if (!theEnum) {
        }
      `,
        errors: [
          {
            message: messages.conditionErrorNullableEnum({
              context: "conditional",
            }),
            line: 7,
            column: 14,
            endLine: 7,
            endColumn: 21,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
        enum ExampleEnum {
          This = 0,
          That = 1,
        }
        const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
        if (theEnum == null) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNullableEnum: false },
        code: `
        enum ExampleEnum {
          This,
          That,
        }
        const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
        if (!theEnum) {
        }
      `,
        errors: [
          {
            message: messages.conditionErrorNullableEnum({
              context: "conditional",
            }),
            line: 7,
            column: 14,
            endLine: 7,
            endColumn: 21,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
        enum ExampleEnum {
          This,
          That,
        }
        const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
        if (theEnum == null) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNullableEnum: false },
        code: `
        enum ExampleEnum {
          This = '',
          That = 'a',
        }
        const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
        if (!theEnum) {
        }
      `,
        errors: [
          {
            message: messages.conditionErrorNullableEnum({
              context: "conditional",
            }),
            line: 7,
            column: 14,
            endLine: 7,
            endColumn: 21,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
        enum ExampleEnum {
          This = '',
          That = 'a',
        }
        const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
        if (theEnum == null) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNullableEnum: false },
        code: `
        enum ExampleEnum {
          This = '',
          That = 0,
        }
        const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
        if (!theEnum) {
        }
      `,
        errors: [
          {
            message: messages.conditionErrorNullableEnum({
              context: "conditional",
            }),
            line: 7,
            column: 14,
            endLine: 7,
            endColumn: 21,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
        enum ExampleEnum {
          This = '',
          That = 0,
        }
        const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
        if (theEnum == null) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNullableEnum: false },
        code: `
        enum ExampleEnum {
          This = 'one',
          That = 'two',
        }
        const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
        if (!theEnum) {
        }
      `,
        errors: [
          {
            message: messages.conditionErrorNullableEnum({
              context: "conditional",
            }),
            line: 7,
            column: 14,
            endLine: 7,
            endColumn: 21,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
        enum ExampleEnum {
          This = 'one',
          That = 'two',
        }
        const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
        if (theEnum == null) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNullableEnum: false },
        code: `
        enum ExampleEnum {
          This = 1,
          That = 2,
        }
        const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
        if (!theEnum) {
        }
      `,
        errors: [
          {
            message: messages.conditionErrorNullableEnum({
              context: "conditional",
            }),
            line: 7,
            column: 14,
            endLine: 7,
            endColumn: 21,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
        enum ExampleEnum {
          This = 1,
          That = 2,
        }
        const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
        if (theEnum == null) {
        }
      `,
              },
            ],
          },
        ],
      },
      // nullable mixed enum in boolean context
      {
        options: { allowNullableEnum: false }, // falsy number and truthy string
        code: `
        enum ExampleEnum {
          This = 0,
          That = 'one',
        }
        (value?: ExampleEnum) => (value ? 1 : 0);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableEnum({
              context: "conditional",
            }),
            line: 6,
            column: 35,
            endLine: 6,
            endColumn: 40,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
        enum ExampleEnum {
          This = 0,
          That = 'one',
        }
        (value?: ExampleEnum) => (value != null ? 1 : 0);
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNullableEnum: false }, // falsy string and truthy number
        code: `
        enum ExampleEnum {
          This = '',
          That = 1,
        }
        (value?: ExampleEnum) => (!value ? 1 : 0);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableEnum({
              context: "conditional",
            }),
            line: 6,
            column: 36,
            endLine: 6,
            endColumn: 41,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
        enum ExampleEnum {
          This = '',
          That = 1,
        }
        (value?: ExampleEnum) => (value == null ? 1 : 0);
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNullableEnum: false }, // truthy string and truthy number
        code: `
        enum ExampleEnum {
          This = 'this',
          That = 1,
        }
        (value?: ExampleEnum) => (!value ? 1 : 0);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableEnum({
              context: "conditional",
            }),
            line: 6,
            column: 36,
            endLine: 6,
            endColumn: 41,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
        enum ExampleEnum {
          This = 'this',
          That = 1,
        }
        (value?: ExampleEnum) => (value == null ? 1 : 0);
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNullableEnum: false }, // falsy string and falsy number
        code: `
        enum ExampleEnum {
          This = '',
          That = 0,
        }
        (value?: ExampleEnum) => (!value ? 1 : 0);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableEnum({
              context: "conditional",
            }),
            line: 6,
            column: 36,
            endLine: 6,
            endColumn: 41,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
        enum ExampleEnum {
          This = '',
          That = 0,
        }
        (value?: ExampleEnum) => (value == null ? 1 : 0);
      `,
              },
            ],
          },
        ],
      },
      // any in boolean context
      {
        code: `
if (x) {
}
      `,
        errors: [
          {
            message: messages.conditionErrorAny({ context: "conditional" }),
            line: 2,
            column: 5,
            suggestions: [
              {
                message: messages.conditionFixCastBoolean,
                output: `
if (Boolean(x)) {
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: "x => !x;",
        errors: [
          {
            message: messages.conditionErrorAny({ context: "conditional" }),
            line: 1,
            column: 7,
            suggestions: [
              {
                message: messages.conditionFixCastBoolean,
                output: "x => !Boolean(x);",
              },
            ],
          },
        ],
      },
      {
        code: "<T extends any>(x: T) => (x ? 1 : 0);",
        errors: [
          {
            message: messages.conditionErrorAny({ context: "conditional" }),
            line: 1,
            column: 27,
            suggestions: [
              {
                message: messages.conditionFixCastBoolean,
                output: "<T extends any>(x: T) => (Boolean(x) ? 1 : 0);",
              },
            ],
          },
        ],
      },
      {
        code: "<T,>(x: T) => (x ? 1 : 0);",
        errors: [
          {
            message: messages.conditionErrorAny({ context: "conditional" }),
            line: 1,
            column: 16,
            suggestions: [
              {
                message: messages.conditionFixCastBoolean,
                output: "<T,>(x: T) => (Boolean(x) ? 1 : 0);",
              },
            ],
          },
        ],
      },
      // automatic semicolon insertion test
      {
        options: { allowNullableObject: false },
        code: `
        declare const obj: { x: number } | null;
        !obj ? 1 : 0
        !obj
        obj || 0
        obj && 1 || 0
      `,
        errors: [
          {
            message: messages.conditionErrorNullableObject({
              context: "conditional",
            }),
            line: 3,
            column: 10,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
        declare const obj: { x: number } | null;
        obj == null ? 1 : 0
        !obj
        obj || 0
        obj && 1 || 0
      `,
              },
            ],
          },
          {
            message: messages.conditionErrorNullableObject({
              context: "conditional",
            }),
            line: 4,
            column: 10,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
        declare const obj: { x: number } | null;
        !obj ? 1 : 0
        obj == null
        obj || 0
        obj && 1 || 0
      `,
              },
            ],
          },
          {
            message: messages.conditionErrorNullableObject({
              context: "conditional",
            }),
            line: 5,
            column: 9,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
        declare const obj: { x: number } | null;
        !obj ? 1 : 0
        !obj
        obj != null || 0
        obj && 1 || 0
      `,
              },
            ],
          },
          {
            message: messages.conditionErrorNullableObject({
              context: "conditional",
            }),
            line: 6,
            column: 9,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
        declare const obj: { x: number } | null;
        !obj ? 1 : 0
        !obj
        obj || 0
        obj != null && 1 || 0
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare function assert(x: unknown): asserts x;
declare const nullableString: string | null;
assert(nullableString);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableString({
              context: "conditional",
            }),
            line: 4,
            column: 8,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
declare function assert(x: unknown): asserts x;
declare const nullableString: string | null;
assert(nullableString != null);
      `,
              },
              {
                message: messages.conditionFixDefaultEmptyString,
                output: `
declare function assert(x: unknown): asserts x;
declare const nullableString: string | null;
assert(nullableString ?? "");
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare function assert(x: unknown): asserts x;
declare const nullableString: string | null;
assert(Boolean(nullableString));
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare function assert(a: number, b: unknown): asserts b;
declare const nullableString: string | null;
assert(foo, nullableString);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableString({
              context: "conditional",
            }),
            line: 4,
            column: 13,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
declare function assert(a: number, b: unknown): asserts b;
declare const nullableString: string | null;
assert(foo, nullableString != null);
      `,
              },
              {
                message: messages.conditionFixDefaultEmptyString,
                output: `
declare function assert(a: number, b: unknown): asserts b;
declare const nullableString: string | null;
assert(foo, nullableString ?? "");
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare function assert(a: number, b: unknown): asserts b;
declare const nullableString: string | null;
assert(foo, Boolean(nullableString));
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare function assert(a: number, b: unknown): asserts b;
declare function assert(one: number, two: unknown): asserts two;
declare const nullableString: string | null;
assert(foo, nullableString);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableString({
              context: "conditional",
            }),
            line: 5,
            column: 13,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
declare function assert(a: number, b: unknown): asserts b;
declare function assert(one: number, two: unknown): asserts two;
declare const nullableString: string | null;
assert(foo, nullableString != null);
      `,
              },
              {
                message: messages.conditionFixDefaultEmptyString,
                output: `
declare function assert(a: number, b: unknown): asserts b;
declare function assert(one: number, two: unknown): asserts two;
declare const nullableString: string | null;
assert(foo, nullableString ?? "");
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare function assert(a: number, b: unknown): asserts b;
declare function assert(one: number, two: unknown): asserts two;
declare const nullableString: string | null;
assert(foo, Boolean(nullableString));
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare function assert(this: object, a: number, b: unknown): asserts b;
declare const nullableString: string | null;
assert(foo, nullableString);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableString({
              context: "conditional",
            }),
            line: 4,
            column: 13,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
declare function assert(this: object, a: number, b: unknown): asserts b;
declare const nullableString: string | null;
assert(foo, nullableString != null);
      `,
              },
              {
                message: messages.conditionFixDefaultEmptyString,
                output: `
declare function assert(this: object, a: number, b: unknown): asserts b;
declare const nullableString: string | null;
assert(foo, nullableString ?? "");
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare function assert(this: object, a: number, b: unknown): asserts b;
declare const nullableString: string | null;
assert(foo, Boolean(nullableString));
      `,
              },
            ],
          },
        ],
      },
      {
        // The implementation signature doesn't count towards the call signatures
        code: `
function assert(this: object, a: number, b: unknown): asserts b;
function assert(a: bigint, b: unknown): asserts b;
function assert(this: object, a: string, two: string): asserts two;
function assert(
  this: object,
  a: string,
  assertee: string,
  c: bigint,
  d: object,
): asserts assertee;

function assert(...args: any[]) {
  throw new Error('lol');
}

declare const nullableString: string | null;
assert(3 as any, nullableString);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableString({
              context: "conditional",
            }),
            line: 18,
            column: 18,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
function assert(this: object, a: number, b: unknown): asserts b;
function assert(a: bigint, b: unknown): asserts b;
function assert(this: object, a: string, two: string): asserts two;
function assert(
  this: object,
  a: string,
  assertee: string,
  c: bigint,
  d: object,
): asserts assertee;

function assert(...args: any[]) {
  throw new Error('lol');
}

declare const nullableString: string | null;
assert(3 as any, nullableString != null);
      `,
              },
              {
                message: messages.conditionFixDefaultEmptyString,
                output: `
function assert(this: object, a: number, b: unknown): asserts b;
function assert(a: bigint, b: unknown): asserts b;
function assert(this: object, a: string, two: string): asserts two;
function assert(
  this: object,
  a: string,
  assertee: string,
  c: bigint,
  d: object,
): asserts assertee;

function assert(...args: any[]) {
  throw new Error('lol');
}

declare const nullableString: string | null;
assert(3 as any, nullableString ?? "");
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
function assert(this: object, a: number, b: unknown): asserts b;
function assert(a: bigint, b: unknown): asserts b;
function assert(this: object, a: string, two: string): asserts two;
function assert(
  this: object,
  a: string,
  assertee: string,
  c: bigint,
  d: object,
): asserts assertee;

function assert(...args: any[]) {
  throw new Error('lol');
}

declare const nullableString: string | null;
assert(3 as any, Boolean(nullableString));
      `,
              },
            ],
          },
        ],
      },
      {
        // The implementation signature doesn't count towards the call signatures
        code: `
function assert(this: object, a: number, b: unknown): asserts b;
function assert(a: bigint, b: unknown): asserts b;
function assert(this: object, a: string, two: string): asserts two;
function assert(
  this: object,
  a: string,
  assertee: string,
  c: bigint,
  d: object,
): asserts assertee;
function assert(a: any, two: unknown, ...rest: any[]): asserts two;

function assert(...args: any[]) {
  throw new Error('lol');
}

declare const nullableString: string | null;
assert(3 as any, nullableString, 'more', 'args', 'afterwards');
      `,
        errors: [
          {
            message: messages.conditionErrorNullableString({
              context: "conditional",
            }),
            line: 19,
            column: 18,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
function assert(this: object, a: number, b: unknown): asserts b;
function assert(a: bigint, b: unknown): asserts b;
function assert(this: object, a: string, two: string): asserts two;
function assert(
  this: object,
  a: string,
  assertee: string,
  c: bigint,
  d: object,
): asserts assertee;
function assert(a: any, two: unknown, ...rest: any[]): asserts two;

function assert(...args: any[]) {
  throw new Error('lol');
}

declare const nullableString: string | null;
assert(3 as any, nullableString != null, 'more', 'args', 'afterwards');
      `,
              },
              {
                message: messages.conditionFixDefaultEmptyString,
                output: `
function assert(this: object, a: number, b: unknown): asserts b;
function assert(a: bigint, b: unknown): asserts b;
function assert(this: object, a: string, two: string): asserts two;
function assert(
  this: object,
  a: string,
  assertee: string,
  c: bigint,
  d: object,
): asserts assertee;
function assert(a: any, two: unknown, ...rest: any[]): asserts two;

function assert(...args: any[]) {
  throw new Error('lol');
}

declare const nullableString: string | null;
assert(3 as any, nullableString ?? "", 'more', 'args', 'afterwards');
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
function assert(this: object, a: number, b: unknown): asserts b;
function assert(a: bigint, b: unknown): asserts b;
function assert(this: object, a: string, two: string): asserts two;
function assert(
  this: object,
  a: string,
  assertee: string,
  c: bigint,
  d: object,
): asserts assertee;
function assert(a: any, two: unknown, ...rest: any[]): asserts two;

function assert(...args: any[]) {
  throw new Error('lol');
}

declare const nullableString: string | null;
assert(3 as any, Boolean(nullableString), 'more', 'args', 'afterwards');
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare function assert(a: boolean, b: unknown): asserts b;
declare function assert({ a }: { a: boolean }, b: unknown): asserts b;
declare const nullableString: string | null;
declare const boo: boolean;
assert(boo, nullableString);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableString({
              context: "conditional",
            }),
            line: 6,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
declare function assert(a: boolean, b: unknown): asserts b;
declare function assert({ a }: { a: boolean }, b: unknown): asserts b;
declare const nullableString: string | null;
declare const boo: boolean;
assert(boo, nullableString != null);
      `,
              },
              {
                message: messages.conditionFixDefaultEmptyString,
                output: `
declare function assert(a: boolean, b: unknown): asserts b;
declare function assert({ a }: { a: boolean }, b: unknown): asserts b;
declare const nullableString: string | null;
declare const boo: boolean;
assert(boo, nullableString ?? "");
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare function assert(a: boolean, b: unknown): asserts b;
declare function assert({ a }: { a: boolean }, b: unknown): asserts b;
declare const nullableString: string | null;
declare const boo: boolean;
assert(boo, Boolean(nullableString));
      `,
              },
            ],
          },
        ],
      },
      {
        // This report matches TS's analysis, which selects the assertion overload.
        code: `
function assert(one: unknown): asserts one;
function assert(one: unknown, two: unknown): asserts two;
function assert(...args: unknown[]) {
  throw new Error('not implemented');
}
declare const nullableString: string | null;
assert(nullableString);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableString({
              context: "conditional",
            }),
            line: 8,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
function assert(one: unknown): asserts one;
function assert(one: unknown, two: unknown): asserts two;
function assert(...args: unknown[]) {
  throw new Error('not implemented');
}
declare const nullableString: string | null;
assert(nullableString != null);
      `,
              },
              {
                message: messages.conditionFixDefaultEmptyString,
                output: `
function assert(one: unknown): asserts one;
function assert(one: unknown, two: unknown): asserts two;
function assert(...args: unknown[]) {
  throw new Error('not implemented');
}
declare const nullableString: string | null;
assert(nullableString ?? "");
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
function assert(one: unknown): asserts one;
function assert(one: unknown, two: unknown): asserts two;
function assert(...args: unknown[]) {
  throw new Error('not implemented');
}
declare const nullableString: string | null;
assert(Boolean(nullableString));
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowString: false },
        code: `
['one', 'two', ''].find(x => {
  return x;
});
      `,
        errors: [
          {
            message: messages.conditionErrorString({
              context: "array predicate return type",
            }),
            line: 2,
            column: 25,
            endLine: 4,
            endColumn: 2,
            suggestions: [
              {
                message: messages.explicitBooleanReturnType,
                output: `
['one', 'two', ''].find((x): boolean => {
  return x;
});
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
['one', 'two', ''].find(x => {
  return;
});
      `,
        errors: [
          {
            message: messages.conditionErrorNullish({
              context: "array predicate return type",
            }),
            line: 2,
            column: 25,
            endLine: 4,
            endColumn: 2,
            suggestions: [
              {
                message: messages.explicitBooleanReturnType,
                output: `
['one', 'two', ''].find((x): boolean => {
  return;
});
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
['one', 'two', ''].findLast(x => {
  return undefined;
});
      `,
        errors: [
          {
            message: messages.conditionErrorNullish({
              context: "array predicate return type",
            }),
            line: 2,
            column: 29,
            endLine: 4,
            endColumn: 2,
            suggestions: [
              {
                message: messages.explicitBooleanReturnType,
                output: `
['one', 'two', ''].findLast((x): boolean => {
  return undefined;
});
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
['one', 'two', ''].find(x => {
  if (x) {
    return Math.random() > 0.5;
  }
});
      `,
        errors: [
          {
            message: messages.conditionErrorNullableBoolean({
              context: "array predicate return type",
            }),
            line: 2,
            column: 25,
            endLine: 6,
            endColumn: 2,
            suggestions: [
              {
                message: messages.explicitBooleanReturnType,
                output: `
['one', 'two', ''].find((x): boolean => {
  if (x) {
    return Math.random() > 0.5;
  }
});
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNullableBoolean: false },
        code: `
const predicate = (x: string) => {
  if (x) {
    return Math.random() > 0.5;
  }
};

['one', 'two', ''].find(predicate);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableBoolean({
              context: "array predicate return type",
            }),
            line: 8,
            column: 25,
            endLine: 8,
            endColumn: 34,
          },
        ],
      },
      {
        code: `
[1, null].every(async x => {
  return x != null;
});
      `,
        errors: [
          {
            message: messages.predicateCannotBeAsync,
            line: 2,
            column: 17,
            endLine: 4,
            endColumn: 2,
          },
        ],
      },
      {
        code: `
const predicate = async x => {
  return x != null;
};

[1, null].every(predicate);
      `,
        errors: [
          {
            message: messages.conditionErrorObject({
              context: "array predicate return type",
            }),
            line: 6,
            column: 17,
            endLine: 6,
            endColumn: 26,
          },
        ],
      },
      {
        code: `
[1, null].every((x): boolean | number => {
  return x != null;
});
      `,
        errors: [
          {
            message: messages.conditionErrorOther({
              context: "array predicate return type",
            }),
            line: 2,
            column: 17,
            endLine: 4,
            endColumn: 2,
          },
        ],
      },
      {
        code: `
[1, null].every((x): boolean | undefined => {
  return x != null;
});
      `,
        errors: [
          {
            message: messages.conditionErrorNullableBoolean({
              context: "array predicate return type",
            }),
            line: 2,
            column: 17,
            endLine: 4,
            endColumn: 2,
          },
        ],
      },
      // various cases for the suggestion fix
      {
        code: `
[1, null].every((x, i) => {});
      `,
        errors: [
          {
            message: messages.conditionErrorNullish({
              context: "array predicate return type",
            }),
            line: 2,
            column: 17,
            endLine: 2,
            endColumn: 29,
            suggestions: [
              {
                message: messages.explicitBooleanReturnType,
                output: `
[1, null].every((x, i): boolean => {});
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
[() => {}, null].every((x: () => void) => {});
      `,
        errors: [
          {
            message: messages.conditionErrorNullish({
              context: "array predicate return type",
            }),
            line: 2,
            column: 24,
            endLine: 2,
            endColumn: 45,
            suggestions: [
              {
                message: messages.explicitBooleanReturnType,
                output: `
[() => {}, null].every((x: () => void): boolean => {});
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
[() => {}, null].every(function (x: () => void) {});
      `,
        errors: [
          {
            message: messages.conditionErrorNullish({
              context: "array predicate return type",
            }),
            line: 2,
            column: 24,
            endLine: 2,
            endColumn: 51,
            suggestions: [
              {
                message: messages.explicitBooleanReturnType,
                output: `
[() => {}, null].every(function (x: () => void) : boolean{});
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
[() => {}, null].every(() => {});
      `,
        errors: [
          {
            message: messages.conditionErrorNullish({
              context: "array predicate return type",
            }),
            line: 2,
            column: 24,
            endLine: 2,
            endColumn: 32,
            suggestions: [
              {
                message: messages.explicitBooleanReturnType,
                output: `
[() => {}, null].every((): boolean => {});
      `,
              },
            ],
          },
        ],
      },
      // function overloading
      {
        code: `
declare function f(x: number): string;
declare function f(x: string | null): boolean;

[35].filter(f);
      `,
        errors: [
          {
            message: messages.conditionErrorOther({
              context: "array predicate return type",
            }),
            line: 5,
            column: 13,
            endLine: 5,
            endColumn: 14,
          },
        ],
      },
      {
        code: `
declare function f(x: number): string;
declare function f(x: number | boolean): boolean;
declare function f(x: string | null): boolean;

[35].filter(f);
      `,
        errors: [
          {
            message: messages.conditionErrorOther({
              context: "array predicate return type",
            }),
            line: 6,
            column: 13,
            endLine: 6,
            endColumn: 14,
          },
        ],
      },
      // type constraints
      {
        code: `
declare function foo<T>(x: number): T;
[1, null].every(foo);
      `,
        errors: [
          {
            message: messages.conditionErrorAny({
              context: "array predicate return type",
            }),
            line: 3,
            column: 17,
            endLine: 3,
            endColumn: 20,
          },
        ],
      },
      {
        options: { allowNumber: false },
        code: `
function foo<T extends number>(x: number): T {}
[1, null].every(foo);
      `,
        errors: [
          {
            message: messages.conditionErrorNumber({
              context: "array predicate return type",
            }),
            line: 3,
            column: 17,
            endLine: 3,
            endColumn: 20,
          },
        ],
      },
      {
        code: `
declare const nullOrString: string | null;
['one', null].filter(x => nullOrString);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableString({
              context: "array predicate return type",
            }),
            line: 3,
            column: 22,
            endLine: 3,
            endColumn: 39,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
declare const nullOrString: string | null;
['one', null].filter(x => nullOrString != null);
      `,
              },
              {
                message: messages.conditionFixDefaultEmptyString,
                output: `
declare const nullOrString: string | null;
['one', null].filter(x => nullOrString ?? "");
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare const nullOrString: string | null;
['one', null].filter(x => Boolean(nullOrString));
      `,
              },
              {
                message: messages.explicitBooleanReturnType,
                output: `
declare const nullOrString: string | null;
['one', null].filter((x): boolean => nullOrString);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const nullOrString: string | null;
['one', null].filter(x => !nullOrString);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableString({
              context: "conditional",
            }),
            line: 3,
            column: 28,
            endLine: 3,
            endColumn: 40,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
declare const nullOrString: string | null;
['one', null].filter(x => nullOrString == null);
      `,
              },
              {
                message: messages.conditionFixDefaultEmptyString,
                output: `
declare const nullOrString: string | null;
['one', null].filter(x => !(nullOrString ?? ""));
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare const nullOrString: string | null;
['one', null].filter(x => !Boolean(nullOrString));
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const anyValue: any;
['one', null].filter(x => anyValue);
      `,
        errors: [
          {
            message: messages.conditionErrorAny({
              context: "array predicate return type",
            }),
            line: 3,
            column: 22,
            endLine: 3,
            endColumn: 35,
            suggestions: [
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare const anyValue: any;
['one', null].filter(x => Boolean(anyValue));
      `,
              },
              {
                message: messages.explicitBooleanReturnType,
                output: `
declare const anyValue: any;
['one', null].filter((x): boolean => anyValue);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const nullOrBoolean: boolean | null;
[true, null].filter(x => nullOrBoolean);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableBoolean({
              context: "array predicate return type",
            }),
            line: 3,
            column: 21,
            endLine: 3,
            endColumn: 39,
            suggestions: [
              {
                message: messages.conditionFixDefaultFalse,
                output: `
declare const nullOrBoolean: boolean | null;
[true, null].filter(x => nullOrBoolean ?? false);
      `,
              },
              {
                message: messages.conditionFixCompareTrue,
                output: `
declare const nullOrBoolean: boolean | null;
[true, null].filter(x => nullOrBoolean === true);
      `,
              },
              {
                message: messages.explicitBooleanReturnType,
                output: `
declare const nullOrBoolean: boolean | null;
[true, null].filter((x): boolean => nullOrBoolean);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
enum ExampleEnum {
  This = 0,
  That = 1,
}
const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
[0, 1].filter(x => theEnum);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableEnum({
              context: "array predicate return type",
            }),
            line: 7,
            column: 15,
            endLine: 7,
            endColumn: 27,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
enum ExampleEnum {
  This = 0,
  That = 1,
}
const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
[0, 1].filter(x => theEnum != null);
      `,
              },
              {
                message: messages.explicitBooleanReturnType,
                output: `
enum ExampleEnum {
  This = 0,
  That = 1,
}
const theEnum = Math.random() < 0.3 ? ExampleEnum.This : null;
[0, 1].filter((x): boolean => theEnum);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const nullOrNumber: number | null;
[0, null].filter(x => nullOrNumber);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableNumber({
              context: "array predicate return type",
            }),
            line: 3,
            column: 18,
            endLine: 3,
            endColumn: 35,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
declare const nullOrNumber: number | null;
[0, null].filter(x => nullOrNumber != null);
      `,
              },
              {
                message: messages.conditionFixDefaultZero,
                output: `
declare const nullOrNumber: number | null;
[0, null].filter(x => nullOrNumber ?? 0);
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
declare const nullOrNumber: number | null;
[0, null].filter(x => Boolean(nullOrNumber));
      `,
              },
              {
                message: messages.explicitBooleanReturnType,
                output: `
declare const nullOrNumber: number | null;
[0, null].filter((x): boolean => nullOrNumber);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const objectValue: object = {};
[{ a: 0 }, {}].filter(x => objectValue);
      `,
        errors: [
          {
            message: messages.conditionErrorObject({
              context: "array predicate return type",
            }),
            line: 3,
            column: 23,
            endLine: 3,
            endColumn: 39,
            suggestions: [
              {
                message: messages.explicitBooleanReturnType,
                output: `
const objectValue: object = {};
[{ a: 0 }, {}].filter((x): boolean => objectValue);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const objectValue: object = {};
[{ a: 0 }, {}].filter(x => {
  return objectValue;
});
      `,
        errors: [
          {
            message: messages.conditionErrorObject({
              context: "array predicate return type",
            }),
            line: 3,
            column: 23,
            endLine: 5,
            endColumn: 2,
            suggestions: [
              {
                message: messages.explicitBooleanReturnType,
                output: `
const objectValue: object = {};
[{ a: 0 }, {}].filter((x): boolean => {
  return objectValue;
});
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNullableObject: false },
        code: `
declare const nullOrObject: object | null;
[{ a: 0 }, null].filter(x => nullOrObject);
      `,
        errors: [
          {
            message: messages.conditionErrorNullableObject({
              context: "array predicate return type",
            }),
            line: 3,
            column: 25,
            endLine: 3,
            endColumn: 42,
            suggestions: [
              {
                message: messages.conditionFixCompareNullish,
                output: `
declare const nullOrObject: object | null;
[{ a: 0 }, null].filter(x => nullOrObject != null);
      `,
              },
              {
                message: messages.explicitBooleanReturnType,
                output: `
declare const nullOrObject: object | null;
[{ a: 0 }, null].filter((x): boolean => nullOrObject);
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNumber: false },
        code: `
const numbers: number[] = [1];
[1, 2].filter(x => numbers.length);
      `,
        errors: [
          {
            message: messages.conditionErrorNumber({
              context: "array predicate return type",
            }),
            line: 3,
            column: 15,
            endLine: 3,
            endColumn: 34,
            suggestions: [
              {
                message: messages.conditionFixCompareArrayLengthNonzero,
                output: `
const numbers: number[] = [1];
[1, 2].filter(x => numbers.length > 0);
      `,
              },
              {
                message: messages.explicitBooleanReturnType,
                output: `
const numbers: number[] = [1];
[1, 2].filter((x): boolean => numbers.length);
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowNumber: false },
        code: `
const numberValue: number = 1;
[1, 2].filter(x => numberValue);
      `,
        errors: [
          {
            message: messages.conditionErrorNumber({
              context: "array predicate return type",
            }),
            line: 3,
            column: 15,
            endLine: 3,
            endColumn: 31,
            suggestions: [
              {
                message: messages.conditionFixCompareZero,
                output: `
const numberValue: number = 1;
[1, 2].filter(x => numberValue !== 0);
      `,
              },
              {
                message: messages.conditionFixCompareNaN,
                output: `
const numberValue: number = 1;
[1, 2].filter(x => !Number.isNaN(numberValue));
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
const numberValue: number = 1;
[1, 2].filter(x => Boolean(numberValue));
      `,
              },
              {
                message: messages.explicitBooleanReturnType,
                output: `
const numberValue: number = 1;
[1, 2].filter((x): boolean => numberValue);
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowString: false },
        code: `
const stringValue: string = 'hoge';
['hoge', 'foo'].filter(x => stringValue);
      `,
        errors: [
          {
            message: messages.conditionErrorString({
              context: "array predicate return type",
            }),
            line: 3,
            column: 24,
            endLine: 3,
            endColumn: 40,
            suggestions: [
              {
                message: messages.conditionFixCompareStringLength,
                output: `
const stringValue: string = 'hoge';
['hoge', 'foo'].filter(x => stringValue.length > 0);
      `,
              },
              {
                message: messages.conditionFixCompareEmptyString,
                output: `
const stringValue: string = 'hoge';
['hoge', 'foo'].filter(x => stringValue !== "");
      `,
              },
              {
                message: messages.conditionFixCastBoolean,
                output: `
const stringValue: string = 'hoge';
['hoge', 'foo'].filter(x => Boolean(stringValue));
      `,
              },
              {
                message: messages.explicitBooleanReturnType,
                output: `
const stringValue: string = 'hoge';
['hoge', 'foo'].filter((x): boolean => stringValue);
      `,
              },
            ],
          },
        ],
      },
    ],
  });
