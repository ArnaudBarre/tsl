import ts from "typescript";
import type { Checker, CheckerUtils } from "./types.ts";

export const createChecker = (typeChecker: ts.TypeChecker) => {
  /* Credits: ts-api-utils, @typescript-eslint */
  const utils: CheckerUtils = {
    isTypeFlagSet(type, flag) {
      return (type.flags & flag) !== 0;
    },
    getTypeFlags(type) {
      if (!type.isUnion()) return type.flags;
      // @ts-expect-error Since typescript 5.0, this is invalid, but uses 0 as the default value of TypeFlags.
      let flags: ts.TypeFlags = 0;
      for (const t of type.types) flags |= t.flags;
      return flags;
    },
    unionTypeParts(type) {
      return type.isUnion() ? type.types : [type];
    },
    isNullableType(type, isReceiver = false) {
      const flags = this.getTypeFlags(type);
      if (isReceiver && flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
        return true;
      }
      return (flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) !== 0;
    },
    isThenableType(node, type) {
      for (const typePart of this.unionTypeParts(
        typeChecker.getApparentType(type),
      )) {
        const then = typePart.getProperty("then");
        if (!then) continue;
        const thenType = typeChecker.getTypeOfSymbolAtLocation(then, node);
        for (const subTypePart of this.unionTypeParts(thenType)) {
          for (const signature of subTypePart.getCallSignatures()) {
            if (signature.parameters.length !== 0) {
              const param = signature.parameters[0];
              let type: ts.Type | undefined = typeChecker.getApparentType(
                typeChecker.getTypeOfSymbolAtLocation(param, node),
              );
              if (
                (param.valueDeclaration as ts.ParameterDeclaration)
                  .dotDotDotToken
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
  };
  (typeChecker as any).utils = utils;
  return typeChecker as Checker;
};
