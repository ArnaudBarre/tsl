import { intersectionTypeParts, unionTypeParts } from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import { createRule } from "../../public-utils.ts";
import type { Context, Suggestion } from "../../types.ts";

export const messages = {
  preferTypeParameter:
    "Unnecessary cast: Array#reduce accepts a type parameter for the default value.",
  fix: "Replace with a type parameter.",
};

export const preferReduceTypeParameter = createRule(() => ({
  name: "core/preferReduceTypeParameter",
  visitor: {
    CallExpression(node, context) {
      const callee = node.expression;

      if (callee.kind !== SyntaxKind.PropertyAccessExpression) return;
      if (callee.name.text !== "reduce") return;

      const secondArg = node.arguments.at(1);
      if (!secondArg) return;

      const isAs = secondArg.kind === SyntaxKind.AsExpression;
      const isCast = secondArg.kind === SyntaxKind.TypeAssertionExpression;
      if (!isAs && !isCast) return;

      const calleeObjType = context.utils.getConstrainedTypeAtLocation(
        callee.expression,
      );
      if (!isArrayType(calleeObjType, context)) return;

      context.report({
        node: secondArg,
        message: messages.preferTypeParameter,
        suggestions: () => {
          const changes: Suggestion["changes"] = [];
          if (isAs) {
            changes.push({
              start: secondArg.expression.getEnd(),
              end: secondArg.getEnd(),
              newText: "",
            });
          } else if (isCast) {
            changes.push({
              start: secondArg.getStart(),
              end: secondArg.expression.getStart(),
              newText: "",
            });
          }
          if (!node.typeArguments) {
            changes.push({
              start: callee.getEnd(),
              length: 0,
              newText: `<${secondArg.type.getText()}>`,
            });
          }
          return [{ message: messages.fix, changes }];
        },
      });
    },
  },
}));

function isArrayType(type: ts.Type, context: Context): boolean {
  return unionTypeParts(type).every((unionPart) =>
    intersectionTypeParts(unionPart).every(
      (t) => context.checker.isArrayType(t) || context.checker.isTupleType(t),
    ),
  );
}
