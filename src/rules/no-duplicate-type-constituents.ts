import { SyntaxKind } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Infer } from "../types.ts";

const messages = {
  duplicate: (params: { type: string; previous: string }) =>
    `${params.type} type constituent is duplicated with ${params.previous}.`,
};

type Context = Infer<typeof noDuplicateTypeConstituents>["Context"];

const parseOptions = (options?: {
  ignoreIntersections?: boolean;
  ignoreUnions?: boolean;
}) => ({
  ignoreIntersections: options?.ignoreIntersections ?? false,
  ignoreUnions: options?.ignoreUnions ?? false,
});
type RuleVisitor = AST.Visitor<ReturnType<typeof parseOptions>>;

export const noDuplicateTypeConstituents = createRule({
  name: "no-duplicate-type-constituents",
  parseOptions,
  visitor: ({ ignoreIntersections, ignoreUnions }): RuleVisitor => ({
    ...(!ignoreIntersections && { IntersectionType: checkDuplicate }),
    ...(!ignoreUnions && { UnionType: checkDuplicate }),
  }),
});

function checkDuplicate(
  node: AST.IntersectionTypeNode | AST.UnionTypeNode,
  context: Context,
): void {
  node.types.reduce<AST.TypeNode[]>((uniqueConstituents, constituentNode) => {
    const duplicatedPreviousConstituentInAst = uniqueConstituents.find(
      (ele) => {
        const type1 = context.checker.getTypeAtLocation(constituentNode);
        const type2 = context.checker.getTypeAtLocation(ele);
        return (
          context.checker.isTypeAssignableTo(type1, type2) &&
          context.checker.isTypeAssignableTo(type2, type1)
        );
      },
    );
    if (duplicatedPreviousConstituentInAst) {
      context.report({
        message: messages.duplicate({
          type:
            node.kind === SyntaxKind.IntersectionType
              ? "Intersection"
              : "Union",
          previous: duplicatedPreviousConstituentInAst.getText(),
        }),
        node: constituentNode,
      });
      return uniqueConstituents;
    }

    return [...uniqueConstituents, constituentNode];
  }, []);
}

export const test = () =>
  ruleTester({
    rule: noDuplicateTypeConstituents,
    valid: [
      "type T = 1 | 2;",
      "type T = 1 | '1';",
      "type T = true & boolean;",
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
      "type T = (() => string) | (() => void);",
      "type T = () => string | void;",
      "type T = () => null | undefined;",
      `
type A = 'A';
type B = 'B';
type T = A | B;
      `,
      `
type A = 'A';
type B = 'B';
const a: A | B = 'A';
      `,
      `
type A = 'A';
type B = 'B';
type T = A | /* comment */ B;
      `,
      `
type A = 'A';
type B = 'B';
type T = 'A' | 'B';
      `,
      `
type A = 'A';
type B = 'B';
type C = 'C';
type T = A | B | C;
      `,
      "type T = readonly string[] | string[];",
      `
type A = 'A';
type B = 'B';
type C = 'C';
type D = 'D';
type T = (A | B) | (C | D);
      `,
      `
type A = 'A';
type B = 'B';
type T = (A | B) | (A & B);
      `,
      `
type A = 'A';
type B = 'B';
type T = Record<string, A | B>;
      `,
      {
        code: "type T = A | A;",
        options: {
          ignoreUnions: true,
        },
      },
      {
        code: "type T = A & A;",
        options: {
          ignoreIntersections: true,
        },
      },
    ],
    invalid: [
      {
        code: "type T = 1 | 1;",
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "1",
            }),
          },
        ],
      },
      {
        code: "type T = true & true;",
        errors: [
          {
            message: messages.duplicate({
              type: "Intersection",
              previous: "true",
            }),
          },
        ],
      },
      {
        code: "type T = null | null;",
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "null",
            }),
          },
        ],
      },
      {
        code: "type T = any | unknown;",
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "any",
            }),
          },
        ],
      },
      {
        code: "type T = { a: string | string };",
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "string",
            }),
          },
        ],
      },
      {
        code: "type T = { a: string } | { a: string };",
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "{ a: string }",
            }),
          },
        ],
      },
      {
        code: "type T = { a: string; b: number } | { b: number; a: string; };",
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "{ a: string; b: number }",
            }),
          },
        ],
      },
      {
        code: "type T = Set<string> | Set<string>;",
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "Set<string>",
            }),
          },
        ],
      },
      {
        code: `
type IsArray<T> = T extends any[] ? true : false;
type ActuallyDuplicated = IsArray<number> | IsArray<string>;
      `,
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "IsArray<number>",
            }),
          },
        ],
      },
      {
        code: "type T = Class<string> | Class<string>;",
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "Class<string>",
            }),
          },
        ],
      },
      {
        code: "type T = string[] | string[];",
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "string[]",
            }),
          },
        ],
      },
      {
        code: "type T = string[][] | string[][];",
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "string[][]",
            }),
          },
        ],
      },
      {
        code: "type T = [1, 2, 3] | [1, 2, 3];",
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "[1, 2, 3]",
            }),
          },
        ],
      },
      {
        code: "type T = () => string | string;",
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "string",
            }),
          },
        ],
      },
      {
        code: "type T = () => null | null;",
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "null",
            }),
          },
        ],
      },
      {
        code: "type T = (arg: string | string) => void;",
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "string",
            }),
          },
        ],
      },
      {
        code: "type T = 'A' | 'A';",
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "'A'",
            }),
          },
        ],
      },
      {
        code: `
type A = 'A';
type T = A | A;
      `,
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "A",
            }),
          },
        ],
      },
      {
        code: `
type A = 'A';
const a: A | A = 'A';
      `,
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "A",
            }),
          },
        ],
      },
      {
        code: `
type A = 'A';
type T = A | /* comment */ A;
      `,
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "A",
            }),
          },
        ],
      },
      {
        code: `
type A1 = 'A';
type A2 = 'A';
type A3 = 'A';
type T = A1 | A2 | A3;
      `,
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "A1",
            }),
          },
          {
            message: messages.duplicate({
              type: "Union",
              previous: "A1",
            }),
          },
        ],
      },
      {
        code: `
type A = 'A';
type B = 'B';
type T = A | B | A;
      `,
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "A",
            }),
          },
        ],
      },
      {
        code: `
type A = 'A';
type B = 'B';
type T = A | B | A | B;
      `,
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "A",
            }),
          },
          {
            message: messages.duplicate({
              type: "Union",
              previous: "B",
            }),
          },
        ],
      },
      {
        code: `
type A = 'A';
type B = 'B';
type T = A | B | A | A;
      `,
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "A",
            }),
          },
          {
            message: messages.duplicate({
              type: "Union",
              previous: "A",
            }),
          },
        ],
      },
      {
        code: `
type A = 'A';
type B = 'B';
type C = 'C';
type T = A | B | A | C;
      `,
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "A",
            }),
          },
        ],
      },
      {
        code: `
type A = 'A';
type B = 'B';
type T = (A | B) | (A | B);
      `,
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "(A | B)",
            }),
          },
        ],
      },
      {
        code: `
type A = 'A';
type T = A | (A | A);
      `,
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: `A`,
            }),
          },
          {
            message: messages.duplicate({
              type: "Union",
              previous: "A",
            }),
          },
        ],
      },
      {
        code: `
type A = 'A';
type B = 'B';
type C = 'C';
type D = 'D';
type F = (A | B) | (A | B) | ((C | D) & (A | B)) | (A | B);
      `,
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "(A | B)",
            }),
          },
          {
            message: messages.duplicate({
              type: "Union",
              previous: "(A | B)",
            }),
          },
        ],
      },
      {
        code: `
type A = 'A';
type T = Record<string, A | A>;
      `,
        errors: [
          {
            message: messages.duplicate({
              type: "Union",
              previous: "A",
            }),
          },
        ],
      },
    ],
  });
