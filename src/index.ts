import fs from "node:fs";
import ts from "typescript";
import type { SourceFile, Visitor } from "./ast.ts";
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
import type { Checker, Config, Context, UnknownRule } from "./types.ts";
import { visit } from "./visit.ts";

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

const rulesWithOptions: {
  rule: UnknownRule;
  options: unknown;
  visitor: Visitor<unknown, unknown>;
}[] = [];
for (const rule of config.rules) {
  const input = config.options?.[rule.name];
  if (input === "off") continue;
  const options = rule.parseOptions?.(input);
  rulesWithOptions.push({
    rule,
    options,
    visitor:
      typeof rule.visitor === "function" ? rule.visitor(options) : rule.visitor,
  });
}

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

const checker = program.getTypeChecker() as Checker;
const compilerOptions = program.getCompilerOptions();
program.getSourceFiles().forEach((it) => {
  if (it.fileName.includes("node_modules")) return;
  if (config.ignore?.some((p) => it.fileName.includes(p))) return;
  const sourceFile = it.getSourceFile() as unknown as SourceFile;
  for (const { rule, options, visitor } of rulesWithOptions) {
    const context: Context<unknown, unknown> = {
      sourceFile,
      program,
      checker,
      compilerOptions,
      utils: getContextUtils(checker),
      report({ node, message }) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(),
        );
        console.log(
          `${sourceFile.fileName}(${line + 1},${character + 1}): ${message} (${
            rule.name
          })`,
        );
      },
      options,
      data: undefined,
    };
    if (rule.createData) context.data = rule.createData(context);
    visit(sourceFile, visitor, context);
  }
});
