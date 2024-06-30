import type { CodeFixAction, Diagnostic, LanguageService } from "typescript";
import type { SourceFile } from "./ast.ts";
import { initRules } from "./initRules.ts";
import { defineConfig } from "./public-utils.ts";
import type { Suggestion } from "./types.ts";

const TYPE_LINT_ERROR_CODE = 61_333;

export const getPlugin = (
  ts: typeof import("typescript"),
  languageService: LanguageService,
  log?: (v: string) => void,
): {
  getSemanticDiagnostics(
    fileName: string,
    original: LanguageService["getSemanticDiagnostics"],
  ): Diagnostic[];
  getCodeFixesAtPosition: LanguageService["getCodeFixesAtPosition"];
} => {
  const config = defineConfig({
    rules: [
      {
        name: "no-console",
        visitor: {
          PropertyAccessExpression(node, context) {
            if (
              node.expression.kind === ts.SyntaxKind.Identifier &&
              node.expression.text === "console"
            ) {
              context.report({
                node,
                message: "Unexpected console usage",
                suggestions: [
                  {
                    title: "Remove the call",
                    changes: [{ node: node.parent, newText: "" }],
                  },
                ],
              });
            }
          },
        },
      },
    ],
  });
  const lint = initRules(languageService.getProgram()!, config);

  type FileSuggestions = (Suggestion & {
    rule: string;
    start: number;
    end: number;
  })[];
  const suggestionsMap = new Map<string, FileSuggestions>();

  return {
    getSemanticDiagnostics: (
      fileName: string,
      original: LanguageService["getSemanticDiagnostics"],
    ) => {
      const result = original(fileName);
      if (fileName.includes("/node_modules/")) return result;
      const program = languageService.getProgram();
      const sourceFile = program?.getSourceFile(fileName);
      if (!sourceFile) {
        log?.("No sourceFile");
        return result;
      }
      const fileSuggestions: FileSuggestions = [];
      suggestionsMap.set(sourceFile.fileName, fileSuggestions);
      lint(
        sourceFile as unknown as SourceFile,
        ({ node, message, rule, suggestions }) => {
          result.push({
            category: ts.DiagnosticCategory.Warning,
            source: "type-lint",
            code: TYPE_LINT_ERROR_CODE,
            messageText: `${message} (${rule.name})`,
            file: sourceFile,
            start: node.getStart(),
            length: node.getEnd() - node.getStart(),
          });
          if (suggestions?.length) {
            for (const suggestion of suggestions) {
              fileSuggestions.push({
                rule: rule.name,
                start: node.getStart(),
                end: node.getEnd(),
                title: suggestion.title,
                changes: suggestion.changes,
              });
            }
          }
        },
      );
      return result;
    },
    getCodeFixesAtPosition: (fileName, start, end, errorCodes) => {
      if (errorCodes[0] !== TYPE_LINT_ERROR_CODE) return [];
      const suggestions = suggestionsMap.get(fileName);
      if (!suggestions) return [];
      const result: CodeFixAction[] = [];
      for (const suggestion of suggestions) {
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
