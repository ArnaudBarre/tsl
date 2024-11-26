import { SyntaxKind } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Context, Suggestion } from "../types.ts";
import { compareNodes } from "./utils/compareNodes.ts";
import { getTypeName, isLiteralKind } from "./utils/index.ts";

const messages = {
  preferStartsWith: "Use 'String#startsWith' instead.",
  preferEndsWith: "Use 'String#endsWith' instead.",
  replaceStartsWith: "Replace with 'String#startsWith'.",
  replaceEndsWith: "Replace with 'String#endsWith'.",
};

/**
// starts with
foo[0] === 'b'
foo.charAt(0) === 'b'
foo.indexOf('bar') === 0
foo.slice(0, 3) === 'bar'
foo.substring(0, 3) === 'bar'
foo.match(/^bar/) != null
/^bar/.test(foo)

// ends with
foo[foo.length - 1] === 'b'
foo.charAt(foo.length - 1) === 'b'
foo.lastIndexOf('bar') === foo.length - 3
foo.slice(-3) === 'bar'
foo.substring(foo.length - 3) === 'bar'
foo.match(/bar$/) != null
/bar$/.test(foo)
*/

export const preferStringStartsEndsWith = createRule(
  (_options?: { allowSingleElementEquality?: "always" | "never" }) => {
    const options = {
      allowSingleElementEquality: "never",
      ..._options,
    };

    return {
      name: "core/preferStringStartsEndsWith",
      visitor: {
        BinaryExpression(node, context) {
          const isEqualityComparison =
            node.operatorToken.kind === SyntaxKind.EqualsEqualsToken ||
            node.operatorToken.kind === SyntaxKind.EqualsEqualsEqualsToken;
          const isInequalityComparison =
            node.operatorToken.kind === SyntaxKind.ExclamationEqualsToken ||
            node.operatorToken.kind === SyntaxKind.ExclamationEqualsEqualsToken;

          if (!isEqualityComparison && !isInequalityComparison) return;

          const leftIsPropertyCallExpression =
            node.left.kind === SyntaxKind.CallExpression &&
            node.left.expression.kind === SyntaxKind.PropertyAccessExpression &&
            node.left.expression.name.kind === SyntaxKind.Identifier;

          // foo[0] === 'b'
          if (
            options.allowSingleElementEquality === "never" &&
            node.left.kind === SyntaxKind.ElementAccessExpression &&
            node.left.argumentExpression.kind === SyntaxKind.NumericLiteral &&
            node.left.argumentExpression.text === "0" &&
            node.right.kind === SyntaxKind.StringLiteral &&
            isTypeString(context, node.left.expression)
          ) {
            if (node.left.questionDotToken) {
              reportStartsWith(context, node, isInequalityComparison, [
                {
                  start: node.left.questionDotToken.getEnd(),
                  end: node.getEnd(),
                  newText: `startsWith(${node.right.getText()})`,
                },
              ]);
            } else {
              reportStartsWith(context, node, isInequalityComparison, [
                {
                  start: node.left.expression.getEnd(),
                  end: node.getEnd(),
                  newText: `.startsWith(${node.right.getText()})`,
                },
              ]);
            }
          }

          // foo[foo.length - 1] === 'b'
          if (
            options.allowSingleElementEquality === "never" &&
            node.right.kind === SyntaxKind.StringLiteral &&
            node.left.kind === SyntaxKind.ElementAccessExpression &&
            isLengthMinusNumberExpression(
              node.left.argumentExpression,
              node.left.expression,
              1,
            ) &&
            isTypeString(context, node.left.expression)
          ) {
            if (node.left.questionDotToken) {
              reportEndsWith(context, node, isInequalityComparison, [
                {
                  start: node.left.questionDotToken.getEnd(),
                  end: node.getEnd(),
                  newText: `endsWith(${node.right.getText()})`,
                },
              ]);
            } else {
              reportEndsWith(context, node, isInequalityComparison, [
                {
                  start: node.left.expression.getEnd(),
                  end: node.getEnd(),
                  newText: `.endsWith(${node.right.getText()})`,
                },
              ]);
            }
          }

          // foo.charAt(0) === 'b'
          if (
            node.right.kind === SyntaxKind.StringLiteral &&
            leftIsPropertyCallExpression &&
            node.left.expression.name.text === "charAt" &&
            node.left.arguments.length === 1 &&
            node.left.arguments[0].kind === SyntaxKind.NumericLiteral &&
            node.left.arguments[0].text === "0" &&
            isTypeString(context, node.left.expression.expression)
          ) {
            reportStartsWith(context, node, isInequalityComparison, [
              {
                start: node.left.expression.name.getStart(),
                end: node.getEnd(),
                newText: `startsWith(${node.right.getText()})`,
              },
            ]);
          }

          // foo.charAt(foo.length - 1) === 'b'
          if (
            node.right.kind === SyntaxKind.StringLiteral &&
            leftIsPropertyCallExpression &&
            node.left.expression.name.text === "charAt" &&
            node.left.arguments.length === 1 &&
            isLengthMinusNumberExpression(
              node.left.arguments[0],
              node.left.expression.expression,
              1,
            ) &&
            isTypeString(context, node.left.expression.expression)
          ) {
            reportEndsWith(context, node, isInequalityComparison, [
              {
                start: node.left.expression.name.getStart(),
                end: node.getEnd(),
                newText: `endsWith(${node.right.getText()})`,
              },
            ]);
          }

          // foo.indexOf('bar') === 0
          if (
            leftIsPropertyCallExpression &&
            node.left.expression.name.text === "indexOf" &&
            node.left.arguments.length === 1 &&
            node.right.kind === SyntaxKind.NumericLiteral &&
            node.right.text === "0" &&
            isTypeString(context, node.left.expression.expression)
          ) {
            reportStartsWith(context, node, isInequalityComparison, [
              {
                start: node.left.expression.name.getStart(),
                end: node.getEnd(),
                newText: `startsWith(${node.left.arguments[0].getText()})`,
              },
            ]);
          }

          // foo.lastIndexOf('bar') === foo.length - 3
          // foo.lastIndexOf(needle) === foo.length - needle.length
          if (
            leftIsPropertyCallExpression &&
            node.left.expression.name.text === "lastIndexOf" &&
            node.left.arguments.length === 1 &&
            isTypeString(context, node.left.expression.expression)
          ) {
            const argument = node.left.arguments[0];
            if (
              // foo.length - 3
              (argument.kind === SyntaxKind.StringLiteral &&
                isLengthMinusNumberExpression(
                  node.right,
                  node.left.expression.expression,
                  argument.text.length,
                )) ||
              // foo.length - needle.length;
              isLengthMinusXExpression(
                node.right,
                node.left.expression.expression,
                (right) =>
                  right.kind === SyntaxKind.PropertyAccessExpression &&
                  right.name.kind === SyntaxKind.Identifier &&
                  right.name.text === "length" &&
                  compareNodes(right.expression, argument) === "Equal",
              )
            ) {
              reportEndsWith(context, node, isInequalityComparison, [
                {
                  start: node.left.expression.name.getStart(),
                  end: node.getEnd(),
                  newText: `endsWith(${node.left.arguments[0].getText()})`,
                },
              ]);
            }
          }

          // foo.slice(0, 3) === 'bar'
          // foo.substring(0, 3) === 'bar'
          // foo.slice(0, needle.length) === needle
          // foo.substring(0, needle.length) === needle
          if (
            leftIsPropertyCallExpression &&
            (node.left.expression.name.text === "slice" ||
              node.left.expression.name.text === "substring") &&
            node.left.arguments.length === 2 &&
            node.left.arguments[0].kind === SyntaxKind.NumericLiteral &&
            node.left.arguments[0].text === "0" &&
            isTypeString(context, node.left.expression.expression)
          ) {
            const secondArgument = node.left.arguments[1];
            if (
              (node.right.kind === SyntaxKind.StringLiteral &&
                secondArgument.kind === SyntaxKind.NumericLiteral &&
                node.right.text.length === Number(secondArgument.text)) ||
              (secondArgument.kind === SyntaxKind.PropertyAccessExpression &&
                secondArgument.name.kind === SyntaxKind.Identifier &&
                secondArgument.name.text === "length" &&
                compareNodes(secondArgument.expression, node.right) === "Equal")
            ) {
              reportStartsWith(context, node, isInequalityComparison, [
                {
                  start: node.left.expression.name.getStart(),
                  end: node.getEnd(),
                  newText: `startsWith(${node.right.getText()})`,
                },
              ]);
            }
          }

          // foo.slice(-3) === 'bar'
          // foo.substring(-3) === 'bar'
          // foo.slice(-needle.length) === needle
          if (
            leftIsPropertyCallExpression &&
            (node.left.expression.name.text === "slice" ||
              node.left.expression.name.text === "substring") &&
            node.left.arguments.length === 1 &&
            node.left.arguments[0].kind === SyntaxKind.PrefixUnaryExpression &&
            node.left.arguments[0].operator === SyntaxKind.MinusToken &&
            isTypeString(context, node.left.expression.expression)
          ) {
            const operand = node.left.arguments[0].operand;
            if (
              (node.right.kind === SyntaxKind.StringLiteral &&
                operand.kind === SyntaxKind.NumericLiteral &&
                node.right.text.length === Number(operand.text)) ||
              (operand.kind === SyntaxKind.PropertyAccessExpression &&
                operand.name.kind === SyntaxKind.Identifier &&
                operand.name.text === "length" &&
                compareNodes(operand.expression, node.right) === "Equal")
            ) {
              reportEndsWith(context, node, isInequalityComparison, [
                {
                  start: node.left.expression.name.getStart(),
                  end: node.getEnd(),
                  newText: `endsWith(${node.right.getText()})`,
                },
              ]);
            }
          }

          // foo.slice(foo.length - needle.length) === needle
          if (
            leftIsPropertyCallExpression &&
            node.left.expression.name.text === "slice" &&
            node.left.arguments.length === 1 &&
            isLengthMinusXExpression(
              node.left.arguments[0],
              node.left.expression.expression,
              (right) =>
                right.kind === SyntaxKind.PropertyAccessExpression &&
                right.name.kind === SyntaxKind.Identifier &&
                right.name.text === "length" &&
                compareNodes(right.expression, node.right) === "Equal",
            ) &&
            isTypeString(context, node.left.expression.expression)
          ) {
            reportEndsWith(context, node, isInequalityComparison, [
              {
                start: node.left.expression.name.getStart(),
                end: node.getEnd(),
                newText: `endsWith(${node.right.getText()})`,
              },
            ]);
          }

          // foo.substring(foo.length - 3) === 'bar';
          // foo.substring(foo.length - 3, s.length) === 'bar';
          if (
            node.right.kind === SyntaxKind.StringLiteral &&
            leftIsPropertyCallExpression &&
            node.left.expression.name.text === "substring" &&
            (node.left.arguments.length === 1 ||
              (node.left.arguments.length === 2 &&
                node.left.arguments[1].kind ===
                  SyntaxKind.PropertyAccessExpression &&
                node.left.arguments[1].name.kind === SyntaxKind.Identifier &&
                node.left.arguments[1].name.text === "length" &&
                compareNodes(
                  node.left.arguments[1].expression,
                  node.left.expression.expression,
                ) === "Equal")) &&
            isLengthMinusNumberExpression(
              node.left.arguments[0],
              node.left.expression.expression,
              node.right.text.length,
            ) &&
            isTypeString(context, node.left.expression.expression)
          ) {
            reportEndsWith(context, node, isInequalityComparison, [
              {
                start: node.left.expression.name.getStart(),
                end: node.getEnd(),
                newText: `endsWith(${node.right.getText()})`,
              },
            ]);
          }

          // foo.match(/^bar/) != null;
          // foo.match(/bar$/) != null;
          if (
            leftIsPropertyCallExpression &&
            node.left.expression.name.text === "match" &&
            node.left.arguments.length === 1 &&
            node.left.arguments[0].kind ===
              SyntaxKind.RegularExpressionLiteral &&
            node.right.kind === SyntaxKind.NullKeyword &&
            isTypeString(context, node.left.expression.expression)
          ) {
            const regex = node.left.arguments[0].text.slice(1, -1);
            if (/^\^[\w]+$/.test(regex)) {
              reportStartsWith(context, node, isEqualityComparison, [
                {
                  start: node.left.expression.name.getStart(),
                  end: node.getEnd(),
                  newText: `startsWith("${regex.slice(1)}")`,
                },
              ]);
            } else if (/^[\w]+\$$/.test(regex)) {
              reportEndsWith(context, node, isEqualityComparison, [
                {
                  start: node.left.expression.name.getStart(),
                  end: node.getEnd(),
                  newText: `endsWith("${regex.slice(0, -1)}")`,
                },
              ]);
            }
          }
        },
        CallExpression(node, context) {
          // /^bar/.test(foo)
          // /bar$/.test(foo)
          if (
            node.expression.kind === SyntaxKind.PropertyAccessExpression &&
            node.expression.name.text === "test" &&
            node.arguments.length === 1 &&
            node.expression.expression.kind ===
              SyntaxKind.RegularExpressionLiteral
          ) {
            const argument = node.arguments[0];
            const regex = node.expression.expression.text.slice(1, -1);

            const isStartsWith = /^\^[\w]+$/.test(regex);
            const isEndsWith = /^[\w]+\$$/.test(regex);
            if (!isStartsWith && !isEndsWith) return;

            const needsParen =
              !isLiteralKind(argument.kind) &&
              argument.kind !== SyntaxKind.TemplateExpression &&
              argument.kind !== SyntaxKind.Identifier &&
              argument.kind !== SyntaxKind.PropertyAccessExpression &&
              argument.kind !== SyntaxKind.CallExpression;

            const maybeStartParen = needsParen ? "(" : "";
            const maybeEndParen = needsParen ? ")" : "";

            if (isStartsWith) {
              reportStartsWith(context, node, false, [
                {
                  start: node.getStart(),
                  end: node.arguments[0].getStart(),
                  newText: maybeStartParen,
                },
                {
                  start: node.arguments[0].getEnd(),
                  end: node.getEnd(),
                  newText: `${maybeEndParen}.startsWith("${regex.slice(1)}")`,
                },
              ]);
            } else if (isEndsWith) {
              reportEndsWith(context, node, false, [
                {
                  start: node.getStart(),
                  end: node.arguments[0].getStart(),
                  newText: maybeStartParen,
                },
                {
                  start: node.arguments[0].getEnd(),
                  end: node.getEnd(),
                  newText: `${maybeEndParen}.endsWith("${regex.slice(0, -1)}")`,
                },
              ]);
            }
          }
        },
      },
    };
  },
);

function isTypeString(context: Context, expression: AST.Expression): boolean {
  return (
    getTypeName(
      context.rawChecker,
      context.utils.getConstrainedTypeAtLocation(expression),
    ) === "string"
  );
}

function isLengthMinusNumberExpression(
  node: AST.Expression,
  expectedObjectNode: AST.Expression,
  value: number,
): boolean {
  return isLengthMinusXExpression(
    node,
    expectedObjectNode,
    (right) =>
      right.kind === SyntaxKind.NumericLiteral &&
      right.text === value.toString(),
  );
}

function isLengthMinusXExpression(
  node: AST.Expression,
  expectedObjectNode: AST.Expression,
  matchRight: (node: AST.Expression) => boolean,
): boolean {
  return (
    node.kind === SyntaxKind.BinaryExpression &&
    node.operatorToken.kind === SyntaxKind.MinusToken &&
    matchRight(node.right) &&
    node.left.kind === SyntaxKind.PropertyAccessExpression &&
    node.left.name.kind === SyntaxKind.Identifier &&
    node.left.name.text === "length" &&
    compareNodes(node.left.expression, expectedObjectNode) === "Equal"
  );
}

const reportStartsWith = (
  context: Context,
  node: AST.AnyNode,
  isNagative: boolean,
  changes: Suggestion["changes"],
) => {
  if (isNagative) {
    changes.unshift({
      start: node.getStart(),
      length: 0,
      newText: "!",
    });
  }
  context.report({
    node,
    message: messages.preferStartsWith,
    suggestions: [{ message: messages.replaceStartsWith, changes }],
  });
};
const reportEndsWith = (
  context: Context,
  node: AST.AnyNode,
  isNagative: boolean,
  changes: Suggestion["changes"],
) => {
  if (isNagative) {
    changes.unshift({
      start: node.getStart(),
      length: 0,
      newText: "!",
    });
  }
  context.report({
    node,
    message: messages.preferEndsWith,
    suggestions: [{ message: messages.replaceEndsWith, changes }],
  });
};

export const test = () =>
  ruleTester({
    ruleFn: preferStringStartsEndsWith,
    valid: [
      `
      function f(s: string[]) {
        s[0] === 'a';
      }
    `,
      `
      function f(s: string[] | null) {
        s?.[0] === 'a';
      }
    `,
      `
      function f(s: string[] | undefined) {
        s?.[0] === 'a';
      }
    `,
      `
      function f(s: string) {
        s[0] + 'a';
      }
    `,
      `
      function f(s: string) {
        s[1] === 'a';
      }
    `,
      `
      function f(s: string | undefined) {
        s?.[1] === 'a';
      }
    `,
      `
      function f(s: string | string[]) {
        s[0] === 'a';
      }
    `,
      `
      function f(s: any) {
        s[0] === 'a';
      }
    `,
      `
      function f<T>(s: T) {
        s[0] === 'a';
      }
    `,
      `
      function f(s: string[]) {
        s[s.length - 1] === 'a';
      }
    `,
      `
      function f(s: string[] | undefined) {
        s?.[s.length - 1] === 'a';
      }
    `,
      `
      function f(s: string) {
        s[s.length - 2] === 'a';
      }
    `,
      `
      function f(s: string | undefined) {
        s?.[s.length - 2] === 'a';
      }
    `,
      `
      function f(s: string[]) {
        s.charAt(0) === 'a';
      }
    `,
      `
      function f(s: string[] | undefined) {
        s?.charAt(0) === 'a';
      }
    `,
      `
      function f(s: string) {
        s.charAt(0) + 'a';
      }
    `,
      `
      function f(s: string) {
        s.charAt(1) === 'a';
      }
    `,
      `
      function f(s: string | undefined) {
        s?.charAt(1) === 'a';
      }
    `,
      `
      function f(s: string) {
        s.charAt() === 'a';
      }
    `,
      `
      function f(s: string[]) {
        s.charAt(s.length - 1) === 'a';
      }
    `,
      `
      function f(a: string, b: string, c: string) {
        (a + b).charAt((a + c).length - 1) === 'a';
      }
    `,
      `
      function f(a: string, b: string, c: string) {
        (a + b).charAt(c.length - 1) === 'a';
      }
    `,
      `
      function f(s: string[]) {
        s.indexOf(needle) === 0;
      }
    `,
      `
      function f(s: string | string[]) {
        s.indexOf(needle) === 0;
      }
    `,
      `
      function f(s: string) {
        s.indexOf(needle) === s.length - needle.length;
      }
    `,
      `
      function f(s: string[]) {
        s.lastIndexOf(needle) === s.length - needle.length;
      }
    `,
      `
      function f(s: string) {
        s.lastIndexOf(needle) === 0;
      }
    `,
      `
      function f(s: string) {
        s.match(/^foo/);
      }
    `,
      `
      function f(s: string) {
        s.match(/foo$/);
      }
    `,
      `
      function f(s: string) {
        s.match(/^foo/) + 1;
      }
    `,
      `
      function f(s: string) {
        s.match(/foo$/) + 1;
      }
    `,
      `
      function f(s: { match(x: any): boolean }) {
        s.match(/^foo/) !== null;
      }
    `,
      `
      function f(s: { match(x: any): boolean }) {
        s.match(/foo$/) !== null;
      }
    `,
      `
      function f(s: string) {
        s.match(/foo/) !== null;
      }
    `,
      `
      function f(s: string) {
        s.match(/^foo$/) !== null;
      }
    `,
      `
      function f(s: string) {
        s.match(/^foo./) !== null;
      }
    `,
      `
      function f(s: string) {
        s.match(/^foo|bar/) !== null;
      }
    `,
      `
      function f(s: string) {
        s.match(new RegExp('')) !== null;
      }
    `,
      `
      function f(s: string) {
        s.match(pattern) !== null; // cannot check '^'/'$'
      }
    `,
      `
      function f(s: string) {
        s.match(new RegExp('^/!{[', 'u')) !== null; // has syntax error
      }
    `,
      `
      function f(s: string) {
        s.match() !== null;
      }
    `,
      `
      function f(s: string) {
        s.match(777) !== null;
      }
    `,
      `
      function f(s: string[]) {
        s.slice(0, needle.length) === needle;
      }
    `,
      `
      function f(s: string[]) {
        s.slice(-needle.length) === needle;
      }
    `,
      `
      function f(s: string) {
        s.slice(1, 4) === 'bar';
      }
    `,
      `
      function f(s: string) {
        s.slice(-4, -1) === 'bar';
      }
    `, // https://github.com/typescript-eslint/typescript-eslint/issues/1690
      `
      function f(s: string) {
        s.slice(1) === 'bar';
      }
    `,
      `
      function f(s: string | null) {
        s?.slice(1) === 'bar';
      }
    `,
      `
      function f(s: string) {
        pattern.test(s);
      }
    `,
      `
      function f(s: string) {
        /^bar/.test();
      }
    `,
      `
      function f(x: { test(): void }, s: string) {
        x.test(s);
      }
    `,
      `
      function f(s: string) {
        s.slice(0, -4) === 'car';
      }
    `,
      `
      function f(x: string, s: string) {
        x.endsWith('foo') && x.slice(0, -4) === 'bar';
      }
    `,
      `
      function f(s: string) {
        s.slice(0, length) === needle; // the 'length' can be different to 'needle.length'
      }
    `,
      `
      function f(s: string) {
        s.slice(-length) === needle; // 'length' can be different
      }
    `,
      `
      function f(s: string) {
        s.slice(0, 3) === needle;
      }
    `,
      {
        options: { allowSingleElementEquality: "always" },
        code: `
        declare const s: string;
        s[0] === 'a';
      `,
      },
      {
        options: { allowSingleElementEquality: "always" },
        code: `
        declare const s: string;
        s[s.length - 1] === 'a';
      `,
      },
    ],
    invalid: [
      // String indexing
      {
        code: `
        function f(s: string) {
          s[0] === 'a';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith('a');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s?.[0] === 'a';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s?.startsWith('a');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s[0] !== 'a';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          !s.startsWith('a');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s?.[0] !== 'a';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          !s?.startsWith('a');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s[0] == 'a';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith('a');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s[0] != 'a';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          !s.startsWith('a');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s[0] === 'あ';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith('あ');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s[0] === '👍'; // the length is 2.
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith('👍'); // the length is 2.
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s[s.length - 1] === 'a';
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          s.endsWith('a');
        }
      `,
              },
            ],
          },
        ],
      },
      // String#charAt
      {
        code: `
        function f(s: string) {
          s.charAt(0) === 'a';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith('a');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.charAt(0) !== 'a';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          !s.startsWith('a');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.charAt(0) == 'a';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith('a');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.charAt(0) != 'a';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          !s.startsWith('a');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.charAt(0) === 'あ';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith('あ');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.charAt(0) === '👍'; // the length is 2.
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith('👍'); // the length is 2.
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.charAt(s.length - 1) === 'a';
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          s.endsWith('a');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          (s).charAt(0) === "a";
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          (s).startsWith("a");
        }
      `,
              },
            ],
          },
        ],
      },
      // String#indexOf
      {
        code: `
        function f(s: string) {
          s.indexOf(needle) === 0;
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith(needle);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s?.indexOf(needle) === 0;
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s?.startsWith(needle);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.indexOf(needle) !== 0;
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          !s.startsWith(needle);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.indexOf(needle) == 0;
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith(needle);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.indexOf(needle) != 0;
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          !s.startsWith(needle);
        }
      `,
              },
            ],
          },
        ],
      },
      // String#lastIndexOf
      {
        code: `
        function f(s: string) {
          s.lastIndexOf('bar') === s.length - 3;
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          s.endsWith('bar');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.lastIndexOf('bar') !== s.length - 3;
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          !s.endsWith('bar');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.lastIndexOf('bar') == s.length - 3;
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          s.endsWith('bar');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.lastIndexOf('bar') != s.length - 3;
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          !s.endsWith('bar');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.lastIndexOf('bar') === s.length - 'bar'.length;
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          s.endsWith('bar');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.lastIndexOf(needle) === s.length - needle.length;
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          s.endsWith(needle);
        }
      `,
              },
            ],
          },
        ],
      },
      // String#match
      {
        code: `
        function f(s: string) {
          s.match(/^bar/) !== null;
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith("bar");
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s?.match(/^bar/) !== null;
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s?.startsWith("bar");
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.match(/^bar/) != null;
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith("bar");
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.match(/bar$/) !== null;
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          s.endsWith("bar");
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.match(/bar$/) != null;
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          s.endsWith("bar");
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.match(/^bar/) === null;
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          !s.startsWith("bar");
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.match(/^bar/) == null;
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          !s.startsWith("bar");
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.match(/bar$/) === null;
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          !s.endsWith("bar");
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.match(/bar$/) == null;
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          !s.endsWith("bar");
        }
      `,
              },
            ],
          },
        ],
      },
      // String#slice
      {
        code: `
        function f(s: string) {
          s.slice(0, 3) === 'bar';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith('bar');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s?.slice(0, 3) === 'bar';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s?.startsWith('bar');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.slice(0, 3) !== 'bar';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          !s.startsWith('bar');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.slice(0, 3) == 'bar';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith('bar');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.slice(0, 3) != 'bar';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          !s.startsWith('bar');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.slice(0, needle.length) === needle;
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith(needle);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.slice(-3) === 'bar';
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          s.endsWith('bar');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.slice(-3) !== 'bar';
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          !s.endsWith('bar');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.slice(-needle.length) === needle;
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          s.endsWith(needle);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.slice(s.length - needle.length) === needle;
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          s.endsWith(needle);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.substring(0, 3) === 'bar';
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith('bar');
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.substring(-3) === 'bar'; // the code is probably mistake.
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          s.endsWith('bar'); // the code is probably mistake.
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          s.substring(s.length - 3, s.length) === 'bar';
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          s.endsWith('bar');
        }
      `,
              },
            ],
          },
        ],
      },
      // RegExp#test
      {
        code: `
        function f(s: string) {
          /^bar/.test(s);
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          s.startsWith("bar");
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          /bar$/.test(s);
        }
      `,
        errors: [
          {
            message: messages.preferEndsWith,
            suggestions: [
              {
                message: messages.replaceEndsWith,
                output: `
        function f(s: string) {
          s.endsWith("bar");
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(s: string) {
          /^bar/.test(a + b);
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: string) {
          (a + b).startsWith("bar");
        }
      `,
              },
            ],
          },
        ],
      },
      // Test for variation of string types.
      {
        code: `
        function f(s: 'a' | 'b') {
          s.indexOf(needle) === 0;
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f(s: 'a' | 'b') {
          s.startsWith(needle);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f<T extends 'a' | 'b'>(s: T) {
          s.indexOf(needle) === 0;
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        function f<T extends 'a' | 'b'>(s: T) {
          s.startsWith(needle);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        type SafeString = string & { __HTML_ESCAPED__: void };
        function f(s: SafeString) {
          s.indexOf(needle) === 0;
        }
      `,
        errors: [
          {
            message: messages.preferStartsWith,
            suggestions: [
              {
                message: messages.replaceStartsWith,
                output: `
        type SafeString = string & { __HTML_ESCAPED__: void };
        function f(s: SafeString) {
          s.startsWith(needle);
        }
      `,
              },
            ],
          },
        ],
      },
    ],
  });
