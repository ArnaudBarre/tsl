import { createRule, isNullableType } from "../utils.ts";

export default createRule({
  name: "no-unnecessary-non-null-expression",
  visitor: {
    NonNullExpression(node, context) {
      if (
        !isNullableType(context.typeChecker.getTypeAtLocation(node.expression))
      ) {
        context.report(node, "Unnecessary non-null assertion.");
      }
    },
  },
});
