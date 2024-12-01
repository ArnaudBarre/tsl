import { isTypeFlagSet, unionTypeParts } from "ts-api-utils";
import ts from "typescript";
import { createRule } from "../../public-utils.ts";

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
        unionTypeParts(type).every((t) => context.checker.isArrayType(t)) ||
        isTypeFlagSet(type, ts.TypeFlags.StringLike)
      ) {
        context.report({
          node: node.expression,
          message: messages.forInViolation,
        });
      }
    },
  },
}));
