import ts, { SyntaxKind, TypeFlags } from "typescript";
import { getOperatorPrecedenceForNode } from "../_utils/getOperatorPrecedence.ts";
import { defineRule, typeHasFlag } from "../_utils/index.ts";
import { isIdentifierFromDefaultLibrary } from "../_utils/isBuiltinSymbolLike.ts";
import type { Context } from "../../types.ts";

export const messages = {
  unnecessaryTypeConversion: (params: { violation: string; type: string }) =>
    `${params.violation} does not change the type or value of the ${params.type}.`,
  suggestRemove: "Remove the type conversion.",
};

// https://typescript-eslint.io/rules/no-unnecessary-type-conversion
export const noUnnecessaryTypeConversion = defineRule(() => ({
  name: "core/noUnnecessaryTypeConversion",
  visitor: {
    BinaryExpression(context, node) {
      if (
        node.operatorToken.kind === SyntaxKind.PlusEqualsToken
        && node.right.kind === SyntaxKind.StringLiteral
        && node.right.text === ""
        && doesUnderlyingTypeMatchFlag(
          context,
          context.checker.getTypeAtLocation(node.left),
          TypeFlags.StringLike,
        )
      ) {
        context.report({
          node,
          message: messages.unnecessaryTypeConversion({
            type: "string",
            violation: "Concatenating a string with ''",
          }),
          suggestions: [
            {
              message: messages.suggestRemove,
              changes:
                node.parent.kind === SyntaxKind.ExpressionStatement
                  ? [{ node: node.parent, newText: "" }]
                  : [
                      {
                        start: node.left.getEnd(),
                        end: node.getEnd(),
                        newText: "",
                      },
                    ],
            },
          ],
        });
      }
      if (node.operatorToken.kind === SyntaxKind.PlusToken) {
        if (
          node.right.kind === SyntaxKind.StringLiteral
          && node.right.text === ""
          && doesUnderlyingTypeMatchFlag(
            context,
            context.checker.getTypeAtLocation(node.left),
            TypeFlags.StringLike,
          )
        ) {
          report({
            context,
            violation: "Concatenating a string with ''",
            type: "string",
            start: node.operatorToken.getStart(),
            end: node.right.getEnd(),
            fix: { start: node.left.getEnd() },
          });
        } else if (
          node.left.kind === SyntaxKind.StringLiteral
          && node.left.text === ""
          && doesUnderlyingTypeMatchFlag(
            context,
            context.checker.getTypeAtLocation(node.right),
            TypeFlags.StringLike,
          )
        ) {
          report({
            context,
            violation: "Concatenating '' with a string",
            type: "string",
            start: node.left.getStart(),
            end: node.operatorToken.getEnd(),
            fix: { end: node.right.getStart() },
          });
        }
      }
    },
    CallExpression(context, node) {
      const callee = node.expression;
      if (callee.kind === SyntaxKind.Identifier) {
        const typeFlag = builtInTypeFlags[callee.text];
        if (typeFlag === undefined) return;

        if (node.arguments.length !== 1) return;

        const arg = node.arguments[0];

        if (!isIdentifierFromDefaultLibrary(context, callee)) {
          // Not the built-in function
          return;
        }

        if (
          doesUnderlyingTypeMatchFlag(
            context,
            context.utils.getConstrainedTypeAtLocation(arg),
            typeFlag,
          )
        ) {
          const keepParentheses =
            getOperatorPrecedenceForNode(arg)
            <= getOperatorPrecedenceForNode(node.parent);
          context.report({
            node: node.expression,
            message: messages.unnecessaryTypeConversion({
              violation: `Passing a ${callee.text.toLowerCase()} to ${callee.text}()`,
              type: callee.text.toLowerCase(),
            }),
            suggestions: [
              {
                message: messages.suggestRemove,
                changes: [
                  {
                    start: callee.getStart(),
                    end: keepParentheses ? callee.getEnd() : arg.getStart(),
                    newText: "",
                  },
                  {
                    start: keepParentheses ? node.getEnd() : arg.getEnd(),
                    end: node.getEnd(),
                    newText: "",
                  },
                ],
              },
            ],
          });
        }
      }
      if (
        node.arguments.length === 0
        && callee.kind === SyntaxKind.PropertyAccessExpression
        && callee.name.kind === SyntaxKind.Identifier
        && callee.name.text === "toString"
      ) {
        const type = context.utils.getConstrainedTypeAtLocation(
          callee.expression,
        );
        if (doesUnderlyingTypeMatchFlag(context, type, TypeFlags.StringLike)) {
          context.report({
            start: callee.name.getStart(),
            end: node.getEnd(),
            message: messages.unnecessaryTypeConversion({
              type: "string",
              violation: "Calling a string's .toString() method",
            }),
            suggestions: [
              {
                message: messages.suggestRemove,
                changes: [
                  {
                    start: callee.expression.getEnd(),
                    end: node.getEnd(),
                    newText: "",
                  },
                ],
              },
            ],
          });
        }
      }
    },
    PrefixUnaryExpression(context, node) {
      if (
        node.operator === SyntaxKind.ExclamationToken
        && node.operand.kind === SyntaxKind.PrefixUnaryExpression
        && node.operand.operator === SyntaxKind.ExclamationToken
      ) {
        const type = context.checker.getTypeAtLocation(node.operand.operand);
        if (doesUnderlyingTypeMatchFlag(context, type, TypeFlags.BooleanLike)) {
          report({
            context,
            violation: "Using !! on a boolean",
            type: "boolean",
            start: node.getStart(),
            end: node.operand.operand.getStart(),
          });
        }
      }
      if (node.operator === SyntaxKind.PlusToken) {
        const type = context.checker.getTypeAtLocation(node.operand);
        if (doesUnderlyingTypeMatchFlag(context, type, TypeFlags.NumberLike)) {
          report({
            context,
            violation: "Using the unary + operator on a number",
            type: "number",
            start: node.getStart(),
            end: node.operand.getStart(),
          });
        }
      }
      if (
        node.operator === SyntaxKind.TildeToken
        && node.operand.kind === SyntaxKind.PrefixUnaryExpression
        && node.operand.operator === SyntaxKind.TildeToken
      ) {
        const type = context.checker.getTypeAtLocation(node.operand.operand);
        if (doesUnderlyingTypeMatchFlag(context, type, TypeFlags.NumberLike)) {
          report({
            context,
            violation: "Using ~~ on a number",
            type: "number",
            start: node.getStart(),
            end: node.operand.operand.getStart(),
          });
        }
      }
    },
  },
}));

function doesUnderlyingTypeMatchFlag(
  context: Context,
  type: ts.Type,
  typeFlag: TypeFlags,
): boolean {
  return context.utils
    .unionConstituents(type)
    .every((t) => typeHasFlag(t, typeFlag));
}

const builtInTypeFlags: Record<string, TypeFlags | undefined> = {
  BigInt: TypeFlags.BigIntLike,
  Boolean: TypeFlags.BooleanLike,
  Number: TypeFlags.NumberLike,
  String: TypeFlags.StringLike,
};

function report(params: {
  context: Context;
  violation: string;
  type: string;
  start: number;
  end: number;
  fix?: { start?: number; end?: number };
}) {
  params.context.report({
    start: params.start,
    end: params.end,
    message: messages.unnecessaryTypeConversion({
      violation: params.violation,
      type: params.type,
    }),
    suggestions: [
      {
        message: messages.suggestRemove,
        changes: [
          {
            start: params.fix?.start ?? params.start,
            end: params.fix?.end ?? params.end,
            newText: "",
          },
        ],
      },
    ],
  });
}
