import { unionConstituents } from "ts-api-utils";
import type { ParameterDeclaration, Program, Type } from "typescript";
import type { Context } from "./types";

/* Credits: ts-api-utils, @typescript-eslint */
export const getContextUtils = (
  getProgram: () => Program,
): Context["utils"] => ({
  isThenableType(node, type) {
    const checker = getProgram().getTypeChecker();
    for (const typePart of unionConstituents(checker.getApparentType(type))) {
      const then = typePart.getProperty("then");
      if (!then) continue;
      const thenType = checker.getTypeOfSymbolAtLocation(then, node);
      for (const subTypePart of unionConstituents(thenType)) {
        for (const signature of subTypePart.getCallSignatures()) {
          if (signature.parameters.length !== 0) {
            const param = signature.parameters[0];
            let type: Type | undefined = checker.getApparentType(
              checker.getTypeOfSymbolAtLocation(param, node),
            );
            if (
              (param.valueDeclaration as ParameterDeclaration).dotDotDotToken
            ) {
              // unwrap array type of rest parameter
              type = type.getNumberIndexType();
              if (type === void 0) return false;
            }
            for (const subType of unionConstituents(type)) {
              if (subType.getCallSignatures().length !== 0) return true;
            }
            return false;
          }
        }
      }
    }
    return false;
  },
  getConstrainedTypeAtLocation(node) {
    const checker = getProgram().getTypeChecker();
    const nodeType = checker.getTypeAtLocation(node);
    return checker.getBaseConstraintOfType(nodeType) ?? nodeType;
  },
});
