import type { CodeFixAction, Diagnostic, LanguageService } from "typescript";
import type { SourceFile } from "./ast.ts";
import { initRules } from "./initRules.ts";
import { loadConfig } from "./loadConfig.ts";
import type { Suggestion } from "./types.ts";

export const getPlugin = async (
  ts: typeof import("typescript"),
  languageService: LanguageService,
  log?: (v: string) => void,
): Promise<{
  getSemanticDiagnostics(
    fileName: string,
    original: LanguageService["getSemanticDiagnostics"],
  ): Diagnostic[];
  getCodeFixesAtPosition: LanguageService["getCodeFixesAtPosition"];
}> => {
  const config = await loadConfig(languageService.getProgram()!);
  const lint = initRules(() => languageService.getProgram()!, config, log);

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
      log?.("No sourceFile");
      return result;
    }

    lint(sourceFile as unknown as SourceFile, (report) => {
      if (report.type === "rule") {
        const { node, message, rule, suggestions } = report;
        const start = node.getStart();
        const end = node.getEnd();
        diagnostics.push({
          category: ts.DiagnosticCategory.Warning,
          source: "type-lint",
          code: 61_333,
          messageText: `${message} (${rule.name})`,
          file: sourceFile,
          start,
          length: end - start,
        });
        if (suggestions?.length) {
          for (const suggestion of suggestions) {
            fileSuggestions.push({
              rule: rule.name,
              start,
              end,
              title: suggestion.title,
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
          title: `Ignore ${rule.name} rule`,
          changes: [
            {
              start: lineStart,
              length: 0,
              newText: `${" ".repeat(nbSpaces)}// type-lint-ignore ${
                rule.name
              }\n`,
            },
          ],
        });
      } else {
        const { message, suggestions, start, end } = report;
        diagnostics.push({
          category: ts.DiagnosticCategory.Warning,
          source: "type-lint",
          code: 61_333,
          messageText: message,
          file: sourceFile,
          start,
          length: end - start,
        });
        if (suggestions.length) {
          for (const suggestion of suggestions) {
            fileSuggestions.push({
              rule: "ignore",
              start,
              end,
              title: suggestion.title,
              changes: suggestion.changes,
            });
          }
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
      const { diagnostics } = runLint(fileName);
      if (!diagnostics.length) return result;
      return [...result, ...diagnostics];
    },
    getCodeFixesAtPosition: (fileName, start, end) => {
      const { fileSuggestions } = runLint(fileName);
      const result: CodeFixAction[] = [];
      for (const suggestion of fileSuggestions) {
        if (
          (suggestion.start >= start && suggestion.start <= end) ||
          (suggestion.end >= start && suggestion.end <= end) ||
          (start >= suggestion.start && start <= suggestion.end) ||
          (end >= suggestion.start && end <= suggestion.end)
        ) {
          result.push({
            fixName: `type-lint:${suggestion.rule}`,
            description: suggestion.title,
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
                        span: { start: it.start, length: it.end - it.start },
                        newText: it.newText,
                      },
                ),
              },
            ],
          });
        }
      }
      return result;
    },
  };
};
