import fs from "node:fs";
import ts from "typescript";
import type { SourceFile } from "./ast.ts";
import { initRules } from "./initRules.ts";
import { loadConfig } from "./loadConfig.ts";

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

const config = await loadConfig(program);
console.log(`Config loaded in ${(performance.now() - start).toFixed(2)}ms`);

const lint = initRules(() => program, config);
console.log(`Lint initialized in ${(performance.now() - start).toFixed(2)}ms`);

for (const it of program.getSourceFiles()) {
  lint(it as unknown as SourceFile, (report) => {
    if (report.type === "rule") {
      const { line, character } = it.getLineAndCharacterOfPosition(
        report.node.getStart(),
      );
      console.log(
        `${it.fileName}(${line + 1},${character + 1}): ${report.message} (${
          report.rule.name
        })`,
      );
    } else {
      const { line, character } = it.getLineAndCharacterOfPosition(
        report.start,
      );
      console.log(
        `${it.fileName}(${line + 1},${character + 1}): ${report.message}`,
      );
    }
  });
}

console.log(`Lint ran in ${(performance.now() - start).toFixed(2)}ms`);
