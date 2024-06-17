import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type * as ts from "typescript";
import { SyntaxKind } from "typescript";
import type { SourceFile } from "../ast.ts";
import { initRules } from "../initRules.ts";
import { defineConfig } from "../public-utils.ts";

const logs: string[] = [];
let logPath: string | undefined;
const log = (v: string) => {
  logs.push(v);
  if (logPath) writeFileSync(logPath, logs.join("\n"));
};

const init: ts.server.PluginModuleFactory = ({ typescript: ts }) => {
  const pluginModule: ts.server.PluginModule = {
    create(info) {
      if (!logPath) {
        logPath = join(
          dirname(info.project.getProjectName()),
          "type-lint-logs.txt",
        );
      }
      log(info.project.getProjectName());
      const program = info.languageService.getProgram();
      if (!program) {
        log("No program");
        return info.languageService;
      }
      const config = defineConfig({
        rules: [
          {
            name: "no-console",
            visitor: {
              PropertyAccessExpression(node, context) {
                if (
                  node.expression.kind === SyntaxKind.Identifier &&
                  node.expression.text === "console"
                ) {
                  context.report({ node, message: "Unexpected console.log" });
                }
              },
            },
          },
        ],
      });
      const lint = initRules(program, config);
      const { getSemanticDiagnostics } = info.languageService;
      info.languageService.getSemanticDiagnostics = (fileName) => {
        const result = getSemanticDiagnostics(fileName);
        if (fileName.includes("/node_modules/")) return result;
        const program = info.languageService.getProgram();
        const sourceFile = program?.getSourceFile(fileName);
        if (!sourceFile) {
          log("No sourceFile");
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
      };
      return info.languageService;
    },
  };
  return pluginModule;
};

module.exports = init;
