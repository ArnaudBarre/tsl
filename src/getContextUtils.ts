import ts from "typescript";
import type { Checker } from "./types.ts";

/* Credits: ts-api-utils, @typescript-eslint */
export type ContextUtils = ReturnType<typeof getContextUtils>;
export const getContextUtils = (checker: Checker) => ({
  isTypeFlagSet(type: ts.Type, flag: ts.TypeFlags): boolean {
    return (type.flags & flag) !== 0;
  },
  getTypeFlags(type: ts.Type): ts.TypeFlags {
    if (!type.isUnion()) return type.flags;
    // @ts-expect-error Since typescript 5.0, this is invalid, but uses 0 as the default value of TypeFlags.
    let flags: ts.TypeFlags = 0;
    for (const t of type.types) flags |= t.flags;
    return flags;
  },
  isAny(type: ts.Type) {
    return this.isTypeFlagSet(type, ts.TypeFlags.Any);
  },
  isUnknown(type: ts.Type) {
    return this.isTypeFlagSet(type, ts.TypeFlags.Unknown);
  },
  unionTypeParts(type: ts.Type): ts.Type[] {
    return type.isUnion() ? type.types : [type];
  },
  isNullableType(type: ts.Type, isReceiver = false): boolean {
    const flags = this.getTypeFlags(type);
    if (isReceiver && flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
      return true;
    }
    return (flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) !== 0;
  },
  isThenableType(node: ts.Node, type: ts.Type): boolean {
    for (const typePart of this.unionTypeParts(checker.getApparentType(type))) {
      const then = typePart.getProperty("then");
      if (!then) continue;
      const thenType = checker.getTypeOfSymbolAtLocation(then, node);
      for (const subTypePart of this.unionTypeParts(thenType)) {
        for (const signature of subTypePart.getCallSignatures()) {
          if (signature.parameters.length !== 0) {
            const param = signature.parameters[0];
            let type: ts.Type | undefined = checker.getApparentType(
              checker.getTypeOfSymbolAtLocation(param, node),
            );
            if (
              (param.valueDeclaration as ts.ParameterDeclaration).dotDotDotToken
            ) {
              // unwrap array type of rest parameter
              type = type.getNumberIndexType();
              if (type === void 0) return false;
            }
            for (const subType of this.unionTypeParts(type)) {
              if (subType.getCallSignatures().length !== 0) return true;
            }
            return false;
          }
        }
      }
    }
    return false;
  },
  getConstrainedTypeAtLocation(node: ts.Node): ts.Type {
    const nodeType = checker.getTypeAtLocation(node);
    return checker.getBaseConstraintOfType(nodeType) ?? nodeType;
  },
});
