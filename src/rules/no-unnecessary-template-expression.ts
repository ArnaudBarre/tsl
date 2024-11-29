import { isTypeFlagSet } from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Context } from "../types.ts";

const messages = {
  unnecessaryTemplateString: "Template string is unnecessary.",
  removeUnnecessaryTemplateString: "Remove unnecessary template string.",
  unnecessaryTemplateExpression:
    "Template literal expression is unnecessary and can be simplified.",
  removeUnnecessaryTemplateExpression:
    "Remove unnecessary template expression.",
};

export const noUnnecessaryTemplateExpression = createRule(() => ({
  name: "core/noUnnecessaryTemplateExpression",
  visitor: {
    TemplateExpression(node, context) {
      if (node.parent.kind === SyntaxKind.TaggedTemplateExpression) {
        return;
      }

      const hasSingleStringVariable =
        node.head.text === "" &&
        node.templateSpans.length === 1 &&
        node.templateSpans[0].literal.text === "" &&
        isUnderlyingTypeString(node.templateSpans[0].expression, context);

      if (hasSingleStringVariable) {
        context.report({
          node: node.templateSpans[0],
          message: messages.unnecessaryTemplateString,
          suggestions: [
            {
              message: messages.removeUnnecessaryTemplateString,
              changes: [
                {
                  node,
                  newText: node.templateSpans[0].expression.getFullText(),
                },
              ],
            },
          ],
        });
        return;
      }

      for (const span of node.templateSpans) {
        if (
          span.expression.kind === SyntaxKind.StringLiteral ||
          span.expression.kind === SyntaxKind.BigIntLiteral ||
          span.expression.kind === SyntaxKind.NumericLiteral ||
          span.expression.kind === SyntaxKind.TrueKeyword ||
          span.expression.kind === SyntaxKind.FalseKeyword ||
          span.expression.kind === SyntaxKind.NullKeyword ||
          (span.expression.kind === SyntaxKind.Identifier &&
            span.expression.text === "undefined")
        ) {
          // Skip if contains a comment
          if (span.literal.getLeadingTriviaWidth()) continue;

          if (
            span.expression.kind === SyntaxKind.StringLiteral &&
            isWhitespace(span.expression.text) &&
            startsWithNewLine(span.literal.text)
          ) {
            // Allow making trailing whitespace visible
            // `Head:${'    '}
            // `
            continue;
          }

          context.report({
            node: span,
            message: messages.unnecessaryTemplateExpression,
            suggestions: () => {
              const expressionText =
                span.expression.kind === SyntaxKind.StringLiteral
                  ? span.expression.getText().slice(1, -1)
                  : span.expression.kind === SyntaxKind.BigIntLiteral
                  ? parseInt(span.expression.getText()).toString()
                  : span.expression.getText();
              const isLastSpan = span === node.templateSpans.at(-1);
              return [
                {
                  message: messages.removeUnnecessaryTemplateExpression,
                  changes: [
                    {
                      start: span.getStart() - 2,
                      end: span.getEnd() - (isLastSpan ? 1 : 2),
                      newText: expressionText + span.literal.text,
                    },
                  ],
                },
              ];
            },
          });
        }
      }
    },
  },
}));

function isUnderlyingTypeString(
  expression: AST.Expression,
  context: Context,
): expression is AST.Identifier | AST.StringLiteral {
  const type = context.utils.getConstrainedTypeAtLocation(expression);

  const isString = (t: ts.Type): boolean => {
    return isTypeFlagSet(t, ts.TypeFlags.StringLike);
  };

  if (type.isUnion()) {
    return type.types.every(isString);
  }

  if (type.isIntersection()) {
    return type.types.some(isString);
  }

  return isString(type);
}

function isWhitespace(x: string): boolean {
  // allow empty string too since we went to allow
  // `      ${''}
  // `;
  //
  // in addition to
  // `${'        '}
  // `;
  //
  return /^\s*$/.test(x);
}

function startsWithNewLine(x: string): boolean {
  return x.startsWith("\n") || x.startsWith("\r\n");
}

export const test = () =>
  ruleTester({
    ruleFn: noUnnecessaryTemplateExpression,
    valid: [
      "const string = 'a';",
      "const string = `a`;",
      `
      declare const string: 'a';
      \`\${string}b\`;
    `,
      `
      declare const number: 1;
      \`\${number}b\`;
    `,
      `
      declare const boolean: true;
      \`\${boolean}b\`;
    `,
      `
      declare const nullish: null;
      \`\${nullish}-undefined\`;
    `,
      `
      declare const undefinedish: undefined;
      \`\${undefinedish}\`;
    `,
      `
      declare const left: 'a';
      declare const right: 'b';
      \`\${left}\${right}\`;
    `,
      `
      declare const left: 'a';
      declare const right: 'c';
      \`\${left}b\${right}\`;
    `,
      `
      declare const left: 'a';
      declare const center: 'b';
      declare const right: 'c';
      \`\${left}\${center}\${right}\`;
    `,
      "`1 + 1 = ${1 + 1}`;",
      "`true && false = ${true && false}`;",
      "tag`${'a'}${'b'}`;",
      "`${function () {}}`;",
      "`${() => {}}`;",
      "`${(...args: any[]) => args}`;",
      `
      declare const number: 1;
      \`\${number}\`;
    `,
      `
      declare const boolean: true;
      \`\${boolean}\`;
    `,
      `
      declare const nullish: null;
      \`\${nullish}\`;
    `,
      `
      declare const union: string | number;
      \`\${union}\`;
    `,
      `
      declare const unknown: unknown;
      \`\${unknown}\`;
    `,
      `
      declare const never: never;
      \`\${never}\`;
    `,
      `
      declare const any: any;
      \`\${any}\`;
    `,
      `
      function func<T extends number>(arg: T) {
        \`\${arg}\`;
      }
    `,
      `
      \`with

      new line\`;
    `,
      `
      declare const a: 'a';

      \`\${a} with

      new line\`;
    `,
      `
      \`with windows \r new line\`;
    `,
      "`24 * ${7 /* days in week */}`",
      `
      \`
      this code has trailing whitespace: \${'    '}
      \`;
    `,
      `
      \`this code has trailing whitespace with a windows \\\r new line: \${' '}\r\n\`;
    `,
      `
      \`trailing position interpolated empty string also makes whitespace clear    \${''}
      \`;
    `,
    ],
    invalid: [
      {
        code: "`${1}2`;",
        errors: [
          {
            message: messages.unnecessaryTemplateExpression,
            line: 1,
            column: 4,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateExpression,
                output: "`12`;",
              },
            ],
          },
        ],
      },
      {
        code: "`${1n}`;",
        errors: [
          {
            message: messages.unnecessaryTemplateExpression,
            line: 1,
            column: 4,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateExpression,
                output: "`1`;",
              },
            ],
          },
        ],
      },
      {
        code: "`${true}`;",
        errors: [
          {
            message: messages.unnecessaryTemplateExpression,
            line: 1,
            column: 4,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateExpression,
                output: "`true`;",
              },
            ],
          },
        ],
      },
      {
        code: "`${null}`;",
        errors: [
          {
            message: messages.unnecessaryTemplateExpression,
            line: 1,
            column: 4,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateExpression,
                output: "`null`;",
              },
            ],
          },
        ],
      },
      {
        code: "`${undefined}`;",
        errors: [
          {
            message: messages.unnecessaryTemplateExpression,
            line: 1,
            column: 4,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateExpression,
                output: "`undefined`;",
              },
            ],
          },
        ],
      },
      {
        code: "`${'a'}${'b'}`;",
        errors: [
          {
            message: messages.unnecessaryTemplateExpression,
            line: 1,
            column: 4,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateExpression,
                output: "`a${'b'}`;",
              },
            ],
          },
          {
            message: messages.unnecessaryTemplateExpression,
            line: 1,
            column: 10,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateExpression,
                output: "`${'a'}b`;",
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const b: 'b';
        \`a\${b}\${'c'}\`;
      `,
        errors: [
          {
            message: messages.unnecessaryTemplateExpression,
            line: 3,
            column: 17,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateExpression,
                output: `
        declare const b: 'b';
        \`a\${b}c\`;
      `,
              },
            ],
          },
        ],
      },
      {
        code: "`a${'b'}`;",
        errors: [
          {
            message: messages.unnecessaryTemplateExpression,
            line: 1,
            column: 5,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateExpression,
                output: "`ab`;",
              },
            ],
          },
        ],
      },
      {
        code: "`${'1 + 1 = '}${2}`;",
        errors: [
          {
            message: messages.unnecessaryTemplateExpression,
            line: 1,
            column: 4,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateExpression,
                output: "`1 + 1 = ${2}`;",
              },
            ],
          },
          {
            message: messages.unnecessaryTemplateExpression,
            line: 1,
            column: 17,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateExpression,
                output: "`${'1 + 1 = '}2`;",
              },
            ],
          },
        ],
      },
      {
        code: "`${'a'}${true}`;",
        errors: [
          {
            message: messages.unnecessaryTemplateExpression,
            line: 1,
            column: 4,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateExpression,
                output: "`a${true}`;",
              },
            ],
          },
          {
            message: messages.unnecessaryTemplateExpression,
            line: 1,
            column: 10,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateExpression,
                output: "`${'a'}true`;",
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const string: 'a';
        \`\${string}\`;
      `,
        errors: [
          {
            message: messages.unnecessaryTemplateString,
            line: 3,
            column: 12,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateString,
                output: `
        declare const string: 'a';
        string;
      `,
              },
            ],
          },
        ],
      },
      {
        code: "`${String(Symbol.for('test'))}`;",
        errors: [
          {
            message: messages.unnecessaryTemplateString,
            line: 1,
            column: 4,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateString,
                output: "String(Symbol.for('test'));",
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const intersection: string & { _brand: 'test-brand' };
        \`\${intersection}\`;
      `,
        errors: [
          {
            message: messages.unnecessaryTemplateString,
            line: 3,
            column: 12,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateString,
                output: `
        declare const intersection: string & { _brand: 'test-brand' };
        intersection;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function func<T extends string>(arg: T) {
          \`\${arg}\`;
        }
      `,
        errors: [
          {
            message: messages.unnecessaryTemplateString,
            line: 3,
            column: 14,
            suggestions: [
              {
                message: messages.removeUnnecessaryTemplateString,
                output: `
        function func<T extends string>(arg: T) {
          arg;
        }
      `,
              },
            ],
          },
        ],
      },
    ],
  });
