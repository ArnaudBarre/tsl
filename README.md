# type-lint

Ongoing work for a modern TypeScript linter

## Core rules

Currently the list of core rules are the type aware lint rules I use from TS-ESLint. If you think more rules should be added, please open an issue, but to reduce the surface, only non-styling type-aware rules will be accepted. Here is the list of TS-ESLint type aware rules with their status:

- await-thenable: Implemented
- consistent-return: Implementation not planned, you can use `noImplicitReturns` compilerOption
- consistent-type-exports: Implementation not planned, you can use `verbatimModuleSyntax` compilerOption
- dot-notation: Implemented without options
- naming-convention: Styling is out of core
- no-array-delete: Implemented
- no-base-to-string: Implemented, only `String()`, `.to(Locale)String()` and `.join()` are checked, see `restrict-plus-operands` and `restrict-template-expressions` for other checks
- no-confusing-void-expression: Implemented
- no-deprecated: Not implemented
- no-duplicate-type-constituents: Merged with `no-redundant-type-constituents`
- no-floating-promises: Implemented, allowList is named based only
- no-for-in-array: Implemented
- no-implied-eval: Implemented, do not check for global shadowing
- no-meaningless-void-operator: Implemented
- no-misused-promises: Implemented
- no-misused-spread: Implemented, no allow option
- no-mixed-enums: TS only concept are out of core
- no-redundant-type-constituents: Implemented and smarter thanks to `checker.isTypeAssignableTo`
- no-unnecessary-boolean-literal-compare: Implemented
- no-unnecessary-condition: Implemented
- no-unnecessary-qualifier: TS only concept are out of core
- no-unnecessary-template-expression: Implemented
- no-unnecessary-type-arguments: Implemented
- no-unnecessary-type-assertion: Implemented
- no-unnecessary-type-conversion: Implemented
- no-unnecessary-type-parameters: Implementation not planned, IMO report too many legitimate cases
- no-unsafe-argument: Implementation not planned, too noisy for me
- no-unsafe-assignment: Implementation not planned, too noisy for me
- no-unsafe-call: Implementation not planned, too noisy for me
- no-unsafe-enum-comparison: TS only concept are out of core
- no-unsafe-member-access: Implementation not planned, too noisy for me
- no-unsafe-return: Implementation not planned, too noisy for me
- no-unsafe-type-assertion: Implementation not planned, too noisy for me
- no-unsafe-unary-minus: Implementation not planned, too noisy for me
- non-nullable-type-assertion-style: Implemented
- only-throw-error: Implemented, allow options is named based only
- prefer-destructuring: Styling is out of core
- prefer-find: Implemented
- prefer-includes: Implemented, without `/baz/.test(a)`, it requires regex parsing and can be achieved without type information
- prefer-nullish-coalescing: Implemented
- prefer-optional-chain: Implemented
- prefer-promise-reject-errors: Implementation not planned, can be achieved with global types instead
- prefer-readonly: Not implemented, to OOP for me
- prefer-readonly-parameter-types: Implementation not planned, it would better to check that function parameters are never mutated instead
- prefer-reduce-type-parameter: Implemented,
- prefer-regexp-exec: Implementation not planned, small regex optimization are out of core
- prefer-return-this-type: Implemented
- prefer-string-starts-ends-with: Implemented
- promise-function-async: Implementation not planned, could be implemented
- related-getter-setter-pairs: Not implemented, to OOP for me
- require-array-sort-compare: Not implemented
- require-await: Implementation not planned, type information to handle async generators, which is a niche case
- restrict-plus-operands: Implemented with stricter defaults, always lint assignment
- restrict-template-expressions: Implemented
- return-await: Implemented, only support always, remove unneeded await handled by await-thenable
- strict-boolean-expressions: Not implemneted
- switch-exhaustiveness-check: Implemented, missing no default comment #10218
- unbound-method: Not implemented, to OOP for me
- use-unknown-in-catch-callback-variable: Implementation not planned, you can use global types instead
