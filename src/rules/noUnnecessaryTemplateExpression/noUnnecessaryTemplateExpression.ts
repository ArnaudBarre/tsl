import { isTypeFlagSet } from "ts-api-utils";
import ts, { SyntaxKind, TypeFlags } from "typescript";
import { typeHasFlag } from "../_utils/index.ts";
import { createRule } from "../../index.ts";
import type { AST, Context } from "../../types.ts";

export const messages = {
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
    TemplateLiteralType(node, context) {
      const hasSingleType =
        node.head.text === "" &&
        node.templateSpans.length === 1 &&
        node.templateSpans[0].literal.text === "" &&
        node.templateSpans[0].type.kind !== SyntaxKind.LiteralType &&
        node.templateSpans[0].type.kind !== SyntaxKind.UndefinedKeyword;

      if (hasSingleType) {
        const type = context.checker.getTypeAtLocation(
          node.templateSpans[0].type,
        );
        if (typeHasFlag(type, TypeFlags.TypeParameter)) return;
        context.report({
          node: node.templateSpans[0],
          message: messages.unnecessaryTemplateString,
          suggestions: [
            {
              message: messages.removeUnnecessaryTemplateString,
              changes: [
                { node, newText: node.templateSpans[0].type.getFullText() },
              ],
            },
          ],
        });
        return;
      }

      for (const span of node.templateSpans) {
        const type = span.type;
        if (
          type.kind === SyntaxKind.LiteralType ||
          type.kind === SyntaxKind.UndefinedKeyword
        ) {
          // Skip if contains a comment
          if (span.type.getLeadingTriviaWidth()) continue;

          if (
            type.kind === SyntaxKind.LiteralType &&
            type.literal.kind === SyntaxKind.StringLiteral &&
            isWhitespace(type.literal.text) &&
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
                type.kind === SyntaxKind.UndefinedKeyword
                  ? "undefined"
                  : type.literal.kind === SyntaxKind.StringLiteral
                    ? type.literal.getText().slice(1, -1)
                    : type.literal.kind === SyntaxKind.BigIntLiteral
                      ? parseInt(type.literal.getText()).toString()
                      : type.literal.getText();
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
  // allow empty string too since we want to allow
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
