import {
  isIntrinsicAnyType,
  isIntrinsicUnknownType,
  isTypeParameter,
} from "ts-api-utils";
import type * as ts from "typescript";
import type { AST, Context } from "../../types.ts";

export function needsToBeAwaited(
  context: Context,
  node: AST.AnyNode,
  type: ts.Type,
): "Always" | "Never" | "May" {
  // can't use `getConstrainedTypeAtLocation` directly since it's bugged for
  // unconstrained generics.
  const constrainedType = !isTypeParameter(type)
    ? type
    : context.checker.getBaseConstraintOfType(type);

  // unconstrained generic types should be treated as unknown
  if (constrainedType == null) {
    return "May";
  }

  // `any` and `unknown` types may need to be awaited
  if (
    isIntrinsicAnyType(constrainedType)
    || isIntrinsicUnknownType(constrainedType)
  ) {
    return "May";
  }

  // 'thenable' values should always be be awaited
  if (context.utils.isThenableType(node, constrainedType)) {
    return "Always";
  }

  // anything else should not be awaited
  return "Never";
}
