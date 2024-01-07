# Round 1: typed rules

await-thenable ✅
consistent-type-exports: ❌ (use verbatimModuleSyntax compilerOption)
dot-notation ✅ (without options)
naming-convention: TODO
no-base-to-string: ✅ (without options, only `.toString()`, see `restrict-plus-operands` and `restrict-template-expressions` for other checks)
no-duplicate-type-constituents.ts ✅ (smarter thanks to `isTypeAssignableTo`)

no-misused-promises.ts ✅
