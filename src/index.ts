import fs from "node:fs";
import ts from "typescript";
import type { AnyNode, SourceFile, Visitor } from "./ast.ts";
import { getContextUtils } from "./getContextUtils.ts";
import { defineConfig } from "./public-utils.ts";
// import { awaitThenable } from "./rules/await-thenable.ts";
// import { dotNotation } from "./rules/dot-notation.ts";
// import { noBaseToString } from "./rules/no-base-to-string.ts";
// import { noConfusingVoidExpression } from "./rules/no-confusing-void-expression.ts";
// import { noFloatingPromises } from "./rules/no-floating-promises.ts";
// import { noForInArray } from "./rules/no-for-in-array.ts";
// import { noImpliedEval } from "./rules/no-implied-eval.ts";
// import { noMeaninglessVoidOperator } from "./rules/no-meaningless-void-operator.ts";
// import { noMisusedPromises } from "./rules/no-misused-promises.ts";
// import { noRedundantTypeConstituents } from "./rules/no-redundant-type-constituents.ts";
// import { noThrowLiteral } from "./rules/no-throw-literal.ts";
// import { noUnnecessaryBooleanLiteralCompare } from "./rules/no-unnecessary-boolean-literal-compare.ts";
import { noUnnecessaryCondition } from "./rules/no-unnecessary-condition.ts";
// import { noUnnecessaryNonNullExpression } from "./rules/no-unnecessary-non-null-expression.ts";
import type { AST, Checker, Config, Context, UnknownRule } from "./types.ts";
import { visitorEntries } from "./visitorEntries.ts";

const config = defineConfig({
  rules: [
    // awaitThenable,
    // dotNotation,
    // noBaseToString,
    // noConfusingVoidExpression,
    // noFloatingPromises,
    // noForInArray,
    // noImpliedEval,
    // noMeaninglessVoidOperator,
    // noMisusedPromises,
    // noRedundantTypeConstituents,
    // noThrowLiteral,
    // noUnnecessaryBooleanLiteralCompare,
    noUnnecessaryCondition,
    // noUnnecessaryNonNullExpression,
  ],
  ignore: ["prisma/client.d.ts", "generated", "scripts/playground"],
  options: {
    // "no-misused-promises": {
    //   checksVoidReturn: { arguments: false, attributes: false },
    // },
    // "no-confusing-void-expression": { ignoreArrowShorthand: true },
  },
}) as Config<UnknownRule[]>;

const formatDiagnostics = (diagnostics: ts.Diagnostic[]) =>
  ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: process.cwd,
    getNewLine: () => "\n",
  });

const parsed = ts.getParsedCommandLineOfConfigFile(
  "./tsconfig.json",
  undefined,
  {
    onUnRecoverableConfigFileDiagnostic: (diag) => {
      throw new Error(formatDiagnostics([diag])); // ensures that `parsed` is defined.
    },
    fileExists: fs.existsSync,
    getCurrentDirectory: () => process.cwd(),
    readDirectory: ts.sys.readDirectory,
    readFile: (file) => fs.readFileSync(file, "utf-8"),
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
  },
);
const result = parsed!; // parsed is not undefined, since we throw on failure.
if (result.errors.length) throw new Error(formatDiagnostics(result.errors));

const host = ts.createCompilerHost(result.options, true);
const program = ts.createProgram(result.fileNames, result.options, host);
const emitResult = program.emit();
const allDiagnostics = ts
  .getPreEmitDiagnostics(program)
  .concat(emitResult.diagnostics);

allDiagnostics.forEach((diagnostic) => {
  if (diagnostic.file) {
    let { line, character } = ts.getLineAndCharacterOfPosition(
      diagnostic.file,
      diagnostic.start!,
    );
    let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    console.log(
      `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`,
    );
  } else {
    console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
  }
});

const start = performance.now();

const checker = program.getTypeChecker() as unknown as Checker;
const compilerOptions = program.getCompilerOptions();
const contextUtils = getContextUtils(checker);

const rulesWithOptions: {
  rule: UnknownRule;
  context: Context<unknown, unknown>;
  visitor: Visitor<unknown, unknown>;
}[] = [];
for (const rule of config.rules) {
  const input = config.options?.[rule.name];
  if (input === "off") continue;
  const options = rule.parseOptions?.(input);
  rulesWithOptions.push({
    rule,
    context: {
      sourceFile: undefined as unknown as SourceFile,
      program,
      checker,
      compilerOptions,
      utils: contextUtils,
      report({ node, message }) {
        const { line, character } =
          this.sourceFile.getLineAndCharacterOfPosition(node.getStart());
        console.log(
          `${this.sourceFile.fileName}(${line + 1},${
            character + 1
          }): ${message} (${rule.name})`,
        );
      },
      options,
      data: undefined,
    },
    visitor:
      typeof rule.visitor === "function" ? rule.visitor(options) : rule.visitor,
  });
}

const entryMap: Record<number, ((node: AnyNode) => void) | undefined> = {};
const exitMap: Record<number, ((node: AnyNode) => void) | undefined> = {};
for (const [keySuffix, map] of [
  ["", entryMap],
  [":exit", exitMap],
] as const) {
  for (const [kind, _key] of visitorEntries) {
    const key = (_key + keySuffix) as keyof Visitor;
    const rulesWithKey: typeof rulesWithOptions = [];
    for (const ruleWithOptions of rulesWithOptions) {
      if (ruleWithOptions.visitor[key]) {
        rulesWithKey.push(ruleWithOptions);
      }
    }
    if (rulesWithKey.length) {
      map[kind] = (node) => {
        for (const ruleWithOptions of rulesWithKey) {
          ruleWithOptions.visitor[key]!(node as any, ruleWithOptions.context);
        }
      };
    }
  }
}

const visit = (node: AST.AnyNode) => {
  entryMap[node.kind]?.(node);
  // @ts-expect-error
  node.forEachChild(visit);
  exitMap[node.kind]?.(node);
};

for (const it of program.getSourceFiles()) {
  if (it.fileName.includes("node_modules")) continue;
  if (config.ignore?.some((p) => it.fileName.includes(p))) continue;
  const sourceFile = it.getSourceFile() as unknown as SourceFile;
  for (const { rule, context } of rulesWithOptions) {
    context.sourceFile = sourceFile;
    if (rule.createData) context.data = rule.createData(context);
  }
  visit(sourceFile);
}

console.log(`Rules ran in ${(performance.now() - start).toFixed(2)}ms`);
