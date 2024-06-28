import type { LanguageService } from "typescript";
import type { SourceFile } from "./ast.ts";
import { initRules } from "./initRules.ts";
import { defineConfig } from "./public-utils.ts";

export const getPlugin = (
  ts: typeof import("typescript"),
  languageService: LanguageService,
  log?: (v: string) => void,
) => {
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
              context.report({ node, message: "Unexpected console usage" });
            }
          },
        },
      },
    ],
  });
  const lint = initRules(languageService.getProgram()!, config);

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
      lint(sourceFile as unknown as SourceFile, ({ node, message, rule }) => {
        result.push({
          category: ts.DiagnosticCategory.Warning,
          source: "type-lint",
          code: 2,
          messageText: `${message} (${rule.name})`,
          file: sourceFile,
          start: node.getStart(),
          length: node.getEnd() - node.getStart(),
        });
      });
      return result;
    },
  };
};
