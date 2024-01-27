import { TypeFlags } from "typescript";
import { createRule } from "../public-utils.ts";
import { typeHasFlag } from "../types-utils.ts";

export const noUnnecessaryNonNullExpression = createRule({
  name: "no-unnecessary-non-null-expression",
  visitor: {
    NonNullExpression(node, context) {
      if (
        !typeHasFlag(
          context.checker.getTypeAtLocation(node.expression),
          TypeFlags.Null | TypeFlags.Undefined,
        )
      ) {
        context.report({ node, message: "Unnecessary non-null assertion." });
      }
    },
  },
});
