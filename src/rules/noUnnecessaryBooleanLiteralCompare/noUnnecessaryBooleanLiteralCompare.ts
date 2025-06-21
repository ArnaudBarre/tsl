import { isTypeParameter } from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import {
  getOperatorPrecedenceForNode,
  OperatorPrecedence,
} from "../_utils/getOperatorPrecedence.ts";
import { defineRule } from "../_utils/index.ts";
import type { AST, Context } from "../../types.ts";

export const messages = {
  comparingNullableToFalse:
    "This expression unnecessarily compares a nullable boolean value to false instead of using the ?? operator to provide a default.",
  comparingNullableToTrueDirect:
    "This expression unnecessarily compares a nullable boolean value to true instead of using it directly.",
  comparingNullableToTrueNegated:
    "This expression unnecessarily compares a nullable boolean value to true instead of negating it.",
  direct:
    "This expression unnecessarily compares a boolean value to a boolean instead of using it directly.",
  negated:
    "This expression unnecessarily compares a boolean value to a boolean instead of negating it.",
  fix: "Fix",
};

export type NoUnnecessaryBooleanLiteralCompareOptions = {
  /**
   * Whether to allow comparisons between nullable boolean variables and `false`.
   * @default true
   */
  allowComparingNullableBooleansToFalse?: boolean;
  /**
   * Whether to allow comparisons between nullable boolean variables and `true`.
   * @default true
   */
  allowComparingNullableBooleansToTrue?: boolean;
};
type ParsedOptions = {
  allowComparingNullableBooleansToTrue: boolean;
  allowComparingNullableBooleansToFalse: boolean;
};

export const noUnnecessaryBooleanLiteralCompare = defineRule(
  (_options?: NoUnnecessaryBooleanLiteralCompareOptions) => {
    const options: ParsedOptions = {
      allowComparingNullableBooleansToFalse: true,
      allowComparingNullableBooleansToTrue: true,
      ..._options,
    };
    return {
      name: "core/noUnnecessaryBooleanLiteralCompare",
      visitor: {
        BinaryExpression(node, context) {
          const comparison = getBooleanComparison(node, context);
          if (comparison === undefined) return;

          if (comparison.expressionIsNullableBoolean) {
            if (
              comparison.literalBooleanInComparison
              && options.allowComparingNullableBooleansToTrue
            ) {
              return;
            }
            if (
              !comparison.literalBooleanInComparison
              && options.allowComparingNullableBooleansToFalse
            ) {
              return;
            }
          }

          context.report({
            node,
            message: comparison.expressionIsNullableBoolean
              ? comparison.literalBooleanInComparison
                ? comparison.negated
                  ? messages.comparingNullableToTrueNegated
                  : messages.comparingNullableToTrueDirect
                : messages.comparingNullableToFalse
              : comparison.negated
                ? messages.negated
                : messages.direct,
            suggestions: () => {
              // 1. isUnaryNegation - parent negation
              // 2. literalBooleanInComparison - is compared to literal boolean
              // 3. negated - is expression negated

              const isUnaryNegation =
                node.parent.kind === SyntaxKind.ParenthesizedExpression
                && node.parent.parent.kind === SyntaxKind.PrefixUnaryExpression
                && node.parent.parent.operator === SyntaxKind.ExclamationToken;

              const shouldNegate =
                comparison.negated !== comparison.literalBooleanInComparison;

              const mutatedNode = isUnaryNegation ? node.parent.parent : node;

              let newText = comparison.expression.getText();

              // if the expression `exp` is nullable, and we're not comparing to `true`, insert `?? true`
              let alreadyHasParentheses = false;
              if (
                comparison.expressionIsNullableBoolean
                && !comparison.literalBooleanInComparison
              ) {
                // provide the default `true`
                newText = "(" + newText + " ?? true)";
                alreadyHasParentheses = true;
              }

              if (shouldNegate === isUnaryNegation) {
                newText =
                  !alreadyHasParentheses
                  && getOperatorPrecedenceForNode(comparison.expression)
                    < OperatorPrecedence.Unary
                    ? "!(" + newText + ")"
                    : "!" + newText;
              }
              return [
                {
                  message: messages.fix,
                  changes: [{ node: mutatedNode, newText }],
                },
              ];
            },
          });
        },
      },
    };
  },
);

function getBooleanComparison(
  node: AST.BinaryExpression,
  context: Context,
): (BooleanComparison & { expressionIsNullableBoolean: boolean }) | undefined {
  const comparison = deconstructComparison(node);
  if (!comparison) {
    return undefined;
  }

  const type = context.checker.getTypeAtLocation(comparison.expression);
  const constraintType = isTypeParameter(type)
    ? context.checker.getBaseConstraintOfType(type)
    : type;

  if (constraintType === undefined) {
    return undefined;
  }

  if (isBooleanType(context, constraintType)) {
    return { ...comparison, expressionIsNullableBoolean: false };
  }

  if (isNullableBoolean(context, constraintType)) {
    return { ...comparison, expressionIsNullableBoolean: true };
  }

  return undefined;
}

function isBooleanType(context: Context, expressionType: ts.Type): boolean {
  return context.utils.typeHasFlag(
    expressionType,
    ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral,
  );
}

/**
 * checks if the expressionType is a union that
 *   1) contains at least one nullish type (null or undefined)
 *   2) contains at least once boolean type (true or false or boolean)
 *   3) does not contain any types besides nullish and boolean types
 */
function isNullableBoolean(context: Context, expressionType: ts.Type): boolean {
  if (!expressionType.isUnion()) {
    return false;
  }

  const { types } = expressionType;

  const nonNullishTypes = types.filter(
    (type) =>
      !context.utils.typeHasFlag(
        type,
        ts.TypeFlags.Undefined | ts.TypeFlags.Null,
      ),
  );

  const hasNonNullishType = nonNullishTypes.length > 0;
  if (!hasNonNullishType) {
    return false;
  }

  const hasNullableType = nonNullishTypes.length < types.length;
  if (!hasNullableType) {
    return false;
  }

  const allNonNullishTypesAreBoolean = nonNullishTypes.every((type) =>
    isBooleanType(context, type),
  );
  if (!allNonNullishTypesAreBoolean) {
    return false;
  }

  return true;
}

type BooleanComparison = {
  expression: AST.Expression;
  literalBooleanInComparison: boolean;
  negated: boolean;
};
function deconstructComparison(
  node: AST.BinaryExpression,
): BooleanComparison | undefined {
  const equalsKind = getEqualsKind(node.operatorToken);
  if (!equalsKind) return;

  for (const [against, expression] of [
    [node.right, node.left],
    [node.left, node.right],
  ]) {
    if (
      against.kind === SyntaxKind.TrueKeyword
      || against.kind === SyntaxKind.FalseKeyword
    ) {
      return {
        literalBooleanInComparison: against.kind === SyntaxKind.TrueKeyword,
        expression,
        negated: !equalsKind.isPositive,
      };
    }
  }

  return undefined;
}

function getEqualsKind(
  operator: AST.BinaryOperatorToken,
): { isPositive: boolean } | undefined {
  switch (operator.kind) {
    case SyntaxKind.EqualsEqualsToken: // ==
      return { isPositive: true };
    case SyntaxKind.EqualsEqualsEqualsToken: // ===
      return { isPositive: true };
    case SyntaxKind.ExclamationEqualsToken: // !=
      return { isPositive: false };
    case SyntaxKind.ExclamationEqualsEqualsToken: // !==
      return { isPositive: false };
    default:
      return undefined;
  }
}
