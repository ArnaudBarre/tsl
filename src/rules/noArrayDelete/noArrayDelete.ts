import ts, { SyntaxKind } from "typescript";
import { defineRule } from "../_utils/index.ts";
import type { Expression } from "../../ast.ts";
import type { Context } from "../../types.ts";

export const messages = {
  noArrayDelete:
    "Using the `delete` operator with an array expression is unsafe.",
  useSplice: "Use `array.splice()` instead.",
};

export const noArrayDelete = defineRule(() => ({
  name: "core/noArrayDelete",
  visitor: {
    DeleteExpression(context, node) {
      let expression: Expression = node.expression;
      while (expression.kind === SyntaxKind.ParenthesizedExpression) {
        expression = expression.expression;
      }
      if (expression.kind !== SyntaxKind.ElementAccessExpression) {
        return;
      }

      const type = context.utils.getConstrainedTypeAtLocation(
        expression.expression,
      );

      if (!isUnderlyingTypeArray(context, type)) {
        return;
      }

      context.report({
        node,
        message: messages.noArrayDelete,
        suggestions: () => {
          const array = expression.expression.getText();
          const key = expression.argumentExpression.getFullText();
          return [
            {
              message: messages.useSplice,
              changes: [
                {
                  node: node,
                  newText: `${array}.splice(${key}, 1)`,
                },
              ],
            },
          ];
        },
      });
    },
  },
}));

function isUnderlyingTypeArray(context: Context, type: ts.Type): boolean {
  const predicate = (t: ts.Type): boolean =>
    context.checker.isArrayType(t) || context.checker.isTupleType(t);

  if (type.isUnion()) {
    return type.types.every(predicate);
  }

  if (type.isIntersection()) {
    return type.types.some(predicate);
  }

  return predicate(type);
}
