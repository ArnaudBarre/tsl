import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { build } from "tsdown";
import packageJSON from "../package.json";

await build({
  define: { __VERSION__: `"${packageJSON.version}"` },
  entry: ["src/index.ts", "src/ruleTester.ts"],
  dts: true,
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
  JSON.stringify({ name: "type-lint-plugin", main: "index.cjs" }, null, 2),
);

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
        ".": { types: "./index.d.ts", import: "./index.js" },
        "./ruleTester": {
          types: "./ruleTester.d.ts",
          import: "./ruleTester.js",
        },
      },
      bin: { "type-lint": "cli-entrypoint.js" },
      peerDependencies: packageJSON.peerDependencies,
      dependencies: packageJSON.dependencies,
    },
    null,
    2,
  ),
);
