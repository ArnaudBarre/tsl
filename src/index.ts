import fs from "node:fs";
import ts from "typescript";
import type { SourceFile, Visitor } from "./ast.ts";
import { getContextUtils } from "./getContextUtils.ts";
import { defineConfig } from "./public-utils.ts";
import { noMisusedPromises } from "./rules/no-misused-promises.ts";
// import { noUnnecessaryNonNullExpression } from "./rules/unnecessary-non-null-expression.ts";
import type { Checker, Config, Context, UnknownRule } from "./types.ts";
import { visit } from "./visit.ts";

const config = defineConfig({
  rules: [noMisusedPromises],
  ignore: ["prisma/client.d.ts"],
  options: {
    "no-misused-promises": {
      // https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/docs/rules/no-misused-promises.md#checksvoidreturn
      checksVoidReturn: { arguments: false, attributes: false },
    },
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
