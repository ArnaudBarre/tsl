import { isTypeFlagSet } from "ts-api-utils";
import { SyntaxKind, TypeFlags } from "typescript";
import type { TypeNode } from "../../ast.ts";
import { createRule } from "../../public-utils.ts";
import type { AST, Context } from "../../types.ts";

export const messages = {
  intersection: (params: { type: string; overrideBy: string }) =>
    `${params.type} is overridden by ${params.overrideBy} and can be removed.`,
  union: (params: { type: string; assignableTo: string }) =>
    `${params.type} is assignable to ${params.assignableTo} and can be removed.`,
};

export const noRedundantTypeConstituents = createRule(() => ({
  name: "core/noRedundantTypeConstituents",
  visitor: {
    IntersectionType(node, context): void {
      if (
        node.parent.kind === SyntaxKind.ParenthesizedType &&
        node.parent.parent.kind === SyntaxKind.IntersectionType
      ) {
        return;
      }
      const flattenNodes = flattenIntersection(node);
      for (const typeNode of flattenNodes) {
        const type = context.checker.getTypeAtLocation(typeNode);
        for (const otherTypeNode of flattenNodes) {
          if (typeNode === otherTypeNode) {
            // Using break, so we don't report both parts with duplicate
            break;
          }
          const otherType = context.checker.getTypeAtLocation(otherTypeNode);
          if (type.flags === TypeFlags.Never) {
            reportIntersection(context, otherTypeNode, typeNode);
          } else if (otherType.flags === TypeFlags.Never) {
            reportIntersection(context, typeNode, otherTypeNode);
          } else if (type.flags === TypeFlags.Any) {
            reportIntersection(context, otherTypeNode, typeNode);
          } else if (otherType.flags === TypeFlags.Any) {
            reportIntersection(context, typeNode, otherTypeNode);
          } else if (type.flags === TypeFlags.Unknown) {
            reportIntersection(context, typeNode, otherTypeNode);
          } else if (otherType.flags === TypeFlags.Unknown) {
            reportIntersection(context, otherTypeNode, typeNode);
          } else if (
            typeNode.kind === SyntaxKind.LiteralType &&
            literals.includes(typeNode.literal.kind)
          ) {
            reportIntersection(context, otherTypeNode, typeNode);
          } else if (
            otherTypeNode.kind === SyntaxKind.LiteralType &&
            literals.includes(otherTypeNode.literal.kind)
          ) {
            reportIntersection(context, typeNode, otherTypeNode);
          }
        }
      }
    },
    UnionType(node, context): void {
      if (
        node.parent.kind === SyntaxKind.ParenthesizedType &&
        node.parent.parent.kind === SyntaxKind.UnionType
      ) {
        return;
      }
      const flattenNodes = flattenUnion(node);
      const redundantNodes: AST.TypeNode[] = [];
      for (const typeNode of flattenNodes) {
        const type = context.checker.getTypeAtLocation(typeNode);
        for (const otherTypeNode of flattenNodes) {
          if (typeNode === otherTypeNode) {
            // Using break, so we don't report both parts with duplicate
            break;
          }
          const otherType = context.checker.getTypeAtLocation(otherTypeNode);
          // Generics can lead to false positive
          if (isTypeFlagSet(otherType, TypeFlags.TypeVariable)) continue;
          if (context.checker.isTypeAssignableTo(type, otherType)) {
            const [redundantNode, assignableToNode] =
              type.flags === TypeFlags.Any
                ? [otherTypeNode, typeNode]
                : [typeNode, otherTypeNode];
            if (redundantNodes.includes(redundantNode)) continue;
            redundantNodes.push(redundantNode);
            context.report({
              node: redundantNode,
              message: messages.union({
                type: redundantNode.getText(),
                assignableTo: assignableToNode.getText(),
              }),
            });
          } else if (context.checker.isTypeAssignableTo(otherType, type)) {
            if (redundantNodes.includes(otherTypeNode)) continue;
            redundantNodes.push(otherTypeNode);
            context.report({
              node: otherTypeNode,
              message: messages.union({
                type: otherTypeNode.getText(),
                assignableTo: typeNode.getText(),
              }),
            });
          }
        }
      }
    },
  },
}));

const flattenUnion = (node: AST.UnionTypeNode): TypeNode[] =>
  node.types.flatMap((n) =>
    n.kind === SyntaxKind.ParenthesizedType &&
    n.type.kind === SyntaxKind.UnionType
      ? flattenUnion(n.type)
      : [n],
  );
const flattenIntersection = (node: AST.IntersectionTypeNode): TypeNode[] =>
  node.types.flatMap((n) =>
    n.kind === SyntaxKind.ParenthesizedType &&
    n.type.kind === SyntaxKind.IntersectionType
      ? flattenIntersection(n.type)
      : [n],
  );

const literals = [
  SyntaxKind.BigIntLiteral,
  SyntaxKind.NumericLiteral,
  SyntaxKind.NoSubstitutionTemplateLiteral,
  SyntaxKind.RegularExpressionLiteral,
  SyntaxKind.StringLiteral,
  SyntaxKind.FalseKeyword,
  SyntaxKind.TrueKeyword,
  SyntaxKind.NullKeyword,
];

const reportIntersection = (
  context: Context,
  redundantNode: TypeNode,
  overriddenBy: TypeNode,
) => {
  context.report({
    node: redundantNode,
    message: messages.intersection({
      type: redundantNode.getText(),
      overrideBy: overriddenBy.getText(),
    }),
  });
};
