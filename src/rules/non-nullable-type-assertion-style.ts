import { isTypeFlagSet } from "ts-api-utils";
import { SyntaxKind, TypeFlags } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import { typeHasFlag } from "../types-utils.ts";
import type { AST, Context } from "../types.ts";
import { isConstAssertion } from "./utils";

const messages = {
  preferNonNullAssertion:
    "Use a ! assertion to more succinctly remove null and undefined from the type.",
  fix: "Fix",
};

export const nonNullableTypeAssertionStyle = createRule(() => ({
  name: "core/nonNullableTypeAssertionStyle",
  visitor: {
    AsExpression(node, context) {
      if (isConstAssertion(node.type)) return;
      checkAssertion(node, context);
    },
    TypeAssertionExpression(node, context) {
      checkAssertion(node, context);
    },
  },
}));

const checkAssertion = (
  node: AST.AsExpression | AST.TypeAssertion,
  context: Context,
) => {
  const originalType = context.checker.getTypeAtLocation(node.expression);
  if (!typeHasFlag(originalType, TypeFlags.Undefined | TypeFlags.Null)) {
    return;
  }
  const assertedType = context.checker.getTypeAtLocation(node.type);
  if (isTypeFlagSet(assertedType, TypeFlags.Any | TypeFlags.Unknown)) {
    return;
  }

  if (
    context.checker.isTypeAssignableTo(
      originalType.getNonNullableType(),
      assertedType,
    ) &&
    context.checker.isTypeAssignableTo(
      assertedType,
      originalType.getNonNullableType(),
    )
  ) {
    context.report({
      message: messages.preferNonNullAssertion,
      node,
      suggestions: [
        {
          message: messages.fix,
          changes:
            node.kind === SyntaxKind.AsExpression
              ? [
                  {
                    start: node.type.getFullStart() - 3, // " as"
                    end: node.getEnd(),
                    newText: "!",
                  },
                ]
              : [
                  {
                    start: node.getStart(),
                    end: node.expression.getFullStart(),
                    newText: "",
                  },
                  {
                    start: node.expression.getEnd(),
                    length: 0,
                    newText: "!",
                  },
                ],
        },
      ],
    });
  }
};

export const test = () =>
  ruleTester({
    ruleFn: nonNullableTypeAssertionStyle,
    valid: [
      `
declare const original: number | string;
const cast = original as string;
    `,
      `
declare const original: number | undefined;
const cast = original as string | number | undefined;
    `,
      `
declare const original: number | any;
const cast = original as string | number | undefined;
    `,
      `
declare const original: number | undefined;
const cast = original as any;
    `,
      `
declare const original: number | null | undefined;
const cast = original as number | null;
    `,
      `
type Type = { value: string };
declare const original: Type | number;
const cast = original as Type;
    `,
      `
type T = string;
declare const x: T | number;

const y = x as NonNullable<T>;
    `,
      `
type T = string | null;
declare const x: T | number;

const y = x as NonNullable<T>;
    `,
      `
const foo = [] as const;
    `,
      `
const x = 1 as 1;
    `,
      `
declare function foo<T = any>(): T;
const bar = foo() as number;
    `,
      ...[
        `
function first<T>(array: ArrayLike<T>): T | null {
  return array.length > 0 ? (array[0] as T) : null;
}
      `,
        `
function first<T extends string | null>(array: ArrayLike<T>): T | null {
  return array.length > 0 ? (array[0] as T) : null;
}
      `,
        `
function first<T extends string | undefined>(array: ArrayLike<T>): T | null {
  return array.length > 0 ? (array[0] as T) : null;
}
      `,
        `
function first<T extends string | null | undefined>(
  array: ArrayLike<T>,
): T | null {
  return array.length > 0 ? (array[0] as T) : null;
}
      `,
        `
type A = 'a' | 'A';
type B = 'b' | 'B';
function first<T extends A | B | null>(array: ArrayLike<T>): T | null {
  return array.length > 0 ? (array[0] as T) : null;
}
      `,
      ].map((code) => ({
        compilerOptions: { noUncheckedIndexedAccess: true },
        code,
      })),
    ],
    invalid: [
      {
        code: `
declare const maybe: string | undefined;
const bar = maybe as string;
      `,
        errors: [
          {
            message: messages.preferNonNullAssertion,
            line: 3,
            column: 13,
            suggestions: [
              {
                message: messages.fix,
                output: `
declare const maybe: string | undefined;
const bar = maybe!;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const maybe: string | null;
const bar = maybe as string;
      `,
        errors: [
          {
            message: messages.preferNonNullAssertion,
            line: 3,
            column: 13,
            suggestions: [
              {
                message: messages.fix,
                output: `
declare const maybe: string | null;
const bar = maybe!;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const maybe: string | null | undefined;
const bar = maybe as string;
      `,
        errors: [
          {
            message: messages.preferNonNullAssertion,
            line: 3,
            column: 13,
            suggestions: [
              {
                message: messages.fix,
                output: `
declare const maybe: string | null | undefined;
const bar = maybe!;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Type = { value: string };
declare const maybe: Type | undefined;
const bar = maybe as Type;
      `,
        errors: [
          {
            message: messages.preferNonNullAssertion,
            line: 4,
            column: 13,
            suggestions: [
              {
                message: messages.fix,
                output: `
type Type = { value: string };
declare const maybe: Type | undefined;
const bar = maybe!;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
interface Interface {
  value: string;
}
declare const maybe: Interface | undefined;
const bar = maybe as Interface;
      `,
        errors: [
          {
            message: messages.preferNonNullAssertion,
            line: 6,
            column: 13,
            suggestions: [
              {
                message: messages.fix,
                output: `
interface Interface {
  value: string;
}
declare const maybe: Interface | undefined;
const bar = maybe!;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type T = string | null;
declare const x: T;

const y = x as NonNullable<T>;
      `,
        errors: [
          {
            message: messages.preferNonNullAssertion,
            line: 5,
            column: 11,
            suggestions: [
              {
                message: messages.fix,
                output: `
type T = string | null;
declare const x: T;

const y = x!;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type T = string | null | undefined;
declare const x: T;

const y = x as NonNullable<T>;
      `,
        errors: [
          {
            message: messages.preferNonNullAssertion,
            line: 5,
            column: 11,
            suggestions: [
              {
                message: messages.fix,
                output: `
type T = string | null | undefined;
declare const x: T;

const y = x!;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare function nullablePromise(): Promise<string | null>;

async function fn(): Promise<string> {
  return (await nullablePromise()) as string;
}
      `,
        errors: [
          {
            message: messages.preferNonNullAssertion,
            line: 5,
            column: 10,
            suggestions: [
              {
                message: messages.fix,
                output: `
declare function nullablePromise(): Promise<string | null>;

async function fn(): Promise<string> {
  return (await nullablePromise())!;
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const a: string | null;

const b = (a || undefined) as string;
      `,
        errors: [
          {
            message: messages.preferNonNullAssertion,
            line: 4,
            column: 11,
            suggestions: [
              {
                message: messages.fix,
                output: `
declare const a: string | null;

const b = (a || undefined)!;
      `,
              },
            ],
          },
        ],
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
function first<T extends string | number>(array: ArrayLike<T>): T | null {
  return array.length > 0 ? (array[0] as T) : null;
}
        `,
        errors: [
          {
            message: messages.preferNonNullAssertion,
            line: 3,
            column: 30,
            suggestions: [
              {
                message: messages.fix,
                output: `
function first<T extends string | number>(array: ArrayLike<T>): T | null {
  return array.length > 0 ? (array[0]!) : null;
}
        `,
              },
            ],
          },
        ],
      },
    ],
  });
