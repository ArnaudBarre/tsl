import type { Config, Rule } from "./types.ts";

export const createRule = <
  Name extends string,
  F extends (...args: any[]) => Rule<Name, any>,
>(
  fn: F,
) => fn;

export const defineConfig = <const BaseRuleName extends string>(
  config: Config<BaseRuleName>,
) => config;
