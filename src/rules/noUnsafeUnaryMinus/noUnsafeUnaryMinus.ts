import { SyntaxKind, TypeFlags } from "typescript";
import { defineRule, typeHasFlag } from "../_utils/index.ts";

export const messages = {
  unaryMinus: (params: { type: string }) =>
    `Argument of unary negation should be assignable to number | bigint but is ${params.type} instead.`,
};

export const noUnsafeUnaryMinus = defineRule(() => ({
  name: "core/noUnsafeUnaryMinus",
  visitor: {
    PrefixUnaryExpression(context, node) {
      if (node.operator !== SyntaxKind.MinusToken) {
        return;
      }
      const argType = context.utils.getConstrainedTypeAtLocation(node.operand);
      if (
        context.utils
          .unionConstituents(argType)
          .some(
            (type) =>
              !typeHasFlag(
                type,
                TypeFlags.Any
                  | TypeFlags.Never
                  | TypeFlags.BigIntLike
                  | TypeFlags.NumberLike,
              ),
          )
      ) {
        context.report({
          node,
          message: messages.unaryMinus({
            type: context.checker.typeToString(argType),
          }),
        });
      }
    },
  },
}));
