import ts, { SyntaxKind } from "typescript";
import { createRule } from "../../index.ts";

export const messages = {
  preferIncludes: "Use 'includes()' method instead.",
  fix: "Replace 'indexOf()' with 'includes()'.",
};

export const preferIncludes = createRule(() => ({
  name: "core/preferIncludes",
  visitor: {
    PropertyAccessExpression(node, context) {
      if (node.name.kind !== SyntaxKind.Identifier) return;
      if (node.name.text !== "indexOf") return;
      if (node.parent.kind !== SyntaxKind.CallExpression) return;
      if (node.parent.parent.kind !== SyntaxKind.BinaryExpression) return;
      const isLeft = node.parent.parent.left === node.parent;
      const compareNode = isLeft
        ? node.parent.parent.right
        : node.parent.parent.left;
      let notIncludes = false;
      const operator = node.parent.parent.operatorToken.kind;
      switch (operator) {
        case SyntaxKind.EqualsEqualsToken:
        case SyntaxKind.EqualsEqualsEqualsToken:
        case SyntaxKind.ExclamationEqualsEqualsToken:
        case SyntaxKind.ExclamationEqualsToken:
        case SyntaxKind.GreaterThanToken:
        case SyntaxKind.LessThanEqualsToken:
          if (compareNode.kind !== SyntaxKind.PrefixUnaryExpression) return;
          if (compareNode.operand.kind !== SyntaxKind.NumericLiteral) return;
          if (compareNode.operand.text !== "1") return;
          notIncludes =
            operator === SyntaxKind.EqualsEqualsToken ||
            operator === SyntaxKind.EqualsEqualsEqualsToken ||
            operator === SyntaxKind.LessThanEqualsToken;
          break;
        case SyntaxKind.GreaterThanEqualsToken:
        case SyntaxKind.LessThanToken:
          if (compareNode.kind !== SyntaxKind.NumericLiteral) return;
          if (compareNode.text !== "0") return;
          notIncludes = operator === SyntaxKind.LessThanToken;
          break;
        default:
          return;
      }
      // Get the symbol of `indexOf` method.
      const indexOfMethodDeclarations = context.checker
        .getSymbolAtLocation(node.name)
        ?.getDeclarations();
      if (
        indexOfMethodDeclarations == null ||
        indexOfMethodDeclarations.length === 0
      ) {
        return;
      }

      // Check if every declaration of `indexOf` method has `includes` method
      // and the two methods have the same parameters.
      for (const instanceofMethodDecl of indexOfMethodDeclarations) {
        const typeDecl = instanceofMethodDecl.parent;
        const type = context.checker.getTypeAtLocation(typeDecl);
        const includesMethodDecl = type
          .getProperty("includes")
          ?.getDeclarations();
        if (
          !includesMethodDecl?.some((includesMethodDecl) =>
            hasSameParameters(includesMethodDecl, instanceofMethodDecl),
          )
        ) {
          return;
        }
      }

      context.report({
        node: node.parent.parent,
        message: messages.preferIncludes,
        suggestions: node.questionDotToken
          ? []
          : [
              {
                message: messages.fix,
                changes: [
                  { node: node.name, newText: "includes" },
                  {
                    start: node.parent.getStart(),
                    length: 0,
                    newText: notIncludes ? "!" : "",
                  },
                  isLeft
                    ? {
                        start: node.parent.end,
                        end: node.parent.parent.getEnd(),
                        newText: "",
                      }
                    : {
                        start: node.parent.parent.getStart(),
                        end: node.parent.end,
                        newText: "",
                      },
                ],
              },
            ],
      });
    },
  },
}));

function hasSameParameters(
  nodeA: ts.Declaration,
  nodeB: ts.Declaration,
): boolean {
  if (!ts.isFunctionLike(nodeA) || !ts.isFunctionLike(nodeB)) {
    return false;
  }

  const paramsA = nodeA.parameters;
  const paramsB = nodeB.parameters;
  if (paramsA.length !== paramsB.length) {
    return false;
  }

  for (let i = 0; i < paramsA.length; ++i) {
    const paramA = paramsA[i];
    const paramB = paramsB[i];

    // Check name, type, and question token once.
    if (paramA.getText() !== paramB.getText()) {
      return false;
    }
  }

  return true;
}
