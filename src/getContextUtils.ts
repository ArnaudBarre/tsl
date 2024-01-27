import { unionTypeParts } from "ts-api-utils";
import ts from "typescript";
import type { Checker } from "./types.ts";

/* Credits: ts-api-utils, @typescript-eslint */
export type ContextUtils = ReturnType<typeof getContextUtils>;
export const getContextUtils = (checker: Checker) => ({
  isThenableType(node: ts.Node, type: ts.Type): boolean {
    for (const typePart of unionTypeParts(checker.getApparentType(type))) {
      const then = typePart.getProperty("then");
      if (!then) continue;
      const thenType = checker.getTypeOfSymbolAtLocation(then, node);
      for (const subTypePart of unionTypeParts(thenType)) {
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
            for (const subType of unionTypeParts(type)) {
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
