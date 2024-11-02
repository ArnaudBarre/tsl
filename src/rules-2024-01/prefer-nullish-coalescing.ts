import { isTypeFlagSet } from "ts-api-utils";
import ts, { SyntaxKind, TypeFlags } from "typescript";
import type { EqualityOperator } from "../ast.ts";
import { createRule } from "../public-utils.ts";
import {
  type InvalidTestCase,
  ruleTester,
  type ValidTestCase,
} from "../ruleTester.ts";
import { typeHasFlag } from "../types-utils.ts";
import type { AST } from "../types.ts";

const messages = {
  preferNullishOverOr:
    "Prefer using nullish coalescing operator (`??`) instead of a logical or (`||`), as it is a safer operator.",
  preferNullishOverTernary:
    "Prefer using nullish coalescing operator (`??`) instead of a ternary expression, as it is simpler to read.",
  suggestNullish: "Fix to nullish coalescing operator (`??`).",
};

export const preferNullishCoalescing = createRule({
  name: "prefer-nullish-coalescing",
  parseOptions: (options?: {
    ignoreConditionalTests?: boolean;
    ignoreMixedLogicalExpressions?: boolean;
    ignorePrimitives?:
      | {
          bigint?: boolean;
          boolean?: boolean;
          number?: boolean;
          string?: boolean;
        }
      | true;
    ignoreTernaryTests?: boolean;
  }) => ({
    ignoreConditionalTests: false,
    ignoreTernaryTests: false,
    ignoreMixedLogicalExpressions: false,
    ...options,
    ignorePrimitives:
      options?.ignorePrimitives === true
        ? { bigint: true, boolean: true, number: true, string: true }
        : {
            bigint: options?.ignorePrimitives?.bigint ?? false,
            boolean: options?.ignorePrimitives?.boolean ?? false,
            number: options?.ignorePrimitives?.number ?? false,
            string: options?.ignorePrimitives?.string ?? false,
          },
  }),
  visitor: {
    ConditionalExpression(node, context) {
      if (context.options.ignoreTernaryTests) return;

      let operator: EqualityOperator | undefined;
      let nodesInsideTestExpression: AST.AnyNode[] = [];
      if (node.condition.kind === SyntaxKind.BinaryExpression) {
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
            if (node.condition.operatorToken.kind === SyntaxKind.BarBarToken) {
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
        }
      }

      if (!operator) return;

      let identifier: AST.AnyNode | undefined;
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
        context.report({ node, message: messages.preferNullishOverTernary });
      }
    },
    BinaryExpression(node, context) {
      if (node.operatorToken.kind !== SyntaxKind.BarBarToken) return;
      const type = context.checker.getTypeAtLocation(node.left);
      const isNullish = typeHasFlag(type, TypeFlags.Null | TypeFlags.Undefined);
      if (!isNullish) return;

      if (context.options.ignoreConditionalTests && isConditionalTest(node)) {
        return;
      }

      if (
        context.options.ignoreMixedLogicalExpressions &&
        isMixedLogicalExpression(node)
      ) {
        return;
      }

      const ignorableFlags = [
        context.options.ignorePrimitives.bigint && TypeFlags.BigInt,
        context.options.ignorePrimitives.boolean && TypeFlags.BooleanLiteral,
        context.options.ignorePrimitives.number && TypeFlags.Number,
        context.options.ignorePrimitives.string && TypeFlags.String,
      ].reduce((previous, flag) => (flag ? previous | flag : previous), 0);
      if (
        type.flags !== TypeFlags.Null &&
        type.flags !== TypeFlags.Undefined &&
        (type as ts.UnionOrIntersectionType).types.some((t) =>
          isTypeFlagSet(t, ignorableFlags),
        )
      ) {
        return;
      }

      context.report({
        node: node.operatorToken,
        message: messages.preferNullishOverOr,
      });
    },
  },
});

function isConditionalTest(node: AST.AnyNode): boolean {
  const parents = new Set<AST.AnyNode | null>([node]);
  let current = node.parent as AST.AnyNode | null;
  while (current) {
    parents.add(current);

    if (
      (current.kind === SyntaxKind.DoStatement ||
        current.kind === SyntaxKind.IfStatement ||
        current.kind === SyntaxKind.WhileStatement) &&
      parents.has(current.expression)
    ) {
      return true;
    }
    if (
      (current.kind === SyntaxKind.ConditionalExpression ||
        current.kind === SyntaxKind.ForStatement) &&
      current.condition &&
      parents.has(current.condition)
    ) {
      return true;
    }

    if (
      [SyntaxKind.ArrowFunction, SyntaxKind.FunctionExpression].includes(
        current.kind,
      )
    ) {
      /**
       * This is a weird situation like:
       * `if (() => a || b) {}`
       * `if (function () { return a || b }) {}`
       */
      return false;
    }

    current = current.parent as AST.AnyNode | null;
  }

  return false;
}

function isMixedLogicalExpression(node: AST.BinaryExpression): boolean {
  const seen = new Set<ts.Node | undefined>();
  const queue = [node.parent, node.left, node.right];
  for (const current of queue) {
    if (seen.has(current)) {
      continue;
    }
    seen.add(current);

    if (current.kind === SyntaxKind.BinaryExpression) {
      if (current.operatorToken.kind === SyntaxKind.AmpersandAmpersandToken) {
        return true;
      } else if (current.operatorToken.kind === SyntaxKind.BarBarToken) {
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
const ignorablePrimitiveTypes = ["string", "number", "boolean", "bigint"];

function nullishTypeValidTest(
  cb: (
    nullish: string,
    type: string,
  ) => ValidTestCase<typeof preferNullishCoalescing>,
): ValidTestCase<typeof preferNullishCoalescing>[] {
  return nullishTypes.reduce<ValidTestCase<typeof preferNullishCoalescing>[]>(
    (acc, nullish) => {
      types.forEach((type) => {
        acc.push(cb(nullish, type));
      });
      return acc;
    },
    [],
  );
}
function nullishTypeInvalidTest(
  cb: (
    nullish: string,
    type: string,
  ) => InvalidTestCase<typeof preferNullishCoalescing>,
): InvalidTestCase<typeof preferNullishCoalescing>[] {
  return nullishTypes.reduce<InvalidTestCase<typeof preferNullishCoalescing>[]>(
    (acc, nullish) => {
      types.forEach((type) => {
        acc.push(cb(nullish, type));
      });
      return acc;
    },
    [],
  );
}

export const test = () =>
  ruleTester({
    rule: preferNullishCoalescing,
    valid: [
      ...types.map(
        (type) => `
declare const x: ${type};
x || 'foo';
      `,
      ),
      ...nullishTypeValidTest(
        (nullish, type) => `
declare const x: ${type} | ${nullish};
x ?? 'foo';
      `,
      ),
      {
        options: {
          ignoreTernaryTests: true,
        },
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
declare const x: string;
x === null ? x : y;
      `,
        `
declare const x: string | undefined;
x === null ? x : y;
      `,
        `
declare const x: string | null;
x === undefined ? x : y;
      `,
        `
declare const x: string | undefined | null;
x !== undefined ? x : y;
      `,
        `
declare const x: string | undefined | null;
x !== null ? x : y;
      `,
        `
declare const x: string | null | any;
x === null ? x : y;
      `,
        `
declare const x: string | null | unknown;
x === null ? x : y;
      `,
        `
declare const x: string | undefined;
x === null ? x : y;
      `,
      ].map((code) => ({
        options: {
          ignoreTernaryTests: false,
        },
        code,
      })),
      // ignoreConditionalTests
      ...nullishTypeValidTest((nullish, type) => ({
        options: {
          ignoreConditionalTests: true,
        },
        code: `
declare const x: ${type} | ${nullish};
x || 'foo' ? null : null;
      `,
      })),
      ...nullishTypeValidTest((nullish, type) => ({
        options: {
          ignoreConditionalTests: true,
        },
        code: `
declare const x: ${type} | ${nullish};
if (x || 'foo') {}
      `,
      })),
      ...nullishTypeValidTest((nullish, type) => ({
        options: {
          ignoreConditionalTests: true,
        },
        code: `
declare const x: ${type} | ${nullish};
do {} while (x || 'foo')
      `,
      })),
      ...nullishTypeValidTest((nullish, type) => ({
        options: {
          ignoreConditionalTests: true,
        },
        code: `
declare const x: ${type} | ${nullish};
for (;x || 'foo';) {}
      `,
      })),
      ...nullishTypeValidTest((nullish, type) => ({
        options: {
          ignoreConditionalTests: true,
        },
        code: `
declare const x: ${type} | ${nullish};
while (x || 'foo') {}
      `,
      })),
      // ignoreMixedLogicalExpressions
      ...nullishTypeValidTest((nullish, type) => ({
        options: {
          ignoreMixedLogicalExpressions: true,
        },
        code: `
declare const a: ${type} | ${nullish};
declare const b: ${type} | ${nullish};
declare const c: ${type} | ${nullish};
a || b && c;
      `,
      })),
      ...nullishTypeValidTest((nullish, type) => ({
        options: {
          ignoreMixedLogicalExpressions: true,
        },
        code: `
declare const a: ${type} | ${nullish};
declare const b: ${type} | ${nullish};
declare const c: ${type} | ${nullish};
declare const d: ${type} | ${nullish};
a || b || c && d;
      `,
      })),
      ...nullishTypeValidTest((nullish, type) => ({
        options: {
          ignoreMixedLogicalExpressions: true,
        },
        code: `
declare const a: ${type} | ${nullish};
declare const b: ${type} | ${nullish};
declare const c: ${type} | ${nullish};
declare const d: ${type} | ${nullish};
a && b || c || d;
      `,
      })),
      ...ignorablePrimitiveTypes.map<
        ValidTestCase<typeof preferNullishCoalescing>
      >((type) => ({
        options: {
          ignorePrimitives: {
            [type]: true,
          },
        },
        code: `
declare const x: ${type} | undefined;
x || y;
      `,
      })),
      ...ignorablePrimitiveTypes.map<
        ValidTestCase<typeof preferNullishCoalescing>
      >((type) => ({
        options: {
          ignorePrimitives: true,
        },
        code: `
declare const x: ${type} | undefined;
x || y;
      `,
      })),
    ],
    invalid: [
      ...nullishTypeInvalidTest((nullish, type) => ({
        code: `
declare const x: ${type} | ${nullish};
x || 'foo';
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
            line: 3,
            column: 3,
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
          options: {
            ignoreTernaryTests: false,
          },
          code,
          errors: [
            {
              message: messages.preferNullishOverTernary,
              line: 1,
              column: 1,
            },
          ],
        },
        {
          options: {
            ignoreTernaryTests: false,
          },
          code: code.replace(/x/g, 'x.z[1][this[this.o]]["3"][a.b.c]'),
          errors: [
            {
              message: messages.preferNullishOverTernary,
              line: 1,
              column: 1,
            },
          ],
        },
      ]),
      {
        options: {
          ignoreTernaryTests: false,
        },
        code: "this != undefined ? this : y;",
        errors: [
          {
            message: messages.preferNullishOverTernary,
            line: 1,
            column: 1,
          },
        ],
      },
      ...[
        `
declare const x: string | undefined;
x !== undefined ? x : y;
      `,
        `
declare const x: string | undefined;
undefined !== x ? x : y;
      `,
        `
declare const x: string | undefined;
undefined === x ? y : x;
      `,
        `
declare const x: string | undefined;
undefined === x ? y : x;
      `,
        `
declare const x: string | null;
x !== null ? x : y;
      `,
        `
declare const x: string | null;
null !== x ? x : y;
      `,
        `
declare const x: string | null;
null === x ? y : x;
      `,
        `
declare const x: string | null;
null === x ? y : x;
      `,
      ].map((code) => ({
        options: {
          ignoreTernaryTests: false,
        },
        code,
        errors: [
          {
            message: messages.preferNullishOverTernary,
            line: 3,
            column: 1,
          },
        ],
      })),
      // ignoreConditionalTests
      ...nullishTypeInvalidTest((nullish, type) => ({
        options: {
          ignoreConditionalTests: false,
        },
        code: `
declare const x: ${type} | ${nullish};
x || 'foo' ? null : null;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
            line: 3,
            column: 3,
          },
        ],
      })),
      ...nullishTypeInvalidTest((nullish, type) => ({
        options: {
          ignoreConditionalTests: false,
        },
        code: `
declare const x: ${type} | ${nullish};
if (x || 'foo') {}
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
            line: 3,
            column: 7,
          },
        ],
      })),
      ...nullishTypeInvalidTest((nullish, type) => ({
        options: {
          ignoreConditionalTests: false,
        },
        code: `
declare const x: ${type} | ${nullish};
do {} while (x || 'foo')
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
            line: 3,
            column: 16,
          },
        ],
      })),
      ...nullishTypeInvalidTest((nullish, type) => ({
        options: {
          ignoreConditionalTests: false,
        },
        code: `
declare const x: ${type} | ${nullish};
for (;x || 'foo';) {}
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
            line: 3,
            column: 9,
          },
        ],
      })),
      ...nullishTypeInvalidTest((nullish, type) => ({
        options: {
          ignoreConditionalTests: false,
        },
        code: `
declare const x: ${type} | ${nullish};
while (x || 'foo') {}
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
            line: 3,
            column: 10,
          },
        ],
      })),
      // ignoreMixedLogicalExpressions
      ...nullishTypeInvalidTest((nullish, type) => ({
        options: {
          ignoreMixedLogicalExpressions: false,
        },
        code: `
declare const a: ${type} | ${nullish};
declare const b: ${type} | ${nullish};
declare const c: ${type} | ${nullish};
a || b && c;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
            line: 5,
            column: 3,
          },
        ],
      })),
      ...nullishTypeInvalidTest((nullish, type) => ({
        options: {
          ignoreMixedLogicalExpressions: false,
        },
        code: `
declare const a: ${type} | ${nullish};
declare const b: ${type} | ${nullish};
declare const c: ${type} | ${nullish};
declare const d: ${type} | ${nullish};
a || b || c && d;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
            line: 6,
            column: 3,
          },
          {
            message: messages.preferNullishOverOr,
            line: 6,
            column: 8,
          },
        ],
      })),
      ...nullishTypeInvalidTest((nullish, type) => ({
        options: {
          ignoreMixedLogicalExpressions: false,
        },
        code: `
declare const a: ${type} | ${nullish};
declare const b: ${type} | ${nullish};
declare const c: ${type} | ${nullish};
declare const d: ${type} | ${nullish};
a && b || c || d;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
            line: 6,
            column: 8,
          },
          {
            message: messages.preferNullishOverOr,
            line: 6,
            column: 13,
          },
        ],
      })),
      // should not false positive for functions inside conditional tests
      ...nullishTypeInvalidTest((nullish, type) => ({
        options: {
          ignoreConditionalTests: true,
        },
        code: `
declare const x: ${type} | ${nullish};
if (() => x || 'foo') {}
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
            line: 3,
            column: 13,
          },
        ],
      })),
      ...nullishTypeInvalidTest((nullish, type) => ({
        options: {
          ignoreConditionalTests: true,
        },
        code: `
declare const x: ${type} | ${nullish};
if (function werid() { return x || 'foo' }) {}
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
            line: 3,
            column: 33,
          },
        ],
      })),
      // https://github.com/typescript-eslint/typescript-eslint/issues/1290
      ...nullishTypeInvalidTest((nullish, type) => ({
        code: `
declare const a: ${type} | ${nullish};
declare const b: ${type};
declare const c: ${type};
a || b || c;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
            line: 5,
            column: 3,
          },
        ],
      })),
      // default for missing option
      {
        options: {
          ignorePrimitives: {
            number: true,
            boolean: true,
            bigint: true,
          },
        },
        code: `
declare const x: string | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            boolean: true,
            bigint: true,
          },
        },
        code: `
declare const x: number | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: true,
            bigint: true,
          },
        },
        code: `
declare const x: boolean | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: true,
            boolean: true,
          },
        },
        code: `
declare const x: bigint | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      // falsy
      {
        options: {
          ignorePrimitives: {
            string: false,
            number: true,
            boolean: true,
            bigint: true,
          },
        },
        code: `
declare const x: '' | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: false,
            number: true,
            boolean: true,
            bigint: true,
          },
        },
        code: `
declare const x: \`\` | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: false,
            boolean: true,
            bigint: true,
          },
        },
        code: `
declare const x: 0 | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: true,
            boolean: true,
            bigint: false,
          },
        },
        code: `
declare const x: 0n | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: true,
            boolean: false,
            bigint: true,
          },
        },
        code: `
declare const x: false | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      // truthy
      {
        options: {
          ignorePrimitives: {
            string: false,
            number: true,
            boolean: true,
            bigint: true,
          },
        },
        code: `
declare const x: 'a' | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: false,
            number: true,
            boolean: true,
            bigint: true,
          },
        },
        code: `
declare const x: \`hello\${'string'}\` | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: false,
            boolean: true,
            bigint: true,
          },
        },
        code: `
declare const x: 1 | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: true,
            boolean: true,
            bigint: false,
          },
        },
        code: `
declare const x: 1n | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: true,
            boolean: false,
            bigint: true,
          },
        },
        code: `
declare const x: true | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      // Unions of same primitive
      {
        options: {
          ignorePrimitives: {
            string: false,
            number: true,
            boolean: true,
            bigint: true,
          },
        },
        code: `
declare const x: 'a' | 'b' | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: false,
            number: true,
            boolean: true,
            bigint: true,
          },
        },
        code: `
declare const x: 'a' | \`b\` | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: false,
            boolean: true,
            bigint: true,
          },
        },
        code: `
declare const x: 0 | 1 | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: false,
            boolean: true,
            bigint: true,
          },
        },
        code: `
declare const x: 1 | 2 | 3 | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: true,
            boolean: true,
            bigint: false,
          },
        },
        code: `
declare const x: 0n | 1n | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: true,
            boolean: true,
            bigint: false,
          },
        },
        code: `
declare const x: 1n | 2n | 3n | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: true,
            boolean: false,
            bigint: true,
          },
        },
        code: `
declare const x: true | false | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      // Mixed unions
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: false,
            boolean: true,
            bigint: true,
          },
        },
        code: `
declare const x: 0 | 1 | 0n | 1n | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: true,
            boolean: true,
            bigint: false,
          },
        },
        code: `
declare const x: 0 | 1 | 0n | 1n | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: false,
            boolean: true,
            bigint: false,
          },
        },
        code: `
declare const x: 0 | 1 | 0n | 1n | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            string: true,
            number: true,
            boolean: false,
            bigint: true,
          },
        },
        code: `
declare const x: true | false | null | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            number: true,
            string: true,
          },
        },
        code: `
declare const x: 0 | 'foo' | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        options: {
          ignorePrimitives: {
            number: true,
            string: false,
          },
        },
        code: `
declare const x: 0 | 'foo' | undefined;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        code: `
declare const x: null;
x || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
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
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        code: `
null || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
      {
        code: `
undefined || y;
      `,
        errors: [
          {
            message: messages.preferNullishOverOr,
          },
        ],
      },
    ],
  });
