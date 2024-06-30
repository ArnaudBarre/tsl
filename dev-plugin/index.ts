import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { context } from "esbuild";
import type * as ts from "typescript";
import type { server } from "typescript";
import type { getPlugin } from "../src/plugin.ts";

let currentProject:
  | { ts: typeof ts; info: server.PluginCreateInfo }
  | undefined;
let plugin: ReturnType<typeof getPlugin> | undefined;

context({
  bundle: true,
  entryPoints: [join(__dirname, "../src/plugin.ts")],
  outfile: join(__dirname, "get-plugin.mjs"),
  platform: "node",
  format: "esm",
  external: ["typescript", "esbuild", "ts-api-utils"],
  plugins: [
    {
      name: "hot-reload",
      setup(build) {
        build.onEnd(async (result) => {
          for (const m of result.errors) log(m.text);
          for (const m of result.warnings) log(m.text);
          try {
            let path = "./get-plugin.mjs" + `?${Date.now()}`;
            const module = (await import(path)) as {
              getPlugin: typeof getPlugin;
            };
            if (!currentProject) {
              log("get-plugin loaded before plugin start");
            } else {
              plugin = module.getPlugin(
                currentProject.ts,
                currentProject.info.languageService,
                log,
              );
              log("Plugin updated");
              currentProject.info.project.refreshDiagnostics();
            }
          } catch (e: any) {
            log(e.message);
          }
        });
      },
    },
  ],
}).then((ctx) => ctx.watch());

const logs: string[] = [`Start at ${new Date()}`];
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
          "plugin-logs.txt",
        );
      }
      log?.(`create ${info.project.getProjectName()}`);
      currentProject = { ts, info };
      const { getSemanticDiagnostics, getCodeFixesAtPosition } =
        info.languageService;
      info.languageService.getSemanticDiagnostics = (fileName) => {
        if (!plugin) return getSemanticDiagnostics(fileName);
        return plugin.getSemanticDiagnostics(fileName, getSemanticDiagnostics);
      };
      info.languageService.getCodeFixesAtPosition = (...args) => {
        if (!plugin) return getCodeFixesAtPosition(...args);
        const customFixes = plugin.getCodeFixesAtPosition(...args);
        if (!customFixes.length) return getCodeFixesAtPosition(...args);
        return [...getCodeFixesAtPosition(...args), ...customFixes];
      };
      return info.languageService;
    },
  };
  return pluginModule;
};

module.exports = init;
