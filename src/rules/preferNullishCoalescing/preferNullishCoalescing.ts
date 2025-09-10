import ts, { SyntaxKind, TypeFlags } from "typescript";
import {
  getOperatorPrecedenceForNode,
  OperatorPrecedence,
} from "../_utils/getOperatorPrecedence.ts";
import { defineRule, isLogicalExpression } from "../_utils/index.ts";
import type { EqualityOperator } from "../../ast.ts";
import type { AST, Context, Suggestion } from "../../types.ts";

export const messages = {
  preferNullishOverOr: (params: {
    equals: string;
    description: "assignment" | "or";
  }) =>
    `Prefer using nullish coalescing operator (\`??${params.equals}\`) instead of a logical ${params.description} (\`||${params.equals}\`), as it is a safer operator.`,
  preferNullishOverTernary: `Prefer using nullish coalescing operator (\`??\`) instead of a ternary expression, as it is simpler to read.`,
  preferNullishOverAssignment:
    "Prefer using nullish coalescing operator (??=) instead of an assignment expression, as it is simpler to read.",
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
   * Whether to ignore any if statements that could be simplified by using the nullish coalescing operator.
   * @default false
   */
  ignoreIfStatements?: boolean;
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
  ignoreIfStatements: boolean;
  ignorePrimitives: {
    bigint: boolean;
    boolean: boolean;
    number: boolean;
    string: boolean;
  };
};

// https://typescript-eslint.io/rules/prefer-nullish-coalescing
export const preferNullishCoalescing = defineRule(
  (_options?: PreferNullishCoalescingOptions) => {
    const options: ParsedOptions = {
      ignoreBooleanCoercion: false,
      ignoreConditionalTests: true,
      ignoreMixedLogicalExpressions: false,
      ignoreTernaryTests: false,
      ignoreIfStatements: false,
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
        BinaryExpression(context, node) {
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
        ConditionalExpression(context, node) {
          if (options.ignoreTernaryTests) return;

          // !x ? y : x
          if (
            node.condition.kind === SyntaxKind.PrefixUnaryExpression
            && node.condition.operator === SyntaxKind.ExclamationToken
            && isMemberAccessLike(node.condition.operand)
            && isMemberAccessLike(node.whenFalse)
            && areNodesSimilarMemberAccess(
              node.condition.operand,
              node.whenFalse,
            )
          ) {
            if (
              !truthinessEligibleForNullishCoalescing(
                context,
                options,
                node.condition.operand,
              )
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
                      newText: getNewText(
                        node.condition.operand,
                        node.whenTrue,
                      ),
                    },
                  ],
                },
              ],
            });
            return;
          }

          // x ? x : y
          if (
            isMemberAccessLike(node.condition)
            && isMemberAccessLike(node.whenTrue)
            && areNodesSimilarMemberAccess(node.condition, node.whenTrue)
          ) {
            if (
              !truthinessEligibleForNullishCoalescing(
                context,
                options,
                node.condition,
              )
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
                      newText: getNewText(node.condition, node.whenFalse),
                    },
                  ],
                },
              ],
            });
            return;
          }

          const result = conditionEligibleForNullishCoalescing(
            context,
            node.condition,
            (operator) => getBranchNodes(node, operator).nonNullishBranch,
          );

          if (!result) return;

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
                      newText: getNewText(
                        result.nullishCoalescingLeftNode,
                        getBranchNodes(node, result.operator).nullishBranch,
                      ),
                    },
                  ],
                },
              ];
            },
          });
        },
        IfStatement(context, node) {
          if (options.ignoreIfStatements) return;
          if (node.elseStatement) return;

          let assignmentExpression: AST.Expression | undefined;
          if (
            node.thenStatement.kind === SyntaxKind.Block
            && node.thenStatement.statements.length === 1
            && node.thenStatement.statements[0].kind
              === SyntaxKind.ExpressionStatement
          ) {
            assignmentExpression = node.thenStatement.statements[0].expression;
          } else if (
            node.thenStatement.kind === SyntaxKind.ExpressionStatement
          ) {
            assignmentExpression = node.thenStatement.expression;
          }

          if (!assignmentExpression) return;
          if (
            !(
              assignmentExpression.kind === SyntaxKind.BinaryExpression
              && assignmentExpression.operatorToken.kind
                === SyntaxKind.EqualsToken
            )
          ) {
            return;
          }
          if (!isMemberAccessLike(assignmentExpression.left)) return;

          let eligible = false;

          // if (!a) a = b
          if (
            node.expression.kind === SyntaxKind.PrefixUnaryExpression
            && node.expression.operator === SyntaxKind.ExclamationToken
            && isMemberAccessLike(node.expression.operand)
            && areNodesSimilarMemberAccess(
              node.expression.operand,
              assignmentExpression.left,
            )
            && truthinessEligibleForNullishCoalescing(
              context,
              options,
              node.expression.operand,
            )
          ) {
            eligible = true;
          }

          const result = conditionEligibleForNullishCoalescing(
            context,
            node.expression,
            () => assignmentExpression.left,
          );

          if (
            result
            && (result.operator === SyntaxKind.EqualsEqualsToken
              || result.operator === SyntaxKind.EqualsEqualsEqualsToken)
          ) {
            // if (a == null) {...}
            eligible = true;
          }

          if (!eligible) return;

          context.report({
            node,
            message: messages.preferNullishOverAssignment,
            suggestions: [
              {
                message: messages.suggestNullish({ equals: "=" }),
                changes: [
                  {
                    node,
                    newText: `${assignmentExpression.left.getText()} ??= ${assignmentExpression.right.getText()};`,
                  },
                ],
              },
            ],
          });
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

  if (!truthinessEligibleForNullishCoalescing(context, options, node.left)) {
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

function conditionEligibleForNullishCoalescing(
  context: Context,
  condition: AST.Expression,
  getNonNullishBranch: (operator: EqualityOperator) => AST.AnyNode,
) {
  if (condition.kind !== SyntaxKind.BinaryExpression) return;
  let operator: EqualityOperator | undefined;
  let nodesInsideTestExpression: AST.AnyNode[] = [];
  switch (condition.operatorToken.kind) {
    case SyntaxKind.EqualsEqualsToken:
    case SyntaxKind.EqualsEqualsEqualsToken:
    case SyntaxKind.ExclamationEqualsToken:
    case SyntaxKind.ExclamationEqualsEqualsToken:
      nodesInsideTestExpression = [condition.left, condition.right];

      operator = condition.operatorToken.kind;
      break;
    case SyntaxKind.BarBarToken:
    case SyntaxKind.BarBarEqualsToken:
    case SyntaxKind.AmpersandAmpersandToken:
      if (condition.left.kind !== SyntaxKind.BinaryExpression) {
        return;
      }
      if (condition.right.kind !== SyntaxKind.BinaryExpression) {
        return;
      }
      nodesInsideTestExpression = [
        condition.left.left,
        condition.left.right,
        condition.right.left,
        condition.right.right,
      ];

      if (
        condition.operatorToken.kind === SyntaxKind.BarBarToken
        || condition.operatorToken.kind === SyntaxKind.BarBarEqualsToken
      ) {
        if (
          condition.left.operatorToken.kind
            === SyntaxKind.EqualsEqualsEqualsToken
          && condition.right.operatorToken.kind
            === SyntaxKind.EqualsEqualsEqualsToken
        ) {
          operator = SyntaxKind.EqualsEqualsEqualsToken;
        } else if (
          ((condition.left.operatorToken.kind
            === SyntaxKind.EqualsEqualsEqualsToken
            || condition.right.operatorToken.kind
              === SyntaxKind.EqualsEqualsEqualsToken)
            && (condition.left.operatorToken.kind
              === SyntaxKind.EqualsEqualsToken
              || condition.right.operatorToken.kind
                === SyntaxKind.EqualsEqualsToken))
          || (condition.left.operatorToken.kind === SyntaxKind.EqualsEqualsToken
            && condition.right.operatorToken.kind
              === SyntaxKind.EqualsEqualsToken)
        ) {
          operator = SyntaxKind.EqualsEqualsToken;
        }
      } else {
        if (
          condition.left.operatorToken.kind
            === SyntaxKind.ExclamationEqualsEqualsToken
          && condition.right.operatorToken.kind
            === SyntaxKind.ExclamationEqualsEqualsToken
        ) {
          operator = SyntaxKind.ExclamationEqualsEqualsToken;
        } else if (
          ((condition.left.operatorToken.kind
            === SyntaxKind.ExclamationEqualsEqualsToken
            || condition.right.operatorToken.kind
              === SyntaxKind.ExclamationEqualsEqualsToken)
            && (condition.left.operatorToken.kind
              === SyntaxKind.ExclamationEqualsToken
              || condition.right.operatorToken.kind
                === SyntaxKind.ExclamationEqualsToken))
          || (condition.left.operatorToken.kind
            === SyntaxKind.ExclamationEqualsToken
            && condition.right.operatorToken.kind
              === SyntaxKind.ExclamationEqualsToken)
        ) {
          operator = SyntaxKind.ExclamationEqualsToken;
        }
      }
      break;
    default:
      break;
  }

  if (operator === undefined) return;

  let nullishCoalescingLeftNode: AST.AnyNode | undefined;
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
      areNodesSimilarMemberAccess(testNode, getNonNullishBranch(operator))
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

  const isEligible = ((): boolean => {
    // it is eligible if we check for both null and undefined, or not if neither
    if (hasUndefinedCheck === hasNullCheck) {
      return hasUndefinedCheck;
    }

    // it is eligible if we loosely check for either null or undefined
    if (
      operator === SyntaxKind.EqualsEqualsToken
      || operator === SyntaxKind.ExclamationEqualsToken
    ) {
      return true;
    }

    const type = context.checker.getTypeAtLocation(nullishCoalescingLeftNode);

    if (
      context.utils.typeOrUnionHasFlag(type, TypeFlags.Any | TypeFlags.Unknown)
    ) {
      return false;
    }

    const hasNullType = context.utils.typeOrUnionHasFlag(type, TypeFlags.Null);

    // it is eligible if we check for undefined and the type is not nullable
    if (hasUndefinedCheck && !hasNullType) {
      return true;
    }

    const hasUndefinedType = context.utils.typeOrUnionHasFlag(
      type,
      TypeFlags.Undefined,
    );

    // it is eligible if we check for null and the type can't be undefined
    return hasNullCheck && !hasUndefinedType;
  })();

  if (!isEligible) return;

  return { nullishCoalescingLeftNode, operator };
}

function truthinessEligibleForNullishCoalescing(
  context: Context,
  options: ParsedOptions,
  testNode: AST.Expression,
): boolean {
  const type = context.checker.getTypeAtLocation(testNode);
  if (
    !context.utils.typeOrUnionHasFlag(
      type,
      TypeFlags.Null
        | TypeFlags.Undefined
        | TypeFlags.Any
        | TypeFlags.Unknown
        | TypeFlags.Void,
    )
  ) {
    return false;
  }

  let ignorableFlags = 0;
  const { ignorePrimitives } = options;
  if (ignorePrimitives.bigint) ignorableFlags |= TypeFlags.BigIntLike;
  if (ignorePrimitives.boolean) ignorableFlags |= TypeFlags.BooleanLike;
  if (ignorePrimitives.number) ignorableFlags |= TypeFlags.NumberLike;
  if (ignorePrimitives.string) ignorableFlags |= TypeFlags.StringLike;

  if (ignorableFlags === 0) {
    // any types are eligible for conversion.
    return true;
  }

  // if the type is `any` or `unknown` we can't make any assumptions
  // about the value, so it could be any primitive, even though the flags
  // won't be set.
  //
  // technically, this is true of `void` as well, however, it's a TS error
  // to test `void` for truthiness, so we don't need to bother checking for
  // it in valid code.
  if (context.utils.typeHasFlag(type, TypeFlags.Any | TypeFlags.Unknown)) {
    return false;
  }

  if (
    type.flags !== TypeFlags.Null
    && type.flags !== TypeFlags.Undefined
    && (type as ts.UnionOrIntersectionType).types.some((t) =>
      context.utils
        .intersectionConstituents(t)
        .some((t) => context.utils.typeHasFlag(t, ignorableFlags)),
    )
  ) {
    return false;
  }

  return true;
}

function isMemberAccessLike(node: AST.AnyNode): boolean {
  return (
    node.kind === SyntaxKind.Identifier
    || node.kind === SyntaxKind.PropertyAccessExpression
  );
}

function getNewText(left: AST.AnyNode, right: AST.AnyNode): string {
  const rightText =
    right.kind !== SyntaxKind.ParenthesizedExpression
    && getOperatorPrecedenceForNode(right) <= OperatorPrecedence.Coalesce
      ? `(${right.getText()})`
      : right.getText();
  return `${left.getText()} ?? ${rightText}`;
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
