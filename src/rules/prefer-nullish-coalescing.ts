import { intersectionTypeParts, isTypeFlagSet } from "ts-api-utils";
import ts, { SyntaxKind, TypeFlags } from "typescript";
import type { EqualityOperator } from "../ast.ts";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import { typeHasFlag } from "../types-utils.ts";
import type { AST, Context, Suggestion } from "../types.ts";
import { isLogicalExpression } from "./_utils";

const messages = {
  noStrictNullCheck:
    "This rule requires the `strictNullChecks` compiler option to be turned on to function correctly.",
  preferNullishOverOr: (params: {
    equals: string;
    description: "assignment" | "or";
  }) =>
    `Prefer using nullish coalescing operator (\`??${params.equals}\`) instead of a logical ${params.description} (\`||${params.equals}\`), as it is a safer operator.`,
  preferNullishOverTernary: `Prefer using nullish coalescing operator (\`??\`) instead of a ternary expression, as it is simpler to read.`,
  suggestNullish: (params: { equals: string }) =>
    `Fix to nullish coalescing operator (\`??${params.equals}\`).`,
};

type ParsedOptions = {
  ignoreBooleanCoercion: boolean;
  ignoreConditionalTests: boolean;
  ignoreMixedLogicalExpressions: boolean;
  ignoreTernaryTests: boolean;
  ignorePrimitives: {
    bigint: boolean;
    boolean: boolean;
    number: boolean;
    string: boolean;
  };
};

export const preferNullishCoalescing = createRule(
  (_options?: {
    ignoreBooleanCoercion?: boolean;
    ignoreConditionalTests?: boolean;
    ignoreMixedLogicalExpressions?: boolean;
    ignoreTernaryTests?: boolean;
    ignorePrimitives?:
      | {
          bigint?: boolean;
          boolean?: boolean;
          number?: boolean;
          string?: boolean;
        }
      | true;
  }) => {
    const options: ParsedOptions = {
      ignoreBooleanCoercion: false,
      ignoreConditionalTests: true,
      ignoreMixedLogicalExpressions: false,
      ignoreTernaryTests: false,
      ..._options,
      ignorePrimitives:
        _options?.ignorePrimitives === true
          ? { bigint: true, boolean: true, number: true, string: true }
          : {
              bigint: _options?.ignorePrimitives?.bigint ?? false,
              boolean: _options?.ignorePrimitives?.boolean ?? false,
              number: _options?.ignorePrimitives?.number ?? false,
              string: _options?.ignorePrimitives?.string ?? false,
            },
    };
    return {
      name: "core/preferNullishCoalescing",
      visitor: {
        BinaryExpression(node, context) {
          if (node.operatorToken.kind === SyntaxKind.BarBarEqualsToken) {
            checkAssignmentOrLogicalExpression(
              node,
              "assignment",
              "=",
              context,
              options,
            );
          }
          if (
            node.operatorToken.kind === SyntaxKind.BarBarToken &&
            !(
              options.ignoreBooleanCoercion && isBooleanConstructorContext(node)
            )
          ) {
            checkAssignmentOrLogicalExpression(
              node,
              "or",
              "",
              context,
              options,
            );
          }
        },
        ConditionalExpression(node, context) {
          if (options.ignoreTernaryTests) return;
          if (node.condition.kind !== SyntaxKind.BinaryExpression) return;

          let operator: EqualityOperator | undefined;
          let nodesInsideTestExpression: AST.AnyNode[] = [];
          switch (node.condition.operatorToken.kind) {
            case SyntaxKind.EqualsEqualsToken:
            case SyntaxKind.EqualsEqualsEqualsToken:
            case SyntaxKind.ExclamationEqualsToken:
            case SyntaxKind.ExclamationEqualsEqualsToken:
              nodesInsideTestExpression = [
                node.condition.left,
                node.condition.right,
              ];
              operator = node.condition.operatorToken.kind;
              break;
            case SyntaxKind.BarBarToken:
            case SyntaxKind.BarBarEqualsToken:
            case SyntaxKind.AmpersandAmpersandToken:
              if (node.condition.left.kind !== SyntaxKind.BinaryExpression) {
                return;
              }
              if (node.condition.right.kind !== SyntaxKind.BinaryExpression) {
                return;
              }
              nodesInsideTestExpression = [
                node.condition.left.left,
                node.condition.left.right,
                node.condition.right.left,
                node.condition.right.right,
              ];
              if (
                node.condition.operatorToken.kind === SyntaxKind.BarBarToken ||
                node.condition.operatorToken.kind ===
                  SyntaxKind.BarBarEqualsToken
              ) {
                if (
                  node.condition.left.operatorToken.kind ===
                    SyntaxKind.EqualsEqualsEqualsToken &&
                  node.condition.right.operatorToken.kind ===
                    SyntaxKind.EqualsEqualsEqualsToken
                ) {
                  operator = SyntaxKind.EqualsEqualsEqualsToken;
                } else if (
                  ((node.condition.left.operatorToken.kind ===
                    SyntaxKind.EqualsEqualsEqualsToken ||
                    node.condition.right.operatorToken.kind ===
                      SyntaxKind.EqualsEqualsEqualsToken) &&
                    (node.condition.left.operatorToken.kind ===
                      SyntaxKind.EqualsEqualsToken ||
                      node.condition.right.operatorToken.kind ===
                        SyntaxKind.EqualsEqualsToken)) ||
                  (node.condition.left.operatorToken.kind ===
                    SyntaxKind.EqualsEqualsToken &&
                    node.condition.right.operatorToken.kind ===
                      SyntaxKind.EqualsEqualsToken)
                ) {
                  operator = SyntaxKind.EqualsEqualsToken;
                }
              } else {
                if (
                  node.condition.left.operatorToken.kind ===
                    SyntaxKind.ExclamationEqualsEqualsToken &&
                  node.condition.right.operatorToken.kind ===
                    SyntaxKind.ExclamationEqualsEqualsToken
                ) {
                  operator = SyntaxKind.ExclamationEqualsEqualsToken;
                } else if (
                  ((node.condition.left.operatorToken.kind ===
                    SyntaxKind.ExclamationEqualsEqualsToken ||
                    node.condition.right.operatorToken.kind ===
                      SyntaxKind.ExclamationEqualsEqualsToken) &&
                    (node.condition.left.operatorToken.kind ===
                      SyntaxKind.ExclamationEqualsToken ||
                      node.condition.right.operatorToken.kind ===
                        SyntaxKind.ExclamationEqualsToken)) ||
                  (node.condition.left.operatorToken.kind ===
                    SyntaxKind.ExclamationEqualsToken &&
                    node.condition.right.operatorToken.kind ===
                      SyntaxKind.ExclamationEqualsToken)
                ) {
                  operator = SyntaxKind.ExclamationEqualsToken;
                }
              }
              break;
            default:
              break;
          }

          if (!operator) return;

          let identifier: ts.Node | undefined;
          let hasUndefinedCheck = false;
          let hasNullCheck = false;

          // we check that the test only contains null, undefined and the identifier
          for (const testNode of nodesInsideTestExpression) {
            if (testNode.kind === SyntaxKind.NullKeyword) {
              hasNullCheck = true;
            } else if (
              testNode.kind === SyntaxKind.Identifier &&
              testNode.text === "undefined"
            ) {
              hasUndefinedCheck = true;
            } else if (
              (operator === SyntaxKind.ExclamationEqualsEqualsToken ||
                operator === SyntaxKind.ExclamationEqualsToken) &&
              isNodeEqual(testNode, node.whenTrue)
            ) {
              identifier = testNode;
            } else if (
              (operator === SyntaxKind.EqualsEqualsEqualsToken ||
                operator === SyntaxKind.EqualsEqualsToken) &&
              isNodeEqual(testNode, node.whenFalse)
            ) {
              identifier = testNode;
            } else {
              return;
            }
          }

          if (!identifier) return;

          const isFixable = ((): boolean => {
            // it is fixable if we check for both null and undefined, or not if neither
            if (hasUndefinedCheck === hasNullCheck) {
              return hasUndefinedCheck;
            }

            // it is fixable if we loosely check for either null or undefined
            if (
              operator === SyntaxKind.EqualsEqualsToken ||
              operator === SyntaxKind.ExclamationEqualsToken
            ) {
              return true;
            }

            const type = context.checker.getTypeAtLocation(identifier);

            if (typeHasFlag(type, TypeFlags.Any | TypeFlags.Unknown)) {
              return false;
            }

            const hasNullType = typeHasFlag(type, TypeFlags.Null);

            // it is fixable if we check for undefined and the type is not nullable
            if (hasUndefinedCheck && !hasNullType) {
              return true;
            }

            const hasUndefinedType = typeHasFlag(type, TypeFlags.Undefined);

            // it is fixable if we check for null and the type can't be undefined
            return hasNullCheck && !hasUndefinedType;
          })();

          if (isFixable) {
            context.report({
              node,
              message: messages.preferNullishOverTernary,
              suggestions: () => {
                const [left, right] =
                  operator === SyntaxKind.EqualsEqualsEqualsToken ||
                  operator === SyntaxKind.EqualsEqualsToken
                    ? [node.whenFalse, node.whenTrue]
                    : [node.whenTrue, node.whenFalse];
                return [
                  {
                    message: messages.suggestNullish({ equals: "" }),
                    changes: [
                      {
                        node,
                        newText: `${left.getText()} ?? ${right.getText()}`,
                      },
                    ],
                  },
                ];
              },
            });
          }
        },
      },
    };
  },
);

function checkAssignmentOrLogicalExpression(
  node: AST.BinaryExpression,
  description: "assignment" | "or",
  equals: string,
  context: Context,
  options: ParsedOptions,
): void {
  const type = context.checker.getTypeAtLocation(node.left);
  if (!typeHasFlag(type, TypeFlags.Null | TypeFlags.Undefined)) {
    return;
  }

  if (options.ignoreConditionalTests && isConditionalTest(node)) {
    return;
  }

  if (options.ignoreMixedLogicalExpressions && isMixedLogicalExpression(node)) {
    return;
  }

  let ignorableFlags = 0;
  const ignorePrimitives = options.ignorePrimitives;
  if (ignorePrimitives.bigint) ignorableFlags |= TypeFlags.BigIntLike;
  if (ignorePrimitives.boolean) ignorableFlags |= TypeFlags.BooleanLike;
  if (ignorePrimitives.number) ignorableFlags |= TypeFlags.NumberLike;
  if (ignorePrimitives.string) ignorableFlags |= TypeFlags.StringLike;

  if (
    type.flags !== TypeFlags.Null &&
    type.flags !== TypeFlags.Undefined &&
    (type as ts.UnionOrIntersectionType).types.some((t) =>
      intersectionTypeParts(t).some((t) => isTypeFlagSet(t, ignorableFlags)),
    )
  ) {
    return;
  }

  context.report({
    node: node.operatorToken,
    message: messages.preferNullishOverOr({ description, equals }),
    suggestions: () => {
      const changes: Suggestion["changes"] = [
        { node: node.operatorToken, newText: `??${equals}` },
      ];
      if (
        node.parent.kind === SyntaxKind.BinaryExpression &&
        node.parent.operatorToken.kind === SyntaxKind.BarBarToken
      ) {
        if (
          node.left.kind === SyntaxKind.BinaryExpression &&
          isLogicalExpression(node.left.operatorToken) &&
          !(
            node.left.left.kind === SyntaxKind.BinaryExpression &&
            node.left.left.operatorToken.kind === SyntaxKind.BarBarToken
          )
        ) {
          changes.push({
            start: node.left.right.getStart(),
            length: 0,
            newText: "(",
          });
        } else {
          changes.push({
            start: node.left.getStart(),
            length: 0,
            newText: "(",
          });
        }
        changes.push({
          start: node.right.getEnd(),
          length: 0,
          newText: ")",
        });
      }
      return [{ message: messages.suggestNullish({ equals }), changes }];
    },
  });
}

function isConditionalTest(node: AST.AnyNode): boolean {
  const parent = node.parent as AST.AnyNode | null;
  if (!parent) return false;

  if (parent.kind === SyntaxKind.ParenthesizedExpression) {
    return isConditionalTest(parent);
  }

  if (
    parent.kind === SyntaxKind.BinaryExpression &&
    isLogicalExpression(parent.operatorToken)
  ) {
    return isConditionalTest(parent);
  }

  if (
    parent.kind === SyntaxKind.ConditionalExpression &&
    (parent.whenTrue === node || parent.whenFalse === node)
  ) {
    return isConditionalTest(parent);
  }

  if (
    parent.kind === SyntaxKind.BinaryExpression &&
    parent.operatorToken.kind === SyntaxKind.CommaToken &&
    parent.right === node
  ) {
    return isConditionalTest(parent);
  }

  if (
    parent.kind === SyntaxKind.PrefixUnaryExpression &&
    parent.operator === SyntaxKind.ExclamationToken
  ) {
    return isConditionalTest(parent);
  }

  if (
    (parent.kind === SyntaxKind.ConditionalExpression ||
      parent.kind === SyntaxKind.ForStatement) &&
    parent.condition === node
  ) {
    return true;
  }

  if (
    (parent.kind === SyntaxKind.DoStatement ||
      parent.kind === SyntaxKind.IfStatement ||
      parent.kind === SyntaxKind.WhileStatement) &&
    parent.expression === node
  ) {
    return true;
  }

  return false;
}

function isBooleanConstructorContext(node: AST.AnyNode): boolean {
  const parent = node.parent as AST.AnyNode | null;
  if (!parent) return false;

  if (parent.kind === SyntaxKind.ParenthesizedExpression) {
    return isBooleanConstructorContext(parent);
  }

  if (
    parent.kind === SyntaxKind.BinaryExpression &&
    isLogicalExpression(parent.operatorToken)
  ) {
    return isBooleanConstructorContext(parent);
  }

  if (
    parent.kind === SyntaxKind.ConditionalExpression &&
    (parent.whenTrue === node || parent.whenFalse === node)
  ) {
    return isBooleanConstructorContext(parent);
  }

  if (
    parent.kind === SyntaxKind.BinaryExpression &&
    parent.operatorToken.kind === SyntaxKind.CommaToken &&
    parent.right === node
  ) {
    return isBooleanConstructorContext(parent);
  }

  return (
    parent.kind === SyntaxKind.CallExpression &&
    parent.expression.kind === SyntaxKind.Identifier &&
    parent.expression.text === "Boolean"
  );
}

function isMixedLogicalExpression(node: AST.BinaryExpression): boolean {
  const seen = new Set<AST.AnyNode | undefined>();
  const queue = [node.parent, node.left, node.right];
  for (const current of queue) {
    if (seen.has(current)) {
      continue;
    }
    seen.add(current);

    if (current.kind === SyntaxKind.BinaryExpression) {
      if (current.operatorToken.kind === SyntaxKind.AmpersandAmpersandToken) {
        return true;
      } else if (
        current.operatorToken.kind === SyntaxKind.BarBarToken ||
        current.operatorToken.kind === SyntaxKind.BarBarEqualsToken
      ) {
        // check the pieces of the node to catch cases like `a || b || c && d`
        queue.push(current.parent, current.left, current.right);
      }
    }
  }

  return false;
}

function isNodeEqual(a: AST.AnyNode, b: AST.AnyNode): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (
    a.kind === SyntaxKind.TrueKeyword ||
    a.kind === SyntaxKind.FalseKeyword ||
    a.kind === SyntaxKind.ThisKeyword ||
    a.kind === SyntaxKind.NullKeyword
  ) {
    return true;
  }
  if (
    a.kind === SyntaxKind.StringLiteral &&
    b.kind === SyntaxKind.StringLiteral
  ) {
    return a.text === b.text;
  }
  if (
    a.kind === SyntaxKind.NumericLiteral &&
    b.kind === SyntaxKind.NumericLiteral
  ) {
    return a.text === b.text;
  }

  if (a.kind === SyntaxKind.Identifier && b.kind === SyntaxKind.Identifier) {
    return a.text === b.text;
  }
  if (
    a.kind === SyntaxKind.PropertyAccessExpression &&
    b.kind === SyntaxKind.PropertyAccessExpression
  ) {
    return (
      isNodeEqual(a.name, b.name) &&
      isNodeEqual(a.expression, b.expression) &&
      !a.questionDotToken &&
      !b.questionDotToken
    );
  }
  if (
    a.kind === SyntaxKind.ElementAccessExpression &&
    b.kind === SyntaxKind.ElementAccessExpression
  ) {
    return (
      isNodeEqual(a.argumentExpression, b.argumentExpression) &&
      isNodeEqual(a.expression, b.expression) &&
      !a.questionDotToken &&
      !b.questionDotToken
    );
  }
  return false;
}

/** Tests */
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
      ].map((code) => ({ options: { ignoreTernaryTests: false }, code })), // ignoreConditionalTests
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
      })), // ignoreMixedLogicalExpressions
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
      declare let x: any;
      declare let y: number;
      x || y;
    `,
      `
      declare let x: unknown;
      declare let y: number;
      x || y;
    `,
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
    ],
    invalid: [
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
      // ignoreConditionalTests
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
      })), // ignoreMixedLogicalExpressions
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
      })), // should not false positive for functions inside conditional tests
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
      })), // https://github.com/typescript-eslint/typescript-eslint/issues/1290
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
    ],
  });
