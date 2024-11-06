import { unionTypeParts } from "ts-api-utils";
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
      const unionParts = unionTypeParts(argType);
      const checkFlags = context.options.checkNever
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
            suggestions: [
              { message: messages.removeVoid, output: "(() => {})();" },
            ],
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
            suggestions: [
              {
                message: messages.removeVoid,
                output: `
function foo() {}
foo();
      `,
              },
            ],
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
            suggestions: [
              {
                message: messages.removeVoid,
                output: `
function bar(x: never) {
  x;
}
      `,
              },
            ],
          },
        ],
      },
    ],
  });
