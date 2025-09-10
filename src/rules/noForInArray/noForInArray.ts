import ts, { TypeFlags } from "typescript";
import { defineRule, isTypeRecurser } from "../_utils/index.ts";
import type { Context } from "../../types.ts";

export const messages = {
  forInViolation:
    "For-in loops over arrays skips holes, returns indices as strings, and may visit the prototype chain or other enumerable properties. Use a more robust iteration method such as for-of or array.forEach instead.",
};

// https://typescript-eslint.io/rules/no-for-in-array
export const noForInArray = defineRule(() => ({
  name: "core/noForInArray",
  visitor: {
    ForInStatement(context, node) {
      const type = context.utils.getConstrainedTypeAtLocation(node.expression);
      if (
        isTypeRecurser(
          type,
          (t) =>
            t.getNumberIndexType() != null && hasArrayishLength(context, t),
        )
      ) {
        context.report({
          node: node.expression,
          message: messages.forInViolation,
        });
      }
    },
  },
}));

function hasArrayishLength(context: Context, type: ts.Type): boolean {
  const lengthProperty = type.getProperty("length");

  if (lengthProperty == null) return false;

  return context.utils.typeHasFlag(
    context.checker.getTypeOfSymbol(lengthProperty),
    TypeFlags.NumberLike,
  );
}
