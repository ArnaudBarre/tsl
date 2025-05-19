import {
  intersectionTypeParts,
  isFalseLiteralType,
  isTypeFlagSet,
} from "ts-api-utils";
import ts, { SyntaxKind, TypeFlags } from "typescript";
import {
  getValueOfLiteralType,
  isLogicalExpression,
  isTypeRecurser,
  typeHasFlag,
} from "../_utils/index.ts";
import type { EqualityOperator } from "../../ast.ts";
import { createRule } from "../../index.ts";
import type { AST, Context, Suggestion } from "../../types.ts";

export const messages = {
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

export type PreferNullishCoalescingOptions = {
  /**
   * Whether to ignore arguments to the `Boolean` constructor.
   * @default false
   */
  ignoreBooleanCoercion?: boolean;
  /**
   * Whether to ignore cases that are located within a conditional test.
   * @default true
   */
  ignoreConditionalTests?: boolean;
  /**
   * Whether to ignore any logical or expressions that are part of a mixed logical expression (with `&&`).
   * @default false
   */
  ignoreMixedLogicalExpressions?: boolean;
  /**
   * Whether to ignore any ternary expressions that could be simplified by using the nullish coalescing operator.
   * @default false
   */
  ignoreTernaryTests?: boolean;
  /**
   * Whether to ignore all (`true`) or some (an object with properties) primitive types.
   * @default false
   */
  ignorePrimitives?:
    | {
        /** Ignore bigint primitive types. */
        bigint?: boolean;
        /** Ignore boolean primitive types. */
        boolean?: boolean;
        /** Ignore number primitive types. */
        number?: boolean;
        /** Ignore string primitive types. */
        string?: boolean;
      }
    /** Ignore all primitive types. */
    | true;
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
            node.operatorToken.kind === SyntaxKind.BarBarToken
            && !(
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

          // !x ? y : x
          if (
            node.condition.kind === SyntaxKind.PrefixUnaryExpression
            && node.condition.operator === SyntaxKind.ExclamationToken
            && (node.condition.operand.kind === SyntaxKind.Identifier
              || node.condition.operand.kind
                === SyntaxKind.PropertyAccessExpression)
            && (node.whenFalse.kind === SyntaxKind.Identifier
              || node.whenFalse.kind === SyntaxKind.PropertyAccessExpression)
            && areNodesSimilarMemberAccess(
              node.condition.operand,
              node.whenFalse,
            )
          ) {
            const type = context.checker.getTypeAtLocation(
              node.condition.operand,
            );
            if (!typeHasFlag(type, TypeFlags.Null | TypeFlags.Undefined)) {
              return;
            }
            if (
              node.condition.operand.kind === SyntaxKind.Identifier
              && isUnsafeConditional(type)
            ) {
              return;
            }
            context.report({
              node,
              message: messages.preferNullishOverTernary,
              suggestions: [
                {
                  message: messages.suggestNullish({ equals: "" }),
                  changes: [
                    {
                      node,
                      newText: `${node.condition.operand.getText()} ?? ${node.whenTrue.getText()}`,
                    },
                  ],
                },
              ],
            });
            return;
          }

          // x ? x : y
          if (
            (node.condition.kind === SyntaxKind.Identifier
              || node.condition.kind === SyntaxKind.PropertyAccessExpression)
            && (node.whenTrue.kind === SyntaxKind.Identifier
              || node.whenTrue.kind === SyntaxKind.PropertyAccessExpression)
            && areNodesSimilarMemberAccess(node.condition, node.whenTrue)
          ) {
            const type = context.checker.getTypeAtLocation(node.condition);
            if (!typeHasFlag(type, TypeFlags.Null | TypeFlags.Undefined)) {
              return;
            }
            if (
              node.condition.kind === SyntaxKind.Identifier
              && isUnsafeConditional(type)
            ) {
              return;
            }
            context.report({
              node,
              message: messages.preferNullishOverTernary,
              suggestions: [
                {
                  message: messages.suggestNullish({ equals: "" }),
                  changes: [
                    {
                      node,
                      newText: `${node.condition.getText()} ?? ${node.whenFalse.getText()}`,
                    },
                  ],
                },
              ],
            });
            return;
          }

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
                node.condition.operatorToken.kind === SyntaxKind.BarBarToken
                || node.condition.operatorToken.kind
                  === SyntaxKind.BarBarEqualsToken
              ) {
                if (
                  node.condition.left.operatorToken.kind
                    === SyntaxKind.EqualsEqualsEqualsToken
                  && node.condition.right.operatorToken.kind
                    === SyntaxKind.EqualsEqualsEqualsToken
                ) {
                  operator = SyntaxKind.EqualsEqualsEqualsToken;
                } else if (
                  ((node.condition.left.operatorToken.kind
                    === SyntaxKind.EqualsEqualsEqualsToken
                    || node.condition.right.operatorToken.kind
                      === SyntaxKind.EqualsEqualsEqualsToken)
                    && (node.condition.left.operatorToken.kind
                      === SyntaxKind.EqualsEqualsToken
                      || node.condition.right.operatorToken.kind
                        === SyntaxKind.EqualsEqualsToken))
                  || (node.condition.left.operatorToken.kind
                    === SyntaxKind.EqualsEqualsToken
                    && node.condition.right.operatorToken.kind
                      === SyntaxKind.EqualsEqualsToken)
                ) {
                  operator = SyntaxKind.EqualsEqualsToken;
                }
              } else {
                if (
                  node.condition.left.operatorToken.kind
                    === SyntaxKind.ExclamationEqualsEqualsToken
                  && node.condition.right.operatorToken.kind
                    === SyntaxKind.ExclamationEqualsEqualsToken
                ) {
                  operator = SyntaxKind.ExclamationEqualsEqualsToken;
                } else if (
                  ((node.condition.left.operatorToken.kind
                    === SyntaxKind.ExclamationEqualsEqualsToken
                    || node.condition.right.operatorToken.kind
                      === SyntaxKind.ExclamationEqualsEqualsToken)
                    && (node.condition.left.operatorToken.kind
                      === SyntaxKind.ExclamationEqualsToken
                      || node.condition.right.operatorToken.kind
                        === SyntaxKind.ExclamationEqualsToken))
                  || (node.condition.left.operatorToken.kind
                    === SyntaxKind.ExclamationEqualsToken
                    && node.condition.right.operatorToken.kind
                      === SyntaxKind.ExclamationEqualsToken)
                ) {
                  operator = SyntaxKind.ExclamationEqualsToken;
                }
              }
              break;
            default:
              break;
          }

          if (!operator) return;

          let nullishCoalescingLeftNode: ts.Node | undefined;
          let hasUndefinedCheck = false;
          let hasNullCheck = false;

          // we check that the test only contains null, undefined and the identifier
          for (const testNode of nodesInsideTestExpression) {
            if (testNode.kind === SyntaxKind.NullKeyword) {
              hasNullCheck = true;
            } else if (
              testNode.kind === SyntaxKind.Identifier
              && testNode.text === "undefined"
            ) {
              hasUndefinedCheck = true;
            } else if (
              areNodesSimilarMemberAccess(
                testNode,
                getBranchNodes(node, operator).nonNullishBranch,
              )
            ) {
              // Only consider the first expression in a multi-part nullish check,
              // as subsequent expressions might not require all the optional chaining operators.
              // For example: a?.b?.c !== undefined && a.b.c !== null ? a.b.c : 'foo';
              // This works because `node.test` is always evaluated first in the loop
              // and has the same or more necessary optional chaining operators
              // than `node.alternate` or `node.consequent`.
              nullishCoalescingLeftNode ??= testNode;
            } else {
              return;
            }
          }

          if (!nullishCoalescingLeftNode) return;

          const isFixable = ((): boolean => {
            // it is fixable if we check for both null and undefined, or not if neither
            if (hasUndefinedCheck === hasNullCheck) {
              return hasUndefinedCheck;
            }

            // it is fixable if we loosely check for either null or undefined
            if (
              operator === SyntaxKind.EqualsEqualsToken
              || operator === SyntaxKind.ExclamationEqualsToken
            ) {
              return true;
            }

            const type = context.checker.getTypeAtLocation(
              nullishCoalescingLeftNode,
            );

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
                return [
                  {
                    message: messages.suggestNullish({ equals: "" }),
                    changes: [
                      {
                        node,
                        newText: `${nullishCoalescingLeftNode.getText()} ?? ${getBranchNodes(
                          node,
                          operator,
                        ).nullishBranch.getText()}`,
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
  if (options.ignoreConditionalTests && isConditionalTest(node)) {
    return;
  }

  if (options.ignoreMixedLogicalExpressions && isMixedLogicalExpression(node)) {
    return;
  }

  const type = context.checker.getTypeAtLocation(node.left);
  if (!typeHasFlag(type, TypeFlags.Null | TypeFlags.Undefined)) {
    return;
  }

  let ignorableFlags = 0;
  const { ignorePrimitives } = options;
  if (ignorePrimitives.bigint) ignorableFlags |= TypeFlags.BigIntLike;
  if (ignorePrimitives.boolean) ignorableFlags |= TypeFlags.BooleanLike;
  if (ignorePrimitives.number) ignorableFlags |= TypeFlags.NumberLike;
  if (ignorePrimitives.string) ignorableFlags |= TypeFlags.StringLike;

  if (
    type.flags !== TypeFlags.Null
    && type.flags !== TypeFlags.Undefined
    && (type as ts.UnionOrIntersectionType).types.some((t) =>
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
        node.parent.kind === SyntaxKind.BinaryExpression
        && node.parent.operatorToken.kind === SyntaxKind.BarBarToken
      ) {
        if (
          node.left.kind === SyntaxKind.BinaryExpression
          && isLogicalExpression(node.left.operatorToken)
          && !(
            node.left.left.kind === SyntaxKind.BinaryExpression
            && node.left.left.operatorToken.kind === SyntaxKind.BarBarToken
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

function isUnsafeConditional(type: ts.Type): boolean {
  return isTypeRecurser(type, (t) => {
    return t.isLiteral()
      ? !getValueOfLiteralType(t)
      : t.flags === TypeFlags.Any
          || t.flags === TypeFlags.Unknown
          || t.flags === TypeFlags.String
          || t.flags === TypeFlags.Number
          || t.flags === TypeFlags.BigInt
          || t.flags === TypeFlags.Boolean
          || isFalseLiteralType(t);
  });
}

function isConditionalTest(node: AST.AnyNode): boolean {
  const parent = node.parent as AST.AnyNode | null;
  if (!parent) return false;

  if (parent.kind === SyntaxKind.ParenthesizedExpression) {
    return isConditionalTest(parent);
  }

  if (
    parent.kind === SyntaxKind.BinaryExpression
    && isLogicalExpression(parent.operatorToken)
  ) {
    return isConditionalTest(parent);
  }

  if (
    parent.kind === SyntaxKind.ConditionalExpression
    && (parent.whenTrue === node || parent.whenFalse === node)
  ) {
    return isConditionalTest(parent);
  }

  if (
    parent.kind === SyntaxKind.BinaryExpression
    && parent.operatorToken.kind === SyntaxKind.CommaToken
    && parent.right === node
  ) {
    return isConditionalTest(parent);
  }

  if (
    parent.kind === SyntaxKind.PrefixUnaryExpression
    && parent.operator === SyntaxKind.ExclamationToken
  ) {
    return isConditionalTest(parent);
  }

  if (
    (parent.kind === SyntaxKind.ConditionalExpression
      || parent.kind === SyntaxKind.ForStatement)
    && parent.condition === node
  ) {
    return true;
  }

  if (
    (parent.kind === SyntaxKind.DoStatement
      || parent.kind === SyntaxKind.IfStatement
      || parent.kind === SyntaxKind.WhileStatement)
    && parent.expression === node
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
    parent.kind === SyntaxKind.BinaryExpression
    && isLogicalExpression(parent.operatorToken)
  ) {
    return isBooleanConstructorContext(parent);
  }

  if (
    parent.kind === SyntaxKind.ConditionalExpression
    && (parent.whenTrue === node || parent.whenFalse === node)
  ) {
    return isBooleanConstructorContext(parent);
  }

  if (
    parent.kind === SyntaxKind.BinaryExpression
    && parent.operatorToken.kind === SyntaxKind.CommaToken
    && parent.right === node
  ) {
    return isBooleanConstructorContext(parent);
  }

  return (
    parent.kind === SyntaxKind.CallExpression
    && parent.expression.kind === SyntaxKind.Identifier
    && parent.expression.text === "Boolean"
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
        current.operatorToken.kind === SyntaxKind.BarBarToken
        || current.operatorToken.kind === SyntaxKind.BarBarEqualsToken
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
    a.kind === SyntaxKind.TrueKeyword
    || a.kind === SyntaxKind.FalseKeyword
    || a.kind === SyntaxKind.ThisKeyword
    || a.kind === SyntaxKind.NullKeyword
  ) {
    return true;
  }
  if (
    a.kind === SyntaxKind.StringLiteral
    && b.kind === SyntaxKind.StringLiteral
  ) {
    return a.text === b.text;
  }
  if (
    a.kind === SyntaxKind.NumericLiteral
    && b.kind === SyntaxKind.NumericLiteral
  ) {
    return a.text === b.text;
  }

  if (a.kind === SyntaxKind.Identifier && b.kind === SyntaxKind.Identifier) {
    return a.text === b.text;
  }
  if (
    a.kind === SyntaxKind.PropertyAccessExpression
    && b.kind === SyntaxKind.PropertyAccessExpression
  ) {
    return (
      isNodeEqual(a.name, b.name)
      && isNodeEqual(a.expression, b.expression)
      && !a.questionDotToken
      && !b.questionDotToken
    );
  }
  if (
    a.kind === SyntaxKind.ElementAccessExpression
    && b.kind === SyntaxKind.ElementAccessExpression
  ) {
    return (
      isNodeEqual(a.argumentExpression, b.argumentExpression)
      && isNodeEqual(a.expression, b.expression)
      && !a.questionDotToken
      && !b.questionDotToken
    );
  }
  return false;
}

/**
 * Checks if two nodes have the same member access sequence,
 * regardless of optional chaining differences.
 *
 * Note: This does not imply that the nodes are runtime-equivalent.
 *
 * Example: `a.b.c`, `a?.b.c`, `a.b?.c`, `(a?.b).c`, `(a.b)?.c` are considered similar.
 */
function areNodesSimilarMemberAccess(a: AST.AnyNode, b: AST.AnyNode): boolean {
  if (a.kind === SyntaxKind.ParenthesizedExpression) a = a.expression;
  if (b.kind === SyntaxKind.ParenthesizedExpression) b = b.expression;
  if (
    a.kind === SyntaxKind.PropertyAccessExpression
    && b.kind === SyntaxKind.PropertyAccessExpression
  ) {
    return (
      isNodeEqual(a.name, b.name)
      && areNodesSimilarMemberAccess(a.expression, b.expression)
    );
  }
  return isNodeEqual(a, b);
}

function getBranchNodes(
  node: AST.ConditionalExpression,
  operator: EqualityOperator,
) {
  if (
    operator === SyntaxKind.EqualsEqualsEqualsToken
    || operator === SyntaxKind.EqualsEqualsToken
  ) {
    return { nonNullishBranch: node.whenFalse, nullishBranch: node.whenTrue };
  }
  return { nonNullishBranch: node.whenTrue, nullishBranch: node.whenFalse };
}
