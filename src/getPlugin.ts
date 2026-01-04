import { type FSWatcher, watch } from "node:fs";
import type {
  CodeFixAction,
  Diagnostic,
  LanguageService,
  Program,
} from "typescript";
import type ts from "typescript";
import { initRules, type Report } from "./initRules.ts";
import { loadConfig } from "./loadConfig.ts";
import type { AST, Suggestion } from "./types.ts";

const UNUSED_COMMENT_CODE = "unusedComment";

export const getPlugin = async (
  ts: typeof import("typescript"),
  languageService: LanguageService,
  log: (v: string) => void,
): Promise<{
  getSemanticDiagnostics(fileName: string): Diagnostic[];
  getCodeFixesAtPosition: LanguageService["getCodeFixesAtPosition"];
  cleanUp(): void;
}> => {
  const watchedFiles = new Map<string, FSWatcher>();
  let initRulesResult: Awaited<ReturnType<typeof initRules>>;
  let diagnosticCategory: Diagnostic["category"];
  let enableProjectWideRulesInIDE = false;
  let readyForAggregate = false;

  const load = async () => {
    const start = performance.now();
    const { config, configFiles } = await loadConfig(
      languageService.getProgram()!,
    );
    for (const watchedFile in watchedFiles) {
      if (!configFiles.includes(watchedFile)) {
        watchedFiles.get(watchedFile)!.close();
        watchedFiles.delete(watchedFile);
      }
    }
    for (const configFile of configFiles) {
      if (!watchedFiles.has(configFile)) {
        watchedFiles.set(configFile, watch(configFile, load));
      }
    }
    initRulesResult = await initRules(
      () => languageService.getProgram()!,
      config ?? { rules: [] },
      false,
    );
    diagnosticCategory =
      config?.diagnosticCategory === "error"
        ? ts.DiagnosticCategory.Error
        : ts.DiagnosticCategory.Warning;
    readyForAggregate = false;
    enableProjectWideRulesInIDE = config?.enableProjectWideRulesInIDE ?? false;
    (ts as any).codefix.registerCodeFix({
      errorCodes: [
        UNUSED_COMMENT_CODE,
        ...Array.from(initRulesResult.allRules),
      ],
      getCodeActions: () => undefined,
    });
    log(
      `tsl: Config with ${initRulesResult.allRules.size} rules loaded in ${(
        performance.now() - start
      ).toFixed(0)}ms`,
    );
  };
  await load();

  type FileSuggestion = Suggestion & {
    rule: string;
    start: number;
    end: number;
  };

  const aggregateStatusByProgram = new WeakMap<
    Program,
    { count: number; lintedFiles: Set<string> }
  >();
  const aggregateResultsByProgram = new WeakMap<
    Program,
    Map<ts.SourceFile, Report[]>
  >();
  const runLint = (fileName: string) => {
    const diagnostics: Diagnostic[] = [];
    const fileSuggestions: FileSuggestion[] = [];
    const result = { diagnostics, fileSuggestions };

    if (fileName.includes("/node_modules/")) return result;
    const program = languageService.getProgram();
    if (!program) {
      log("tsl: No program");
      return result;
    }
    const sourceFile = program.getSourceFile(fileName);
    if (!sourceFile) {
      log("tsl: No sourceFile");
      return result;
    }

    const onReport = (report: Report) => {
      switch (report.type) {
        case "rule": {
          const { message, rule, suggestions } = report;
          const start =
            "node" in report ? report.node.getStart() : report.start;
          const end = "node" in report ? report.node.getEnd() : report.end;
          diagnostics.push({
            category: diagnosticCategory,
            source: "tsl",
            code: rule.name as any,
            messageText: message,
            file: sourceFile,
            start,
            length: end - start,
          });
          if (suggestions) {
            const suggestionsArray =
              typeof suggestions === "function" ? suggestions() : suggestions;
            for (const suggestion of suggestionsArray) {
              fileSuggestions.push({
                rule: rule.name,
                start,
                end,
                message: suggestion.message,
                changes: suggestion.changes,
              });
            }
          }
          const lineStart = sourceFile
            .getLineStarts()
            .findLast((it) => it <= start)!;
          let nbSpaces = 0;
          while (sourceFile.text[lineStart + nbSpaces] === " ") nbSpaces++;
          fileSuggestions.push({
            rule: rule.name,
            start,
            end,
            message: `Ignore ${rule.name} rule`,
            changes: [
              {
                start: lineStart,
                length: 0,
                newText: `${" ".repeat(nbSpaces)}/\/ tsl-ignore ${rule.name}\n`,
              },
            ],
          });
          break;
        }
        case "ignore": {
          const { message, suggestions, start, end } = report;
          diagnostics.push({
            category: ts.DiagnosticCategory.Warning,
            source: "tsl",
            code: UNUSED_COMMENT_CODE as any,
            messageText: message,
            file: sourceFile,
            start,
            length: end - start,
          });
          for (const suggestion of suggestions()) {
            fileSuggestions.push({
              rule: "ignore",
              start,
              end,
              message: suggestion.message,
              changes: suggestion.changes,
            });
          }
          break;
        }
      }
    };

    initRulesResult.lint(sourceFile as unknown as AST.SourceFile, onReport);

    if (enableProjectWideRulesInIDE) {
      // Aggregate if all source files have been linted once
      if (!readyForAggregate) {
        let aggregateStatus = aggregateStatusByProgram.get(program);
        if (!aggregateStatus) {
          let count = 0;
          for (const it of program.getSourceFiles()) {
            if (!it.fileName.includes("/node_modules/")) count++;
          }
          aggregateStatus = { count, lintedFiles: new Set() };
          aggregateStatusByProgram.set(program, aggregateStatus);
        }
        aggregateStatus.lintedFiles.add(fileName);
        if (aggregateStatus.count >= aggregateStatus.lintedFiles.size) {
          log("tsl: Ready for aggregate");
          readyForAggregate = true;
        }
      }
      if (readyForAggregate) {
        let aggregateReports = aggregateResultsByProgram.get(program);
        if (!aggregateReports) {
          aggregateReports = initRulesResult.aggregate();
          aggregateResultsByProgram.set(program, aggregateReports);
        }
        const reportsForFile = aggregateReports.get(sourceFile);
        if (reportsForFile) {
          for (const report of reportsForFile) onReport(report);
        }
      }
    }

    const unusedIgnoreReports = initRulesResult
      .getUnusedIgnoreComments({ includeProjectWideRules: readyForAggregate })
      .get(sourceFile);
    if (unusedIgnoreReports) {
      for (const report of unusedIgnoreReports) onReport(report);
    }

    return result;
  };

  return {
    getSemanticDiagnostics: (fileName: string) => {
      try {
        return runLint(fileName).diagnostics;
      } catch (e) {
        log((e as any)?.message);
        return [];
      }
    },
    getCodeFixesAtPosition: (fileName, start, end) => {
      try {
        const { fileSuggestions } = runLint(fileName);
        const result: CodeFixAction[] = [];
        for (const suggestion of fileSuggestions) {
          if (
            (suggestion.start >= start && suggestion.start <= end)
            || (suggestion.end >= start && suggestion.end <= end)
            || (start >= suggestion.start && start <= suggestion.end)
            || (end >= suggestion.start && end <= suggestion.end)
          ) {
            result.push({
              fixName: `tsl:${suggestion.rule}`,
              description: suggestion.message,
              changes: [
                {
                  fileName,
                  textChanges: suggestion.changes.map((it) =>
                    "node" in it
                      ? {
                          span: {
                            start: it.node.getStart(),
                            length: it.node.getEnd() - it.node.getStart(),
                          },
                          newText: it.newText,
                        }
                      : "length" in it
                        ? {
                            span: { start: it.start, length: it.length },
                            newText: it.newText,
                          }
                        : {
                            span: {
                              start: it.start,
                              length: it.end - it.start,
                            },
                            newText: it.newText,
                          },
                  ),
                },
              ],
            });
          }
        }
        return result;
      } catch (e) {
        log((e as any)?.message);
        return [];
      }
    },
    cleanUp() {
      for (const [, watcher] of watchedFiles) watcher.close();
    },
  };
};
