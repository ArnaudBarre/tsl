import ts from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";

const messages = {
  meaninglessVoidOperator: (params: { type: string }) =>
    `void operator shouldn't be used on ${params.type}; it should convey that a return value is being ignored`,
  removeVoid: "Remove 'void'",
};

export const noMeaninglessVoidOperator = createRule({
  name: "no-meaningless-void-operator",
  parseOptions: (options?: { checkNever: boolean }) => ({
    checkNever: options?.checkNever ?? false,
  }),
  visitor: {
    VoidExpression(node, context) {
      const argType = context.checker.getTypeAtLocation(node.expression);
      const unionParts = context.utils.unionTypeParts(argType);
      if (
        unionParts.every(
          (part) => part.flags & (ts.TypeFlags.Void | ts.TypeFlags.Undefined),
        )
      ) {
        context.report({
          node,
          message: messages.meaninglessVoidOperator({
            type: context.checker.typeToString(argType),
          }),
        });
      } else if (
        context.options.checkNever &&
        unionParts.every(
          (part) =>
            part.flags &
            (ts.TypeFlags.Void | ts.TypeFlags.Undefined | ts.TypeFlags.Never),
        )
      ) {
        context.report({
          node,
          message: messages.meaninglessVoidOperator({
            type: context.checker.typeToString(argType),
          }),
        });
      }
    },
  },
});

export const test = () =>
  ruleTester({
    rule: noMeaninglessVoidOperator,
    valid: [
      `
(() => {})();

function foo() {}
foo(); // nothing to discard

function bar(x: number) {
  void x;
  return 2;
}
void bar(); // discarding a number
    `,
      `
function bar(x: never) {
  void x;
}
    `,
    ],

    invalid: [
      {
        code: "void (() => {})();",

        errors: [
          {
            message: messages.meaninglessVoidOperator({ type: "void" }),
            line: 1,
            column: 1,
          },
        ],
      },
      {
        code: `
function foo() {}
void foo();
      `,

        errors: [
          {
            message: messages.meaninglessVoidOperator({ type: "void" }),
            line: 3,
            column: 1,
          },
        ],
      },
      {
        options: { checkNever: true },
        code: `
function bar(x: never) {
  void x;
}
      `,
        errors: [
          {
            message: messages.meaninglessVoidOperator({ type: "never" }),
            line: 3,
            column: 3,
          },
        ],
      },
    ],
  });
