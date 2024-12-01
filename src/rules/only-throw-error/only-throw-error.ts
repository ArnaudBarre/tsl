import { isIntrinsicAnyType, isIntrinsicUnknownType } from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import { isBuiltinSymbolLike } from "../_utils/isBuiltinSymbolLike.ts";
import { createRule } from "../../public-utils.ts";

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
   * A list of identifiers to ignore.
   * @default []
   */
  allow?: string[];
};

export const onlyThrowError = createRule((_options?: OnlyThrowErrorOptions) => {
  const options = {
    allowThrowingAny: true,
    allowThrowingUnknown: true,
    ..._options,
  };

  return {
    name: "core/onlyThrowError",
    visitor: {
      ThrowStatement({ expression: node }, context) {
        if (
          node.kind === SyntaxKind.AwaitExpression ||
          node.kind === SyntaxKind.YieldExpression
        ) {
          return;
        }

        const type = context.checker.getTypeAtLocation(node);

        if (options.allow) {
          const identifier =
            node.kind === SyntaxKind.NewExpression ||
            node.kind === SyntaxKind.CallExpression
              ? node.expression
              : node;
          if (options.allow.includes(identifier.getText())) {
            return;
          }
        }

        if (type.flags & ts.TypeFlags.Undefined) {
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
