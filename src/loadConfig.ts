import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build, type BuildResult, formatMessagesSync } from "esbuild";
import ts from "typescript";
import type { Config } from "./types.ts";

const defaultConfig: Config<string> = { rules: [] };

export const loadConfig = async (
  program: ts.Program,
): Promise<{ config: Config<string>; configFiles: string[] }> => {
  const workingDir = program.getCurrentDirectory();
  const entryPoint = join(workingDir, "type-lint.config.ts");
  const cacheDir = join(workingDir, "node_modules/.cache/type-lint");
  const output = join(cacheDir, "config.js");
  if (!existsSync(entryPoint)) {
    return { config: defaultConfig, configFiles: [entryPoint] };
  }
  const cache = jsonCache<{ files: [path: string, hash: string][] }>(
    join(cacheDir, "config-hashes.json"),
    4,
  );
  let files = cache.read()?.files;
  if (
    !files
    || files.some(([path, hash]) => {
      const content = readMaybeFileSync(path);
      return !content || getHash(content) !== hash;
    })
  ) {
    const result = await build({
      entryPoints: [entryPoint],
      outfile: output,
      metafile: true,
      bundle: true,
      format: "esm",
      target: "node18",
      platform: "node",
      plugins: [
        {
          name: "externalize-deps",
          setup: ({ onResolve }) => {
            onResolve({ filter: /.*/ }, ({ path }) => {
              if (path !== entryPoint && !path.startsWith(".")) {
                return { external: true };
              }
            });
          },
        },
      ],
    });
    logEsbuildErrors(result);
    files = Object.keys(result.metafile.inputs).map((path) => [
      path,
      getHash(readFileSync(path)),
    ]);
    cache.write({ files });
    writeFileSync(join(cacheDir, "package.json"), '{ "type": "module" }');
  }

  const module = (await import(`${output}?t=${Date.now()}`)) as {
    default?: Config<string>;
  };
  if (!module.default) {
    throw new Error(`${entryPoint} doesn't have a default export`);
  }
  return {
    config: module.default,
    configFiles: files.map((f) => f[0]),
  };
};

const jsonCache = <T extends Record<string, any>>(
  path: string,
  version: number | string,
) => ({
  read: (): T | undefined => {
    const content = readMaybeFileSync(path);
    if (!content) return;
    const json = JSON.parse(content) as T & { version: number | string };
    if (json.version !== version) return;
    // @ts-expect-error
    delete json.version;
    return json;
  },
  write: (data: T): void => {
    writeFileSync(path, JSON.stringify({ version, ...data }));
  },
});

const useColors = !(
  "NO_COLOR" in process.env || process.argv.includes("--no-color")
);

const logEsbuildErrors = ({ errors, warnings }: BuildResult): void => {
  if (errors.length) {
    console.log(
      formatMessagesSync(errors, {
        kind: "error",
        color: useColors,
      }).join("\n"),
    );
  } else if (warnings.length) {
    console.log(
      formatMessagesSync(warnings, {
        kind: "warning",
        color: useColors,
      }).join("\n"),
    );
  }
};

const getHash = (content: string | Buffer): string =>
  typeof content === "string"
    ? createHash("sha1").update(content, "utf-8").digest("hex")
    : createHash("sha1").update(content).digest("hex");

const readMaybeFileSync = (path: string): string | undefined => {
  try {
    return readFileSync(path, "utf-8");
  } catch (err: any) {
    if (err.code === "ENOENT") return;
    throw err;
  }
};
