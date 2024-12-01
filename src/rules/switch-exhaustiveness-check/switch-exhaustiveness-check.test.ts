import { ruleTester } from "../../ruleTester.ts";
import {
  messages,
  switchExhaustivenessCheck,
} from "./switch-exhaustiveness-check.ts";

export const test = () =>
  ruleTester({
    ruleFn: switchExhaustivenessCheck,
    valid: [
      // All branches matched
      `
type Day =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

const day = 'Monday' as Day;
let result = 0;

switch (day) {
  case 'Monday':
    break;
  case 'Tuesday':
    break;
  case 'Wednesday':
    break;
  case 'Thursday':
    break;
  case 'Friday':
    break;
  case 'Saturday':
    break;
  case 'Sunday':
    break;
}
    `,
      //  Other primitive literals work too
      `
type Num = 0 | 1 | 2;

function test(value: Num): number {
  switch (value) {
    case 0:
      return 0;
    case 1:
      return 1;
    case 2:
      return 2;
  }
}
    `,
      `
type Bool = true | false;

function test(value: Bool): number {
  switch (value) {
    case true:
      return 1;
    case false:
      return 0;
  }
}
    `,
      `
type Mix = 0 | 1 | 'two' | 'three' | true;

function test(value: Mix): number {
  switch (value) {
    case 0:
      return 0;
    case 1:
      return 1;
    case 'two':
      return 2;
    case 'three':
      return 3;
    case true:
      return 4;
  }
}
    `,
      //  Works with type references
      `
type A = 'a';
type B = 'b';
type C = 'c';
type Union = A | B | C;

function test(value: Union): number {
  switch (value) {
    case 'a':
      return 1;
    case 'b':
      return 2;
    case 'c':
      return 3;
  }
}
    `,
      //  Works with `typeof`
      `
const A = 'a';
const B = 1;
const C = true;

type Union = typeof A | typeof B | typeof C;

function test(value: Union): number {
  switch (value) {
    case 'a':
      return 1;
    case 1:
      return 2;
    case true:
      return 3;
  }
}
    `,
      //  Switch contains default clause.
      {
        options: { considerDefaultExhaustiveForUnions: true },
        code: `
type Day =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

const day = 'Monday' as Day;
let result = 0;

switch (day) {
  case 'Monday':
    break;
  default:
    break;
}
      `,
      },
      // Exhaustiveness check only works for union types...
      `
const day = 'Monday' as string;
let result = 0;

switch (day) {
  case 'Monday':
    break;
  case 'Tuesday':
    break;
}
    `,
      //  ... and enums (at least for now).
      `
enum Enum {
  A,
  B,
}

function test(value: Enum): number {
  switch (value) {
    case Enum.A:
      return 1;
    case Enum.B:
      return 2;
  }
}
    `,
      //  Object union types won't work either, unless it's a discriminated union
      `
type ObjectUnion = { a: 1 } | { b: 2 };

function test(value: ObjectUnion): number {
  switch (value.a) {
    case 1:
      return 1;
  }
}
    `,
      //  switch with default clause on non-union type
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: number;
switch (value) {
  case 0:
    return 0;
  case 1:
    return 1;
  default:
    return -1;
}
      `,
      },
      // switch with default clause on string type +
      // "allowDefaultCaseForExhaustiveSwitch" option
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: string;
switch (value) {
  case 'foo':
    return 0;
  case 'bar':
    return 1;
  default:
    return -1;
}
      `,
      },
      // switch with default clause on number type +
      // "allowDefaultCaseForExhaustiveSwitch" option
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: number;
switch (value) {
  case 0:
    return 0;
  case 1:
    return 1;
  default:
    return -1;
}
      `,
      },
      // switch with default clause on bigint type +
      // "allowDefaultCaseForExhaustiveSwitch" option
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: bigint;
switch (value) {
  case 0:
    return 0;
  case 1:
    return 1;
  default:
    return -1;
}
      `,
      },
      // switch with default clause on symbol type +
      // "allowDefaultCaseForExhaustiveSwitch" option
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: symbol;
const foo = Symbol('foo');
switch (value) {
  case foo:
    return 0;
  default:
    return -1;
}
      `,
      },
      // switch with default clause on union with number +
      // "allowDefaultCaseForExhaustiveSwitch" option
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: 0 | 1 | number;
switch (value) {
  case 0:
    return 0;
  case 1:
    return 1;
  default:
    return -1;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: 'literal';
switch (value) {
  case 'literal':
    return 0;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: null;
switch (value) {
  case null:
    return 0;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: undefined;
switch (value) {
  case undefined:
    return 0;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: null | undefined;
switch (value) {
  case null:
    return 0;
  case undefined:
    return 0;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: 'literal' & { _brand: true };
switch (value) {
  case 'literal':
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: ('literal' & { _brand: true }) | 1;
switch (value) {
  case 'literal':
    break;
  case 1:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: (1 & { _brand: true }) | 'literal' | null;
switch (value) {
  case 'literal':
    break;
  case 1:
    break;
  case null:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: '1' | '2' | number;
switch (value) {
  case '1':
    break;
  case '2':
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: '1' | '2' | number;
switch (value) {
  case '1':
    break;
  case '2':
    break;
  default:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: '1' | '2' | number;
switch (value) {
  case '1':
    break;
  case '2':
    break;
  default:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: '1' | '2' | (number & { foo: 'bar' });
switch (value) {
  case '1':
    break;
  case '2':
    break;
  default:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: '1' | '2' | number;
switch (value) {
  case '1':
    break;
  case '2':
    break;
  default:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          considerDefaultExhaustiveForUnions: true,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: number | null | undefined;
switch (value) {
  case null:
    break;
  case undefined:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          considerDefaultExhaustiveForUnions: true,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: '1' | '2' | number;
switch (value) {
  case '1':
    break;
  default:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: (string & { foo: 'bar' }) | '1';
switch (value) {
  case '1':
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
const a = Symbol('a');
declare const value: typeof a | 2;
switch (value) {
  case a:
    break;
  case 2:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: string | number;
switch (value) {
  case 1:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: string | number;
switch (value) {
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: string | number;
switch (value) {
  default:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: number;
declare const a: number;
switch (value) {
  case a:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: bigint;
switch (value) {
  case 10n:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: symbol;
const a = Symbol('a');
switch (value) {
  case a:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: symbol;
const a = Symbol('a');
switch (value) {
  case a:
    break;
  default:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: true,
        },
        code: `
const a = Symbol('a');
declare const value: typeof a | string;
switch (value) {
  case a:
    break;
  default:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          considerDefaultExhaustiveForUnions: true,
          requireDefaultForNonUnion: true,
        },
        code: `
const a = Symbol('a');
declare const value: typeof a | string;
switch (value) {
  default:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          considerDefaultExhaustiveForUnions: true,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: boolean | 1;
switch (value) {
  case 1:
    break;
  default:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: boolean | 1;
switch (value) {
  case 1:
    break;
  case true:
    break;
  case false:
    break;
  default:
    break;
}
      `,
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: false,
        },
        code: `
enum Aaa {
  Foo,
  Bar,
}
declare const value: Aaa | 1;
switch (value) {
  case 1:
    break;
  case Aaa.Foo:
    break;
  case Aaa.Bar:
    break;
}
      `,
      },
      {
        options: { considerDefaultExhaustiveForUnions: true },
        code: `
declare const literal: 'a' | 'b';
switch (literal) {
  case 'a':
    break;
  case 'b':
    break;
}
      `,
      },
      {
        options: { considerDefaultExhaustiveForUnions: true },
        code: `
declare const literal: 'a' | 'b';
switch (literal) {
  case 'a':
    break;
  default:
    break;
}
      `,
      },
      {
        options: { allowDefaultCaseForExhaustiveSwitch: false },
        code: `
declare const literal: 'a' | 'b';
switch (literal) {
  case 'a':
    break;
  case 'b':
    break;
}
      `,
      },
      {
        options: { considerDefaultExhaustiveForUnions: true },
        code: `
enum MyEnum {
  Foo = 'Foo',
  Bar = 'Bar',
  Baz = 'Baz',
}

declare const myEnum: MyEnum;

switch (myEnum) {
  case MyEnum.Foo:
    break;
  case MyEnum.Bar:
    break;
  default:
    break;
}
      `,
      },
      {
        options: { considerDefaultExhaustiveForUnions: true },
        code: `
declare const value: boolean;
switch (value) {
  case false:
    break;
  default:
    break;
}
      `,
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
function foo(x: string[]) {
  switch (x[0]) {
    case 'hi':
      break;
    case undefined:
      break;
  }
}
      `,
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
function foo(x: string[], y: string | undefined) {
  const a = x[0];
  if (typeof a === 'string') {
    return;
  }
  switch (y) {
    case 'hi':
      break;
    case a:
      break;
  }
}
      `,
      },
    ],

    invalid: [
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: 'literal';
switch (value) {
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: '"literal"',
            }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
declare const value: 'literal';
switch (value) {
  case "literal":
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: 'literal' & { _brand: true };
switch (value) {
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: '"literal"',
            }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
declare const value: 'literal' & { _brand: true };
switch (value) {
  case "literal":
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: ('literal' & { _brand: true }) | 1;
switch (value) {
  case 'literal':
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({ missingCases: "1" }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
declare const value: ('literal' & { _brand: true }) | 1;
switch (value) {
  case 'literal':
    break;
  case 1:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: '1' | '2' | number;
switch (value) {
  case '1':
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({ missingCases: '"2"' }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
declare const value: '1' | '2' | number;
switch (value) {
  case '1':
    break;
  case "2":
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: '1' | '2' | number;
switch (value) {
  case '1':
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({ missingCases: '"2"' }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
declare const value: '1' | '2' | number;
switch (value) {
  case '1':
    break;
  case "2":
    break;
}
      `,
              },
            ],
          },
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "default",
            }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addDefaultCase,
                output: `
declare const value: '1' | '2' | number;
switch (value) {
  case '1':
    break;
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: (string & { foo: 'bar' }) | '1';
switch (value) {
  case '1':
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "default",
            }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addDefaultCase,
                output: `
declare const value: (string & { foo: 'bar' }) | '1';
switch (value) {
  case '1':
    break;
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: (string & { foo: 'bar' }) | '1' | 1 | null | undefined;
switch (value) {
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: 'undefined | null | 1 | "1"',
            }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
declare const value: (string & { foo: 'bar' }) | '1' | 1 | null | undefined;
switch (value) {
  case undefined:
    break;
  case null:
    break;
  case 1:
    break;
  case "1":
    break;
}
      `,
              },
            ],
          },
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "default",
            }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addDefaultCase,
                output: `
declare const value: (string & { foo: 'bar' }) | '1' | 1 | null | undefined;
switch (value) {
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: string | number;
switch (value) {
  case 1:
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "default",
            }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addDefaultCase,
                output: `
declare const value: string | number;
switch (value) {
  case 1:
    break;
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: number;
declare const a: number;
switch (value) {
  case a:
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "default",
            }),
            line: 4,
            column: 9,
            suggestions: [
              {
                message: messages.addDefaultCase,
                output: `
declare const value: number;
declare const a: number;
switch (value) {
  case a:
    break;
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: bigint;
switch (value) {
  case 10n:
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "default",
            }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addDefaultCase,
                output: `
declare const value: bigint;
switch (value) {
  case 10n:
    break;
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: symbol;
const a = Symbol('a');
switch (value) {
  case a:
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "default",
            }),
            line: 4,
            column: 9,
            suggestions: [
              {
                message: messages.addDefaultCase,
                output: `
declare const value: symbol;
const a = Symbol('a');
switch (value) {
  case a:
    break;
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
const a = Symbol('aa');
const b = Symbol('bb');
declare const value: typeof a | typeof b | 1;
switch (value) {
  case 1:
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "typeof a | typeof b",
            }),
            line: 5,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
const a = Symbol('aa');
const b = Symbol('bb');
declare const value: typeof a | typeof b | 1;
switch (value) {
  case 1:
    break;
  case a:
    break;
  case b:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
const a = Symbol('a');
declare const value: typeof a | string;
switch (value) {
  case a:
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "default",
            }),
            line: 4,
            column: 9,
            suggestions: [
              {
                message: messages.addDefaultCase,
                output: `
const a = Symbol('a');
declare const value: typeof a | string;
switch (value) {
  case a:
    break;
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: false,
        },
        code: `
declare const value: boolean;
switch (value) {
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "false | true",
            }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
declare const value: boolean;
switch (value) {
  case false:
    break;
  case true:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: boolean | 1;
switch (value) {
  case false:
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "true | 1",
            }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
declare const value: boolean | 1;
switch (value) {
  case false:
    break;
  case true:
    break;
  case 1:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: boolean | number;
switch (value) {
  case 1:
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "false | true",
            }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
declare const value: boolean | number;
switch (value) {
  case 1:
    break;
  case false:
    break;
  case true:
    break;
}
      `,
              },
            ],
          },
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "default",
            }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addDefaultCase,
                output: `
declare const value: boolean | number;
switch (value) {
  case 1:
    break;
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
        code: `
declare const value: object;
switch (value) {
  case 1:
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "default",
            }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addDefaultCase,
                output: `
declare const value: object;
switch (value) {
  case 1:
    break;
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: true,
        },
        code: `
enum Aaa {
  Foo,
  Bar,
}
declare const value: Aaa | 1 | string;
switch (value) {
  case 1:
    break;
  case Aaa.Foo:
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "Aaa.Bar",
            }),
            line: 7,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
enum Aaa {
  Foo,
  Bar,
}
declare const value: Aaa | 1 | string;
switch (value) {
  case 1:
    break;
  case Aaa.Foo:
    break;
  case Aaa.Bar:
    break;
}
      `,
              },
            ],
          },
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "default",
            }),
            line: 7,
            column: 9,
            suggestions: [
              {
                message: messages.addDefaultCase,
                output: `
enum Aaa {
  Foo,
  Bar,
}
declare const value: Aaa | 1 | string;
switch (value) {
  case 1:
    break;
  case Aaa.Foo:
    break;
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        // Matched only one branch out of seven.
        code: `
type Day =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

const day = 'Monday' as Day;
let result = 0;

switch (day) {
  case 'Monday':
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases:
                '"Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday"',
            }),
            line: 14,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
type Day =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

const day = 'Monday' as Day;
let result = 0;

switch (day) {
  case 'Monday':
    break;
  case "Tuesday":
    break;
  case "Wednesday":
    break;
  case "Thursday":
    break;
  case "Friday":
    break;
  case "Saturday":
    break;
  case "Sunday":
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        // Didn't match all enum variants
        code: `
enum Enum {
  A,
  B,
}

function test(value: Enum): number {
  switch (value) {
    case Enum.A:
      return 1;
  }
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({ missingCases: "Enum.B" }),
            line: 8,
            column: 11,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
enum Enum {
  A,
  B,
}

function test(value: Enum): number {
  switch (value) {
    case Enum.A:
      return 1;
    case Enum.B:
      break;
  }
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type A = 'a';
type B = 'b';
type C = 'c';
type Union = A | B | C;

function test(value: Union): number {
  switch (value) {
    case 'a':
      return 1;
  }
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: '"b" | "c"',
            }),
            line: 8,
            column: 11,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
type A = 'a';
type B = 'b';
type C = 'c';
type Union = A | B | C;

function test(value: Union): number {
  switch (value) {
    case 'a':
      return 1;
    case "b":
      break;
    case "c":
      break;
  }
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const A = 'a';
const B = 1;
const C = true;

type Union = typeof A | typeof B | typeof C;

function test(value: Union): number {
  switch (value) {
    case 'a':
      return 1;
  }
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "true | 1",
            }),
            line: 9,
            column: 11,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
const A = 'a';
const B = 1;
const C = true;

type Union = typeof A | typeof B | typeof C;

function test(value: Union): number {
  switch (value) {
    case 'a':
      return 1;
    case true:
      break;
    case 1:
      break;
  }
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type DiscriminatedUnion = { type: 'A'; a: 1 } | { type: 'B'; b: 2 };

function test(value: DiscriminatedUnion): number {
  switch (value.type) {
    case 'A':
      return 1;
  }
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({ missingCases: '"B"' }),
            line: 5,
            column: 11,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
type DiscriminatedUnion = { type: 'A'; a: 1 } | { type: 'B'; b: 2 };

function test(value: DiscriminatedUnion): number {
  switch (value.type) {
    case 'A':
      return 1;
    case "B":
      break;
  }
}
      `,
              },
            ],
          },
        ],
      },
      {
        // Still complains with empty switch
        code: `
type Day =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

const day = 'Monday' as Day;

switch (day) {
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases:
                '"Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday"',
            }),
            line: 13,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
type Day =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

const day = 'Monday' as Day;

switch (day) {
  case "Monday":
    break;
  case "Tuesday":
    break;
  case "Wednesday":
    break;
  case "Thursday":
    break;
  case "Friday":
    break;
  case "Saturday":
    break;
  case "Sunday":
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const a = Symbol('a');
const b = Symbol('b');
const c = Symbol('c');

type T = typeof a | typeof b | typeof c;

function test(value: T): number {
  switch (value) {
    case a:
      return 1;
  }
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "typeof b | typeof c",
            }),
            line: 9,
            column: 11,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
const a = Symbol('a');
const b = Symbol('b');
const c = Symbol('c');

type T = typeof a | typeof b | typeof c;

function test(value: T): number {
  switch (value) {
    case a:
      return 1;
    case b:
      break;
    case c:
      break;
  }
}
      `,
              },
            ],
          },
        ],
      },
      // Provides suggestions to add missing cases
      {
        // with existing cases present
        code: `
type T = 1 | 2;

function test(value: T): number {
  switch (value) {
    case 1:
      return 1;
  }
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({ missingCases: "2" }),
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
type T = 1 | 2;

function test(value: T): number {
  switch (value) {
    case 1:
      return 1;
    case 2:
      break;
  }
}
      `,
              },
            ],
          },
        ],
      },
      {
        // without existing cases
        code: `
type T = 1 | 2;

function test(value: T): number {
  switch (value) {
  }
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({ missingCases: "1 | 2" }),
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
type T = 1 | 2;

function test(value: T): number {
  switch (value) {
    case 1:
      break;
    case 2:
      break;
  }
}
      `,
              },
            ],
          },
        ],
      },
      {
        // keys include special characters
        code: `
export enum Enum {
  'test-test' = 'test-test',
  'test' = 'test',
}

function test(arg: Enum): string {
  switch (arg) {
  }
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: '(typeof Enum)["test-test"] | Enum.test',
            }),
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
export enum Enum {
  'test-test' = 'test-test',
  'test' = 'test',
}

function test(arg: Enum): string {
  switch (arg) {
    case Enum['test-test']:
      break;
    case Enum.test:
      break;
  }
}
      `,
              },
            ],
          },
        ],
      },
      {
        // keys include empty string
        code: `
export enum Enum {
  '' = 'test-test',
  'test' = 'test',
}

function test(arg: Enum): string {
  switch (arg) {
  }
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: '(typeof Enum)[""] | Enum.test',
            }),
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
export enum Enum {
  '' = 'test-test',
  'test' = 'test',
}

function test(arg: Enum): string {
  switch (arg) {
    case Enum['']:
      break;
    case Enum.test:
      break;
  }
}
      `,
              },
            ],
          },
        ],
      },
      {
        // keys include number as first character
        code: `
export enum Enum {
  '9test' = 'test-test',
  'test' = 'test',
}

function test(arg: Enum): string {
  switch (arg) {
  }
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: '(typeof Enum)["9test"] | Enum.test',
            }),
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
export enum Enum {
  '9test' = 'test-test',
  'test' = 'test',
}

function test(arg: Enum): string {
  switch (arg) {
    case Enum['9test']:
      break;
    case Enum.test:
      break;
  }
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: true,
          requireDefaultForNonUnion: true,
        },
        code: `
const value: number = Math.floor(Math.random() * 3);
switch (value) {
  case 0:
    return 0;
  case 1:
    return 1;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "default",
            }),
            suggestions: [
              {
                message: messages.addDefaultCase,
                output: `
const value: number = Math.floor(Math.random() * 3);
switch (value) {
  case 0:
    return 0;
  case 1:
    return 1;
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
enum Enum {
  'a' = 1,
  [\`key-with

  new-line\`] = 2,
}

declare const a: Enum;

switch (a) {
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases:
                'Enum.a | (typeof Enum)["key-with\\n\\n  new-line"]',
            }),
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
enum Enum {
  'a' = 1,
  [\`key-with

  new-line\`] = 2,
}

declare const a: Enum;

switch (a) {
  case Enum.a:
    break;
  case Enum['key-with\\n\\n  new-line']:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
enum Enum {
  'a' = 1,
  "'a' \`b\` \\"c\\"" = 2,
}

declare const a: Enum;

switch (a) {}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: 'Enum.a | (typeof Enum)["\'a\' `b` \\"c\\""]',
            }),
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
enum Enum {
  'a' = 1,
  "'a' \`b\` \\"c\\"" = 2,
}

declare const a: Enum;

switch (a) {
  case Enum.a:
    break;
  case Enum['\\'a\\' \`b\` "c"']:
    break;}
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: false,
        },
        // superfluous switch with a string-based union
        code: `
type MyUnion = 'foo' | 'bar' | 'baz';

declare const myUnion: MyUnion;

switch (myUnion) {
  case 'foo':
  case 'bar':
  case 'baz':
    break;
  default:
    break;
}
      `,
        errors: [{ message: messages.dangerousDefaultCase }],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: false,
        },
        // superfluous switch with a string-based enum
        code: `
enum MyEnum {
  Foo = 'Foo',
  Bar = 'Bar',
  Baz = 'Baz',
}

declare const myEnum: MyEnum;

switch (myEnum) {
  case MyEnum.Foo:
  case MyEnum.Bar:
  case MyEnum.Baz:
    break;
  default:
    break;
}
      `,
        errors: [{ message: messages.dangerousDefaultCase }],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: false,
        },
        // superfluous switch with a number-based enum
        code: `
enum MyEnum {
  Foo,
  Bar,
  Baz,
}

declare const myEnum: MyEnum;

switch (myEnum) {
  case MyEnum.Foo:
  case MyEnum.Bar:
  case MyEnum.Baz:
    break;
  default:
    break;
}
      `,
        errors: [{ message: messages.dangerousDefaultCase }],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: false,
        },
        // superfluous switch with a boolean
        code: `
declare const myBoolean: boolean;

switch (myBoolean) {
  case true:
  case false:
    break;
  default:
    break;
}
      `,
        errors: [{ message: messages.dangerousDefaultCase }],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: false,
        },
        // superfluous switch with undefined
        code: `
declare const myValue: undefined;

switch (myValue) {
  case undefined:
    break;

  default:
    break;
}
      `,
        errors: [{ message: messages.dangerousDefaultCase }],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: false,
        },
        // superfluous switch with null
        code: `
declare const myValue: null;

switch (myValue) {
  case null:
    break;

  default:
    break;
}
      `,
        errors: [{ message: messages.dangerousDefaultCase }],
      },
      {
        options: {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: false,
        },
        // superfluous switch with union of various types
        code: `
declare const myValue: 'foo' | boolean | undefined | null;

switch (myValue) {
  case 'foo':
  case true:
  case false:
  case undefined:
  case null:
    break;

  default:
    break;
}
      `,
        errors: [{ message: messages.dangerousDefaultCase }],
      },
      {
        options: { considerDefaultExhaustiveForUnions: false },
        code: `
declare const literal: 'a' | 'b';

switch (literal) {
  case 'a':
    break;
  default:
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({ missingCases: '"b"' }),
            line: 4,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
declare const literal: 'a' | 'b';

switch (literal) {
  case 'a':
    break;
  case "b":
    break;
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const literal: 'a' | 'b';

switch (literal) {
  case 'a':
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({ missingCases: '"b"' }),
            line: 4,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
declare const literal: 'a' | 'b';

switch (literal) {
  case 'a':
    break;
  case "b":
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { considerDefaultExhaustiveForUnions: false },
        code: `
declare const literal: 'a' | 'b';

switch (literal) {
  default:
  case 'a':
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({ missingCases: '"b"' }),
            line: 4,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
declare const literal: 'a' | 'b';

switch (literal) {
  case "b":
    break;
  default:
  case 'a':
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { considerDefaultExhaustiveForUnions: false },
        code: `
declare const literal: 'a' | 'b';

switch (literal) {
  case 'a':
  default:
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({ missingCases: '"b"' }),
            line: 4,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
declare const literal: 'a' | 'b';

switch (literal) {
  case "b":
    break;
  case 'a':
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { considerDefaultExhaustiveForUnions: false },
        code: `
declare const literal: 'a' | 'b' | 'c';

switch (literal) {
  case 'a':
    break;
  default:
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: '"b" | "c"',
            }),
            line: 4,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
declare const literal: 'a' | 'b' | 'c';

switch (literal) {
  case 'a':
    break;
  case "b":
    break;
  case "c":
    break;
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { considerDefaultExhaustiveForUnions: false },
        code: `
enum MyEnum {
  Foo = 'Foo',
  Bar = 'Bar',
  Baz = 'Baz',
}

declare const myEnum: MyEnum;

switch (myEnum) {
  case MyEnum.Foo:
    break;
  default:
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "MyEnum.Bar | MyEnum.Baz",
            }),
            line: 10,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
enum MyEnum {
  Foo = 'Foo',
  Bar = 'Bar',
  Baz = 'Baz',
}

declare const myEnum: MyEnum;

switch (myEnum) {
  case MyEnum.Foo:
    break;
  case MyEnum.Bar:
    break;
  case MyEnum.Baz:
    break;
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { considerDefaultExhaustiveForUnions: false },
        code: `
declare const value: boolean;
switch (value) {
  default:
    break;
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "false | true",
            }),
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
declare const value: boolean;
switch (value) {
  case false:
    break;
  case true:
    break;
  default:
    break;
}
      `,
              },
            ],
          },
        ],
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
function foo(x: string[]) {
  switch (x[0]) {
    case 'hi':
      break;
  }
}
      `,
        errors: [
          {
            message: messages.switchIsNotExhaustive({
              missingCases: "undefined",
            }),
            line: 3,
            column: 11,
            suggestions: [
              {
                message: messages.addMissingCases,
                output: `
function foo(x: string[]) {
  switch (x[0]) {
    case 'hi':
      break;
    case undefined:
      break;
  }
}
      `,
              },
            ],
          },
        ],
      },
    ],
  });
