import { isTypeFlagSet } from "ts-api-utils";
import { TypeFlags } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import { typeHasFlag } from "../types-utils.ts";
import type { AST, Context } from "../types.ts";
import { isConstAssertion } from "./no-unnecessary-type-assertion.ts";

const messages = {
  preferNonNullAssertion:
    "Use a ! assertion to more succinctly remove null and undefined from the type.",
};

export const nonNullableTypeAssertionStyle = createRule({
  name: "non-nullable-type-assertion-style",
  visitor: {
    AsExpression(node, context) {
      if (isConstAssertion(node.type)) return;
      checkAssertion(node, context);
    },
    TypeAssertionExpression(node, context) {
      checkAssertion(node, context);
    },
  },
});

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
    });
  }
};

export const test = () =>
  ruleTester({
    rule: nonNullableTypeAssertionStyle,
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
        code,
        compilerOptions: { noUncheckedIndexedAccess: true },
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
            column: 13,
            line: 3,
            message: messages.preferNonNullAssertion,
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
            column: 13,
            line: 3,
            message: messages.preferNonNullAssertion,
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
            column: 13,
            line: 3,
            message: messages.preferNonNullAssertion,
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
            column: 13,
            line: 4,
            message: messages.preferNonNullAssertion,
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
            column: 13,
            line: 6,
            message: messages.preferNonNullAssertion,
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
            column: 11,
            line: 5,
            message: messages.preferNonNullAssertion,
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
            column: 11,
            line: 5,
            message: messages.preferNonNullAssertion,
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
            column: 10,
            line: 5,
            message: messages.preferNonNullAssertion,
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
            column: 11,
            line: 4,
            message: messages.preferNonNullAssertion,
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
            column: 30,
            line: 3,
            message: messages.preferNonNullAssertion,
          },
        ],
      },
    ],
  });
