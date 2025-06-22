import { core, defineConfig } from "./src/index.ts";

export default defineConfig({
  rules: [
    ...core.all(),
    core.noConfusingVoidExpression({ ignoreArrowShorthand: true }),
    core.preferNullishCoalescing({ ignoreConditionalTests: false }),
    core.noMisusedPromises({
      checksConditionals: false,
      checksVoidReturn: { arguments: false, attributes: false },
    }),
    core.switchExhaustivenessCheck({
      allowDefaultCaseForExhaustiveSwitch: false,
      considerDefaultExhaustiveForUnions: true,
    }),
    core.noUnnecessaryCondition({
      allowConstantLoopConditions: "only-allowed-literals",
      checkTypePredicates: true,
    }),
    core.strictBooleanExpressions({
      allowNullableString: true,
      allowNullableBoolean: true,
    }),
    {
      name: "core/returnAwait",
      visitor: {},
    },
  ],
});
