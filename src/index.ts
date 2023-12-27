import fs from "node:fs";
import ts from "typescript";
import rule1 from "./rules/unnecessary-non-null-expression.ts";
import type { Context, SourceFile } from "./types.ts";
import { visit } from "./visit.ts";

const rules = [rule1];

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

const typeChecker = program.getTypeChecker();
program.getSourceFiles().forEach((it) => {
  if (it.fileName.includes("node_modules")) return;
  const sourceFile = it.getSourceFile() as unknown as SourceFile;
  for (const rule of rules) {
    const context: Context<unknown> = {
      sourceFile,
      typeChecker,
      report(node, message) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(),
        );
        console.log(
          `${sourceFile.fileName} (${line + 1},${character + 1}): ${message} (${
            rule.name
          })`,
        );
      },
      data: undefined,
    };
    if (rule.createData) context.data = rule.createData(context);
    visit(sourceFile, rule.visitor, context);
  }
});
