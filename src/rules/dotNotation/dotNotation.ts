import { SyntaxKind } from "typescript";
import { createRule } from "../../index.ts";

const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/u;

export const dotNotation = createRule(() => ({
  name: "core/dotNotation",
  visitor: {
    ElementAccessExpression(node, context) {
      if (
        node.argumentExpression.kind === SyntaxKind.StringLiteral
        || node.argumentExpression.kind
          === SyntaxKind.NoSubstitutionTemplateLiteral
      ) {
        if (!validIdentifier.test(node.argumentExpression.text)) {
          return;
        }
        const property = node.argumentExpression.text;
        if (
          context.compilerOptions.noPropertyAccessFromIndexSignature
          && !context.checker
            .getTypeAtLocation(node.expression)
            .getNonNullableType()
            .getApparentProperties()
            .some((p) => p.name === property)
        ) {
          // Using brackets for index signature
          return;
        }
        context.report({
          node: node.argumentExpression,
          message: `['${node.argumentExpression.text}'] is better written in dot notation.`,
        });
      }
    },
  },
}));
