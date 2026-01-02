# Changelog

## 1.1.0

### Project-wide rules (experimental)

Rules can now implement an `aggregate` function that will be called once for all files that have been linted. This allows to implement rules that require cross-file analysis, like detecting circular dependencies.

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

`enableProjectWideRulesInIDE` is an experimental new option to enable project-wide reports in the IDE (default to false). The IDE implementation is still a work in progress, and memory leaks or performance issues may occur.

### Deprecate `context.rawChecker`

Types overrides of `context.checker` have been updated so it can be passed to other libraries. `context.rawChecker` is therefore not needed anymore and has been deprecated. Thanks @JoshuaKGoldberg for challenging this!

### Other

- Port fixes from typescript-eslint up to v8.54.0

## 1.0.28

- Add `noUselessDefaultAssignment` rule
- `noUnnecessaryCondition`: Catch useless `?? null` and `?? undefined` coalescing and add "Remove unnecessary nullish coalescing" suggestion
- Port fixes from typescript-eslint up to v8.51.0

## 1.0.27

- `preferOptionalChain`: fix chain analysis when the chain ends with `=== null`

## 1.0.26

- Port fixes from typescript-eslint up to v8.46.2

## 1.0.25

- Port fixes from typescript-eslint up to v8.44.1

## 1.0.24

- Port fixes from typescript-eslint up to v8.44.0

## 1.0.23

- Port fixes from typescript-eslint up to v8.43.0

## 1.0.22

- Support TS 5.9 ([#7](https://github.com/ArnaudBarre/tsl/pull/7))

## 1.0.21

- `noBaseToString`: add checkUnknown option ([#8](https://github.com/ArnaudBarre/tsl/pull/8))
- `strictBooleanExpressions`: fix unary operator analysis for strict boolean expression ([#11](https://github.com/ArnaudBarre/tsl/pull/11))

## 1.0.20

- Display number of supported rules in `tsl --migrate`.

## 1.0.19

- Change `tsl/migrate` command to `tsl --migrate`.

## 1.0.18

- Add support for workspaces.
- Add `tsl/migrate` command to migrate from typescript-eslint to tsl.

## 1.0.17

Beta release
