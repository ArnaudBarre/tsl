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

export function returnAwait() {
  return defineRule({
    name: "core/returnAwait",
    // Keep track of (async) function stack
    createData: (): boolean[] => [],
    visitor: {
      ArrowFunction: enterFunction,
      "ArrowFunction:exit"(node, context) {
        context.data.pop();
        if (
          hasModifier(node, SyntaxKind.AsyncKeyword)
          && node.body.kind !== SyntaxKind.Block
        ) {
          for (const expression of findPossiblyReturnedNodes(node.body)) {
            checkExpression(expression, context);
          }
        }
      },
      FunctionDeclaration: enterFunction,
      "FunctionDeclaration:exit"(_, context) {
        context.data.pop();
      },
      FunctionExpression: enterFunction,
      "FunctionExpression:exit"(_, context) {
        context.data.pop();
      },

      ReturnStatement(node, context) {
        if (!context.data.at(-1) || !node.expression) return;
        for (const expression of findPossiblyReturnedNodes(node.expression)) {
          checkExpression(expression, context);
        }
      },
    },
  });
}

function enterFunction(node: FunctionNode, context: Context<boolean[]>): void {
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

function checkExpression(node: AST.Expression, context: Context): void {
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
