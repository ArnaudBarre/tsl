import { core, defineConfig } from "./src/index.ts";

export default defineConfig({
  rules: [
    ...core.all(),
    core.noConfusingVoidExpression({ ignoreArrowShorthand: true }),
    core.noMisusedPromises({
      checksConditionals: false,
      checksVoidReturn: { arguments: false, attributes: false },
    }),
    core.switchExhaustivenessCheck({
      considerDefaultExhaustiveForUnions: true,
    }),
  ],
});
