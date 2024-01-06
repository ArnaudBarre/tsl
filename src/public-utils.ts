import type { AnyRule, Config, Rule } from "./types.ts";

export const createRule = <
  Name extends string,
  OptionsInput = undefined,
  OptionsOutput = undefined,
  Data = undefined,
>(
  rule: Rule<Name, OptionsInput, OptionsOutput, Data>,
) => rule;

export const defineConfig = <Rules extends AnyRule[]>(config: Config<Rules>) =>
  config;
