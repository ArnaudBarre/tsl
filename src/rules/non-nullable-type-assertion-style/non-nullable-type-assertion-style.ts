import { isTypeFlagSet } from "ts-api-utils";
import { SyntaxKind, TypeFlags } from "typescript";
import { isConstAssertion, typeHasFlag } from "../_utils";
import { createRule } from "../../index.ts";
import type { AST, Context } from "../../types.ts";

export const messages = {
  preferNonNullAssertion:
    "Use a ! assertion to more succinctly remove null and undefined from the type.",
  fix: "Fix",
};

export const nonNullableTypeAssertionStyle = createRule(() => ({
  name: "core/nonNullableTypeAssertionStyle",
  visitor: {
    AsExpression(node, context) {
      if (isConstAssertion(node.type)) return;
      checkAssertion(node, context);
    },
    TypeAssertionExpression(node, context) {
      checkAssertion(node, context);
    },
  },
}));

const checkAssertion = (
  node: AST.AsExpression | AST.TypeAssertion,
  context: Context,
) => {
  const originalType = context.checker.getTypeAtLocation(node.expression);
  if (!typeHasFlag(originalType, TypeFlags.Undefined | TypeFlags.Null)) {
    return;
  }
  const assertedType = context.checker.getTypeAtLocation(node.type);
  if (isTypeFlagSet(assertedType, TypeFlags.Any | TypeFlags.Unknown)) {
    return;
  }

  if (
    context.checker.isTypeAssignableTo(
      originalType.getNonNullableType(),
      assertedType,
    ) &&
    context.checker.isTypeAssignableTo(
      assertedType,
      originalType.getNonNullableType(),
    )
  ) {
    context.report({
      message: messages.preferNonNullAssertion,
      node,
      suggestions: [
        {
          message: messages.fix,
          changes:
            node.kind === SyntaxKind.AsExpression
              ? [
                  {
                    start: node.type.getFullStart() - 3, // " as"
                    end: node.getEnd(),
                    newText: "!",
                  },
                ]
              : [
                  {
                    start: node.getStart(),
                    end: node.expression.getFullStart(),
                    newText: "",
                  },
                  {
                    start: node.expression.getEnd(),
                    length: 0,
                    newText: "!",
                  },
                ],
        },
      ],
    });
  }
};
