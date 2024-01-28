import ts, { TypeFlags } from "typescript";
import type { Checker } from "./types.ts";

export function typeHasFlag(type: ts.Type, flag: ts.TypeFlags): boolean {
  if (!type.isUnion()) return (type.flags & flag) !== 0;
  // @ts-expect-error Since typescript 5.0, this is invalid, but uses 0 as the default value of TypeFlags.
  let flags: ts.TypeFlags = 0;
  for (const t of type.types) flags |= t.flags;
  return (flags & flag) !== 0;
}

export function isTypeAnyArrayType(type: ts.Type, checker: Checker): boolean {
  return (
    checker.isArrayType(type) &&
    typeHasFlag(checker.getTypeArguments(type)[0], TypeFlags.Any)
  );
}

export function isTypeUnknownArrayType(
  type: ts.Type,
  checker: Checker,
): boolean {
  return (
    checker.isArrayType(type) &&
    typeHasFlag(checker.getTypeArguments(type)[0], TypeFlags.Unknown)
  );
}
