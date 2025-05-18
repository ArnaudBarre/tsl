import { isTypeFlagSet } from "ts-api-utils";
import ts from "typescript";
import { isTypeRecurser } from "../_utils/index.ts";
import { createRule } from "../../index.ts";
import type { Checker } from "../../types.ts";

export const messages = {
  forInViolation:
    "For-in loops over arrays skips holes, returns indices as strings, and may visit the prototype chain or other enumerable properties. Use a more robust iteration method such as for-of or array.forEach instead.",
};

export const noForInArray = createRule(() => ({
  name: "core/noForInArray",
  visitor: {
    ForInStatement(node, context) {
      const type = context.utils.getConstrainedTypeAtLocation(node.expression);
      if (
        isTypeRecurser(
          type,
          (t) =>
            t.getNumberIndexType() != null
            && hasArrayishLength(context.checker, t),
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

function hasArrayishLength(checker: Checker, type: ts.Type): boolean {
  const lengthProperty = type.getProperty("length");

  if (lengthProperty == null) return false;

  return isTypeFlagSet(
    checker.getTypeOfSymbol(lengthProperty),
    ts.TypeFlags.NumberLike,
  );
}
