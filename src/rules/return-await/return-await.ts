import { SyntaxKind } from "typescript";
import { isHigherPrecedenceThanUnary } from "../_utils/index.ts";
import { needsToBeAwaited } from "../_utils/needsToBeAwaited.ts";
import { createRule } from "../../index.ts";
import type { AST, Context, Suggestion } from "../../types.ts";

export const messages = {
  requiredPromiseAwait: "Returned value must be awaited.",
  addAwait: "Add await operator.",
};

type FunctionNode =
  | AST.ArrowFunction
  | AST.FunctionDeclaration
  | AST.FunctionExpression;

export const returnAwait = createRule(() => ({
  name: "core/returnAwait",
  // Keep track of (async) function stack
  createData: (): boolean[] => [],
  visitor: {
    ArrowFunction: enterFunction,
    "ArrowFunction:exit"(node, context) {
      context.data.pop();
      if (isAsyncFunction(node) && node.body.kind !== SyntaxKind.Block) {
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
}));

function isAsyncFunction(node: FunctionNode): boolean {
  return (
    node.modifiers?.some(
      (modifier) => modifier.kind === SyntaxKind.AsyncKeyword,
    ) ?? false
  );
}

function enterFunction(node: FunctionNode, context: Context<boolean[]>): void {
  context.data.push(isAsyncFunction(node));
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
    suggestions: () => {
      const changes: Suggestion["changes"] = [];
      if (isHigherPrecedenceThanUnary(node)) {
        changes.push({ start: node.getStart(), length: 0, newText: "await " });
      } else {
        changes.push({ start: node.getStart(), length: 0, newText: "await (" });
        changes.push({ start: node.getEnd(), length: 0, newText: ")" });
      }
      return [{ message: messages.addAwait, changes }];
    },
  });
}
