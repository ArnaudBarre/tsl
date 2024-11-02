import { SyntaxKind } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";

const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/u;

export const dotNotation = createRule({
  name: "dot-notation",
  visitor: {
    ElementAccessExpression(node, context) {
      if (
        node.argumentExpression.kind === SyntaxKind.StringLiteral ||
        node.argumentExpression.kind ===
          SyntaxKind.NoSubstitutionTemplateLiteral
      ) {
        if (!validIdentifier.test(node.argumentExpression.text)) {
          return;
        }
        const property = node.argumentExpression.text;
        if (
          context.compilerOptions.noPropertyAccessFromIndexSignature &&
          !context.checker
            .getTypeAtLocation(node.expression)
            .getNonNullableType()
            .getApparentProperties()
            .some((p) => p.name === property)
        ) {
          // Using brackets for index signature
          return;
        }
        context.report({
          node,
          message: `['${node.argumentExpression.text}'] is better written in dot notation.`,
        });
      }
    },
  },
});

export const test = () =>
  ruleTester({
    rule: dotNotation,
    valid: [
      //  baseRule

      "a['12'];",
      "a[b];",
      "a[0];",
      "a[`time${range}`];",
      "a[`time range`];",
      "a[undefined];",
      "a[void 0];",
      "a[b()];",
      "a[/(?<zero>0)/];",
      {
        code: `
interface Nested {
  property: string;
  [key: string]: number | string;
}

class Dingus {
  nested: Nested;
}

let dingus: Dingus | undefined;

dingus?.nested.property;
dingus?.nested['hello'];
      `,
        compilerOptions: { noPropertyAccessFromIndexSignature: true },
      },
    ],
    invalid: [
      {
        code: "a['true'];",
        error: "['true'] is better written in dot notation.",
      },
      {
        code: "a['time'];",
        error: "['time'] is better written in dot notation.",
      },
      {
        code: "a.b['c'];",
        error: "['c'] is better written in dot notation.",
      },
      {
        code:
          "getResource()\n" +
          "    .then(function(){})\n" +
          '    ["catch"](function(){})\n' +
          "    .then(function(){})\n" +
          '    ["catch"](function(){});',
        errors: [
          {
            message: "['catch'] is better written in dot notation.",
            line: 3,
            column: 6,
          },
          {
            message: "['catch'] is better written in dot notation.",
            line: 5,
            column: 6,
          },
        ],
      },
      {
        code: `
interface Nested {
  property: string;
  [key: string]: number | string;
}

class Dingus {
  nested: Nested;
}

let dingus: Dingus | undefined;

dingus?.nested['property'];
      `,
        compilerOptions: { noPropertyAccessFromIndexSignature: true },
        errors: [
          {
            message: "['property'] is better written in dot notation.",
            line: 13,
            column: 15,
          },
        ],
      },
    ],
  });
