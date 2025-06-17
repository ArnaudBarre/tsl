import { isTypeFlagSet } from "ts-api-utils";
import { SyntaxKind, type Type, TypeFlags } from "typescript";
import { defineRule } from "../_utils/index.ts";
import type { TypeNode } from "../../ast.ts";
import type { AST, Context } from "../../types.ts";

export const messages = {
  intersection: (params: { type: string; overrideBy: string }) =>
    `${params.type} is overridden by ${params.overrideBy} and can be removed.`,
  union: (params: { type: string; assignableTo: string }) =>
    `${params.type} is assignable to ${params.assignableTo} and can be removed.`,
};

export const noRedundantTypeConstituents = defineRule(() => ({
  name: "core/noRedundantTypeConstituents",
  visitor: {
    IntersectionType(node, context): void {
      if (
        node.parent.kind === SyntaxKind.ParenthesizedType
        && node.parent.parent.kind === SyntaxKind.IntersectionType
      ) {
        return;
      }
      const flattenNodes = flattenIntersection(node);
      for (const typeNode of flattenNodes) {
        const type = context.checker.getTypeAtLocation(typeNode);
        for (const otherTypeNode of flattenNodes) {
          if (typeNode === otherTypeNode) {
            // Break so we don't report both parts with duplicate
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
            typeNode.kind === SyntaxKind.LiteralType
            && literals.includes(typeNode.literal.kind)
            && baseTypes.includes(otherTypeNode.kind)
          ) {
            reportIntersection(context, otherTypeNode, typeNode);
          } else if (
            otherTypeNode.kind === SyntaxKind.LiteralType
            && literals.includes(otherTypeNode.literal.kind)
            && baseTypes.includes(typeNode.kind)
          ) {
            reportIntersection(context, typeNode, otherTypeNode);
          }
        }
      }
    },
    UnionType(node, context): void {
      if (
        node.parent.kind === SyntaxKind.ParenthesizedType
        && node.parent.parent.kind === SyntaxKind.UnionType
      ) {
        return;
      }
      const flattenNodes = flattenUnion(node);
      const redundantNodes: AST.TypeNode[] = [];
      for (const typeNode of flattenNodes) {
        const type = context.checker.getTypeAtLocation(typeNode);
        if (skipCheckForUnion(type)) continue;
        for (const otherTypeNode of flattenNodes) {
          if (typeNode === otherTypeNode) {
            // Break so we don't report both parts with duplicate
            break;
          }
          const otherType = context.checker.getTypeAtLocation(otherTypeNode);
          if (skipCheckForUnion(otherType)) continue;
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
                type: printNode(redundantNode),
                assignableTo: printNode(assignableToNode),
              }),
            });
          } else if (context.checker.isTypeAssignableTo(otherType, type)) {
            if (redundantNodes.includes(otherTypeNode)) continue;
            redundantNodes.push(otherTypeNode);
            context.report({
              node: otherTypeNode,
              message: messages.union({
                type: printNode(otherTypeNode),
                assignableTo: printNode(typeNode),
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
    n.kind === SyntaxKind.ParenthesizedType
    && n.type.kind === SyntaxKind.UnionType
      ? flattenUnion(n.type)
      : [n],
  );
const flattenIntersection = (node: AST.IntersectionTypeNode): TypeNode[] =>
  node.types.flatMap((n) =>
    n.kind === SyntaxKind.ParenthesizedType
    && n.type.kind === SyntaxKind.IntersectionType
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

const baseTypes = [
  ...literals,
  SyntaxKind.StringKeyword,
  SyntaxKind.BooleanKeyword,
  SyntaxKind.NumberKeyword,
  SyntaxKind.TemplateLiteralType,
];

const reportIntersection = (
  context: Context,
  redundantNode: TypeNode,
  overriddenBy: TypeNode,
) => {
  context.report({
    node: redundantNode,
    message: messages.intersection({
      type: printNode(redundantNode),
      overrideBy: printNode(overriddenBy),
    }),
  });
};

const printNode = (node: TypeNode) => {
  const oneLineText = node.getText().replaceAll("\s+", " ");
  return oneLineText.length > 100
    ? oneLineText.slice(0, 95) + "..."
    : oneLineText;
};

const skipCheckForUnion = (type: Type) =>
  // the Instantiable flag is currently the best way I found to avoid flaging types
  // containing type variables, but it too wide and also matches template expressions
  isTypeFlagSet(type, TypeFlags.Instantiable)
  || isTypeFlagSet(type, TypeFlags.TypeVariable)
  || isEnumAutocompleteHack(type);

const isEnumAutocompleteHack = (type: Type) =>
  type.isIntersection()
  && type.types.length === 2
  && type.types.some((t) => t.flags === TypeFlags.String)
  && type.types.some((t) => t.flags === TypeFlags.Object);
