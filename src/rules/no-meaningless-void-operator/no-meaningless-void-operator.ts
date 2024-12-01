import { unionTypeParts } from "ts-api-utils";
import ts from "typescript";
import { createRule } from "../../public-utils.ts";

export const messages = {
  meaninglessVoidOperator: (params: { type: string }) =>
    `void operator shouldn't be used on ${params.type}; it should convey that a return value is being ignored`,
  removeVoid: "Remove 'void'",
};

export const noMeaninglessVoidOperator = createRule(
  (options?: { checkNever: boolean }) => ({
    name: "core/noMeaninglessVoidOperator",
    visitor: {
      VoidExpression(node, context) {
        const argType = context.checker.getTypeAtLocation(node.expression);
        const unionParts = unionTypeParts(argType);
        const checkFlags = options?.checkNever
          ? ts.TypeFlags.Void | ts.TypeFlags.Undefined | ts.TypeFlags.Never
          : ts.TypeFlags.Void | ts.TypeFlags.Undefined;
        if (unionParts.every((part) => part.flags & checkFlags)) {
          context.report({
            node,
            message: messages.meaninglessVoidOperator({
              type: context.checker.typeToString(argType),
            }),
            suggestions: [
              {
                message: messages.removeVoid,
                changes: [
                  {
                    start: node.getStart(),
                    end: node.expression.getStart(),
                    newText: "",
                  },
                ],
              },
            ],
          });
        }
      },
    },
  }),
);
