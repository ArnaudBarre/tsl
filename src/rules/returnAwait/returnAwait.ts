import { SyntaxKind } from "typescript";
import { addAwait, defineRule, hasModifier } from "../_utils/index.ts";
import { needsToBeAwaited } from "../_utils/needsToBeAwaited.ts";
import type { AST, Context } from "../../types.ts";

export const messages = {
  requiredPromiseAwait: "Returned value must be awaited.",
  addAwait: "Add await operator.",
};

type FunctionNode =
  | AST.ArrowFunction
  | AST.FunctionDeclaration
  | AST.FunctionExpression;

// https://typescript-eslint.io/rules/return-await
export const returnAwait = defineRule(() => ({
  name: "core/returnAwait",
  // Keep track of (async) function stack
  createData: (): boolean[] => [],
  visitor: {
    ArrowFunction: enterFunction,
    ArrowFunction_exit(context, node) {
      context.data.pop();
      if (
        hasModifier(node, SyntaxKind.AsyncKeyword)
        && node.body.kind !== SyntaxKind.Block
      ) {
        for (const expression of findPossiblyReturnedNodes(node.body)) {
          checkExpression(context, expression);
        }
      }
    },
    FunctionDeclaration: enterFunction,
    FunctionDeclaration_exit(context) {
      context.data.pop();
    },
    FunctionExpression: enterFunction,
    FunctionExpression_exit(context) {
      context.data.pop();
    },

    ReturnStatement(context, node) {
      if (!context.data.at(-1) || !node.expression) return;
      for (const expression of findPossiblyReturnedNodes(node.expression)) {
        checkExpression(context, expression);
      }
    },
  },
}));

function enterFunction(context: Context<boolean[]>, node: FunctionNode): void {
  context.data.push(hasModifier(node, SyntaxKind.AsyncKeyword));
}

function findPossiblyReturnedNodes(node: AST.Expression): AST.Expression[] {
  if (node.kind === SyntaxKind.ConditionalExpression) {
    return [
      ...findPossiblyReturnedNodes(node.whenTrue),
      ...findPossiblyReturnedNodes(node.whenFalse),
    ];
  }
  if (node.kind === SyntaxKind.ParenthesizedExpression) {
    return findPossiblyReturnedNodes(node.expression);
  }
  return [node];
}

function checkExpression(context: Context, node: AST.Expression): void {
  if (node.kind === SyntaxKind.AwaitExpression) return;
  const type = context.checker.getTypeAtLocation(node);
  if (needsToBeAwaited(context, node, type) !== "Always") return;
  context.report({
    node,
    message: messages.requiredPromiseAwait,
    suggestions: () => [
      { message: messages.addAwait, changes: addAwait(node) },
    ],
  });
}
