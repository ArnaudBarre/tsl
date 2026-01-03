import type * as ts from "typescript";
import { getPlugin } from "./getPlugin.ts";

const init: ts.server.PluginModuleFactory = ({ typescript: ts }) => {
  const pluginModule: ts.server.PluginModule = {
    create(info) {
      const log = (v: string) => info.project.projectService.logger.info(v);
      log("tsl: Starting plugin");
      const { getSemanticDiagnostics, getCodeFixesAtPosition } =
        info.languageService;
      let plugin: Awaited<ReturnType<typeof getPlugin>> | undefined;
      void getPlugin(ts, info.languageService, log).then((p) => (plugin = p));
      info.languageService.getSemanticDiagnostics = (fileName) => [
        ...(plugin?.getSemanticDiagnostics(fileName) ?? []),
        ...getSemanticDiagnostics(fileName),
      ];
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
