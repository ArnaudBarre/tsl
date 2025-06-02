import fs from "node:fs";
import ts from "typescript";
import type { SourceFile } from "./ast.ts";
import { initRules, showTiming } from "./initRules.ts";
import { loadConfig } from "./loadConfig.ts";

const start = performance.now();

if (showTiming) {
  console.log(
    `Booted in ${(start - globalThis.__type_lint_start).toFixed(2)}ms`,
  );
}

const formatDiagnostics = (diagnostics: ts.Diagnostic[]) =>
  ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: process.cwd,
    getNewLine: () => "\n",
  });

const cwd = process.cwd();
const parsed = ts.getParsedCommandLineOfConfigFile(
  "./tsconfig.json",
  undefined,
  {
    onUnRecoverableConfigFileDiagnostic: (diag) => {
      throw new Error(formatDiagnostics([diag])); // ensures that `parsed` is defined.
    },
    fileExists: fs.existsSync,
    getCurrentDirectory: () => cwd,
    readDirectory: ts.sys.readDirectory,
    readFile: (file) => fs.readFileSync(file, "utf-8"),
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
  },
);
const result = parsed!; // parsed is not undefined, since we throw on failure.
if (result.errors.length) throw new Error(formatDiagnostics(result.errors));

const host = ts.createCompilerHost(result.options, true);
const program = ts.createProgram(result.fileNames, result.options, host);
if (!process.argv.includes("--lint-only")) {
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
      let message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        "\n",
      );
      console.log(
        `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`,
      );
    } else {
      console.log(
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      );
    }
  });
  console.log(`Typecheck in ${(performance.now() - start).toFixed(2)}ms`);
}

const configStart = performance.now();

const { config } = await loadConfig(program);

const { lint, rulesCount, timingMaps } = await initRules(() => program, config);

if (showTiming) {
  console.log(
    `Config (${rulesCount} base ${
      rulesCount === 1 ? "rule" : "rules"
    }) loaded in ${(performance.now() - configStart).toFixed(2)}ms`,
  );
}

const lintStart = performance.now();

const files = program.getSourceFiles();

const displayFilename = (name: string) => name.slice(cwd.length + 1);

for (const it of files) {
  lint(it as unknown as SourceFile, (report) => {
    if (report.type === "rule") {
      const { line, character } = it.getLineAndCharacterOfPosition(
        "node" in report ? report.node.getStart() : report.start,
      );
      console.log(
        `${displayFilename(it.fileName)}(${line + 1},${character + 1}): ${
          report.message
        } (${report.rule.name})`,
      );
    } else {
      const { line, character } = it.getLineAndCharacterOfPosition(
        report.start,
      );
      console.log(
        `${displayFilename(it.fileName)}(${line + 1},${character + 1}): ${
          report.message
        }`,
      );
    }
  });
}

const lintTime = performance.now() - lintStart;
console.log(`Lint ran in ${lintTime.toFixed(2)}ms`);

if (timingMaps) {
  console.log(
    `Total time: ${(performance.now() - globalThis.__type_lint_start).toFixed(2)}ms`,
  );
  for (const [timingName, map] of Object.entries(timingMaps)) {
    const rulesEntries = Object.entries(map)
      .map(([key, time]) => ({ key, time }))
      .sort((a, b) => b.time - a.time);
    const totalMeasured = rulesEntries.reduce((acc, { time }) => acc + time, 0);
    console.table(
      rulesEntries.slice(0, 30).map(({ key, time }) => ({
        [timingName]: timingName === "File" ? displayFilename(key) : key,
        "Time (ms)": time.toFixed(1),
        Relative: `${((time / totalMeasured) * 100).toFixed(1)}%`,
      })),
    );
  }
}

if (globalThis.__type_lint_profile_session) {
  globalThis.__type_lint_profile_session.post(
    "Profiler.stop",
    (err, { profile }) => {
      if (err) {
        throw err;
      } else {
        const path = "type-lint-profile.cpuprofile";
        fs.writeFileSync(path, JSON.stringify(profile));
        console.log(`Profile save to ${path}`);
      }
    },
  );
}
