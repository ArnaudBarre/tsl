import ts, { SyntaxKind } from "typescript";
import type { Expression } from "../../ast.ts";
import { createRule } from "../../public-utils.ts";
import type { Checker } from "../../types.ts";

export const messages = {
  noArrayDelete:
    "Using the `delete` operator with an array expression is unsafe.",
  useSplice: "Use `array.splice()` instead.",
};

export const noArrayDelete = createRule(() => ({
  name: "core/noArrayDelete",
  visitor: {
    DeleteExpression(node, context) {
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

      if (!isUnderlyingTypeArray(type, context.checker)) {
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

function isUnderlyingTypeArray(type: ts.Type, checker: Checker): boolean {
  const predicate = (t: ts.Type): boolean =>
    checker.isArrayType(t) || checker.isTupleType(t);

  if (type.isUnion()) {
    return type.types.every(predicate);
  }

  if (type.isIntersection()) {
    return type.types.some(predicate);
  }

  return predicate(type);
}
