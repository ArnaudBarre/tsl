import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { build } from "tsdown";
import packageJSON from "../package.json";

await build({
  define: { __VERSION__: `"${packageJSON.version}"` },
  entry: ["src/index.ts", "src/ruleTester.ts"],
  dts: { emitDtsOnly: true },
});

await build({
  clean: false,
  entry: [
    "src/index.ts",
    "src/ruleTester.ts",
    "src/cli-entrypoint.ts",
    "src/cli.ts",
  ],
});

await build({
  clean: false,
  format: "cjs",
  entry: { "plugin/index": "src/plugin-entrypoint.ts" },
});
writeFileSync(
  "dist/plugin/package.json",
  JSON.stringify({ name: "tsl-plugin", main: "index.cjs" }, null, 2),
);

execSync("cp -r LICENSE README.md src/patches dist/");

writeFileSync(
  "dist/package.json",
  JSON.stringify(
    {
      name: packageJSON.name,
      description: packageJSON.description,
      version: packageJSON.version,
      author: packageJSON.author,
      license: packageJSON.license,
      repository: "github:ArnaudBarre/tsl",
      type: "module",
      exports: {
        ".": { types: "./index.d.ts", import: "./index.js" },
        "./patches": { types: "./patches/all.d.ts" },
        "./patches/*": { types: "./patches/*.d.ts" },
        "./ruleTester": {
          types: "./ruleTester.d.ts",
          import: "./ruleTester.js",
        },
      },
      bin: { tsl: "cli-entrypoint.js" },
      peerDependencies: packageJSON.peerDependencies,
      dependencies: packageJSON.dependencies,
    },
    null,
    2,
  ),
);
