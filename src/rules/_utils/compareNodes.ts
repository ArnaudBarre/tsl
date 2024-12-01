import { SyntaxKind } from "typescript";
import type { AST } from "../../types.ts";

/**
 * Compares two nodes' ASTs to determine if the A is equal to or a subset of B
 */
type NodeComparisonResult =
  | "Equal" /** the two nodes are comparably the same */
  | "Subset" /** the left node is a subset of the right node */
  | "Invalid";
/** the left node is not the same or is a superset of the right node */
const COMPARE_NODES_CACHE = new WeakMap<
  AST.AnyNode,
  WeakMap<AST.AnyNode, NodeComparisonResult>
>();

export function compareNodes(
  nodeA: AST.AnyNode | null | undefined,
  nodeB: AST.AnyNode | null | undefined,
): NodeComparisonResult {
  if (nodeA == null || nodeB == null) {
    if (nodeA !== nodeB) return "Invalid";
    return "Equal";
  }

  const cached = COMPARE_NODES_CACHE.get(nodeA)?.get(nodeB);
  if (cached) return cached;

  const result = compareNodesUncached(nodeA, nodeB);
  let mapA = COMPARE_NODES_CACHE.get(nodeA);
  if (mapA == null) {
    mapA = new WeakMap();
    COMPARE_NODES_CACHE.set(nodeA, mapA);
  }
  mapA.set(nodeB, result);
  return result;
}

function compareNodesUncached(
  nodeA: AST.AnyNode,
  nodeB: AST.AnyNode,
): NodeComparisonResult {
  if (nodeA.kind !== nodeB.kind) {
    // special cases where nodes are allowed to be non-equal

    // look through the type-only non-null assertion because its existence could
    // possibly be replaced by an optional chain instead
    //
    // a.b! && a.b.c
    // ^^^^ TSNonNullExpression
    if (nodeA.kind === SyntaxKind.NonNullExpression) {
      return compareNodes(nodeA.expression, nodeB);
    }
    if (nodeB.kind === SyntaxKind.NonNullExpression) {
      return compareNodes(nodeA, nodeB.expression);
    }

    // special case for subset optional chains where the node types don't match,
    // but we want to try comparing by discarding the "extra" code
    //
    // a && a.b
    //      ^ compare this
    // a && a()
    //      ^ compare this
    // a.b && a.b()
    //        ^^^ compare this
    // a() && a().b
    //        ^^^ compare this
    // import.meta && import.meta.b
    //                ^^^^^^^^^^^ compare this
    if (
      nodeA.kind === SyntaxKind.CallExpression ||
      nodeA.kind === SyntaxKind.Identifier ||
      nodeA.kind === SyntaxKind.PropertyAccessExpression ||
      nodeA.kind === SyntaxKind.ElementAccessExpression ||
      nodeA.kind === SyntaxKind.MetaProperty
    ) {
      switch (nodeB.kind) {
        case SyntaxKind.PropertyAccessExpression:
        case SyntaxKind.ElementAccessExpression:
          const name =
            nodeB.kind === SyntaxKind.PropertyAccessExpression
              ? nodeB.name
              : nodeB.argumentExpression;
          if (name.kind === SyntaxKind.PrivateIdentifier) {
            // Private identifiers in optional chaining is not currently allowed
            // TODO - handle this once TS supports it (https://github.com/microsoft/TypeScript/issues/42734)
            return "Invalid";
          }
          if (compareNodes(nodeA, nodeB.expression) !== "Invalid") {
            return "Subset";
          }
          return "Invalid";

        case SyntaxKind.CallExpression:
          if (compareNodes(nodeA, nodeB.expression) !== "Invalid") {
            return "Subset";
          }
          return "Invalid";

        default:
          return "Invalid";
      }
    }

    return "Invalid";
  }

  switch (nodeA.kind) {
    // these expressions create a new instance each time - so it makes no sense to compare the chain
    case SyntaxKind.ArrayLiteralExpression:
    case SyntaxKind.ArrowFunction:
    case SyntaxKind.ClassExpression:
    case SyntaxKind.FunctionExpression:
    case SyntaxKind.JsxElement:
    case SyntaxKind.JsxFragment:
    case SyntaxKind.NewExpression:
    case SyntaxKind.ObjectLiteralExpression:
      return "Invalid";

    case SyntaxKind.CallExpression: {
      const nodeBCall = nodeB as typeof nodeA;

      // check for cases like
      // foo() && foo()(bar)
      // ^^^^^ nodeA
      //          ^^^^^^^^^^ nodeB
      // we don't want to check the arguments in this case
      const aSubsetOfB = compareNodes(nodeA, nodeBCall.expression);
      if (aSubsetOfB !== "Invalid") {
        return "Subset";
      }

      const calleeCompare = compareNodes(
        nodeA.expression,
        nodeBCall.expression,
      );
      if (calleeCompare !== "Equal") {
        return "Invalid";
      }

      // NOTE - we purposely ignore optional flag because for our purposes
      // foo?.bar() && foo.bar?.()?.baz
      // or
      // foo.bar() && foo?.bar?.()?.baz
      // are going to be exactly the same

      const argumentCompare = compareArrays(
        nodeA.arguments,
        nodeBCall.arguments,
      );
      if (argumentCompare !== "Equal") {
        return "Invalid";
      }

      const typeParamCompare = compareArrays(
        nodeA.typeArguments ?? [],
        nodeBCall.typeArguments ?? [],
      );
      if (typeParamCompare === "Equal") {
        return "Equal";
      }

      return "Invalid";
    }

    case SyntaxKind.Identifier:
    case SyntaxKind.PrivateIdentifier:
      if (nodeA.text === (nodeB as typeof nodeA).text) {
        return "Equal";
      }
      return "Invalid";

    case SyntaxKind.TrueKeyword:
    case SyntaxKind.FalseKeyword:
    case SyntaxKind.NullKeyword:
    case SyntaxKind.ThisKeyword:
    case SyntaxKind.StringKeyword:
    case SyntaxKind.NumberKeyword:
      return "Equal";
    case SyntaxKind.FirstTemplateToken:
    case SyntaxKind.StringLiteral:
    case SyntaxKind.NumericLiteral:
    case SyntaxKind.BigIntLiteral:
    case SyntaxKind.RegularExpressionLiteral: {
      const nodeBLiteral = nodeB as typeof nodeA;
      if (nodeA.text === nodeBLiteral.text) return "Equal";
      return "Invalid";
    }

    case SyntaxKind.PropertyAccessExpression: {
      const nodeBMember = nodeB as typeof nodeA;

      if (nodeBMember.name.kind === SyntaxKind.PrivateIdentifier) {
        // Private identifiers in optional chaining is not currently allowed
        // TODO - handle this once TS supports it (https://github.com/microsoft/TypeScript/issues/42734)
        return "Invalid";
      }

      // check for cases like
      // foo.bar && foo.bar.baz
      // ^^^^^^^ nodeA
      //            ^^^^^^^^^^^ nodeB
      // result === Equal
      //
      // foo.bar && foo.bar.baz.bam
      // ^^^^^^^ nodeA
      //            ^^^^^^^^^^^^^^^ nodeB
      // result === Subset
      //
      // we don't want to check the property in this case
      const aSubsetOfB = compareNodes(nodeA, nodeBMember.expression);
      if (aSubsetOfB !== "Invalid") return "Subset";

      // NOTE - we purposely ignore optional flag because for our purposes
      // foo?.bar && foo.bar?.baz
      // or
      // foo.bar && foo?.bar?.baz
      // are going to be exactly the same

      const objectCompare = compareNodes(
        nodeA.expression,
        nodeBMember.expression,
      );
      if (objectCompare !== "Equal") return "Invalid";

      return compareNodes(nodeA.name, nodeBMember.name);
    }
    case SyntaxKind.ElementAccessExpression: {
      const nodeBMember = nodeB as typeof nodeA;

      // check for cases like
      // foo.bar && foo.bar.baz
      // ^^^^^^^ nodeA
      //            ^^^^^^^^^^^ nodeB
      // result === Equal
      //
      // foo.bar && foo.bar.baz.bam
      // ^^^^^^^ nodeA
      //            ^^^^^^^^^^^^^^^ nodeB
      // result === Subset
      //
      // we don't want to check the property in this case
      const aSubsetOfB = compareNodes(nodeA, nodeBMember.expression);
      if (aSubsetOfB !== "Invalid") return "Subset";

      // NOTE - we purposely ignore optional flag because for our purposes
      // foo?.bar && foo.bar?.baz
      // or
      // foo.bar && foo?.bar?.baz
      // are going to be exactly the same

      const objectCompare = compareNodes(
        nodeA.expression,
        nodeBMember.expression,
      );
      if (objectCompare !== "Equal") return "Invalid";

      return compareNodes(
        nodeA.argumentExpression,
        nodeBMember.argumentExpression,
      );
    }

    case SyntaxKind.TemplateLiteralType:
    case SyntaxKind.TemplateExpression: {
      const nodeBTemplate = nodeB as typeof nodeA;
      const areHeadsEqual = nodeA.head.text === nodeBTemplate.head.text;
      if (!areHeadsEqual) return "Invalid";
      const areQuasisEqual =
        nodeA.templateSpans.length === nodeBTemplate.templateSpans.length &&
        nodeA.templateSpans.every((elA, idx) => {
          const elB = nodeBTemplate.templateSpans[idx];
          return elA.literal.text === elB.literal.text;
        });
      if (!areQuasisEqual) return "Invalid";
      return "Equal";
    }

    case SyntaxKind.MetaProperty: {
      const nodeBMeta = nodeB as typeof nodeA;
      return compareNodes(nodeA.name, nodeBMeta.name);
    }

    case SyntaxKind.AsExpression: {
      const nodeBAs = nodeB as typeof nodeA;
      const expressionCompare = compareNodes(
        nodeA.expression,
        nodeBAs.expression,
      );
      if (expressionCompare !== "Equal") return "Invalid";
      return compareNodes(nodeA.type, nodeBAs.type);
    }

    case SyntaxKind.BinaryExpression: {
      const nodeBBinary = nodeB as typeof nodeA;
      if (nodeA.operatorToken.kind !== nodeBBinary.operatorToken.kind) {
        return "Invalid";
      }
      const leftCompare = compareNodes(nodeA.left, nodeBBinary.left);
      if (leftCompare !== "Equal") return "Invalid";
      return compareNodes(nodeA.right, nodeBBinary.right);
    }

    case SyntaxKind.ParenthesizedExpression:
    case SyntaxKind.NonNullExpression:
    case SyntaxKind.AwaitExpression:
    case SyntaxKind.TypeOfExpression: {
      const nodeBTypeOf = nodeB as typeof nodeA;
      return compareNodes(nodeA.expression, nodeBTypeOf.expression);
    }

    default:
      return "Invalid";
  }
}

function compareUnknownValues(
  valueA: unknown,
  valueB: unknown,
): NodeComparisonResult {
  /* istanbul ignore if -- not possible for us to test this - it's just a sanity safeguard */
  if (valueA == null || valueB == null) {
    if (valueA !== valueB) return "Invalid";
    return "Equal";
  }

  if (!isValidNode(valueA) || !isValidNode(valueB)) return "Invalid";

  return compareNodes(valueA, valueB);
}

function isValidNode(x: unknown): x is AST.AnyNode {
  return (
    typeof x === "object" &&
    x != null &&
    "kind" in x &&
    typeof x.kind === "number"
  );
}

function compareArrays(
  arrayA: readonly unknown[],
  arrayB: readonly unknown[],
): "Equal" | "Invalid" {
  if (arrayA.length !== arrayB.length) return "Invalid";

  const result = arrayA.every((elA, idx) => {
    const elB = arrayB[idx];
    if (elA == null || elB == null) {
      return elA === elB;
    }
    return compareUnknownValues(elA, elB) === "Equal";
  });
  if (result) return "Equal";
  return "Invalid";
}
