import ts, { SyntaxKind } from "typescript";
import { defineRule } from "../_utils/index.ts";
import type { Context, Suggestion } from "../../types.ts";

export const messages = {
  preferTypeParameter:
    "Unnecessary assertion: Array#reduce accepts a type parameter for the default value.",
  fix: "Replace with a type parameter.",
};

export const preferReduceTypeParameter = defineRule(() => ({
  name: "core/preferReduceTypeParameter",
  visitor: {
    CallExpression(context, node) {
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
      if (!isArrayType(context, calleeObjType)) return;

      const initializerType = context.checker.getTypeAtLocation(
        secondArg.expression,
      );

      const assertedType = context.checker.getTypeAtLocation(secondArg.type);

      const isAssertionNecessary = !context.checker.isTypeAssignableTo(
        initializerType,
        assertedType,
      );

      // don't report this if the resulting fix will be a type error
      if (isAssertionNecessary) {
        return;
      }

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

function isArrayType(context: Context, type: ts.Type): boolean {
  return context.utils
    .unionConstituents(type)
    .every((unionPart) =>
      context.utils
        .intersectionConstituents(unionPart)
        .every(
          (t) =>
            context.checker.isArrayType(t) || context.checker.isTupleType(t),
        ),
    );
}
