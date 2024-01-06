import { createRule } from "../public-utils.ts";

export const noUnnecessaryNonNullExpression = createRule({
  name: "no-unnecessary-non-null-expression",
  visitor: {
    NonNullExpression(node, context) {
      if (
        !context.utils.isNullableType(
          context.checker.getTypeAtLocation(node.expression),
        )
      ) {
        context.report({ node, message: "Unnecessary non-null assertion." });
      }
    },
  },
});
