import ts, { SyntaxKind } from "typescript";
import type { AST, Context } from "../../types.ts";

/**
 * Inspect a call expression to see if it's a call to an assertion function.
 * If it is, return the node of the argument that is asserted.
 */
export function findTruthinessAssertedArgument(
  context: Context,
  node: AST.CallExpression,
): AST.Expression | undefined {
  // If the call looks like `assert(expr1, expr2, ...c, d, e, f)`, then we can
  // only care if `expr1` or `expr2` is asserted, since anything that happens
  // within or after a spread argument is out of scope to reason about.
  const checkableArguments: AST.Expression[] = [];
  for (const argument of node.arguments) {
    if (argument.kind === SyntaxKind.SpreadElement) {
      break;
    }
    checkableArguments.push(argument);
  }

  // nothing to do
  if (checkableArguments.length === 0) {
    return undefined;
  }

  const signature = context.checker.getResolvedSignature(node);

  if (signature == null) {
    return undefined;
  }

  const firstTypePredicateResult =
    context.checker.getTypePredicateOfSignature(signature);

  if (firstTypePredicateResult == null) {
    return undefined;
  }

  const { kind, parameterIndex, type } = firstTypePredicateResult;
  if (!(kind === ts.TypePredicateKind.AssertsIdentifier && type == null)) {
    return undefined;
  }

  return checkableArguments.at(parameterIndex);
}
