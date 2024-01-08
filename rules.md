# Round 1: typed rules

await-thenable ✅
consistent-type-exports: ❌ (use verbatimModuleSyntax compilerOption)
dot-notation ✅ (without options)
naming-convention: TODO
no-base-to-string: ✅ (without options, only `.toString()`, see `restrict-plus-operands` and `restrict-template-expressions` for other checks)
no-duplicate-type-constituents ✅ (smarter thanks to `isTypeAssignableTo`)
no-floating-promises ✅
no-for-in-array ✅
no-implied-eval ✅ (do not check for global shadowing)
no-meaningless-void-operator ✅

no-misused-promises ✅
