import type ts from "typescript";
import type { Config, UnknownRule } from "./types";

export const loadConfig = async (program: ts.Program) => {
  return (await import(`${program.getCurrentDirectory()}/type-lint.config.ts`))
    .default as Config<UnknownRule[]>;
};
