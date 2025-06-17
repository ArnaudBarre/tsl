import { isSymbolFlagSet } from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import { defineRule, isReferenceToGlobalFunction } from "../_utils/index.ts";
import { isBuiltinSymbolLike } from "../_utils/isBuiltinSymbolLike.ts";
import type { AnyNode } from "../../ast.ts";
import type { AST, Context } from "../../types.ts";

export const messages = {
  noImpliedEvalError: "Implied eval. Consider passing a function.",
  noFunctionConstructor:
    "Implied eval. Do not use the Function constructor to create functions.",
};

const FUNCTION_CONSTRUCTOR = "Function";
const GLOBAL_CANDIDATES = new Set(["global", "globalThis", "window"]);
const EVAL_LIKE_METHODS = new Set([
  "execScript",
  "setImmediate",
  "setInterval",
  "setTimeout",
]);

export const noImpliedEval = defineRule(() => ({
  name: "core/noImpliedEval",
  visitor: {
    CallExpression: checkImpliedEval,
    NewExpression: checkImpliedEval,
  },
}));

function getCalleeName(node: AST.Expression): string | null {
  if (node.kind === SyntaxKind.Identifier) {
    return node.text;
  }

  if (
    node.kind === SyntaxKind.PropertyAccessExpression
    && node.expression.kind === SyntaxKind.Identifier
    && GLOBAL_CANDIDATES.has(node.expression.text)
    && node.name.kind === SyntaxKind.Identifier
  ) {
    return node.name.text;
  }

  if (
    node.kind === SyntaxKind.ElementAccessExpression
    && node.expression.kind === SyntaxKind.Identifier
    && GLOBAL_CANDIDATES.has(node.expression.text)
    && node.argumentExpression.kind === SyntaxKind.StringLiteral
  ) {
    return node.argumentExpression.text;
  }

  return null;
}

function isFunctionType(node: AnyNode, context: Context): boolean {
  const type = context.checker.getTypeAtLocation(node);
  const symbol = type.getSymbol();

  if (
    symbol
    && isSymbolFlagSet(symbol, ts.SymbolFlags.Function | ts.SymbolFlags.Method)
  ) {
    return true;
  }

  if (isBuiltinSymbolLike(context.program, type, FUNCTION_CONSTRUCTOR)) {
    return true;
  }

  const signatures = context.checker.getSignaturesOfType(
    type,
    ts.SignatureKind.Call,
  );

  return signatures.length > 0;
}

function isBind(node: AnyNode, context: Context): boolean {
  return node.kind === SyntaxKind.PropertyAccessExpression
    ? isBind(node.name, context)
    : node.kind === SyntaxKind.Identifier && node.text === "bind";
}

function isFunction(node: AnyNode, context: Context): boolean {
  switch (node.kind) {
    case SyntaxKind.ArrowFunction:
    case SyntaxKind.FunctionDeclaration:
    case SyntaxKind.FunctionExpression:
      return true;

    case SyntaxKind.StringLiteral:
    case SyntaxKind.NumericLiteral:
    case SyntaxKind.TrueKeyword:
    case SyntaxKind.FalseKeyword:
    case SyntaxKind.TemplateExpression:
      return false;

    case SyntaxKind.CallExpression:
      return isBind(node.expression, context) || isFunctionType(node, context);

    default:
      return isFunctionType(node, context);
  }
}

function checkImpliedEval(
  node: AST.CallExpression | AST.NewExpression,
  context: Context,
): void {
  const calleeName = getCalleeName(node.expression);
  if (calleeName == null) {
    return;
  }

  if (calleeName === FUNCTION_CONSTRUCTOR) {
    const type = context.checker.getTypeAtLocation(node.expression);
    const symbol = type.getSymbol();
    if (symbol) {
      if (isBuiltinSymbolLike(context.program, type, "FunctionConstructor")) {
        context.report({ node, message: messages.noFunctionConstructor });
        return;
      }
    } else {
      context.report({ node, message: messages.noFunctionConstructor });
      return;
    }
  }

  if (!node.arguments || node.arguments.length === 0) {
    return;
  }

  const [handler] = node.arguments;
  if (
    EVAL_LIKE_METHODS.has(calleeName)
    && !isFunction(handler, context)
    && isReferenceToGlobalFunction(node.expression, context)
  ) {
    context.report({ node: handler, message: messages.noImpliedEvalError });
  }
}
