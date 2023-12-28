import { createRule } from "../public-utils.ts";

export const noUnnecessaryNonNullExpression = createRule({
  name: "no-unnecessary-non-null-expression",
  visitor: {
    NonNullExpression(node, context) {
      if (
        !context.checker.utils.isNullableType(
          context.checker.getTypeAtLocation(node.expression),
        )
      ) {
        context.report(node, "Unnecessary non-null assertion.");
      }
    },
  },
});
