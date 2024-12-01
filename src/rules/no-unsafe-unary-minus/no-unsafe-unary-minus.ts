import { isTypeFlagSet, unionTypeParts } from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import { createRule } from "../../public-utils.ts";

export const messages = {
  unaryMinus: (params: { type: string }) =>
    `Argument of unary negation should be assignable to number | bigint but is ${params.type} instead.`,
};

export const noUnsafeUnaryMinus = createRule(() => ({
  name: "core/noUnsafeUnaryMinus",
  visitor: {
    PrefixUnaryExpression(node, context) {
      if (node.operator !== SyntaxKind.MinusToken) {
        return;
      }
      const argType = context.utils.getConstrainedTypeAtLocation(node.operand);
      if (
        unionTypeParts(argType).some(
          (type) =>
            !isTypeFlagSet(
              type,
              ts.TypeFlags.Any |
                ts.TypeFlags.Never |
                ts.TypeFlags.BigIntLike |
                ts.TypeFlags.NumberLike,
            ),
        )
      ) {
        context.report({
          message: messages.unaryMinus({
            type: context.checker.typeToString(argType),
          }),
          node,
        });
      }
    },
  },
}));
