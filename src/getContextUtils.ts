import { intersectionConstituents, unionConstituents } from "ts-api-utils";
import type { Program } from "typescript";
import { typeHasFlag, typeOrUnionHasFlag } from "./rules/_utils/index.ts";
import type { Context } from "./types.ts";

export const getContextUtils = (
  getProgram: () => Program,
): Context["utils"] => ({
  unionConstituents,
  intersectionConstituents,
  typeHasFlag,
  typeOrUnionHasFlag,
  getConstrainedTypeAtLocation(node) {
    const checker = getProgram().getTypeChecker();
    const nodeType = checker.getTypeAtLocation(node);
    return checker.getBaseConstraintOfType(nodeType) ?? nodeType;
  },
});
