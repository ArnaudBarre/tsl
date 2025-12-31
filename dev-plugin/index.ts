import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { context } from "esbuild";
import type * as ts from "typescript";
import type { getPlugin } from "../src/getPlugin.ts";

let currentProject:
  | { ts: typeof ts; info: ts.server.PluginCreateInfo }
  | undefined;
let plugin: Awaited<ReturnType<typeof getPlugin>> | undefined;

const outfile = join(__dirname, "getPlugin.mjs");
rmSync(outfile, { force: true });

context({
  bundle: true,
  entryPoints: [join(__dirname, "../src/getPlugin.ts")],
  outfile,
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
            if (plugin) plugin.cleanUp();
            let path = `./getPlugin.mjs?${Date.now()}`;
            const module = (await import(path)) as {
              getPlugin: typeof getPlugin;
            };
            if (!currentProject) {
              log("getPlugin loaded before plugin start");
            } else {
              plugin = await module.getPlugin(
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
}).then(
  (ctx) => ctx.watch(),
  (e) => log((e as Error).message),
);

const logs: string[] = [];
let logPath: string | undefined;
const log = (v: string) => {
  logs.push(`[${new Date().toISOString().slice(11, -1)}] ${v}`);
  if (logPath !== undefined) writeFileSync(logPath, logs.join("\n"));
};

const init: ts.server.PluginModuleFactory = ({ typescript: ts }) => {
  const pluginModule: ts.server.PluginModule = {
    create(info) {
      const start = new Date().toISOString();
      const dir = join(
        dirname(info.project.getProjectName()),
        "dev-plugin/logs",
      );
      if (!existsSync(dir)) mkdirSync(dir);
      logPath = join(dir, `${start}.txt`);
      log(
        `Create ${info.project.getProjectName()} (${info.project.projectKind})`,
      );
      currentProject = { ts, info };
      const { getSemanticDiagnostics, getCodeFixesAtPosition } =
        info.languageService;
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
