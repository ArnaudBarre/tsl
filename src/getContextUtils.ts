import { intersectionConstituents, unionConstituents } from "ts-api-utils";
import type { Program } from "typescript";
import {
  typeHasFlag,
  typeHasSymbolFlag,
  typeOrUnionHasFlag,
} from "./rules/_utils/index.ts";
import type { Context } from "./types.ts";

export const getContextUtils = (
  getProgram: () => Program,
): Context["utils"] => ({
  unionConstituents,
  intersectionConstituents,
  typeHasFlag,
  typeOrUnionHasFlag,
  typeHasSymbolFlag,
  getConstrainedTypeAtLocation(node) {
    const checker = getProgram().getTypeChecker();
    const nodeType = checker.getTypeAtLocation(node);
    return checker.getBaseConstraintOfType(nodeType) ?? nodeType;
  },
});
