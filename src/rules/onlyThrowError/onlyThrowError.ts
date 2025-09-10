import { isIntrinsicAnyType, isIntrinsicUnknownType } from "ts-api-utils";
import { SyntaxKind, TypeFlags } from "typescript";
import { defineRule } from "../_utils/index.ts";
import { isBuiltinSymbolLike } from "../_utils/isBuiltinSymbolLike.ts";
import type { AST } from "../../types.ts";

export const messages = {
  object: "Expected an error object to be thrown.",
  undef: "Do not throw undefined.",
};

export type OnlyThrowErrorOptions = {
  /**
   * Whether to always allow throwing values typed as `any`.
   * @default true
   */
  allowThrowingAny?: boolean;
  /**
   * Whether to always allow throwing values typed as `unknown`.
   * @default true
   */
  allowThrowingUnknown?: boolean;
  /**
   * Whether to allow rethrowing caught values that are not `Error` objects.
   * @default true
   */
  allowRethrowing?: boolean;
  /**
   * A list of identifiers to ignore.
   * @default []
   */
  allow?: string[];
};

// https://typescript-eslint.io/rules/only-throw-error
export const onlyThrowError = defineRule((_options?: OnlyThrowErrorOptions) => {
  const options = {
    allowThrowingAny: true,
    allowThrowingUnknown: true,
    allowRethrowing: true,
    ..._options,
  };
  return {
    name: "core/onlyThrowError",
    visitor: {
      ThrowStatement(context, { expression: node }) {
        if (options.allowRethrowing && node.kind === SyntaxKind.Identifier) {
          const declaration = context.checker
            .getSymbolAtLocation(node)
            ?.getDeclarations()
            ?.at(0) as AST.AnyNode | undefined;
          const parent = declaration?.parent;
          if (parent?.kind === SyntaxKind.CatchClause) return;
          if (
            parent
            && parent.kind === SyntaxKind.ArrowFunction
            && parent.parameters.length >= 1
            && parent.parameters[0] === declaration
            && parent.parent.kind === SyntaxKind.CallExpression
            && parent.parent.expression.kind
              === SyntaxKind.PropertyAccessExpression
            && parent.parent.expression.name.kind === SyntaxKind.Identifier
          ) {
            if (
              parent.parent.expression.name.text === "catch"
              && parent.parent.arguments[0] === parent
            ) {
              return;
            }
            if (
              parent.parent.expression.name.text === "then"
              && parent.parent.arguments[1] === parent
            ) {
              return;
            }
          }
        }

        const type = context.checker.getTypeAtLocation(node);

        if (options.allow) {
          const identifier =
            node.kind === SyntaxKind.NewExpression
            || node.kind === SyntaxKind.CallExpression
              ? node.expression
              : node;
          if (options.allow.includes(identifier.getText())) {
            return;
          }
        }

        if (type.flags & TypeFlags.Undefined) {
          context.report({ node, message: messages.undef });
          return;
        }

        if (options.allowThrowingAny && isIntrinsicAnyType(type)) {
          return;
        }

        if (options.allowThrowingUnknown && isIntrinsicUnknownType(type)) {
          return;
        }

        if (isBuiltinSymbolLike(context.program, type, "Error")) {
          return;
        }

        context.report({ node, message: messages.object });
      },
    },
  };
});
