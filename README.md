# tsl [![npm](https://img.shields.io/npm/v/tsl)](https://www.npmjs.com/package/tsl)

tsl is an extension of tsc for type-aware linting. It's designed to be used in conjunction with fast linters like [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) or [Biome](https://biomejs.dev/) that can't leverage type information and currently lack APIs for writing custom rules in TypeScript. But you can also use it with ESLint or standalone.

## Features

- Run type-aware rules [faster](https://github.com/ArnaudBarre/tsl/issues/3) than [typescript-eslint](https://typescript-eslint.io/)
- Type safe config with custom rules in TypeScript
- Project-wide rules (experimental)
- No [IDE caching issue](https://typescript-eslint.io/troubleshooting/faqs/general/#changes-to-one-file-are-not-reflected-when-linting-other-files-in-my-ide)
- Something missing? Look at the [roadmap](https://github.com/ArnaudBarre/tsl/issues/4) or [open an issue](https://github.com/ArnaudBarre/tsl/issues/new)

## What is type-aware linting?

Most lint rules only rely on the structure (AST) to detect issues. On top of that, type-aware linting leverage type information, such as the types of variables or return values, to detect new issues. Here are two of the most common issues that type-aware linting can detect:

```ts
async function foo() {
  try {
    doAsyncWork(); // <- Missing await
    // ^ core/noFloatingPromises: Promises must be awaited, [...]
  } catch {
    // This will never run, even if doAsyncWork() throws
    return getDefault();
  }
}
```

```ts
type User = { firstName: string | null };

function greet(user: User) {
  console.log(`Hello ${user.firstName}`);
  //                   ^ core/restrictTemplateExpressions: Invalid type "string | null" of template literal expression.
}

greet({ firstName: null }); // logs "Hello null"
```

To know if you are using type-aware linting in ESLint, see if `@typescript-eslint/parser` is installed and if you have `project` or `projectService` in `languageOptions.parserOptions` in your config.

## Installation

```bash
npm install -D tsl
```

> [!NOTE]  
> TS >=5.8 is expected as a peer dependency.

### Add a configuration

Add a `tsl.config.ts` file to your project root. If you don't have one, all core rules are enabled (cli only, editor integration requires a config).

You can either enable all core rules and disable some of them or update options if needed,

```ts
// tsl.config.ts
import { core, defineConfig } from "tsl";

export default defineConfig({
  rules: [
    ...core.all(),
    core.strictBooleanExpressions("off"),
    core.switchExhaustivenessCheck({
      considerDefaultExhaustiveForUnions: true,
    }),
  ],
});
```

or pick only the rules you want to enable.

```ts
// tsl.config.ts
import { core, defineConfig } from "tsl";

export default defineConfig({
  rules: [
    core.noFloatingPromises(),
    core.noForInArray(),
    core.preferOptionalChain(),
    core.switchExhaustivenessCheck({
      considerDefaultExhaustiveForUnions: true,
    }),
  ],
});
```

### Migrate from typescript-eslint

If you are using typescript-eslint, you can import the rules supported by tsl with this command:

```bash
npx tsl --migrate
```

### Add the TypeScript plugin

Instead of developing multiple plugins for each IDE, tsl provides a compiler plugin that can be used to display diagnostics in the editor and provide suggestions.

In your `tsconfig.json` add the following:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "tsl/plugin" }]
  }
}
```

> [!IMPORTANT]
> If you use VS Code, you need to run the "TypeScript: Select TypeScript Version" command (when viewing a TS file) and choose "Use Workspace Version".

### Add the patches

Rules like [prefer-promise-reject-errors](https://typescript-eslint.io/rules/prefer-promise-reject-errors/) and [use-unknown-in-catch-callback-variable](https://typescript-eslint.io/rules/use-unknown-in-catch-callback-variable/) in typescript-eslint are implemented with patches to override the builtin types. To do so, add the following to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["tsl/patches"]
  }
}
```

They can also be added individually with `tsl/patches/promiseRejectError` or `tsl/patches/unknowninCatchCallbacks`.

### Update your scripts to run the linter

To avoid parsing and typechecking twice your codebase, tsl runs first tsc via the Node API and then runs the rules on the TS AST.

```diff
{
  "scripts": {
-    "typecheck": "tsc"
+    "typecheck": "tsl"
  }
}
```

#### Can I use it without the tsc wrapper?

Yes, you can run `tsl --lint-only` directly. But if you use rules that request type information for a lot of nodes this can be very inefficient. As an example, running on my work codebase (~1k TS files), `tsc` takes 17s, `tsl --lint-only` takes 17s, and `tsl` (doing both) takes 21s.

### Update your CI

```diff
-  - run: npm run tsc
+  - run: npm run tsl
```

### Run for another tsconfig

```sh
tsl -p tsconfig.test.json
tsl --project tsconfig.test.json
```

## Configuration

### ignore

Everything in node_modules is ignored by default. If you want to ignore generated code, you can use the `ignore` option. The current implementation is simply `ignore.some((i) => path.includes(i))`. By design, files that are excluded in the TS config will not be linted.

```ts
defineConfig({
  ignore: ["src/generated/"],
});
```

### diagnosticCategory

To differentiate tsl reports from TS errors, tsl diagnostics are reported by default as warnings. If you prefer having only red squiggles, you can set the `diagnosticCategory` option to `"error"`.

```ts
defineConfig({
  diagnosticCategory: "error",
});
```

### overrides

If for some subset of files you want to enable or disable rules, you can use the `overrides` option like this:

```ts
defineConfig({
  overrides: [
    {
      files: [".server.ts"],
      rules: [
        core.dotNotation("off"),
        core.switchExhaustivenessCheck({ requireDefaultForNonUnion: true }),
      ],
    },
  ],
});
```

Like the ignore option, the `files` option test for inclusion against the file path.

Redeclared rules (identical name) completely replace the "base" rule, there is no merging of options.

### enableProjectWideRulesInIDE (experimental)

Enable project-wide rules in IDE. The IDE implementation is still a work in progress, and memory leaks or performance issues may occur. Enable and report issues if you encounter any.

## Ignore comments

Rules reports can be ignored with line comments (ignore next line) or one line block comments (ignore for the whole file).

```ts
/* tsl-ignore */
/* tsl-ignore org/ruleA */

// tsl-ignore org/ruleB
const a = 1;

// tsl-ignore org/ruleC, org/ruleD: reason
const b = 2;
```

## Custom rules

Writing custom rules is part of the core values of tsl.

Rules run on the TS AST, which is less known than ESTree but allows to query type information for a given node with `context.checker.getTypeAtLocation(node)`. Use [ast-explorer.dev](https://ast-explorer.dev/#eNo9zEEKwjAQheGrxLdSKG5ctV5AcO9qNiEdQmSYCUlVpPTuTSl0+72fN0Mw4O2/voaS8oQOucH0z3xAaBBMqwlfxeKZ8GARcz8rMp4Ilztpy6xlM6lzBPEaPz7yi0tNpoTB9X23b/vtM+m48Y10wbIChCAraw==) to explore the AST. To explore type information, use [ts-ast-viewer](https://ts-ast-viewer.com/).

By default, the TS AST is, funny enough, poorly typed. That's why tsl ships with rewritten AST types that allows for type narrowing and exhaustive switches.

To help build rules, a few common utils are available on `context.utils`, and `context.checker` is overridden with some type changes.

```ts
import { type AST, core, defineConfig } from "tsl";
import { SyntaxKind, TypeFlags } from "typescript";

export default defineConfig({
  rules: [
    ...core.all(),
    {
      name: "org/useLogger",
      visitor: {
        CallExpression(context, node) {
          if (
            node.expression.kind === SyntaxKind.PropertyAccessExpression
            && node.expression.expression.kind === SyntaxKind.Identifier
            && node.expression.expression.text === "console"
          ) {
            node.expression.expression satisfies AST.Identifier;
            context.report({ node, message: "Use logger instead" });
          }
        },
      },
    },
    {
      name: "org/jsxNoNumberTruthiness",
      visitor: {
        BinaryExpression(context, node) {
          if (
            node.parent.kind === SyntaxKind.JsxExpression
            && node.operatorToken.kind === SyntaxKind.AmpersandAmpersandToken
          ) {
            const type = context.checker.getTypeAtLocation(node.left);
            if (context.utils.typeOrUnionHasFlag(type, TypeFlags.NumberLike)) {
              context.report({
                node,
                message:
                  "Don't use logical expression on a number inside JSX, you might render the character 0 instead of rendering nothing.",
              });
            }
          }
        },
      },
    },
  ],
});
```

### Project-wide rules (added in 1.1.0, experimental)

Rules can optionally implement an `aggregate` function that will be called once for all files that have been linted. This allows to implement rules that require cross-file analysis, like detecting circular dependencies.

```ts
import { type AST, core, defineConfig } from "tsl";

type ImportsData = {
  imports: { path: string; node: AST.ImportDeclaration }[];
};

export default defineConfig({
  rules: [
    ...core.all(),
    {
      name: "org/noCircularDependencies",
      createData: (): ImportsData => ({ imports: [] }),
      visitor: {
        ImportDeclaration(context, node) {
          context.data.imports.push({ path: toAbsolutePath(node), node });
        },
      },
      aggregate(context, files) {
        //                ^ { sourceFile: AST.SourceFile; data: ImportsData }[]
        for (const circularEntry of getCircularDependencies(files)) {
          context.report({
            message: "Circular dependency detected",
            sourceFile: circularEntry.sourceFile,
            node: circularEntry.data.imports[circularEntry.importIndex].node,
          });
        }
      },
    },
  ],
});
```

> [!CAUTION]
> Project-wide rules are currently not supported inside overrides

> [!IMPORTANT]
> The list of files is only files that were linted. If you need a generated file to be in that list, but you still want to ignore all lint rules inside it, use a top level ignore comment instead of using the ignore option.

## Core rules

Currently, the list of core rules are the type-aware lint rules I use from typescript-eslint. If you think more rules should be added, please open an issue, but to reduce the surface, only non-styling type-aware rules will be accepted. Here is the list of [typescript-eslint type aware rules](https://typescript-eslint.io/rules/?=typeInformation) with their status:

- await-thenable: ✅ Implemented
- consistent-return: 🛑 Implementation not planned, you can use `noImplicitReturns` compilerOption
- consistent-type-exports: 🛑 Implementation not planned, you can use `verbatimModuleSyntax` compilerOption
- dot-notation: ✅ Implemented without options
- naming-convention: Styling is out of core
- no-array-delete: ✅ Implemented
- no-base-to-string: ✅ Implemented, only `String()`, `.to(Locale)String()` and `.join()` are checked, see `restrict-plus-operands` and `restrict-template-expressions` for other checks
- no-confusing-void-expression: ✅ Implemented
- no-deprecated: ❌ Not implemented
- no-duplicate-type-constituents: 🗑️ Merged with `no-redundant-type-constituents`
- no-floating-promises: ✅ Implemented, allowList is named based only
- no-for-in-array: ✅ Implemented
- no-implied-eval: ✅ Implemented, do not check for global shadowing
- no-meaningless-void-operator: ✅ Implemented
- no-misused-promises: ✅ Implemented
- no-misused-spread: ✅ Implemented, no allow option
- no-mixed-enums: 🛑 TS only concepts are out of core
- no-redundant-type-constituents: ✅ Implemented and smarter thanks to `checker.isTypeAssignableTo`
- no-unnecessary-boolean-literal-compare: ✅ Implemented
- no-unnecessary-condition: ✅ Implemented
- no-unnecessary-qualifier: TS only concepts are out of core
- no-unnecessary-template-expression: ✅ Implemented
- no-unnecessary-type-arguments: ✅ Implemented
- no-unnecessary-type-assertion: ✅ Implemented
- no-unnecessary-type-conversion: ✅ Implemented
- no-unnecessary-type-parameters: ❌ Not implemented, IMO report too many legitimate cases
- no-unsafe-argument: ❌ Not implemented, too noisy for me
- no-unsafe-assignment: ❌ Not implemented, too noisy for me
- no-unsafe-call: ❌ Not implemented, too noisy for me
- no-unsafe-enum-comparison: 🛑 TS only concepts are out of core
- no-unsafe-member-access: ❌ Not implemented, too noisy for me
- no-unsafe-return: ❌ Not implemented, too noisy for me
- no-unsafe-type-assertion: ❌ Not implemented, too noisy for me
- no-unsafe-unary-minus: ✅ Implemented
- no-useless-default-assignment: ✅ Implemented
- non-nullable-type-assertion-style: ✅ Implemented
- only-throw-error: ✅ Implemented, allow options is named based only
- prefer-destructuring: Styling is out of core
- prefer-find: ✅ Implemented
- prefer-includes: ✅ Implemented, without `/baz/.test(a)`, it requires regex parsing and can be achieved without type information
- prefer-nullish-coalescing: ✅ Implemented
- prefer-optional-chain: ✅ Implemented
- prefer-promise-reject-errors: 🛑 See [Add the patches](#add-the-patches)
- prefer-readonly: ❌ Not implemented, too OOP for me
- prefer-readonly-parameter-types: 🛑 Implementation not planned, it would better to check that function parameters are never mutated instead
- prefer-reduce-type-parameter: ✅ Implemented,
- prefer-regexp-exec: 🛑 Small runtime optimization are out of core
- prefer-return-this-type: ✅ Implemented
- prefer-string-starts-ends-with: ✅ Implemented
- promise-function-async: ❌ Not implemented
- related-getter-setter-pairs: ❌ Not implemented, too OOP for me
- require-array-sort-compare: ❌ Not implemented
- require-await: 🛑 Implementation not planned, type information to handle async generators, which is a niche case
- restrict-plus-operands: ✅ Implemented with stricter defaults, always lint assignment
- restrict-template-expressions: ✅ Implemented, with stricter defaults
- return-await: ✅ Implemented, only support always, remove unneeded await handled by await-thenable
- strict-boolean-expressions: ✅ Implemented
- strict-void-return: ❌ Not implemented
- switch-exhaustiveness-check: ✅ Implemented, missing no default comment #10218
- unbound-method: ❌ Not implemented, too OOP for me
- use-unknown-in-catch-callback-variable: 🛑 See [Add the patches](#add-the-patches)

## Create sharable rules

Use `defineRule` and `createRulesSet` that are used for the core rules. You can test your rules using `ruleTester`, which is still a bit raw. Feel free to open an issue if you need help or have ideas for improvements.

## FAQ

### What about [tsgo](https://github.com/microsoft/typescript-go)?

I still have to investigate how the language service integration will work with inter-process communication. Probably most of the main rules will have to be ported to Go to be efficient, but having them ported to the TS AST is still a useful step.

### What about [Biome](https://biomejs.dev/) type-aware support?

Biome 2 introduced a first type-aware lint rule (noFloatingPromises) without using the TypeScript compiler. While I agree that detecting if a function returns a promise doesn't require full type information, various type aware rules require to know if a variable is nullable or not (restrictedTemplateExpressions, restrictedPlusOperands) and this will be hard to implement without the TypeScript compiler for web codebases where most types come from the DB and are resolved through this kind of types:

<details>

<summary>Extract of Prisma types</summary>

```ts
export declare type GetPayloadResult<
  Base extends Record<any, any>,
  R extends InternalArgs["result"][string],
> = Omit<Base, GetPayloadResultExtensionKeys<R>>
  & GetPayloadResultExtensionObject<R>;

export declare type GetPayloadResultExtensionKeys<
  R extends InternalArgs["result"][string],
  KR extends keyof R = string extends keyof R ? never : keyof R,
> = KR;

export declare type GetPayloadResultExtensionObject<
  R extends InternalArgs["result"][string],
> = {
  [K in GetPayloadResultExtensionKeys<R>]: R[K] extends () => {
    compute: (...args: any) => infer C;
  }
    ? C
    : never;
};

export type $UserPayload<
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
> = {
  name: "User";
  objects: {
    analytics: Prisma.$AnalyticsEventPayload<ExtArgs>[];
  };
  scalars: $Extensions.GetPayloadResult<
    {
      uuid: string;
      createdAt: Date;
      updatedAt: Date;
      username: string;
      firstName: string | null;
      lastName: string | null;
    },
    ExtArgs["result"]["user"]
  >;
  composites: {};
};

type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> =
  $Result.GetResult<Prisma.$UserPayload, S>;

// prettier-ignore
export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
  findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T,"findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>
  findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>
  findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T,"findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>
  findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>
  findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T,"findMany", ClientOptions>>
  create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>
  createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>
  // More methods...
}
```

</details>

## Thanks

- [Josh Goldberg](https://github.com/JoshuaKGoldberg) for his work on typescript-eslint, his feedback on the project and his various blog posts on TS linting.
- [All typescript-eslint contributors](https://github.com/typescript-eslint/typescript-eslint/graphs/contributors) for the quality of the rules and their test suites which made it possible to port them to the TypeScript AST.
- [Jake Bailey](https://github.com/jakebailey) for his help when I was discovering the compiler API.
- [Johnson Chu](https://github.com/johnsoncodehk) for his work on [TSSlint](https://github.com/johnsoncodehk/tsslint) that pushed me to develop the TypeScript plugin for IDE support and for transferring `tsl` to me.
- [Basarat Ali Syed](https://github.com/basarat) for transferring `tsl` to Johnson Chu in the first place.
- [Romain Liautaud](https://github.com/liautaud) for his help on the configuration and rules API.
