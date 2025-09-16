import fs from "node:fs";
import { parseArgs } from "node:util";
import ts from "typescript";
import type { SourceFile } from "./ast.ts";
import {
  displayFilename,
  formatDiagnostics,
  type TSLDiagnostic,
} from "./formatDiagnostic.ts";
import { core } from "./index.ts";
import { initRules, type Report } from "./initRules.ts";
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

const formatErrorDiagnostics = (diagnostics: ts.Diagnostic[]) =>
  ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: process.cwd,
    getNewLine: () => "\n",
  });
const cwd = process.cwd();
const fileParsingDiagnostics: ts.Diagnostic[] = [];
const result = ts.getParsedCommandLineOfConfigFile(
  values.project ?? "./tsconfig.json",
  undefined,
  {
    onUnRecoverableConfigFileDiagnostic: (diag) => {
      fileParsingDiagnostics.push(diag);
    },
    fileExists: fs.existsSync,
    getCurrentDirectory: () => cwd,
    readDirectory: ts.sys.readDirectory,
    readFile: (file) => fs.readFileSync(file, "utf-8"),
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
  },
);
if (!result) {
  console.log(formatErrorDiagnostics(fileParsingDiagnostics));
  process.exit(1);
}
if (result.errors.length) {
  console.log(formatErrorDiagnostics(result.errors));
  process.exit(1);
}

const host = ts.createCompilerHost(result.options, true);
const program = ts.createProgram({
  rootNames: result.fileNames,
  options: result.options,
  projectReferences: result.projectReferences,
  host,
});

const configStart = performance.now();
const { config } = await loadConfig(program);
const { lint, allRules, aggregate, timingMaps } = await initRules(
  () => program,
  config ?? { rules: core.all() },
  values.timing,
  "cli",
);
if (values.timing) {
  console.log(
    `Config with ${allRules.size} ${
      allRules.size === 1 ? "rule" : "rules"
    } loaded in ${displayTiming(performance.now() - configStart)}`,
  );
}

let diagnostics: TSLDiagnostic[] = [];
if (!values["lint-only"]) {
  diagnostics = ts.getPreEmitDiagnostics(program).map((d): TSLDiagnostic => {
    const message = ts.flattenDiagnosticMessageText(
      d.messageText,
      host.getNewLine(),
    );
    const name = `TS${d.code}`;
    if (!d.file) {
      return { file: undefined, name, message };
    }
    return {
      file: d.file,
      name,
      message,
      start: d.start!,
      length: d.length!,
    };
  });

  if (values.timing) {
    console.log(`Typecheck: ${displayTiming(performance.now() - start)}`);
  }
}

const lintStart = performance.now();

const files = program.getSourceFiles();

function onReport(
  sourceFile: ts.SourceFile,
  r: Report,
  currentIdx: number | undefined,
) {
  if (currentIdx === undefined) {
    const lastTsDiagnostic = diagnostics.findLastIndex(
      (d) => d.file === sourceFile,
    );
    if (lastTsDiagnostic !== -1) {
      currentIdx = lastTsDiagnostic + 1;
    } else {
      const sortIdx = diagnostics.findIndex((d, i) => {
        const previousFile = i === 0 ? undefined : diagnostics[i - 1].file;
        return (
          d.file !== undefined
          && sourceFile.fileName < d.file.fileName
          && (previousFile === undefined
            || sourceFile.fileName > previousFile.fileName)
        );
      });
      currentIdx = sortIdx === -1 ? diagnostics.length : sortIdx;
    }
  } else {
    currentIdx++;
  }
  diagnostics.splice(currentIdx, 0, {
    file: sourceFile,
    name: r.type === "rule" ? r.rule.name : "tsl-unused-ignore",
    message: r.message,
    start: "node" in r ? r.node.getStart() : r.start,
    length: "node" in r ? r.node.getEnd() - r.node.getStart() : r.end - r.start,
  });
  return currentIdx;
}

for (const it of files) {
  let currentIdx: number | undefined = undefined;
  lint(it as unknown as SourceFile, (r) => {
    currentIdx = onReport(it, r, currentIdx);
  });
}

aggregate((sourceFile, r) => onReport(sourceFile, r, undefined));

if (values.timing) {
  const lintTime = performance.now() - lintStart;
  console.log(`Lint ran in ${displayTiming(lintTime)}`);
}

if (diagnostics.length > 0) {
  console.log(formatDiagnostics(diagnostics));
}

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

if (globalThis.__type_lint_profile_session) {
  globalThis.__type_lint_profile_session.post(
    "Profiler.stop",
    (err, { profile }) => {
      if (err) {
        throw err;
      } else {
        const path = "tsl-profile.cpuprofile";
        fs.writeFileSync(path, JSON.stringify(profile));
        console.log(`Profile save to ${path}`);
      }
    },
  );
}

if (diagnostics.length > 0) {
  process.exit(1);
}
