import type * as ts from "typescript";
import { getPlugin } from "./getPlugin.ts";

const init: ts.server.PluginModuleFactory = ({ typescript: ts }) => {
  const pluginModule: ts.server.PluginModule = {
    create(info) {
      const log = (v: string) => info.project.projectService.logger.info(v);
      log("type-lint: Starting plugin");
      const { getSemanticDiagnostics, getCodeFixesAtPosition } =
        info.languageService;
      let plugin: Awaited<ReturnType<typeof getPlugin>> | undefined;
      void getPlugin(ts, info.languageService, log).then((p) => (plugin = p));
      info.languageService.getSemanticDiagnostics = (fileName) => {
        if (!plugin) return getSemanticDiagnostics(fileName);
        return plugin.getSemanticDiagnostics(fileName, getSemanticDiagnostics);
      };
      info.languageService.getCodeFixesAtPosition = (...args) => [
        ...(plugin?.getCodeFixesAtPosition(...args) ?? []),
        ...getCodeFixesAtPosition(...args),
      ];
      return info.languageService;
    },
  };
  return pluginModule;
};

module.exports = init;
