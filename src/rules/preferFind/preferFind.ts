import { isIntrinsicNullType, isIntrinsicUndefinedType } from "ts-api-utils";
import { SyntaxKind, type Type } from "typescript";
import { defineRule } from "../_utils/index.ts";
import type { AST, Context } from "../../types.ts";

export const messages = {
  preferFind: "Prefer .find(...) instead of .filter(...)[0].",
  preferFindSuggestion: "Use .find(...) instead of .filter(...)[0].",
};

export const preferFind = defineRule(() => ({
  name: "core/preferFind",
  visitor: {
    CallExpression(node, context) {
      // `<leftHandSide>.at(<arg>)`.
      if (node.arguments.length !== 1) return;
      if (node.expression.kind !== SyntaxKind.PropertyAccessExpression) return;
      if (node.expression.name.kind !== SyntaxKind.Identifier) return;
      if (node.expression.name.text !== "at") return;
      checkAccess(
        node,
        node.expression.expression,
        node.arguments[0],
        node.expression.name.getFullStart() - 1,
        context,
      );
    },
    ElementAccessExpression(node, context) {
      // `<leftHandSide>[<arg>]`.
      checkAccess(
        node,
        node.expression,
        node.argumentExpression,
        node.argumentExpression.getFullStart() - 1,
        context,
      );
    },
  },
}));

function checkAccess(
  node: AST.Expression,
  leftHandSide: AST.LeftHandSideExpression,
  argument: AST.Expression,
  argumentFullStart: number,
  context: Context,
): AST.Expression | undefined {
  if (argument.kind !== SyntaxKind.NumericLiteral) return;
  if (argument.text !== "0") return;
  const filterIdentifiers = parseArrayFilterExpressions(leftHandSide, context);
  if (filterIdentifiers.length !== 0) {
    context.report({
      node,
      message: messages.preferFind,
      suggestions: [
        {
          message: messages.preferFindSuggestion,
          changes: [
            ...filterIdentifiers.map((node) => ({
              node,
              newText: "find",
            })),
            // Get rid of the [0].
            { start: argumentFullStart, end: node.getEnd(), newText: "" },
          ],
        },
      ],
    });
  }
}

function parseArrayFilterExpressions(
  expression: AST.Expression,
  context: Context,
): AST.Identifier[] {
  if (expression.kind === SyntaxKind.ParenthesizedExpression) {
    return parseArrayFilterExpressions(expression.expression, context);
  }

  // This is the only reason we're returning a list rather than a single value.
  if (expression.kind === SyntaxKind.ConditionalExpression) {
    // Both branches of the ternary _must_ return results.
    const consequentResult = parseArrayFilterExpressions(
      expression.whenTrue,
      context,
    );
    if (consequentResult.length === 0) {
      return [];
    }

    const alternateResult = parseArrayFilterExpressions(
      expression.whenFalse,
      context,
    );
    if (alternateResult.length === 0) {
      return [];
    }

    // Accumulate the results from both sides and pass up the chain.
    return [...consequentResult, ...alternateResult];
  }

  // Check if it looks like <<stuff>>(...), but not <<stuff>>?.(...)
  if (
    expression.kind === SyntaxKind.CallExpression
    && !expression.questionDotToken
  ) {
    const callee = expression.expression;
    // Check if it looks like <<stuff>>.filter(...)
    // or the optional chaining variants.
    if (
      callee.kind === SyntaxKind.PropertyAccessExpression
      && callee.name.kind === SyntaxKind.Identifier
      && callee.name.text === "filter"
    ) {
      const filteredObjectType = context.utils.getConstrainedTypeAtLocation(
        callee.expression,
      );

      // As long as the object is a (possibly nullable) array,
      // this is an Array.prototype.filter expression.
      if (isArrayish(filteredObjectType, context)) {
        return [callee.name];
      }
    }
  }

  // not a filter expression.
  return [];
}

/**
 * Tells whether the type is a possibly nullable array/tuple or union thereof.
 */
function isArrayish(type: Type, context: Context): boolean {
  let isAtLeastOneArrayishComponent = false;
  for (const unionPart of context.utils.unionConstituents(type)) {
    if (isIntrinsicNullType(unionPart) || isIntrinsicUndefinedType(unionPart)) {
      continue;
    }

    // apparently checker.isArrayType(T[] & S[]) => false.
    // so we need to check the intersection parts individually.
    const isArrayOrIntersectionThereof = context.utils
      .intersectionConstituents(unionPart)
      .every(
        (intersectionPart) =>
          context.checker.isArrayType(intersectionPart)
          || context.checker.isTupleType(intersectionPart),
      );

    if (!isArrayOrIntersectionThereof) {
      // There is a non-array, non-nullish type component,
      // so it's not an array.
      return false;
    }

    isAtLeastOneArrayishComponent = true;
  }

  return isAtLeastOneArrayishComponent;
}
