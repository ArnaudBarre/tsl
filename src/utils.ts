import ts from "typescript";
import type { Rule } from "./types.ts";

export const createRule = <Data>(rule: Rule<Data>) => rule;

export const isNullableType = (type: ts.Type, isReceiver = false): boolean => {
  const flags = getTypeFlags(type);
  if (isReceiver && flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
    return true;
  }
  return (flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) !== 0;
};

export const getTypeFlags = (type: ts.Type): ts.TypeFlags => {
  if (!type.isUnion()) return type.flags;
  // @ts-expect-error Since typescript 5.0, this is invalid, but uses 0 as the default value of TypeFlags.
  let flags: ts.TypeFlags = 0;
  for (const t of (type as ts.UnionType).types) flags |= t.flags;
  return flags;
};
