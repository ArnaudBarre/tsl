import ts from "typescript";

export function typeHasFlag(type: ts.Type, flag: ts.TypeFlags): boolean {
  if (!type.isUnion()) return (type.flags & flag) !== 0;
  // @ts-expect-error Since typescript 5.0, this is invalid, but uses 0 as the default value of TypeFlags.
  let flags: ts.TypeFlags = 0;
  for (const t of type.types) flags |= t.flags;
  return (flags & flag) !== 0;
}
