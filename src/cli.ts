import fs from "node:fs";
import { parseArgs } from "node:util";
import ts from "typescript";
import type { SourceFile } from "./ast.ts";
import { initRules } from "./initRules.ts";
import { loadConfig } from "./loadConfig.ts";

const start = performance.now();

const { values } = parseArgs({
  options: {
    project: { type: "string", short: "p" },
    timing: { type: "boolean", short: "t", default: false },
    "lint-only": { type: "boolean", default: false },
    profile: { type: "boolean", default: false },
  },
});

const displayTiming = (ms: number) =>
  ms > 1_000 ? `${(ms / 1_000).toFixed(2)}s` : `${ms.toFixed(0)}ms`;

if (values.timing) {
  console.log(
    `Booted in ${displayTiming(start - globalThis.__type_lint_start)}`,
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
  values.project ?? "./tsconfig.json",
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
let hasError = false;
if (!values["lint-only"]) {
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
  hasError = allDiagnostics.length > 0;
  console.log(`Typecheck in ${displayTiming(performance.now() - start)}`);
}

const configStart = performance.now();

const { config } = await loadConfig(program);

const { lint, allRules, timingMaps } = await initRules(
  () => program,
  config,
  values.timing,
);

if (values.timing) {
  console.log(
    `Config with ${allRules.size} ${
      allRules.size === 1 ? "rule" : "rules"
    } loaded in ${displayTiming(performance.now() - configStart)}`,
  );
}

const lintStart = performance.now();

const files = program.getSourceFiles();

const displayFilename = (name: string) => name.slice(cwd.length + 1);

for (const it of files) {
  lint(it as unknown as SourceFile, (report) => {
    hasError = true;
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
console.log(`Lint ran in ${displayTiming(lintTime)}`);

if (timingMaps) {
  console.log(
    `Total time: ${displayTiming(
      performance.now() - globalThis.__type_lint_start,
    )}`,
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

if (hasError) {
  process.exit(1);
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
