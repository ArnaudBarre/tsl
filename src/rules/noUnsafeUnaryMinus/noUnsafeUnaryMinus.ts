import { isTypeFlagSet, unionConstituents } from "ts-api-utils";
import { SyntaxKind, TypeFlags } from "typescript";
import { defineRule } from "../_utils/index.ts";

export const messages = {
  unaryMinus: (params: { type: string }) =>
    `Argument of unary negation should be assignable to number | bigint but is ${params.type} instead.`,
};

export function noUnsafeUnaryMinus() {
  return defineRule({
    name: "core/noUnsafeUnaryMinus",
    visitor: {
      PrefixUnaryExpression(node, context) {
        if (node.operator !== SyntaxKind.MinusToken) {
          return;
        }
        const argType = context.utils.getConstrainedTypeAtLocation(
          node.operand,
        );
        if (
          unionConstituents(argType).some(
            (type) =>
              !isTypeFlagSet(
                type,
                TypeFlags.Any
                  | TypeFlags.Never
                  | TypeFlags.BigIntLike
                  | TypeFlags.NumberLike,
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
  });
}
