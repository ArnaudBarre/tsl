# Changelog

## Unreleased

- Fix `--version` CLI flag
- Port fixes from typescript-eslint up to v8.55.0

## 1.0.29

- Deprecate `context.rawChecker`. Types overrides from `context.checker` have been updated so it can be passed to other libraries. Thanks @JoshuaKGoldberg for challenging this!
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
