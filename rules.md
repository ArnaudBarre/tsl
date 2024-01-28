# Round 1: typed rules

await-thenable ✅
consistent-type-exports ❌ (use verbatimModuleSyntax compilerOption)
dot-notation ✅ (without options)
naming-convention: TODO?
no-base-to-string: ✅ (without options, only `.toString()`, see `restrict-plus-operands` and `restrict-template-expressions` for other checks)
no-duplicate-type-constituents ❌(merged with no-redundant-type-constituents)
no-floating-promises ✅
no-for-in-array ✅
no-implied-eval ✅ (do not check for global shadowing)
no-meaningless-void-operator ✅
no-misused-promises ✅
no-mixed-enums ❌ (type rule only to handle cases not supported in isolatedModules)
no-redundant-type-constituents ✅ (smarter thanks to `isTypeAssignableTo`)
no-throw-literal ✅
no-unnecessary-boolean-literal-compare ✅
no-unnecessary-non-null-expression ✅ (no crazy edge case for non-strict mode)
no-unnecessary-qualifier ❌ (please move out of TS only concept)
no-unnecessary-type-arguments ✅
no-unnecessary-type-assertion ✅
no-unsafe-argument ✅
no-unsafe-assignment ✅ (strict mode only)
