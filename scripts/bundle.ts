import { execSync } from "node:child_process";
import { readdirSync, rmSync, writeFileSync } from "node:fs";
import { build, type BuildOptions } from "esbuild";
import packageJSON from "../package.json";

rmSync("dist", { force: true, recursive: true });

const commonOptions = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  packages: "external",
  treeShaking: true,
} satisfies BuildOptions;

const fileToFunction = (folder: string) =>
  folder.replace(/-([a-z])/gu, (_, c) => c.toUpperCase());

const rules = readdirSync("src/rules").filter(
  (f) => !f.startsWith(".") && !f.startsWith("_"),
);

await build({
  ...commonOptions,
  entryPoints: rules.map((r) => ({ in: `src/rules/${r}/${r}.ts`, out: r })),
  outdir: "dist/rules",
  splitting: true,
});

writeFileSync(
  "dist/allRules.js",
  [
    "export const allRules = async (config) => {",
    "  const rules = [];",
    "  for (const key in config) {",
    "    if (!key) continue;",
    "    if (key === 'off') continue;",
    ...rules.map(
      (r) =>
        `    if (key === "${r}") rules.push(import("./rules/${r}.js").then((m) => m.${fileToFunction(
          r,
        )}));`,
    ),
    "  }",
    "  return await Promise.all(rules);",
    "};",
  ].join("\n"),
);
writeFileSync(
  "dist/rules.js",
  rules
    .map((r) => `export { ${fileToFunction(r)} } from "./rules/${r}.js";`)
    .join("\n"),
);
await build({
  ...commonOptions,
  entryPoints: ["src/cli.ts"],
  outfile: "dist/cli.js",
});
await build({
  ...commonOptions,
  entryPoints: ["src/plugin.ts"],
  outfile: "dist/plugin.js",
});
await build({
  ...commonOptions,
  entryPoints: ["src/public-utils.ts"],
  outfile: "dist/index.js",
});

execSync("cp LICENSE README.md dist/");

writeFileSync(
  "dist/package.json",
  JSON.stringify(
    {
      name: packageJSON.name,
      description: packageJSON.description,
      version: packageJSON.version,
      author: packageJSON.author,
      license: packageJSON.license,
      repository: "github:ArnaudBarre/type-lint",
      type: "module",
      exports: {
        ".": {
          types: "./index.d.ts",
          import: "./index.js",
        },
        "./plugin": { import: "./plugin.js" },
      },
      bin: { "type-lint": "cli.js" },
      peerDependencies: packageJSON.peerDependencies,
      dependencies: packageJSON.dependencies,
    },
    null,
    2,
  ),
);
