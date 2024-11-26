import { isTypeFlagSet } from "ts-api-utils";
import { SyntaxKind, TypeFlags } from "typescript";
import type { TypeNode } from "../ast.ts";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Context } from "../types.ts";

const messages = {
  intersection: (params: { type: string; overrideBy: string }) =>
    `${params.type} is overridden by ${params.overrideBy} and can be removed.`,
  union: (params: { type: string; assignableTo: string }) =>
    `${params.type} is assignable to ${params.assignableTo} and can be removed.`,
};

export const noRedundantTypeConstituents = createRule(() => ({
  name: "core/noRedundantTypeConstituents",
  visitor: {
    IntersectionType(node, context): void {
      if (
        node.parent.kind === SyntaxKind.ParenthesizedType &&
        node.parent.parent.kind === SyntaxKind.IntersectionType
      ) {
        return;
      }
      const flattenNodes = flattenIntersection(node);
      for (const typeNode of flattenNodes) {
        const type = context.checker.getTypeAtLocation(typeNode);
        for (const otherTypeNode of flattenNodes) {
          if (typeNode === otherTypeNode) {
            // Using break, so we don't report both parts with duplicate
            break;
          }
          const otherType = context.checker.getTypeAtLocation(otherTypeNode);
          if (type.flags === TypeFlags.Never) {
            reportIntersection(context, otherTypeNode, typeNode);
          } else if (otherType.flags === TypeFlags.Never) {
            reportIntersection(context, typeNode, otherTypeNode);
          } else if (type.flags === TypeFlags.Any) {
            reportIntersection(context, otherTypeNode, typeNode);
          } else if (otherType.flags === TypeFlags.Any) {
            reportIntersection(context, typeNode, otherTypeNode);
          } else if (type.flags === TypeFlags.Unknown) {
            reportIntersection(context, typeNode, otherTypeNode);
          } else if (otherType.flags === TypeFlags.Unknown) {
            reportIntersection(context, otherTypeNode, typeNode);
          } else if (
            typeNode.kind === SyntaxKind.LiteralType &&
            literals.includes(typeNode.literal.kind)
          ) {
            reportIntersection(context, otherTypeNode, typeNode);
          } else if (
            otherTypeNode.kind === SyntaxKind.LiteralType &&
            literals.includes(otherTypeNode.literal.kind)
          ) {
            reportIntersection(context, typeNode, otherTypeNode);
          }
        }
      }
    },
    UnionType(node, context): void {
      if (
        node.parent.kind === SyntaxKind.ParenthesizedType &&
        node.parent.parent.kind === SyntaxKind.UnionType
      ) {
        return;
      }
      const flattenNodes = flattenUnion(node);
      const redundantNodes: AST.TypeNode[] = [];
      for (const typeNode of flattenNodes) {
        const type = context.checker.getTypeAtLocation(typeNode);
        for (const otherTypeNode of flattenNodes) {
          if (typeNode === otherTypeNode) {
            // Using break, so we don't report both parts with duplicate
            break;
          }
          const otherType = context.checker.getTypeAtLocation(otherTypeNode);
          // Generics can lead to false positive
          if (isTypeFlagSet(otherType, TypeFlags.TypeVariable)) continue;
          if (context.checker.isTypeAssignableTo(type, otherType)) {
            const [redundantNode, assignableToNode] =
              type.flags === TypeFlags.Any
                ? [otherTypeNode, typeNode]
                : [typeNode, otherTypeNode];
            if (redundantNodes.includes(redundantNode)) continue;
            redundantNodes.push(redundantNode);
            context.report({
              node: redundantNode,
              message: messages.union({
                type: redundantNode.getText(),
                assignableTo: assignableToNode.getText(),
              }),
            });
          } else if (context.checker.isTypeAssignableTo(otherType, type)) {
            if (redundantNodes.includes(otherTypeNode)) continue;
            redundantNodes.push(otherTypeNode);
            context.report({
              node: otherTypeNode,
              message: messages.union({
                type: otherTypeNode.getText(),
                assignableTo: typeNode.getText(),
              }),
            });
          }
        }
      }
    },
  },
}));

const flattenUnion = (node: AST.UnionTypeNode): TypeNode[] =>
  node.types.flatMap((n) =>
    n.kind === SyntaxKind.ParenthesizedType &&
    n.type.kind === SyntaxKind.UnionType
      ? flattenUnion(n.type)
      : [n],
  );
const flattenIntersection = (node: AST.IntersectionTypeNode): TypeNode[] =>
  node.types.flatMap((n) =>
    n.kind === SyntaxKind.ParenthesizedType &&
    n.type.kind === SyntaxKind.IntersectionType
      ? flattenIntersection(n.type)
      : [n],
  );

const literals = [
  SyntaxKind.BigIntLiteral,
  SyntaxKind.NumericLiteral,
  SyntaxKind.NoSubstitutionTemplateLiteral,
  SyntaxKind.RegularExpressionLiteral,
  SyntaxKind.StringLiteral,
  SyntaxKind.FalseKeyword,
  SyntaxKind.TrueKeyword,
  SyntaxKind.NullKeyword,
];

const reportIntersection = (
  context: Context,
  redundantNode: TypeNode,
  overriddenBy: TypeNode,
) => {
  context.report({
    node: redundantNode,
    message: messages.intersection({
      type: redundantNode.getText(),
      overrideBy: overriddenBy.getText(),
    }),
  });
};

export const test = () =>
  ruleTester({
    ruleFn: noRedundantTypeConstituents,
    valid: [
      `
      type T = 1 | 2;
      type U = T | 3;
      `,
      "type T = 1n | 2n;",
      `
      type B = 1n;
      type T = B | 2n;
      `,
      `
      type T1 = false | true;
      
      type B2 = false;
      type T2 = B2 | true;
      
      type B3 = true;
      type T3 = B3 | false;
      `,
      "type T = null | undefined;",
      "type T = { a: string } | { b: string };",
      "type T = { a: string | number };",
      "type T = Set<string> | Set<number>;",
      "type Class<T> = { a: T }; type T = Class<string> | Class<number>;",
      "type T = string[] | number[];",
      "type T = string[][] | string[];",
      "type T = [1, 2, 3] | [1, 2, 4];",
      "type T = [1, 2, 3] | [1, 2, 3, 4];",
      "type T = 'A' | string[];",
      "type T = () => string | void;",
      "type T = () => null | undefined;",
      'type Metadata = { language: "EN" | "FR" } & Record<string, string>;',
      `
      type Mutations = { Foo: { output: 0 }, Bar: { output: null } };
      type Output<Name extends keyof Mutations> = Mutations[Name]["output"];
      type GetOutput<Name extends keyof Mutations> = Output<Name> | null`,
    ],
    invalid: [
      // intersections: never > any > number > unknown
      {
        code: "type I1 = unknown & number;",
        error: messages.intersection({ type: "unknown", overrideBy: "number" }),
      },
      {
        code: "type I1 = number & unknown;",
        error: messages.intersection({ type: "unknown", overrideBy: "number" }),
      },
      {
        code: "type I2 = any & unknown;",
        error: messages.intersection({ type: "unknown", overrideBy: "any" }),
      },
      {
        code: "type I2 = unknown & any;",
        error: messages.intersection({ type: "unknown", overrideBy: "any" }),
      },
      {
        code: "type I3 = any & number;",
        error: messages.intersection({ type: "number", overrideBy: "any" }),
      },
      {
        code: "type I3 = number & any;",
        error: messages.intersection({ type: "number", overrideBy: "any" }),
      },
      {
        code: "type I4 = any & never;",
        error: messages.intersection({ type: "any", overrideBy: "never" }),
      },
      {
        code: "type I4 = never & any;",
        error: messages.intersection({ type: "any", overrideBy: "never" }),
      },
      {
        code: "type I5 = unknown & never;",
        error: messages.intersection({ type: "unknown", overrideBy: "never" }),
      },
      {
        code: "type I5 = never & unknown;",
        error: messages.intersection({ type: "unknown", overrideBy: "never" }),
      },
      {
        code: "type I6 = number & never;",
        error: messages.intersection({ type: "number", overrideBy: "never" }),
      },
      {
        code: "type I6 = never & number;",
        error: messages.intersection({ type: "number", overrideBy: "never" }),
      },

      // unions: any > unknown > number > never
      {
        code: "type U1 = unknown | number;",
        error: messages.union({ type: "number", assignableTo: "unknown" }),
      },
      {
        code: "type U1 = number | unknown;",
        error: messages.union({ type: "number", assignableTo: "unknown" }),
      },
      {
        code: "type U2 = any | unknown;",
        error: messages.union({ type: "unknown", assignableTo: "any" }),
      },
      {
        code: "type U2 = unknown | any;",
        error: messages.union({ type: "unknown", assignableTo: "any" }),
      },
      {
        code: "type U3 = any | number;",
        error: messages.union({ type: "number", assignableTo: "any" }),
      },
      {
        code: "type U3 = number | any;",
        error: messages.union({ type: "number", assignableTo: "any" }),
      },
      {
        code: "type U4 = any | never;",
        error: messages.union({ type: "never", assignableTo: "any" }),
      },
      {
        code: "type U4 = never | any;",
        error: messages.union({ type: "never", assignableTo: "any" }),
      },
      {
        code: "type U5 = unknown | never;",
        error: messages.union({ type: "never", assignableTo: "unknown" }),
      },
      {
        code: "type U5 = never | unknown;",
        error: messages.union({ type: "never", assignableTo: "unknown" }),
      },
      {
        code: "type U6 = number | never;",
        error: messages.union({ type: "never", assignableTo: "number" }),
      },
      {
        code: "type U6 = never | number;",
        error: messages.union({ type: "never", assignableTo: "number" }),
      },

      {
        code: "type T = true & boolean;",
        error: messages.intersection({ type: "boolean", overrideBy: "true" }),
      },
      {
        code: "type T = 1 | 1;",
        error: messages.union({ type: "1", assignableTo: "1" }),
      },
      {
        code: "type T = { a: string } | { a: string };",
        error: messages.union({
          type: "{ a: string }",
          assignableTo: "{ a: string }",
        }),
      },
      {
        code: "type T = { a: string; b: number } | { b: number; a: string };",
        error: messages.union({
          type: "{ b: number; a: string }",
          assignableTo: "{ a: string; b: number }",
        }),
      },
      {
        code: `
          type IsArray<T> = T extends any[] ? true : false;
          type ActuallyDuplicated = IsArray<number> | IsArray<string>;
        `,
        error: messages.union({
          type: "IsArray<string>",
          assignableTo: "IsArray<number>",
        }),
      },
      {
        code: `
          type A1 = 'A';
          type A2 = 'A';
          type A3 = 'A';
          type T = A1 | A2 | A3;
        `,
        errors: [
          { message: messages.union({ type: "A2", assignableTo: "A1" }) },
          { message: messages.union({ type: "A3", assignableTo: "A1" }) },
        ],
      },
      {
        code: `
          type A = 'A';
          type B = 'B';
          type T = (A | B) | (A | B);
        `,
        errors: [
          { message: messages.union({ type: "A", assignableTo: "A" }) },
          { message: messages.union({ type: "B", assignableTo: "B" }) },
        ],
      },
      {
        code: `
          type A = 'A';
          type T = A | (A | A);
        `,
        errors: [
          { message: messages.union({ type: "A", assignableTo: "A" }) },
          { message: messages.union({ type: "A", assignableTo: "A" }) },
        ],
      },
      {
        code: "type T = number | 0;",
        error: messages.union({ type: "0", assignableTo: "number" }),
      },
      {
        code: "type T = number | (0 | 1);",
        errors: [
          { message: messages.union({ type: "0", assignableTo: "number" }) },
          { message: messages.union({ type: "1", assignableTo: "number" }) },
        ],
      },
      {
        code: "type T = (2 | 'other' | 3) | number;",
        errors: [
          { message: messages.union({ type: "2", assignableTo: "number" }) },
          { message: messages.union({ type: "3", assignableTo: "number" }) },
        ],
      },
      {
        code: "type T = `a${number}c` | string;",
        error: messages.union({
          type: "`a${number}c`",
          assignableTo: "string",
        }),
      },
      {
        code: "type T = false & boolean;",
        error: messages.intersection({ type: "boolean", overrideBy: "false" }),
      },
      {
        code: "type B = boolean; type T = B & null;",
        error: messages.intersection({ type: "B", overrideBy: "null" }),
      },
      {
        code: "type T = number & null;",
        error: messages.intersection({ type: "number", overrideBy: "null" }),
      },
      {
        code: "type T = `${string}` & null;",
        error: messages.intersection({
          type: "`${string}`",
          overrideBy: "null",
        }),
      },
    ],
  });
