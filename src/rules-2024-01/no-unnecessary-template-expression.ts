import { isTypeFlagSet } from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Context } from "../types.ts";

const messages = {
  noUnnecessaryTemplateExpression:
    "Template literal expression is unnecessary and can be simplified.",
};

export const noUnnecessaryTemplateExpression = createRule({
  name: "no-unnecessary-template-expression",
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
          message: messages.noUnnecessaryTemplateExpression,
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
          context.report({
            node: span,
            message: messages.noUnnecessaryTemplateExpression,
          });
        }
      }
    },
  },
});

function isUnderlyingTypeString(
  expression: AST.Expression,
  context: Context,
): expression is AST.StringLiteral | AST.Identifier {
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

export const test = () =>
  ruleTester({
    rule: noUnnecessaryTemplateExpression,
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
    ],
    invalid: [
      {
        code: "`${1}`;",
        errors: [
          {
            message: messages.noUnnecessaryTemplateExpression,
            line: 1,
            column: 4,
          },
        ],
      },
      {
        code: "`${1n}`;",
        errors: [
          {
            message: messages.noUnnecessaryTemplateExpression,
            line: 1,
            column: 4,
          },
        ],
      },
      {
        code: "`${true}`;",
        errors: [
          {
            message: messages.noUnnecessaryTemplateExpression,
            line: 1,
            column: 4,
          },
        ],
      },
      {
        code: "`${null}`;",
        errors: [
          {
            message: messages.noUnnecessaryTemplateExpression,
            line: 1,
            column: 4,
          },
        ],
      },
      {
        code: "`${undefined}`;",
        errors: [
          {
            message: messages.noUnnecessaryTemplateExpression,
            line: 1,
            column: 4,
          },
        ],
      },
      {
        code: "`${'a'}${'b'}`;",
        errors: [
          {
            message: messages.noUnnecessaryTemplateExpression,
            line: 1,
            column: 4,
          },
          {
            message: messages.noUnnecessaryTemplateExpression,
            line: 1,
            column: 10,
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
            message: messages.noUnnecessaryTemplateExpression,
            line: 3,
            column: 17,
          },
        ],
      },
      {
        code: "`a${'b'}`;",
        errors: [
          {
            message: messages.noUnnecessaryTemplateExpression,
            line: 1,
            column: 5,
          },
        ],
      },
      {
        code: "`${'1 + 1 = '}${2}`;",
        errors: [
          {
            message: messages.noUnnecessaryTemplateExpression,
            line: 1,
            column: 4,
          },
          {
            message: messages.noUnnecessaryTemplateExpression,
            line: 1,
            column: 17,
          },
        ],
      },
      {
        code: "`${'a'}${true}`;",
        errors: [
          {
            message: messages.noUnnecessaryTemplateExpression,
            line: 1,
            column: 4,
          },
          {
            message: messages.noUnnecessaryTemplateExpression,
            line: 1,
            column: 10,
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
            message: messages.noUnnecessaryTemplateExpression,
            line: 3,
            column: 12,
          },
        ],
      },
      {
        code: "`${String(Symbol.for('test'))}`;",
        errors: [
          {
            message: messages.noUnnecessaryTemplateExpression,
            line: 1,
            column: 4,
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
            message: messages.noUnnecessaryTemplateExpression,
            line: 3,
            column: 12,
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
            message: messages.noUnnecessaryTemplateExpression,
            line: 3,
            column: 14,
          },
        ],
      },
    ],
  });
