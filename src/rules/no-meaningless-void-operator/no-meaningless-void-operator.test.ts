import { ruleTester } from "../../ruleTester.ts";
import {
  messages,
  noMeaninglessVoidOperator,
} from "./no-meaningless-void-operator.ts";

export const test = () =>
  ruleTester({
    ruleFn: noMeaninglessVoidOperator,
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
