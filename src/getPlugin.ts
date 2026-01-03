import { type FSWatcher, watch } from "node:fs";
import type { CodeFixAction, Diagnostic, LanguageService } from "typescript";
import type { SourceFile } from "./ast.ts";
import { initRules } from "./initRules.ts";
import { loadConfig } from "./loadConfig.ts";
import type { Suggestion } from "./types.ts";

const UNUSED_COMMENT_CODE = "unusedComment";

export const getPlugin = async (
  ts: typeof import("typescript"),
  languageService: LanguageService,
  log: (v: string) => void,
): Promise<{
  getSemanticDiagnostics(
    fileName: string,
    original: LanguageService["getSemanticDiagnostics"],
  ): Diagnostic[];
  getCodeFixesAtPosition: LanguageService["getCodeFixesAtPosition"];
  cleanUp(): void;
}> => {
  const watchedFiles = new Map<string, FSWatcher>();
  let lint: Awaited<ReturnType<typeof initRules>>["lint"];
  let diagnosticCategory: Diagnostic["category"];

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
    const result = await initRules(
      () => languageService.getProgram()!,
      config ?? { rules: [] },
      false,
    );
    lint = result.lint;
    diagnosticCategory =
      config?.diagnosticCategory === "error"
        ? ts.DiagnosticCategory.Error
        : ts.DiagnosticCategory.Warning;
    (ts as any).codefix.registerCodeFix({
      errorCodes: [UNUSED_COMMENT_CODE, ...Array.from(result.allRules)],
      getCodeActions: () => undefined,
    });
    log(
      `tsl: Config with ${result.allRules.size} rules loaded in ${(
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

  const runLint = (fileName: string) => {
    const diagnostics: Diagnostic[] = [];
    const fileSuggestions: FileSuggestion[] = [];
    const result = { diagnostics, fileSuggestions };

    if (fileName.includes("/node_modules/")) return result;
    const sourceFile = languageService.getProgram()?.getSourceFile(fileName);
    if (!sourceFile) {
      log("tsl: No sourceFile");
      return result;
    }

    lint(sourceFile as unknown as SourceFile, (report) => {
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
    });
    return result;
  };

  return {
    getSemanticDiagnostics: (
      fileName: string,
      original: LanguageService["getSemanticDiagnostics"],
    ) => {
      const result = original(fileName);
      try {
        const { diagnostics } = runLint(fileName);
        if (!diagnostics.length) return result;
        return [...result, ...diagnostics];
      } catch {
        return result;
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
      } catch {
        return [];
      }
    },
    cleanUp() {
      for (const [, watcher] of watchedFiles) watcher.close();
    },
  };
};
