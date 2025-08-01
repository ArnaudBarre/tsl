import { ruleTester } from "../../ruleTester.ts";
import { messages, noUnnecessaryCondition } from "./noUnnecessaryCondition.ts";

const necessaryConditionTest = (condition: string): string => `
declare const b1: ${condition};
declare const b2: boolean;
const t1 = b1 && b2;
`;
const unnecessaryConditionTest = (
  condition: string,
  messageId: "alwaysFalsy" | "alwaysTruthy" | "never",
) => ({
  code: necessaryConditionTest(condition),
  errors: [{ message: messages[messageId], line: 4, column: 12 }],
});

export const test = () =>
  ruleTester({
    ruleFn: noUnnecessaryCondition,
    valid: [
      `
declare const b1: boolean;
declare const b2: boolean;
const t1 = b1 && b2;
const t2 = b1 || b2;
if (b1 && b2) {
}
while (b1 && b2) {}
for (let i = 0; b1 && b2; i++) {
  break;
}
const t1 = b1 && b2 ? 'yes' : 'no';
if (b1 && b2) {
}
while (b1 && b2) {}
for (let i = 0; b1 && b2; i++) {
  break;
}
const t1 = b1 && b2 ? 'yes' : 'no';
for (;;) {}
switch (b1) {
  case true:
  default:
}
    `,
      `
declare function foo(): number | void;
const result1 = foo() === undefined;
const result2 = foo() == null;
    `,
      `
declare const bigInt: 0n | 1n;
if (bigInt) {
}
    `,
      necessaryConditionTest("false | 5"), // Truthy literal and falsy literal
      necessaryConditionTest('boolean | "foo"'), // boolean and truthy literal
      necessaryConditionTest("0 | boolean"), // boolean and falsy literal
      necessaryConditionTest("boolean | object"), // boolean and always-truthy type
      necessaryConditionTest("false | object"), // always truthy type and falsy literal
      // always falsy type and always truthy type
      necessaryConditionTest("null | object"),
      necessaryConditionTest("undefined | true"),
      necessaryConditionTest("void | true"), // "branded" type
      necessaryConditionTest("string & {}"),
      necessaryConditionTest("string & { __brand: string }"),
      necessaryConditionTest("number & { __brand: string }"),
      necessaryConditionTest("boolean & { __brand: string }"),
      necessaryConditionTest("bigint & { __brand: string }"),
      necessaryConditionTest("string & {} & { __brand: string }"),
      necessaryConditionTest(
        "string & { __brandA: string } & { __brandB: string }",
      ),
      necessaryConditionTest("string & { __brand: string } | number"),
      necessaryConditionTest("(string | number) & { __brand: string }"),
      necessaryConditionTest("string & ({ __brand: string } | number)"),
      necessaryConditionTest('("" | "foo") & { __brand: string }'),
      necessaryConditionTest(
        "(string & { __brandA: string }) | (number & { __brandB: string })",
      ),
      necessaryConditionTest(
        '((string & { __brandA: string }) | (number & { __brandB: string }) & ("" | "foo"))',
      ),
      necessaryConditionTest(
        "{ __brandA: string} & (({ __brandB: string } & string) | ({ __brandC: string } & number))",
      ),
      necessaryConditionTest(
        '(string | number) & ("foo" | 123 | { __brandA: string })',
      ),
      necessaryConditionTest("string & string"),
      necessaryConditionTest("any"), // any
      necessaryConditionTest("unknown"), // unknown
      // Generic type params
      `
function test<T extends string>(t: T) {
  return t ? 'yes' : 'no';
}
    `,
      `
// Naked type param
function test<T>(t: T) {
  return t ? 'yes' : 'no';
}
    `,
      `
// Naked type param in union
function test<T>(t: T | []) {
  return t ? 'yes' : 'no';
}
    `, // Boolean expressions
      `
function test(a: string) {
  const t1 = a === 'a';
  const t2 = 'a' === a;
}
    `,
      `
function test(a?: string) {
  const t1 = a === undefined;
  const t2 = undefined === a;
  const t1 = a !== undefined;
  const t2 = undefined !== a;
}
    `,
      `
function test(a: null | string) {
  const t1 = a === null;
  const t2 = null === a;
  const t1 = a !== null;
  const t2 = null !== a;
}
    `,
      `
function test(a?: null | string) {
  const t1 = a == null;
  const t2 = null == a;
  const t3 = a != null;
  const t4 = null != a;
  const t5 = a == undefined;
  const t6 = undefined == a;
  const t7 = a != undefined;
  const t8 = undefined != a;
}
    `,
      `
function test(a?: string) {
  const t1 = a == null;
  const t2 = null == a;
  const t3 = a != null;
  const t4 = null != a;
  const t5 = a == undefined;
  const t6 = undefined == a;
  const t7 = a != undefined;
  const t8 = undefined != a;
}
    `,
      `
function test(a: null | string) {
  const t1 = a == null;
  const t2 = null == a;
  const t3 = a != null;
  const t4 = null != a;
  const t5 = a == undefined;
  const t6 = undefined == a;
  const t7 = a != undefined;
  const t8 = undefined != a;
}
    `,
      `
function test(a: any) {
  const t1 = a == null;
  const t2 = null == a;
  const t3 = a != null;
  const t4 = null != a;
  const t5 = a == undefined;
  const t6 = undefined == a;
  const t7 = a != undefined;
  const t8 = undefined != a;
  const t9 = a === null;
  const t10 = null === a;
  const t11 = a !== null;
  const t12 = null !== a;
  const t13 = a === undefined;
  const t14 = undefined === a;
  const t15 = a !== undefined;
  const t16 = undefined !== a;
}
    `,
      `
function test(a: unknown) {
  const t1 = a == null;
  const t2 = null == a;
  const t3 = a != null;
  const t4 = null != a;
  const t5 = a == undefined;
  const t6 = undefined == a;
  const t7 = a != undefined;
  const t8 = undefined != a;
  const t9 = a === null;
  const t10 = null === a;
  const t11 = a !== null;
  const t12 = null !== a;
  const t13 = a === undefined;
  const t14 = undefined === a;
  const t15 = a !== undefined;
  const t16 = undefined !== a;
}
    `,
      `
function test<T>(a: T) {
  const t1 = a == null;
  const t2 = null == a;
  const t3 = a != null;
  const t4 = null != a;
  const t5 = a == undefined;
  const t6 = undefined == a;
  const t7 = a != undefined;
  const t8 = undefined != a;
  const t9 = a === null;
  const t10 = null === a;
  const t11 = a !== null;
  const t12 = null !== a;
  const t13 = a === undefined;
  const t14 = undefined === a;
  const t15 = a !== undefined;
  const t16 = undefined !== a;
}
    `,
      `
function foo<T extends object>(arg: T, key: keyof T): void {
  arg[key] == null;
}
    `, // Predicate functions
      `
// with literal arrow function
[0, 1, 2].filter(x => x);

// filter with named function
function length(x: string) {
  return x.length;
}
['a', 'b', ''].filter(length);

// with non-literal array
function nonEmptyStrings(x: string[]) {
  return x.filter(length);
}

// filter-like predicate
function count(
  list: string[],
  predicate: (value: string, index: number, array: string[]) => unknown,
) {
  return list.filter(predicate).length;
}
    `,
      `
declare const test: <T>() => T;

[1, null].filter(test);
    `,
      `
declare const test: <T extends boolean>() => T;

[1, null].filter(test);
    `,
      `
[1, null].filter(1 as any);
    `,
      `
[1, null].filter(1 as never);
    `,
      // Ignores non-array methods of the same name
      `
const notArray = {
  filter: (func: () => boolean) => func(),
  find: (func: () => boolean) => func(),
};
notArray.filter(() => true);
notArray.find(() => true);
    `, // Nullish coalescing operator
      `
function test(a: string | null) {
  return a ?? 'default';
}
    `,
      `
function test(a: string | undefined) {
  return a ?? 'default';
}
    `,
      `
function test(a: string | null | undefined) {
  return a ?? 'default';
}
    `,
      `
function test(a: unknown) {
  return a ?? 'default';
}
    `,
      `
function test<T>(a: T) {
  return a ?? 'default';
}
    `,
      `
function test<T extends string | null>(a: T) {
  return a ?? 'default';
}
    `,
      `
function foo<T extends object>(arg: T, key: keyof T): void {
  arg[key] ?? 'default';
}
    `, // Indexing cases
      `
declare const arr: object[];
if (arr[42]) {
} // looks unnecessary from the types, but isn't

const tuple = [{}] as [object];
declare const n: number;
if (tuple[n]) {
}
    `, // Optional-chaining indexing
      `
declare const arr: Array<{ value: string } & (() => void)>;
if (arr[42]?.value) {
}
arr[41]?.();

const tuple = ['foo'] as const;
declare const n: number;
tuple[n]?.toUpperCase();
    `,
      `
if (arr?.[42]) {
}
    `,
      `
type ItemA = { bar: string; baz: string };
type ItemB = { bar: string; qux: string };
declare const foo: ItemA[] | ItemB[];
foo[0]?.bar;
    `,
      `
type TupleA = [string, number];
type TupleB = [string, number];

declare const foo: TupleA | TupleB;
declare const index: number;
foo[index]?.toString();
    `,
      `
declare const returnsArr: undefined | (() => string[]);
if (returnsArr?.()[42]) {
}
returnsArr?.()[42]?.toUpperCase();
    `, // nullish + array index
      `
declare const arr: string[][];
arr[x] ?? [];
    `, // nullish + optional array index
      `
declare const arr: { foo: number }[];
const bar = arr[42]?.foo ?? 0;
    `, // Doesn't check the right-hand side of a logical expression
      //  in a non-conditional context
      {
        code: `
declare const b1: boolean;
declare const b2: true;
const x = b1 && b2;
      `,
      },
      {
        options: { allowConstantLoopConditions: "always" },
        code: `
while (true) {}
for (; true; ) {}
do {} while (true);
      `,
      },
      {
        options: { allowConstantLoopConditions: "only-allowed-literals" },
        code: `
while (true) {}
while (false) {}
while (1) {}
while (0) {}
      `,
      },
      `
let variable = 'abc' as string | void;
variable?.[0];
    `,
      `
let foo: undefined | { bar: true };
foo?.bar;
    `,
      `
let foo: null | { bar: true };
foo?.bar;
    `,
      `
let foo: undefined;
foo?.bar;
    `,
      `
let foo: undefined;
foo?.bar.baz;
    `,
      `
let foo: null;
foo?.bar;
    `,
      `
let anyValue: any;
anyValue?.foo;
    `,
      `
let unknownValue: unknown;
unknownValue?.foo;
    `,
      `
let foo: undefined | (() => {});
foo?.();
    `,
      `
let foo: null | (() => {});
foo?.();
    `,
      `
let foo: undefined;
foo?.();
    `,
      `
let foo: undefined;
foo?.().bar;
    `,
      `
let foo: null;
foo?.();
    `,
      `
let anyValue: any;
anyValue?.();
    `,
      `
let unknownValue: unknown;
unknownValue?.();
    `,
      "const foo = [1, 2, 3][0];",
      `
declare const foo: { bar?: { baz: { c: string } } } | null;
foo?.bar?.baz;
    `,
      `
foo?.bar?.baz?.qux;
    `,
      `
declare const foo: { bar: { baz: string } };
foo.bar.qux?.();
    `,
      `
type Foo = { baz: number } | null;
type Bar = { baz: null | string | { qux: string } };
declare const foo: { fooOrBar: Foo | Bar } | null;
foo?.fooOrBar?.baz?.qux;
    `,
      `
type Foo = { [key: string]: string } | null;
declare const foo: Foo;

const key = '1';
foo?.[key]?.trim();
    `,
      `
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
type Key = 'bar' | 'foo';
declare const foo: Foo;
declare const key: Key;

foo?.[key].trim();
    `,
      `
interface Outer {
  inner?: {
    [key: string]: string | undefined;
  };
}

function Foo(outer: Outer, key: string): number | undefined {
  return outer.inner?.[key]?.charCodeAt(0);
}
    `,
      `
interface Outer {
  inner?: {
    [key: string]: string | undefined;
    bar: 'bar';
  };
}
type Foo = 'foo';

function Foo(outer: Outer, key: Foo): number | undefined {
  return outer.inner?.[key]?.charCodeAt(0);
}
    `,
      `
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
type Key = 'bar' | 'foo' | 'baz';
declare const foo: Foo;
declare const key: Key;

foo?.[key]?.trim();
    `, // https://github.com/typescript-eslint/typescript-eslint/issues/7700
      `
type BrandedKey = string & { __brand: string };
type Foo = { [key: BrandedKey]: string } | null;
declare const foo: Foo;
const key = '1' as BrandedKey;
foo?.[key]?.trim();
    `,
      `
type BrandedKey<S extends string> = S & { __brand: string };
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
type Key = BrandedKey<'bar'> | BrandedKey<'foo'>;
declare const foo: Foo;
declare const key: Key;
foo?.[key].trim();
    `,
      `
type BrandedKey = string & { __brand: string };
interface Outer {
  inner?: {
    [key: BrandedKey]: string | undefined;
  };
}
function Foo(outer: Outer, key: BrandedKey): number | undefined {
  return outer.inner?.[key]?.charCodeAt(0);
}
    `,
      `
interface Outer {
  inner?: {
    [key: string & { __brand: string }]: string | undefined;
    bar: 'bar';
  };
}
type Foo = 'foo' & { __brand: string };
function Foo(outer: Outer, key: Foo): number | undefined {
  return outer.inner?.[key]?.charCodeAt(0);
}
    `,
      `
type BrandedKey<S extends string> = S & { __brand: string };
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
type Key = BrandedKey<'bar'> | BrandedKey<'foo'> | BrandedKey<'baz'>;
declare const foo: Foo;
declare const key: Key;
foo?.[key]?.trim();
    `,
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
type BrandedKey = string & { __brand: string };
type Foo = { [key: BrandedKey]: string } | null;
declare const foo: Foo;
const key = '1' as BrandedKey;
foo?.[key]?.trim();
      `,
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
type BrandedKey<S extends string> = S & { __brand: string };
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
type Key = BrandedKey<'bar'> | BrandedKey<'foo'>;
declare const foo: Foo;
declare const key: Key;
foo?.[key].trim();
      `,
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
type BrandedKey = string & { __brand: string };
interface Outer {
  inner?: {
    [key: BrandedKey]: string | undefined;
  };
}
function Foo(outer: Outer, key: BrandedKey): number | undefined {
  return outer.inner?.[key]?.charCodeAt(0);
}
      `,
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
interface Outer {
  inner?: {
    [key: string & { __brand: string }]: string | undefined;
    bar: 'bar';
  };
}
type Foo = 'foo' & { __brand: string };
function Foo(outer: Outer, key: Foo): number | undefined {
  return outer.inner?.[key]?.charCodeAt(0);
}
      `,
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
type BrandedKey<S extends string> = S & { __brand: string };
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
type Key = BrandedKey<'bar'> | BrandedKey<'foo'> | BrandedKey<'baz'>;
declare const foo: Foo;
declare const key: Key;
foo?.[key]?.trim();
      `,
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
type A = {
  [name in Lowercase<string>]?: {
    [name in Lowercase<string>]: {
      a: 1;
    };
  };
};

declare const a: A;

a.a?.a?.a;
      `,
      },
      `
let latencies: number[][] = [];

function recordData(): void {
  if (!latencies[0]) latencies[0] = [];
  latencies[0].push(4);
}

recordData();
    `,
      `
let latencies: number[][] = [];

function recordData(): void {
  if (latencies[0]) latencies[0] = [];
  latencies[0].push(4);
}

recordData();
    `,
      `
function test(testVal?: boolean) {
  if (testVal ?? true) {
    console.log('test');
  }
}
    `,
      `
declare const x: string[];
if (!x[0]) {
}
    `, // https://github.com/typescript-eslint/typescript-eslint/issues/2421
      `
const isEven = (val: number) => val % 2 === 0;
if (!isEven(1)) {
}
    `,
      `
declare const booleanTyped: boolean;
declare const unknownTyped: unknown;

if (!(booleanTyped || unknownTyped)) {
}
    `,
      `
interface Foo {
  [key: string]: [string] | undefined;
}

type OptionalFoo = Foo | undefined;
declare const foo: OptionalFoo;
foo?.test?.length;
    `,
      `
interface Foo {
  [key: number]: [string] | undefined;
}

type OptionalFoo = Foo | undefined;
declare const foo: OptionalFoo;
foo?.[1]?.length;
    `,
      `
declare let foo: number | null;
foo ??= 1;
    `,
      `
declare let foo: number;
foo ||= 1;
    `,
      `
declare const foo: { bar: { baz?: number; qux: number } };
type Key = 'baz' | 'qux';
declare const key: Key;
foo.bar[key] ??= 1;
    `,
      `
enum Keys {
  A = 'A',
  B = 'B',
}
type Foo = {
  [Keys.A]: number | null;
  [Keys.B]: number;
};
declare const foo: Foo;
declare const key: Keys;
foo[key] ??= 1;
    `,
      {
        compilerOptions: { exactOptionalPropertyTypes: true },
        code: `
declare const foo: { bar?: number };
foo.bar ??= 1;
      `,
      },
      {
        compilerOptions: { exactOptionalPropertyTypes: true },
        code: `
declare const foo: { bar: { baz?: number } };
foo['bar'].baz ??= 1;
      `,
      },
      {
        compilerOptions: { exactOptionalPropertyTypes: true },
        code: `
declare const foo: { bar: { baz?: number; qux: number } };
type Key = 'baz' | 'qux';
declare const key: Key;
foo.bar[key] ??= 1;
      `,
      },
      `
declare let foo: number;
foo &&= 1;
    `,
      `
function foo<T extends object>(arg: T, key: keyof T): void {
  arg[key] ??= 'default';
}
    `, // https://github.com/typescript-eslint/typescript-eslint/issues/6264
      `
function get<Obj, Key extends keyof Obj>(obj: Obj, key: Key) {
  const value = obj[key];
  if (value) {
    return value;
  }
  throw new Error('BOOM!');
}

get({ foo: null }, 'foo');
    `,
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
function getElem(dict: Record<string, { foo: string }>, key: string) {
  if (dict[key]) {
    return dict[key].foo;
  } else {
    return '';
  }
}
      `,
      },
      `
type Foo = { bar: () => number | undefined } | null;
declare const foo: Foo;
foo?.bar()?.toExponential();
    `,
      `
type Foo = (() => number | undefined) | null;
declare const foo: Foo;
foo?.()?.toExponential();
    `,
      `
type FooUndef = () => undefined;
type FooNum = () => number;
type Foo = FooUndef | FooNum | null;
declare const foo: Foo;
foo?.()?.toExponential();
    `,
      `
type Foo = { [key: string]: () => number | undefined } | null;
declare const foo: Foo;
foo?.['bar']()?.toExponential();
    `,
      `
declare function foo(): void | { key: string };
const bar = foo()?.key;
    `,
      `
type fn = () => void;
declare function foo(): void | fn;
const bar = foo()?.();
    `,
      {
        compilerOptions: { exactOptionalPropertyTypes: true },
        code: `
class ConsistentRand {
  #rand?: number;

  getCachedRand() {
    this.#rand ??= Math.random();
    return this.#rand;
  }
}
      `,
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function assert(x: unknown): asserts x;

assert(Math.random() > 0.5);
      `,
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function assert(x: unknown, y: unknown): asserts x;

assert(Math.random() > 0.5, true);
      `,
      },
      {
        options: { checkTypePredicates: false }, // should not report because option is disabled.
        code: `
declare function assert(x: unknown): asserts x;
assert(true);
      `,
      },
      {
        options: { checkTypePredicates: true }, // could be argued that this should report since `thisAsserter` is truthy.
        code: `
class ThisAsserter {
  assertThis(this: unknown, arg2: unknown): asserts this {}
}

const thisAsserter: ThisAsserter = new ThisAsserter();
thisAsserter.assertThis(true);
      `,
      },
      {
        options: { checkTypePredicates: true }, // could be argued that this should report since `thisAsserter` is truthy.
        code: `
class ThisAsserter {
  assertThis(this: unknown, arg2: unknown): asserts this {}
}

const thisAsserter: ThisAsserter = new ThisAsserter();
thisAsserter.assertThis(Math.random());
      `,
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function assert(x: unknown): asserts x;
assert(...[]);
      `,
      },
      {
        options: { checkTypePredicates: true }, // ok to report if we start unpacking spread params one day.
        code: `
declare function assert(x: unknown): asserts x;
assert(...[], {});
      `,
      },
      {
        options: { checkTypePredicates: false },
        code: `
declare function assertString(x: unknown): asserts x is string;
declare const a: string;
assertString(a);
      `,
      },
      {
        options: { checkTypePredicates: false },
        code: `
declare function isString(x: unknown): x is string;
declare const a: string;
isString(a);
      `,
      },
      {
        options: { checkTypePredicates: true }, // Technically, this has type 'falafel' and not string.
        code: `
declare function assertString(x: unknown): asserts x is string;
assertString('falafel');
      `,
      },
      {
        options: { checkTypePredicates: true }, // Technically, this has type 'falafel' and not string.
        code: `
declare function isString(x: unknown): x is string;
isString('falafel');
      `,
      },
      `
function test<T>(arg: T, key: keyof T) {
  if (arg[key]?.toString()) {
  }
}
    `,
      `
function test<T>(arg: T, key: keyof T) {
  if (arg?.toString()) {
  }
}
    `,
      `
function test<T>(arg: T | { value: string }) {
  if (arg?.value) {
  }
}
    `,
    ],
    invalid: [
      // Ensure that it's checking in all the right places
      {
        code: `
const b1 = true;
declare const b2: boolean;
const t1 = b1 && b2;
const t2 = b1 || b2;
if (b1 && b2) {
}
if (b2 && b1) {
}
while (b1 && b2) {}
while (b2 && b1) {}
for (let i = 0; b1 && b2; i++) {
  break;
}
const t1 = b1 && b2 ? 'yes' : 'no';
const t1 = b2 && b1 ? 'yes' : 'no';
switch (b1) {
  case true:
  default:
}
      `,
        errors: [
          { message: messages.alwaysTruthy, line: 4, column: 12 },
          { message: messages.alwaysTruthy, line: 5, column: 12 },
          { message: messages.alwaysTruthy, line: 6, column: 5 },
          { message: messages.alwaysTruthy, line: 8, column: 11 },
          { message: messages.alwaysTruthy, line: 10, column: 8 },
          { message: messages.alwaysTruthy, line: 11, column: 14 },
          { message: messages.alwaysTruthy, line: 12, column: 17 },
          { message: messages.alwaysTruthy, line: 15, column: 12 },
          { message: messages.alwaysTruthy, line: 16, column: 18 },
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "true",
              left: "true",
              operator: "===",
              right: "true",
            }),
            line: 18,
            column: 8,
          },
        ],
      }, // Ensure that it's complaining about the right things
      unnecessaryConditionTest("object", "alwaysTruthy"),
      unnecessaryConditionTest("object | true", "alwaysTruthy"),
      unnecessaryConditionTest('"" | false', "alwaysFalsy"), // Two falsy literals
      unnecessaryConditionTest('"always truthy"', "alwaysTruthy"),
      unnecessaryConditionTest(`undefined`, "alwaysFalsy"),
      unnecessaryConditionTest("null", "alwaysFalsy"),
      unnecessaryConditionTest("void", "alwaysFalsy"),
      unnecessaryConditionTest("never", "never"),
      unnecessaryConditionTest("string & number", "never"), // More complex logical expressions
      {
        code: `
declare const falseyBigInt: 0n;
if (falseyBigInt) {
}
      `,
        errors: [{ message: messages.alwaysFalsy, line: 3, column: 5 }],
      },
      {
        code: `
declare const posbigInt: 1n;
if (posbigInt) {
}
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 5 }],
      },
      {
        code: `
declare const negBigInt: -2n;
if (negBigInt) {
}
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 5 }],
      },
      {
        code: `
declare const b1: boolean;
declare const b2: boolean;
if (true && b1 && b2) {
}
if (b1 && false && b2) {
}
if (b1 || b2 || true) {
}
      `,
        errors: [
          { message: messages.alwaysTruthy, line: 4, column: 5 },
          { message: messages.alwaysFalsy, line: 6, column: 11 },
          { message: messages.alwaysTruthy, line: 8, column: 17 },
        ],
      }, // Generic type params
      {
        code: `
function test<T extends object>(t: T) {
  return t ? 'yes' : 'no';
}
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 10 }],
      },
      {
        code: `
function test<T extends false>(t: T) {
  return t ? 'yes' : 'no';
}
      `,
        errors: [{ message: messages.alwaysFalsy, line: 3, column: 10 }],
      },
      {
        code: `
function test<T extends 'a' | 'b'>(t: T) {
  return t ? 'yes' : 'no';
}
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 10 }],
      }, // Boolean expressions
      {
        code: `
function test(a: 'a') {
  return a === 'a';
}
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "true",
              left: '"a"',
              operator: "===",
              right: '"a"',
            }),
            line: 3,
            column: 10,
          },
        ],
      },
      {
        code: `
declare const a: '34';
declare const b: '56';
a > b;
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "false",
              left: '"34"',
              operator: ">",
              right: '"56"',
            }),
            line: 4,
          },
        ],
      },
      {
        code: `
const y = 1;
if (y === 0) {
}
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "false",
              left: "1",
              operator: "===",
              right: "0",
            }),
            line: 3,
          },
        ],
      },
      {
        code: `
// @ts-expect-error
if (1 == '1') {
}
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "true",
              left: "1",
              operator: "==",
              right: '"1"',
            }),
            line: 3,
          },
        ],
      },
      {
        code: `
2.3 > 2.3;
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "false",
              left: "2.3",
              operator: ">",
              right: "2.3",
            }),
            line: 2,
          },
        ],
      },
      {
        code: `
2.3 >= 2.3;
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "true",
              left: "2.3",
              operator: ">=",
              right: "2.3",
            }),
            line: 2,
          },
        ],
      },
      {
        code: `
2n < 2n;
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "false",
              left: "2n",
              operator: "<",
              right: "2n",
            }),
            line: 2,
          },
        ],
      },
      {
        code: `
2n <= 2n;
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "true",
              left: "2n",
              operator: "<=",
              right: "2n",
            }),
            line: 2,
          },
        ],
      },
      {
        code: `
-2n !== 2n;
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "true",
              left: "-2n",
              operator: "!==",
              right: "2n",
            }),
            line: 2,
          },
        ],
      },
      {
        code: `
// @ts-expect-error
if (1 == '2') {
}
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "false",
              left: "1",
              operator: "==",
              right: '"2"',
            }),
            line: 3,
          },
        ],
      },
      {
        code: `
// @ts-expect-error
if (1 != '2') {
}
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "true",
              left: "1",
              operator: "!=",
              right: '"2"',
            }),
            line: 3,
          },
        ],
      },
      {
        code: `
enum Foo {
  a = 1,
  b = 2,
}

const x = Foo.a;
if (x === Foo.a) {
}
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "true",
              left: "Foo.a",
              operator: "===",
              right: "Foo.a",
            }),
            line: 8,
            column: 5,
          },
        ],
      },
      {
        // narrowed to null. always-true because of loose nullish equality
        code: `
function takesMaybeValue(a: null | object) {
  if (a) {
  } else if (a == undefined) {
  }
}
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "true",
              left: "null",
              operator: "==",
              right: "undefined",
            }),
            line: 4,
            column: 14,
            endColumn: 28,
            endLine: 4,
          },
        ],
      },
      {
        // narrowed to null. always-false because of strict undefined equality
        code: `
function takesMaybeValue(a: null | object) {
  if (a) {
  } else if (a === undefined) {
  }
}
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "false",
              left: "null",
              operator: "===",
              right: "undefined",
            }),
            line: 4,
            column: 14,
            endColumn: 29,
            endLine: 4,
          },
        ],
      },
      {
        // narrowed to null. always-false because of loose nullish equality
        code: `
function takesMaybeValue(a: null | object) {
  if (a) {
  } else if (a != undefined) {
  }
}
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "false",
              left: "null",
              operator: "!=",
              right: "undefined",
            }),
            line: 4,
            column: 14,
            endColumn: 28,
            endLine: 4,
          },
        ],
      },
      {
        // narrowed to null. always-true because of strict undefined equality
        code: `
function takesMaybeValue(a: null | object) {
  if (a) {
  } else if (a !== undefined) {
  }
}
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "true",
              left: "null",
              operator: "!==",
              right: "undefined",
            }),
            line: 4,
            column: 14,
            endColumn: 29,
            endLine: 4,
          },
        ],
      },
      {
        code: `
true === false;
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "false",
              left: "true",
              operator: "===",
              right: "false",
            }),
          },
        ],
      },
      {
        code: `
true === true;
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "true",
              left: "true",
              operator: "===",
              right: "true",
            }),
          },
        ],
      },
      {
        code: `
true === undefined;
      `,
        errors: [
          {
            message: messages.comparisonBetweenLiteralTypes({
              trueOrFalse: "false",
              left: "true",
              operator: "===",
              right: "undefined",
            }),
          },
        ],
      }, // Workaround https://github.com/microsoft/TypeScript/issues/37160
      {
        code: `
function test(a: string) {
  const t1 = a === undefined;
  const t2 = undefined === a;
  const t3 = a !== undefined;
  const t4 = undefined !== a;
  const t5 = a === null;
  const t6 = null === a;
  const t7 = a !== null;
  const t8 = null !== a;
}
      `,
        errors: [
          { message: messages.noOverlapBooleanExpression, line: 3, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 4, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 5, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 6, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 7, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 8, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 9, column: 14 },
          {
            message: messages.noOverlapBooleanExpression,
            line: 10,
            column: 14,
          },
        ],
      },
      {
        code: `
function test(a?: string) {
  const t1 = a === undefined;
  const t2 = undefined === a;
  const t3 = a !== undefined;
  const t4 = undefined !== a;
  const t5 = a === null;
  const t6 = null === a;
  const t7 = a !== null;
  const t8 = null !== a;
}
      `,
        errors: [
          { message: messages.noOverlapBooleanExpression, line: 7, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 8, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 9, column: 14 },
          {
            message: messages.noOverlapBooleanExpression,
            line: 10,
            column: 14,
          },
        ],
      },
      {
        code: `
function test(a: null | string) {
  const t1 = a === undefined;
  const t2 = undefined === a;
  const t3 = a !== undefined;
  const t4 = undefined !== a;
  const t5 = a === null;
  const t6 = null === a;
  const t7 = a !== null;
  const t8 = null !== a;
}
      `,
        errors: [
          { message: messages.noOverlapBooleanExpression, line: 3, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 4, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 5, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 6, column: 14 },
        ],
      },
      {
        code: `
function test<T extends object>(a: T) {
  const t1 = a == null;
  const t2 = null == a;
  const t3 = a != null;
  const t4 = null != a;
  const t5 = a == undefined;
  const t6 = undefined == a;
  const t7 = a != undefined;
  const t8 = undefined != a;
  const t9 = a === null;
  const t10 = null === a;
  const t11 = a !== null;
  const t12 = null !== a;
  const t13 = a === undefined;
  const t14 = undefined === a;
  const t15 = a !== undefined;
  const t16 = undefined !== a;
}
      `,
        errors: [
          { message: messages.noOverlapBooleanExpression, line: 3, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 4, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 5, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 6, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 7, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 8, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 9, column: 14 },
          {
            message: messages.noOverlapBooleanExpression,
            line: 10,
            column: 14,
          },
          {
            message: messages.noOverlapBooleanExpression,
            line: 11,
            column: 14,
          },
          {
            message: messages.noOverlapBooleanExpression,
            line: 12,
            column: 15,
          },
          {
            message: messages.noOverlapBooleanExpression,
            line: 13,
            column: 15,
          },
          {
            message: messages.noOverlapBooleanExpression,
            line: 14,
            column: 15,
          },
          {
            message: messages.noOverlapBooleanExpression,
            line: 15,
            column: 15,
          },
          {
            message: messages.noOverlapBooleanExpression,
            line: 16,
            column: 15,
          },
          {
            message: messages.noOverlapBooleanExpression,
            line: 17,
            column: 15,
          },
          {
            message: messages.noOverlapBooleanExpression,
            line: 18,
            column: 15,
          },
        ],
      }, // Nullish coalescing operator
      {
        code: `
function test(a: string) {
  return a ?? 'default';
}
      `,
        errors: [{ message: messages.neverNullish, line: 3, column: 10 }],
      },
      {
        code: `
function test(a: string | false) {
  return a ?? 'default';
}
      `,
        errors: [{ message: messages.neverNullish, line: 3, column: 10 }],
      },
      {
        code: `
function test<T extends string>(a: T) {
  return a ?? 'default';
}
      `,
        errors: [{ message: messages.neverNullish, line: 3, column: 10 }],
      }, // nullish + array index without optional chaining
      {
        code: `
function test(a: { foo: string }[]) {
  return a[0].foo ?? 'default';
}
      `,
        errors: [{ message: messages.neverNullish, line: 3, column: 10 }],
      },
      {
        code: `
function test(a: null) {
  return a ?? 'default';
}
      `,
        errors: [{ message: messages.alwaysNullish, line: 3, column: 10 }],
      },
      {
        code: `
function test(a: null[]) {
  return a[0] ?? 'default';
}
      `,
        errors: [{ message: messages.alwaysNullish, line: 3, column: 10 }],
      },
      {
        code: `
function test<T extends null>(a: T) {
  return a ?? 'default';
}
      `,
        errors: [{ message: messages.alwaysNullish, line: 3, column: 10 }],
      },
      {
        code: `
function test(a: never) {
  return a ?? 'default';
}
      `,
        errors: [{ message: messages.never, line: 3, column: 10 }],
      },
      {
        code: `
function test<T extends { foo: number }, K extends 'foo'>(num: T[K]) {
  num ?? 'default';
}
      `,
        errors: [{ message: messages.neverNullish, line: 3, column: 3 }],
      }, // Predicate functions
      {
        code: `
[1, 3, 5].filter(() => true);
[1, 2, 3].find(() => {
  return false;
});

// with non-literal array
function nothing(x: string[]) {
  return x.filter(() => false);
}
// with readonly array
function nothing2(x: readonly string[]) {
  return x.filter(() => false);
}
// with tuple
function nothing3(x: [string, string]) {
  return x.filter(() => false);
}
      `,
        errors: [
          { message: messages.alwaysTruthy, line: 2, column: 24 },
          { message: messages.alwaysFalsy, line: 4, column: 10 },
          { message: messages.alwaysFalsy, line: 9, column: 25 },
          { message: messages.alwaysFalsy, line: 13, column: 25 },
          { message: messages.alwaysFalsy, line: 17, column: 25 },
        ],
      },
      {
        code: `
declare const test: <T extends true>() => T;
  
[1, null].filter(test);
        `,
        errors: [{ message: messages.alwaysTruthyFunc, line: 4, column: 18 }],
      },
      // Indexing cases
      {
        // This is an error because 'dict' doesn't represent
        //  the potential for undefined in its types
        code: `
declare const dict: Record<string, object>;
if (dict['mightNotExist']) {
}
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 5 }],
      },
      {
        // Should still check tuples when accessed with literal numbers, since they don't have
        //   unsound index signatures
        code: `
const x = [{}] as [{ foo: string }];
if (x[0]) {
}
if (x[0]?.foo) {
}
      `,
        errors: [
          { message: messages.alwaysTruthy, line: 3, column: 5 },
          {
            message: messages.neverOptionalChain,
            line: 5,
            column: 9,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
const x = [{}] as [{ foo: string }];
if (x[0]) {
}
if (x[0].foo) {
}
      `,
              },
            ],
          },
        ],
      },
      {
        // Shouldn't mistake this for an array indexing case
        code: `
declare const arr: object[];
if (arr.filter) {
}
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 5 }],
      },
      {
        code: `
function truthy() {
  return [];
}
function falsy() {}
[1, 3, 5].filter(truthy);
[1, 2, 3].find(falsy);
[1, 2, 3].findLastIndex(falsy);
      `,
        errors: [
          { message: messages.alwaysTruthyFunc, line: 6, column: 18 },
          { message: messages.alwaysFalsyFunc, line: 7, column: 16 },
          { message: messages.alwaysFalsyFunc, line: 8, column: 25 },
        ],
      }, // Supports generics
      // TODO: fix this
      //     {
      //       code: `
      // const isTruthy = <T>(t: T) => T;
      // // Valid: numbers can be truthy or falsy (0).
      // [0,1,2,3].filter(isTruthy);
      // // Invalid: arrays are always falsy.
      // [[1,2], [3,4]].filter(isTruthy);
      // `,
      //       errors: [({ line: 6, column: 23, messageId: 'alwaysTruthyFunc' })],
      //     },
      {
        options: { allowConstantLoopConditions: "never" },
        code: `
while (true) {}
for (; true; ) {}
do {} while (true);
      `,
        errors: [
          { message: messages.alwaysTruthy, line: 2, column: 8 },
          { message: messages.alwaysTruthy, line: 3, column: 8 },
          { message: messages.alwaysTruthy, line: 4, column: 14 },
        ],
      },
      {
        code: `
let foo = { bar: true };
foo?.bar;
foo ?. bar;
foo ?.
  bar;
foo
  ?. bar;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 4,
            endColumn: 6,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = { bar: true };
foo.bar;
foo ?. bar;
foo ?.
  bar;
foo
  ?. bar;
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 5,
            endColumn: 7,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = { bar: true };
foo?.bar;
foo . bar;
foo ?.
  bar;
foo
  ?. bar;
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 5,
            column: 5,
            endColumn: 7,
            endLine: 5,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = { bar: true };
foo?.bar;
foo ?. bar;
foo .
  bar;
foo
  ?. bar;
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 8,
            column: 3,
            endColumn: 5,
            endLine: 8,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = { bar: true };
foo?.bar;
foo ?. bar;
foo ?.
  bar;
foo
  . bar;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
let foo = () => {};
foo?.();
foo ?. ();
foo ?.
  ();
foo
  ?. ();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 4,
            endColumn: 6,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = () => {};
foo();
foo ?. ();
foo ?.
  ();
foo
  ?. ();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 5,
            endColumn: 7,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = () => {};
foo?.();
foo  ();
foo ?.
  ();
foo
  ?. ();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 5,
            column: 5,
            endColumn: 7,
            endLine: 5,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = () => {};
foo?.();
foo ?. ();
foo 
  ();
foo
  ?. ();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 8,
            column: 3,
            endColumn: 5,
            endLine: 8,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = () => {};
foo?.();
foo ?. ();
foo ?.
  ();
foo
   ();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
let foo = () => {};
foo?.(bar);
foo ?. (bar);
foo ?.
  (bar);
foo
  ?. (bar);
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 4,
            endColumn: 6,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = () => {};
foo(bar);
foo ?. (bar);
foo ?.
  (bar);
foo
  ?. (bar);
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 5,
            endColumn: 7,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = () => {};
foo?.(bar);
foo  (bar);
foo ?.
  (bar);
foo
  ?. (bar);
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 5,
            column: 5,
            endColumn: 7,
            endLine: 5,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = () => {};
foo?.(bar);
foo ?. (bar);
foo 
  (bar);
foo
  ?. (bar);
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 8,
            column: 3,
            endColumn: 5,
            endLine: 8,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = () => {};
foo?.(bar);
foo ?. (bar);
foo ?.
  (bar);
foo
   (bar);
      `,
              },
            ],
          },
        ],
      },
      {
        code: "const foo = [1, 2, 3]?.[0];",
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 1,
            column: 22,
            endColumn: 24,
            endLine: 1,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: "const foo = [1, 2, 3][0];",
              },
            ],
          },
        ],
      },
      {
        code: `
declare const x: { a?: { b: string } };
x?.a?.b;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 2,
            endColumn: 4,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const x: { a?: { b: string } };
x.a?.b;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const x: { a: { b?: { c: string } } };
x.a?.b?.c;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 4,
            endColumn: 6,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const x: { a: { b?: { c: string } } };
x.a.b?.c;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
let x: { a?: string };
x?.a;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 2,
            endColumn: 4,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let x: { a?: string };
x.a;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const foo: { bar: { baz: { c: string } } } | null;
foo?.bar?.baz;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 9,
            endColumn: 11,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const foo: { bar: { baz: { c: string } } } | null;
foo?.bar.baz;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const foo: { bar?: { baz: { qux: string } } } | null;
foo?.bar?.baz?.qux;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 14,
            endColumn: 16,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const foo: { bar?: { baz: { qux: string } } } | null;
foo?.bar?.baz.qux;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const foo: { bar: { baz: { qux?: () => {} } } } | null;
foo?.bar?.baz?.qux?.();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 14,
            endColumn: 16,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const foo: { bar: { baz: { qux?: () => {} } } } | null;
foo?.bar?.baz.qux?.();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 9,
            endColumn: 11,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const foo: { bar: { baz: { qux?: () => {} } } } | null;
foo?.bar.baz?.qux?.();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const foo: { bar: { baz: { qux: () => {} } } } | null;
foo?.bar?.baz?.qux?.();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 19,
            endColumn: 21,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const foo: { bar: { baz: { qux: () => {} } } } | null;
foo?.bar?.baz?.qux();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 14,
            endColumn: 16,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const foo: { bar: { baz: { qux: () => {} } } } | null;
foo?.bar?.baz.qux?.();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 9,
            endColumn: 11,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const foo: { bar: { baz: { qux: () => {} } } } | null;
foo?.bar.baz?.qux?.();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type baz = () => { qux: () => {} };
declare const foo: { bar: { baz: baz } } | null;
foo?.bar?.baz?.().qux?.();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 22,
            endColumn: 24,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type baz = () => { qux: () => {} };
declare const foo: { bar: { baz: baz } } | null;
foo?.bar?.baz?.().qux();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 14,
            endColumn: 16,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type baz = () => { qux: () => {} };
declare const foo: { bar: { baz: baz } } | null;
foo?.bar?.baz().qux?.();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 9,
            endColumn: 11,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type baz = () => { qux: () => {} };
declare const foo: { bar: { baz: baz } } | null;
foo?.bar.baz?.().qux?.();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type baz = null | (() => { qux: () => {} });
declare const foo: { bar: { baz: baz } } | null;
foo?.bar?.baz?.().qux?.();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 22,
            endColumn: 24,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type baz = null | (() => { qux: () => {} });
declare const foo: { bar: { baz: baz } } | null;
foo?.bar?.baz?.().qux();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 9,
            endColumn: 11,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type baz = null | (() => { qux: () => {} });
declare const foo: { bar: { baz: baz } } | null;
foo?.bar.baz?.().qux?.();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type baz = null | (() => { qux: () => {} } | null);
declare const foo: { bar: { baz: baz } } | null;
foo?.bar?.baz?.()?.qux?.();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 23,
            endColumn: 25,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type baz = null | (() => { qux: () => {} } | null);
declare const foo: { bar: { baz: baz } } | null;
foo?.bar?.baz?.()?.qux();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 9,
            endColumn: 11,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type baz = null | (() => { qux: () => {} } | null);
declare const foo: { bar: { baz: baz } } | null;
foo?.bar.baz?.()?.qux?.();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Foo = { baz: number };
type Bar = { baz: null | string | { qux: string } };
declare const foo: { fooOrBar: Foo | Bar } | null;
foo?.fooOrBar?.baz?.qux;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 5,
            column: 14,
            endColumn: 16,
            endLine: 5,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = { baz: number };
type Bar = { baz: null | string | { qux: string } };
declare const foo: { fooOrBar: Foo | Bar } | null;
foo?.fooOrBar.baz?.qux;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const x: { a: { b: number } }[];
x[0].a?.b;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 7,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const x: { a: { b: number } }[];
x[0].a.b;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
type Key = 'bar' | 'foo';
declare const foo: Foo;
declare const key: Key;

foo?.[key]?.trim();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 7,
            column: 11,
            endColumn: 13,
            endLine: 7,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
type Key = 'bar' | 'foo';
declare const foo: Foo;
declare const key: Key;

foo?.[key].trim();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
declare const foo: Foo;
const key = 'bar';
foo?.[key]?.trim();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 5,
            column: 11,
            endColumn: 13,
            endLine: 5,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
declare const foo: Foo;
const key = 'bar';
foo?.[key].trim();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
interface Outer {
  inner?: {
    [key: string]: string | undefined;
    bar: 'bar';
  };
}

export function test(outer: Outer): number | undefined {
  const key = 'bar';
  return outer.inner?.[key]?.charCodeAt(0);
}
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 11,
            column: 28,
            endColumn: 30,
            endLine: 11,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
interface Outer {
  inner?: {
    [key: string]: string | undefined;
    bar: 'bar';
  };
}

export function test(outer: Outer): number | undefined {
  const key = 'bar';
  return outer.inner?.[key].charCodeAt(0);
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
interface Outer {
  inner?: {
    [key: string]: string | undefined;
    bar: 'bar';
  };
}
type Bar = 'bar';

function Foo(outer: Outer, key: Bar): number | undefined {
  return outer.inner?.[key]?.charCodeAt(0);
}
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 11,
            column: 28,
            endColumn: 30,
            endLine: 11,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
interface Outer {
  inner?: {
    [key: string]: string | undefined;
    bar: 'bar';
  };
}
type Bar = 'bar';

function Foo(outer: Outer, key: Bar): number | undefined {
  return outer.inner?.[key].charCodeAt(0);
}
      `,
              },
            ],
          },
        ],
      }, // https://github.com/typescript-eslint/typescript-eslint/issues/2384
      {
        code: `
function test(testVal?: true) {
  if (testVal ?? true) {
    console.log('test');
  }
}
      `,
        errors: [
          {
            message: messages.alwaysTruthy,
            line: 3,
            column: 7,
            endColumn: 22,
            endLine: 3,
          },
        ],
      }, // https://github.com/typescript-eslint/typescript-eslint/issues/2255
      {
        code: `
const a = null;
if (!a) {
}
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 5 }],
      },
      {
        code: `
const a = true;
if (!a) {
}
      `,
        errors: [{ message: messages.alwaysFalsy, line: 3, column: 5 }],
      },
      {
        code: `
function sayHi(): void {
  console.log('Hi!');
}

let speech: never = sayHi();
if (!speech) {
}
      `,
        errors: [{ message: messages.never, line: 7, column: 5 }],
      },
      {
        code: `
interface Foo {
  test: string;
  [key: string]: [string] | undefined;
}

type OptionalFoo = Foo | undefined;
declare const foo: OptionalFoo;
foo?.test?.length;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 9,
            column: 10,
            endColumn: 12,
            endLine: 9,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
interface Foo {
  test: string;
  [key: string]: [string] | undefined;
}

type OptionalFoo = Foo | undefined;
declare const foo: OptionalFoo;
foo?.test.length;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
function pick<Obj extends Record<string, 1 | 2 | 3>, Key extends keyof Obj>(
  obj: Obj,
  key: Key,
): Obj[Key] {
  const k = obj[key];
  if (obj[key]) {
    return obj[key];
  }
  throw new Error('Boom!');
}

pick({ foo: 1, bar: 2 }, 'bar');
      `,
        errors: [
          {
            message: messages.alwaysTruthy,
            line: 7,
            column: 7,
            endColumn: 15,
            endLine: 7,
          },
        ],
      },
      {
        code: `
function getElem(dict: Record<string, { foo: string }>, key: string) {
  if (dict[key]) {
    return dict[key].foo;
  } else {
    return '';
  }
}
      `,
        errors: [
          {
            message: messages.alwaysTruthy,
            line: 3,
            column: 7,
            endColumn: 16,
            endLine: 3,
          },
        ],
      },
      {
        code: `
declare let foo: {};
foo ??= 1;
      `,
        errors: [
          {
            message: messages.neverNullish,
            line: 3,
            column: 1,
            endColumn: 4,
            endLine: 3,
          },
        ],
      },
      {
        code: `
declare let foo: number;
foo ??= 1;
      `,
        errors: [
          {
            message: messages.neverNullish,
            line: 3,
            column: 1,
            endColumn: 4,
            endLine: 3,
          },
        ],
      },
      {
        code: `
declare let foo: null;
foo ??= null;
      `,
        errors: [
          {
            message: messages.alwaysNullish,
            line: 3,
            column: 1,
            endColumn: 4,
            endLine: 3,
          },
        ],
      },
      {
        code: `
declare let foo: {};
foo ||= 1;
      `,
        errors: [
          {
            message: messages.alwaysTruthy,
            line: 3,
            column: 1,
            endColumn: 4,
            endLine: 3,
          },
        ],
      },
      {
        code: `
declare let foo: null;
foo ||= null;
      `,
        errors: [
          {
            message: messages.alwaysFalsy,
            line: 3,
            column: 1,
            endColumn: 4,
            endLine: 3,
          },
        ],
      },
      {
        code: `
declare let foo: {};
foo &&= 1;
      `,
        errors: [
          {
            message: messages.alwaysTruthy,
            line: 3,
            column: 1,
            endColumn: 4,
            endLine: 3,
          },
        ],
      },
      {
        code: `
declare let foo: null;
foo &&= null;
      `,
        errors: [
          {
            message: messages.alwaysFalsy,
            line: 3,
            column: 1,
            endColumn: 4,
            endLine: 3,
          },
        ],
      },
      {
        compilerOptions: { exactOptionalPropertyTypes: true },
        code: `
declare const foo: { bar: number };
foo.bar ??= 1;
      `,
        errors: [
          {
            message: messages.neverNullish,
            line: 3,
            column: 1,
            endColumn: 8,
            endLine: 3,
          },
        ],
      },
      {
        code: `
type Foo = { bar: () => number } | null;
declare const foo: Foo;
foo?.bar()?.toExponential();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 11,
            endColumn: 13,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = { bar: () => number } | null;
declare const foo: Foo;
foo?.bar().toExponential();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Foo = { bar: null | { baz: () => { qux: number } } } | null;
declare const foo: Foo;
foo?.bar?.baz()?.qux?.toExponential();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 21,
            endColumn: 23,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = { bar: null | { baz: () => { qux: number } } } | null;
declare const foo: Foo;
foo?.bar?.baz()?.qux.toExponential();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 16,
            endColumn: 18,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = { bar: null | { baz: () => { qux: number } } } | null;
declare const foo: Foo;
foo?.bar?.baz().qux?.toExponential();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Foo = (() => number) | null;
declare const foo: Foo;
foo?.()?.toExponential();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 8,
            endColumn: 10,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = (() => number) | null;
declare const foo: Foo;
foo?.().toExponential();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Foo = { [key: string]: () => number } | null;
declare const foo: Foo;
foo?.['bar']()?.toExponential();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 15,
            endColumn: 17,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = { [key: string]: () => number } | null;
declare const foo: Foo;
foo?.['bar']().toExponential();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Foo = { [key: string]: () => number } | null;
declare const foo: Foo;
foo?.['bar']?.()?.toExponential();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 17,
            endColumn: 19,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = { [key: string]: () => number } | null;
declare const foo: Foo;
foo?.['bar']?.().toExponential();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        const a = true;
        if (!!a) {
        }
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 13 }],
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function assert(x: unknown): asserts x;
assert(true);
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3 }],
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function assert(x: unknown): asserts x;
assert(false);
      `,
        errors: [{ message: messages.alwaysFalsy, line: 3, column: 8 }],
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function assert(x: unknown, y: unknown): asserts x;

assert(true, Math.random() > 0.5);
      `,
        errors: [{ message: messages.alwaysTruthy, line: 4, column: 8 }],
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function assert(x: unknown): asserts x;
assert({});
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 8 }],
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function assertsString(x: unknown): asserts x is string;
declare const a: string;
assertsString(a);
      `,
        errors: [
          {
            message: messages.typeGuardAlreadyIsType({
              typeGuardOrAssertionFunction: "assertion function",
            }),
            line: 4,
          },
        ],
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function isString(x: unknown): x is string;
declare const a: string;
isString(a);
      `,
        errors: [
          {
            message: messages.typeGuardAlreadyIsType({
              typeGuardOrAssertionFunction: "type guard",
            }),
            line: 4,
          },
        ],
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function isString(x: unknown): x is string;
declare const a: string;
isString('fa' + 'lafel');
      `,
        errors: [
          {
            message: messages.typeGuardAlreadyIsType({
              typeGuardOrAssertionFunction: "type guard",
            }),
            line: 4,
          },
        ],
      }, // "branded" types
      unnecessaryConditionTest('"" & {}', "alwaysFalsy"),
      unnecessaryConditionTest('"" & { __brand: string }', "alwaysFalsy"),
      unnecessaryConditionTest(
        '("" | false) & { __brand: string }',
        "alwaysFalsy",
      ),
      unnecessaryConditionTest(
        '((string & { __brandA: string }) | (number & { __brandB: string })) & ""',
        "alwaysFalsy",
      ),
      unnecessaryConditionTest(
        '("foo" | "bar") & { __brand: string }',
        "alwaysTruthy",
      ),
      unnecessaryConditionTest(
        "(123 | true) & { __brand: string }",
        "alwaysTruthy",
      ),
      unnecessaryConditionTest(
        '(string | number) & ("foo" | 123) & { __brand: string }',
        "alwaysTruthy",
      ),
      unnecessaryConditionTest(
        '((string & { __brandA: string }) | (number & { __brandB: string })) & "foo"',
        "alwaysTruthy",
      ),
      unnecessaryConditionTest(
        '((string & { __brandA: string }) | (number & { __brandB: string })) & ("foo" | 123)',
        "alwaysTruthy",
      ),
      {
        code: `
type A = {
  [name in Lowercase<string>]?: {
    [name in Lowercase<string>]: {
      a: 1;
    };
  };
};

declare const a: A;

a.a?.a?.a;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 12,
            column: 7,
            endLine: 12,
            endColumn: 9,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type A = {
  [name in Lowercase<string>]?: {
    [name in Lowercase<string>]: {
      a: 1;
    };
  };
};

declare const a: A;

a.a?.a.a;
      `,
              },
            ],
          },
        ],
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
declare const arr: object[];
if (arr[42] && arr[42]) {}
       `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 16 }],
      },
    ],
  });
