import { ruleTester } from "../../ruleTester.ts";
import {
  messages,
  preferNullishCoalescing,
} from "./preferNullishCoalescing.ts";

const types = ["string", "number", "boolean", "object"];
const nullishTypes = ["null", "undefined", "null | undefined"];
const ignorablePrimitiveTypes = [
  "string",
  "number",
  "boolean",
  "bigint",
] as const;

const nullishTypeTest = <T>(
  cb: (nullish: string, type: string, equals: string) => T,
): T[] =>
  nullishTypes.flatMap((nullish) =>
    types.flatMap((type) =>
      ["", ...(cb.length === 3 ? ["="] : [])].map((equals) =>
        cb(nullish, type, equals),
      ),
    ),
  );

export const test = () =>
  ruleTester({
    ruleFn: preferNullishCoalescing,
    valid: [
      "declare let x: number | undefined; 15 !== x && x !== undefined ? x : y;",
      `declare let x: () => string | null; x() ? x() : y;`,
      {
        code: `
      declare let foo: string;
      declare function makeFoo(): string;
      
      function lazyInitialize() {
        if (!foo) {
          foo = makeFoo();
        }
      }
      `,
      },
      ...types.map(
        (type) => `
declare let x: ${type};
(x || 'foo');
      `,
      ),
      ...types.map(
        (type) => `
declare let x: ${type};
x ??= 'foo';
      `,
      ),
      ...nullishTypeTest(
        (nullish, type, equals) => `
declare let x: ${type} | ${nullish};
x ??${equals} 'foo';
      `,
      ),
      {
        options: { ignoreTernaryTests: true },
        code: "x !== undefined && x !== null ? x : y;",
      },
      ...[
        'x !== undefined && x !== null ? "foo" : "bar";',
        "x !== null && x !== undefined && x !== 5 ? x : y",
        "x === null || x === undefined || x === 5 ? x : y",
        "x === undefined && x !== null ? x : y;",
        "x === undefined && x === null ? x : y;",
        "x !== undefined && x === null ? x : y;",
        "x === undefined || x !== null ? x : y;",
        "x === undefined || x === null ? x : y;",
        "x !== undefined || x === null ? x : y;",
        "x !== undefined || x === null ? y : x;",
        "x === null || x === null ? y : x;",
        "x === undefined || x === undefined ? y : x;",
        "x == null ? x : y;",
        "undefined == null ? x : y;",
        "undefined != z ? x : y;",
        "x == undefined ? x : y;",
        "x != null ? y : x;",
        "x != undefined ? y : x;",
        "null == x ? x : y;",
        "undefined == x ? x : y;",
        "null != x ? y : x;",
        "undefined != x ? y : x;",
        `
declare let x: string;
x === null ? x : y;
      `,
        `
declare let x: string | undefined;
x === null ? x : y;
      `,
        `
declare let x: string | null;
x === undefined ? x : y;
      `,
        `
declare let x: string | undefined | null;
x !== undefined ? x : y;
      `,
        `
declare let x: string | undefined | null;
x !== null ? x : y;
      `,
        `
declare let x: string | null | any;
x === null ? x : y;
      `,
        `
declare let x: string | null | unknown;
x === null ? x : y;
      `,
        `
declare let x: { n: string[] };
x.n ? x.n : y;
      `,
      ].map((code) => ({ options: { ignoreTernaryTests: false }, code })),
      ...nullishTypeTest((nullish, type, equals) => ({
        code: `
declare let x: ${type} | ${nullish};
(x ||${equals} 'foo') ? null : null;
      `,
      })),
      ...nullishTypeTest((nullish, type, equals) => ({
        code: `
declare let x: ${type} | ${nullish};
if ((x ||${equals} 'foo')) {}
      `,
      })),
      ...nullishTypeTest((nullish, type, equals) => ({
        code: `
declare let x: ${type} | ${nullish};
do {} while ((x ||${equals} 'foo'))
      `,
      })),
      ...nullishTypeTest((nullish, type, equals) => ({
        code: `
declare let x: ${type} | ${nullish};
for (;(x ||${equals} 'foo');) {}
      `,
      })),
      ...nullishTypeTest((nullish, type, equals) => ({
        code: `
declare let x: ${type} | ${nullish};
while ((x ||${equals} 'foo')) {}
      `,
      })),
      // ignoreMixedLogicalExpressions
      ...nullishTypeTest((nullish, type) => ({
        options: { ignoreMixedLogicalExpressions: true },
        code: `
declare let a: ${type} | ${nullish};
declare let b: ${type} | ${nullish};
declare let c: ${type} | ${nullish};
a || b && c;
      `,
      })),
      ...nullishTypeTest((nullish, type) => ({
        options: { ignoreMixedLogicalExpressions: true },
        code: `
declare let a: ${type} | ${nullish};
declare let b: ${type} | ${nullish};
declare let c: ${type} | ${nullish};
declare let d: ${type} | ${nullish};
a || b || c && d;
      `,
      })),
      ...nullishTypeTest((nullish, type) => ({
        options: { ignoreMixedLogicalExpressions: true },
        code: `
declare let a: ${type} | ${nullish};
declare let b: ${type} | ${nullish};
declare let c: ${type} | ${nullish};
declare let d: ${type} | ${nullish};
a && b || c || d;
      `,
      })),
      ...ignorablePrimitiveTypes.map((type) => ({
        options: { ignorePrimitives: { [type]: true } },
        code: `
declare let x: ${type} | undefined;
x || y;
      `,
      })),
      ...ignorablePrimitiveTypes.map((type) => ({
        options: { ignorePrimitives: true },
        code: `
declare let x: ${type} | undefined;
x || y;
      `,
      })),
      ...ignorablePrimitiveTypes.map((type) => ({
        options: { ignorePrimitives: { [type]: true } },
        code: `
declare let x: (${type} & { __brand?: any }) | undefined;
x || y;
      `,
      })),
      ...ignorablePrimitiveTypes.map((type) => ({
        options: { ignorePrimitives: true },
        code: `
declare let x: (${type} & { __brand?: any }) | undefined;
x || y;
      `,
      })),
      `
      declare let x: never;
      declare let y: number;
      x || y;
     `,
      {
        options: {
          ignorePrimitives: {
            bigint: true,
            boolean: true,
            number: false,
            string: true,
          },
        },
        code: `
declare let x: 0 | 1 | 0n | 1n | undefined;
x || y;
      `,
      },
      {
        options: {
          ignorePrimitives: {
            bigint: false,
            boolean: true,
            number: true,
            string: true,
          },
        },
        code: `
declare let x: 0 | 1 | 0n | 1n | undefined;
x || y;
      `,
      },
      {
        options: { ignorePrimitives: { number: true, string: true } },
        code: `
declare let x: 0 | 'foo' | undefined;
x || y;
      `,
      },
      {
        options: { ignorePrimitives: { number: true, string: false } },
        code: `
declare let x: 0 | 'foo' | undefined;
x || y;
      `,
      },
      {
        options: { ignorePrimitives: { number: true } },
        code: `
enum Enum {
  A = 0,
  B = 1,
  C = 2,
}
declare let x: Enum | undefined;
x || y;
      `,
      },
      {
        options: { ignorePrimitives: { number: true } },
        code: `
enum Enum {
  A = 0,
  B = 1,
  C = 2,
}
declare let x: Enum.A | Enum.B | undefined;
x || y;
      `,
      },
      {
        options: { ignorePrimitives: { string: true } },
        code: `
enum Enum {
  A = 'a',
  B = 'b',
  C = 'c',
}
declare let x: Enum | undefined;
x || y;
      `,
      },
      {
        options: { ignorePrimitives: { string: true } },
        code: `
enum Enum {
  A = 'a',
  B = 'b',
  C = 'c',
}
declare let x: Enum.A | Enum.B | undefined;
x || y;
      `,
      },
      {
        options: { ignoreBooleanCoercion: true },
        code: `
let a: string | true | undefined;
let b: string | boolean | undefined;

const x = Boolean(a || b);
      `,
      },
      {
        options: { ignoreBooleanCoercion: true },
        code: `
let a: string | boolean | undefined;
let b: string | boolean | undefined;
let c: string | boolean | undefined;

const test = Boolean(a || b || c);
      `,
      },
      {
        options: { ignoreBooleanCoercion: true },
        code: `
let a: string | boolean | undefined;
let b: string | boolean | undefined;
let c: string | boolean | undefined;

const test = Boolean(a || (b && c));
      `,
      },
      {
        options: { ignoreBooleanCoercion: true },
        code: `
let a: string | boolean | undefined;
let b: string | boolean | undefined;
let c: string | boolean | undefined;

const test = Boolean((a || b) ?? c);
      `,
      },
      {
        options: { ignoreBooleanCoercion: true },
        code: `
let a: string | boolean | undefined;
let b: string | boolean | undefined;
let c: string | boolean | undefined;

const test = Boolean(a ?? (b || c));
      `,
      },
      {
        options: { ignoreBooleanCoercion: true },
        code: `
let a: string | boolean | undefined;
let b: string | boolean | undefined;
let c: string | boolean | undefined;

const test = Boolean(a ? b || c : 'fail');
      `,
      },
      {
        options: { ignoreBooleanCoercion: true },
        code: `
let a: string | boolean | undefined;
let b: string | boolean | undefined;
let c: string | boolean | undefined;

const test = Boolean(a ? 'success' : b || c);
      `,
      },
      {
        options: { ignoreBooleanCoercion: true },
        code: `
let a: string | boolean | undefined;
let b: string | boolean | undefined;
let c: string | boolean | undefined;

const test = Boolean(((a = b), b || c));
      `,
      },
      {
        options: { ignoreConditionalTests: true },
        code: `
let a: string | boolean | undefined;
let b: string | boolean | undefined;
let c: string | boolean | undefined;

if (a || b || c) {
}
      `,
      },
      {
        options: { ignoreConditionalTests: true },
        code: `
let a: string | boolean | undefined;
let b: string | boolean | undefined;
let c: string | boolean | undefined;

if (a || (b && c)) {
}
      `,
      },
      {
        options: { ignoreConditionalTests: true },
        code: `
let a: string | boolean | undefined;
let b: string | boolean | undefined;
let c: string | boolean | undefined;

if ((a || b) ?? c) {
}
      `,
      },
      {
        options: { ignoreConditionalTests: true },
        code: `
let a: string | boolean | undefined;
let b: string | boolean | undefined;
let c: string | boolean | undefined;

if (a ?? (b || c)) {
}
      `,
      },
      {
        options: { ignoreConditionalTests: true },
        code: `
let a: string | boolean | undefined;
let b: string | boolean | undefined;
let c: string | boolean | undefined;

if (a ? b || c : 'fail') {
}
      `,
      },
      {
        options: { ignoreConditionalTests: true },
        code: `
let a: string | boolean | undefined;
let b: string | boolean | undefined;
let c: string | boolean | undefined;

if (a ? 'success' : b || c) {
}
      `,
      },
      {
        options: { ignoreConditionalTests: true },
        code: `
let a: string | boolean | undefined;
let b: string | boolean | undefined;
let c: string | boolean | undefined;

if (((a = b), b || c)) {
}
      `,
      },
      {
        options: { ignoreConditionalTests: true },
        code: `
  let a: string | undefined;
  let b: string | undefined;
  
  if (!(a || b)) {
  }
        `,
      },
      {
        options: { ignoreConditionalTests: true },
        code: `
  let a: string | undefined;
  let b: string | undefined;
  
  if (!!(a || b)) {
  }
        `,
      },
      {
        options: { ignorePrimitives: true },
        code: `
  declare const a: any;
  declare const b: any;
  a ? a : b;
        `,
      },
    ],
    invalid: [
      // ternaries
      {
        code: "declare let x: object | undefined; x ? x : {};",
        errors: [
          {
            message: messages.preferNullishOverTernary,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: "declare let x: object | undefined; x ?? {};",
              },
            ],
          },
        ],
      },
      {
        code: "declare let x: object | undefined; !x ? {} : x;",
        errors: [
          {
            message: messages.preferNullishOverTernary,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: "declare let x: object | undefined; x ?? {};",
              },
            ],
          },
        ],
      },
      {
        code: `
declare let x: unknown;
declare let y: number;
x ? x : y;
        `,
        errors: [
          {
            message: messages.preferNullishOverTernary,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: unknown;
declare let y: number;
x ?? y;
        `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreBooleanCoercion: true },
        code: `
let a: string | boolean | undefined;
let b: string | boolean | undefined;
const test = Boolean(!a ? b : a);
      `,
        errors: [
          {
            message: messages.preferNullishOverTernary,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
let a: string | boolean | undefined;
let b: string | boolean | undefined;
const test = Boolean(a ?? b);
      `,
              },
            ],
          },
        ],
      },
      ...nullishTypeTest((nullish, type, equals) => ({
        code: `
declare let x: ${type} | ${nullish};
(x ||${equals} 'foo');
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals,
              description: equals ? "assignment" : "or",
            }),
            line: 3,
            column: 4,
            endLine: 3,
            endColumn: 6 + equals.length,
            suggestions: [
              {
                message: messages.suggestNullish({ equals }),
                output: `
declare let x: ${type} | ${nullish};
(x ??${equals} 'foo');
      `,
              },
            ],
          },
        ],
      })),
      ...[
        "x !== undefined && x !== null ? x : y;",
        "x !== null && x !== undefined ? x : y;",
        "x === undefined || x === null ? y : x;",
        "x === null || x === undefined ? y : x;",
        "undefined !== x && x !== null ? x : y;",
        "null !== x && x !== undefined ? x : y;",
        "undefined === x || x === null ? y : x;",
        "null === x || x === undefined ? y : x;",
        "x !== undefined && null !== x ? x : y;",
        "x !== null && undefined !== x ? x : y;",
        "x === undefined || null === x ? y : x;",
        "x === null || undefined === x ? y : x;",
        "undefined !== x && null !== x ? x : y;",
        "null !== x && undefined !== x ? x : y;",
        "undefined === x || null === x ? y : x;",
        "null === x || undefined === x ? y : x;",
        "x != undefined && x != null ? x : y;",
        "x == undefined || x == null ? y : x;",
        "x != undefined && x !== null ? x : y;",
        "x == undefined || x === null ? y : x;",
        "x !== undefined && x != null ? x : y;",
        "undefined != x ? x : y;",
        "null != x ? x : y;",
        "undefined == x ? y : x;",
        "null == x ? y : x;",
        "x != undefined ? x : y;",
        "x != null ? x : y;",
        "x == undefined  ? y : x;",
        "x == null ? y : x;",
      ].flatMap((code) => [
        {
          options: { ignoreTernaryTests: false },
          code,
          errors: [
            {
              message: messages.preferNullishOverTernary,
              line: 1,
              column: 1,
              endLine: 1,
              endColumn: code.length,
              suggestions: [
                {
                  message: messages.suggestNullish({ equals: "" }),
                  output: "x ?? y;",
                },
              ],
            },
          ],
        },
        {
          options: { ignoreTernaryTests: false },
          code: code.replaceAll("x", 'x.z[1][this[this.o]]["3"][a.b.c]'),
          errors: [
            {
              message: messages.preferNullishOverTernary,
              line: 1,
              column: 1,
              endLine: 1,
              endColumn: code.replaceAll(
                "x",
                'x.z[1][this[this.o]]["3"][a.b.c]',
              ).length,
              suggestions: [
                {
                  message: messages.suggestNullish({ equals: "" }),
                  output: 'x.z[1][this[this.o]]["3"][a.b.c] ?? y;',
                },
              ],
            },
          ],
        },
        {
          options: { ignoreTernaryTests: false },
          code: code.replaceAll("y", "(z = y)"),
          errors: [
            {
              message: messages.preferNullishOverTernary,
              line: 1,
              column: 1,
              endLine: 1,
              endColumn: code.replaceAll("y", "(z = y)").length,
              suggestions: [
                {
                  message: messages.suggestNullish({ equals: "" }),
                  output: "x ?? (z = y);",
                },
              ],
            },
          ],
        },
      ]),
      {
        options: { ignoreTernaryTests: false },
        code: "this != undefined ? this : y;",
        errors: [
          {
            message: messages.preferNullishOverTernary,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 29,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: "this ?? y;",
              },
            ],
          },
        ],
      },
      ...[
        `
declare let x: string | undefined;
x !== undefined ? x : y;
      `,
        `
declare let x: string | undefined;
undefined !== x ? x : y;
      `,
        `
declare let x: string | undefined;
x === undefined ? y : x;
      `,
        `
declare let x: string | undefined;
undefined === x ? y : x;
      `,
        `
declare let x: string | null;
x !== null ? x : y;
      `,
        `
declare let x: string | null;
null !== x ? x : y;
      `,
        `
declare let x: string | null;
x === null ? y : x;
      `,
        `
declare let x: string | null;
null === x ? y : x;
      `,
      ].map((code) => ({
        options: { ignoreTernaryTests: false },
        code,
        errors: [
          {
            message: messages.preferNullishOverTernary,
            line: 3,
            column: 1,
            endLine: 3,
            endColumn: code.split("\n")[2].length,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
${code.split("\n")[1]}
x ?? y;
      `,
              },
            ],
          },
        ],
      })),
      ...[
        `
declare let x: { n?: { a?: string } };
x.n?.a ? x?.n?.a : y;
      `,
        `
declare let x: { n?: { a?: string } };
x.n?.a ? (x?.n).a : y;
      `,
        `
declare let x: { n?: { a?: string } };
x.n?.a ? x.n.a : y;
      `,
        `
declare let x: { n?: { a?: string } };
x.n?.a !== undefined ? x?.n?.a : y;
      `,
        `
declare let x: { n?: { a?: string } };
x.n?.a !== undefined ? x?.n.a : y;
      `,
        `
declare let x: { n?: { a?: string } };
x.n?.a !== undefined ? x.n.a : y;
      `,
        `
declare let x: { n?: { a?: string } };
x.n?.a != undefined ? x?.n?.a : y;
      `,
        `
declare let x: { n?: { a?: string } };
x.n?.a != undefined ? x?.n.a : y;
      `,
        `
declare let x: { n?: { a?: string } };
x.n?.a != undefined ? x.n.a : y;
      `,
        `
declare let x: { n?: { a?: string } };
x.n?.a != null ? x?.n?.a : y;
      `,
        `
declare let x: { n?: { a?: string } };
x.n?.a != null ? x?.n.a : y;
      `,
        `
declare let x: { n?: { a?: string } };
x.n?.a != null ? x.n.a : y;
      `,
        `
declare let x: { n?: { a?: string | null } };
x.n?.a !== undefined && x.n.a !== null ? x?.n?.a : y;
      `,
        `
declare let x: { n?: { a?: string | null } };
x.n?.a !== undefined && x.n.a !== null ? x.n.a : y;
      `,
      ].map((code) => ({
        options: { ignoreTernaryTests: false },
        code,
        errors: [
          {
            message: messages.preferNullishOverTernary,
            line: 3,
            column: 1,
            endLine: 3,
            endColumn: code.split("\n")[2].length,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
${code.split("\n")[1]}
x.n?.a ?? y;
      `,
              },
            ],
          },
        ],
        output: null,
      })),
      ...nullishTypeTest((nullish, type, equals) => ({
        options: { ignoreConditionalTests: false },
        code: `
declare let x: ${type} | ${nullish};
(x ||${equals} 'foo') ? null : null;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals,
              description: equals ? "assignment" : "or",
            }),
            line: 3,
            column: 4,
            endLine: 3,
            endColumn: 6 + equals.length,
            suggestions: [
              {
                message: messages.suggestNullish({ equals }),
                output: `
declare let x: ${type} | ${nullish};
(x ??${equals} 'foo') ? null : null;
      `,
              },
            ],
          },
        ],
      })),
      ...nullishTypeTest((nullish, type, equals) => ({
        options: { ignoreConditionalTests: false },
        code: `
declare let x: ${type} | ${nullish};
if ((x ||${equals} 'foo')) {}
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals,
              description: equals ? "assignment" : "or",
            }),
            line: 3,
            column: 8,
            endLine: 3,
            endColumn: 10 + equals.length,
            suggestions: [
              {
                message: messages.suggestNullish({ equals }),
                output: `
declare let x: ${type} | ${nullish};
if ((x ??${equals} 'foo')) {}
      `,
              },
            ],
          },
        ],
      })),
      ...nullishTypeTest((nullish, type, equals) => ({
        options: { ignoreConditionalTests: false },
        code: `
declare let x: ${type} | ${nullish};
do {} while ((x ||${equals} 'foo'))
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals,
              description: equals ? "assignment" : "or",
            }),
            line: 3,
            column: 17,
            endLine: 3,
            endColumn: 19 + equals.length,
            suggestions: [
              {
                message: messages.suggestNullish({ equals }),
                output: `
declare let x: ${type} | ${nullish};
do {} while ((x ??${equals} 'foo'))
      `,
              },
            ],
          },
        ],
      })),
      ...nullishTypeTest((nullish, type, equals) => ({
        options: { ignoreConditionalTests: false },
        code: `
declare let x: ${type} | ${nullish};
for (;(x ||${equals} 'foo');) {}
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals,
              description: equals ? "assignment" : "or",
            }),
            line: 3,
            column: 10,
            endLine: 3,
            endColumn: 12 + equals.length,
            suggestions: [
              {
                message: messages.suggestNullish({ equals }),
                output: `
declare let x: ${type} | ${nullish};
for (;(x ??${equals} 'foo');) {}
      `,
              },
            ],
          },
        ],
      })),
      ...nullishTypeTest((nullish, type, equals) => ({
        options: { ignoreConditionalTests: false },
        code: `
declare let x: ${type} | ${nullish};
while ((x ||${equals} 'foo')) {}
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals,
              description: equals ? "assignment" : "or",
            }),
            line: 3,
            column: 11,
            endLine: 3,
            endColumn: 13 + equals.length,
            suggestions: [
              {
                message: messages.suggestNullish({ equals }),
                output: `
declare let x: ${type} | ${nullish};
while ((x ??${equals} 'foo')) {}
      `,
              },
            ],
          },
        ],
      })),
      ...nullishTypeTest((nullish, type) => ({
        options: { ignoreMixedLogicalExpressions: false },
        code: `
declare let a: ${type} | ${nullish};
declare let b: ${type} | ${nullish};
declare let c: ${type} | ${nullish};
a || b && c;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            line: 5,
            column: 3,
            endLine: 5,
            endColumn: 5,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let a: ${type} | ${nullish};
declare let b: ${type} | ${nullish};
declare let c: ${type} | ${nullish};
a ?? b && c;
      `,
              },
            ],
          },
        ],
      })),
      ...nullishTypeTest((nullish, type) => ({
        options: { ignoreMixedLogicalExpressions: false },
        code: `
declare let a: ${type} | ${nullish};
declare let b: ${type} | ${nullish};
declare let c: ${type} | ${nullish};
declare let d: ${type} | ${nullish};
a || b || c && d;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            line: 6,
            column: 8,
            endLine: 6,
            endColumn: 10,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let a: ${type} | ${nullish};
declare let b: ${type} | ${nullish};
declare let c: ${type} | ${nullish};
declare let d: ${type} | ${nullish};
a || b ?? c && d;
      `,
              },
            ],
          },
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            line: 6,
            column: 3,
            endLine: 6,
            endColumn: 5,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let a: ${type} | ${nullish};
declare let b: ${type} | ${nullish};
declare let c: ${type} | ${nullish};
declare let d: ${type} | ${nullish};
(a ?? b) || c && d;
      `,
              },
            ],
          },
        ],
      })),
      ...nullishTypeTest((nullish, type) => ({
        options: { ignoreMixedLogicalExpressions: false },
        code: `
declare let a: ${type} | ${nullish};
declare let b: ${type} | ${nullish};
declare let c: ${type} | ${nullish};
declare let d: ${type} | ${nullish};
a && b || c || d;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            line: 6,
            column: 13,
            endLine: 6,
            endColumn: 15,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let a: ${type} | ${nullish};
declare let b: ${type} | ${nullish};
declare let c: ${type} | ${nullish};
declare let d: ${type} | ${nullish};
a && b || c ?? d;
      `,
              },
            ],
          },
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            line: 6,
            column: 8,
            endLine: 6,
            endColumn: 10,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let a: ${type} | ${nullish};
declare let b: ${type} | ${nullish};
declare let c: ${type} | ${nullish};
declare let d: ${type} | ${nullish};
a && (b ?? c) || d;
      `,
              },
            ],
          },
        ],
      })),
      // should not false positive for functions inside conditional tests
      ...nullishTypeTest((nullish, type, equals) => ({
        code: `
declare let x: ${type} | ${nullish};
if (() => (x ||${equals} 'foo')) {}
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals,
              description: equals ? "assignment" : "or",
            }),
            line: 3,
            column: 14,
            endLine: 3,
            endColumn: 16 + equals.length,
            suggestions: [
              {
                message: messages.suggestNullish({ equals }),
                output: `
declare let x: ${type} | ${nullish};
if (() => (x ??${equals} 'foo')) {}
      `,
              },
            ],
          },
        ],
      })),
      ...nullishTypeTest((nullish, type, equals) => ({
        code: `
declare let x: ${type} | ${nullish};
if (function weird() { return (x ||${equals} 'foo') }) {}
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals,
              description: equals ? "assignment" : "or",
            }),
            line: 3,
            column: 34,
            endLine: 3,
            endColumn: 36 + equals.length,
            suggestions: [
              {
                message: messages.suggestNullish({ equals }),
                output: `
declare let x: ${type} | ${nullish};
if (function weird() { return (x ??${equals} 'foo') }) {}
      `,
              },
            ],
          },
        ],
      })),
      // https://github.com/typescript-eslint/typescript-eslint/issues/1290
      ...nullishTypeTest((nullish, type) => ({
        code: `
declare let a: ${type} | ${nullish};
declare let b: ${type};
declare let c: ${type};
a || b || c;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            line: 5,
            column: 3,
            endLine: 5,
            endColumn: 5,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let a: ${type} | ${nullish};
declare let b: ${type};
declare let c: ${type};
(a ?? b) || c;
      `,
              },
            ],
          },
        ],
      })),
      // default for missing option
      {
        options: {
          ignorePrimitives: { bigint: true, boolean: true, number: true },
        },
        code: `
declare let x: string | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: string | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: { bigint: true, boolean: true, string: true },
        },
        code: `
declare let x: number | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: number | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: { bigint: true, number: true, string: true },
        },
        code: `
declare let x: boolean | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: boolean | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: { boolean: true, number: true, string: true },
        },
        code: `
declare let x: bigint | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: bigint | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      // falsy
      {
        options: {
          ignorePrimitives: {
            bigint: true,
            boolean: true,
            number: true,
            string: false,
          },
        },
        code: `
declare let x: '' | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: '' | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            bigint: true,
            boolean: true,
            number: true,
            string: false,
          },
        },
        code: `
declare let x: \`\` | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: \`\` | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            bigint: true,
            boolean: true,
            number: false,
            string: true,
          },
        },
        code: `
declare let x: 0 | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: 0 | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            bigint: false,
            boolean: true,
            number: true,
            string: true,
          },
        },
        code: `
declare let x: 0n | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: 0n | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            bigint: true,
            boolean: false,
            number: true,
            string: true,
          },
        },
        code: `
declare let x: false | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: false | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      // truthy
      {
        options: {
          ignorePrimitives: {
            bigint: true,
            boolean: true,
            number: true,
            string: false,
          },
        },
        code: `
declare let x: 'a' | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: 'a' | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            bigint: true,
            boolean: true,
            number: true,
            string: false,
          },
        },
        code: `
declare let x: \`hello\${'string'}\` | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: \`hello\${'string'}\` | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            bigint: true,
            boolean: true,
            number: false,
            string: true,
          },
        },
        code: `
declare let x: 1 | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: 1 | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            bigint: false,
            boolean: true,
            number: true,
            string: true,
          },
        },
        code: `
declare let x: 1n | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: 1n | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            bigint: true,
            boolean: false,
            number: true,
            string: true,
          },
        },
        code: `
declare let x: true | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: true | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      // Unions of same primitive
      {
        options: {
          ignorePrimitives: {
            bigint: true,
            boolean: true,
            number: true,
            string: false,
          },
        },
        code: `
declare let x: 'a' | 'b' | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: 'a' | 'b' | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            bigint: true,
            boolean: true,
            number: true,
            string: false,
          },
        },
        code: `
declare let x: 'a' | \`b\` | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: 'a' | \`b\` | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            bigint: true,
            boolean: true,
            number: false,
            string: true,
          },
        },
        code: `
declare let x: 0 | 1 | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: 0 | 1 | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            bigint: true,
            boolean: true,
            number: false,
            string: true,
          },
        },
        code: `
declare let x: 1 | 2 | 3 | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: 1 | 2 | 3 | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            bigint: false,
            boolean: true,
            number: true,
            string: true,
          },
        },
        code: `
declare let x: 0n | 1n | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: 0n | 1n | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            bigint: false,
            boolean: true,
            number: true,
            string: true,
          },
        },
        code: `
declare let x: 1n | 2n | 3n | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: 1n | 2n | 3n | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            bigint: true,
            boolean: false,
            number: true,
            string: true,
          },
        },
        code: `
declare let x: true | false | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: true | false | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      // Mixed unions
      {
        options: {
          ignorePrimitives: {
            bigint: false,
            boolean: true,
            number: false,
            string: true,
          },
        },
        code: `
declare let x: 0 | 1 | 0n | 1n | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: 0 | 1 | 0n | 1n | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            bigint: true,
            boolean: false,
            number: true,
            string: true,
          },
        },
        code: `
declare let x: true | false | null | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: true | false | null | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare let x: null;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare let x: null;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const x = undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
const x = undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
null || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
null ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
undefined || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
undefined ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
enum Enum {
  A = 0,
  B = 1,
  C = 2,
}
declare let x: Enum | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
enum Enum {
  A = 0,
  B = 1,
  C = 2,
}
declare let x: Enum | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
enum Enum {
  A = 0,
  B = 1,
  C = 2,
}
declare let x: Enum.A | Enum.B | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
enum Enum {
  A = 0,
  B = 1,
  C = 2,
}
declare let x: Enum.A | Enum.B | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
enum Enum {
  A = 'a',
  B = 'b',
  C = 'c',
}
declare let x: Enum | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
enum Enum {
  A = 'a',
  B = 'b',
  C = 'c',
}
declare let x: Enum | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
enum Enum {
  A = 'a',
  B = 'b',
  C = 'c',
}
declare let x: Enum.A | Enum.B | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
enum Enum {
  A = 'a',
  B = 'b',
  C = 'c',
}
declare let x: Enum.A | Enum.B | undefined;
x ?? y;
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreBooleanCoercion: false },
        code: `
let a: string | true | undefined;
let b: string | boolean | undefined;
let c: boolean | undefined;

const x = Boolean(a || b);
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
let a: string | true | undefined;
let b: string | boolean | undefined;
let c: boolean | undefined;

const x = Boolean(a ?? b);
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreBooleanCoercion: true },
        code: `
let a: string | true | undefined;
let b: string | boolean | undefined;

const x = String(a || b);
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
let a: string | true | undefined;
let b: string | boolean | undefined;

const x = String(a ?? b);
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreBooleanCoercion: true },
        code: `
let a: string | true | undefined;
let b: string | boolean | undefined;

const x = Boolean(() => a || b);
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
let a: string | true | undefined;
let b: string | boolean | undefined;

const x = Boolean(() => a ?? b);
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreBooleanCoercion: true },
        code: `
let a: string | true | undefined;
let b: string | boolean | undefined;

const x = Boolean(function weird() {
  return a || b;
});
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
let a: string | true | undefined;
let b: string | boolean | undefined;

const x = Boolean(function weird() {
  return a ?? b;
});
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreBooleanCoercion: true },
        code: `
let a: string | true | undefined;
let b: string | boolean | undefined;

declare function f(x: unknown): unknown;

const x = Boolean(f(a || b));
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
let a: string | true | undefined;
let b: string | boolean | undefined;

declare function f(x: unknown): unknown;

const x = Boolean(f(a ?? b));
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreBooleanCoercion: true },
        code: `
let a: string | true | undefined;
let b: string | boolean | undefined;

const x = Boolean(1 + (a || b));
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
let a: string | true | undefined;
let b: string | boolean | undefined;

const x = Boolean(1 + (a ?? b));
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreBooleanCoercion: true },
        code: `
let a: string | true | undefined;
let b: string | boolean | undefined;

declare function f(x: unknown): unknown;

if (f(a || b)) {
}
      `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
let a: string | true | undefined;
let b: string | boolean | undefined;

declare function f(x: unknown): unknown;

if (f(a ?? b)) {
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreConditionalTests: true },
        code: `
declare const a: string | undefined;
declare const b: string;

if (+(a || b)) {
}
        `,
        errors: [
          {
            message: messages.preferNullishOverOr({
              equals: "",
              description: "or",
            }),
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
declare const a: string | undefined;
declare const b: string;

if (+(a ?? b)) {
}
        `,
              },
            ],
          },
        ],
      },
      {
        code: `
let a: string | undefined;
let b: { message: string } | undefined;

const foo = a ? a : b ? 1 : 2;
      `,
        errors: [
          {
            message: messages.preferNullishOverTernary,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "" }),
                output: `
let a: string | undefined;
let b: { message: string } | undefined;

const foo = a ?? (b ? 1 : 2);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare let foo: string | null;
declare function makeFoo(): string;
if (foo == null) foo = makeFoo();
        `,
        errors: [
          {
            message: messages.preferNullishOverAssignment,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "=" }),
                output: `
declare let foo: string | null;
declare function makeFoo(): string;
foo ??= makeFoo();
        `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare let foo: { a: string } | null;
declare function makeFoo(): string;

function lazyInitialize() {
  if (foo?.a == null) {
    foo.a = makeFoo();
  }
}
      `,
        errors: [
          {
            message: messages.preferNullishOverAssignment,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "=" }),
                output: `
declare let foo: { a: string } | null;
declare function makeFoo(): string;

function lazyInitialize() {
  foo.a ??= makeFoo();
}
      `,
              },
            ],
          },
        ],
      },
    ],
  });
