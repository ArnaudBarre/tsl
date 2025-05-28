import { unionConstituents } from "ts-api-utils";
import { TypeFlags } from "typescript";
import { createRule } from "../../index.ts";

export const messages = {
  meaninglessVoidOperator: (params: { type: string }) =>
    `void operator shouldn't be used on ${params.type}; it should convey that a return value is being ignored`,
  removeVoid: "Remove 'void'",
};

export type NoMeaninglessVoidOperatorOptions = {
  /**
   * Whether to suggest removing `void` when the argument has type `never`.
   * @default false
   */
  checkNever?: boolean;
};

export const noMeaninglessVoidOperator = createRule(
  (options?: NoMeaninglessVoidOperatorOptions) => ({
    name: "core/noMeaninglessVoidOperator",
    visitor: {
      VoidExpression(node, context) {
        const argType = context.checker.getTypeAtLocation(node.expression);
        const unionParts = unionConstituents(argType);
        const checkFlags = options?.checkNever
          ? TypeFlags.Void | TypeFlags.Undefined | TypeFlags.Never
          : TypeFlags.Void | TypeFlags.Undefined;
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
