import { execSync } from "node:child_process";
import {
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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

const getOptionsName = (rule: string) =>
  rule.charAt(0).toUpperCase() + rule.slice(1) + "Options";

const rules = readdirSync("src/rules").filter(
  (f) => !f.startsWith(".") && !f.startsWith("_"),
);

const getMatch = (content: string, search: string, position?: number) => {
  const index = content.indexOf(search, position);
  if (index === -1) return null;
  return { start: index, end: index + search.length };
};
const optionsTypes: Record<string, string | undefined> = {};
for (const rule of rules) {
  const content = readFileSync(`src/rules/${rule}/${rule}.ts`, "utf-8");
  const match = getMatch(content, "export type ");
  if (!match) continue;
  const endNameMatch = getMatch(content, " ", match.end)!;
  const typeName = content.slice(match.end, endNameMatch.start);
  if (typeName !== getOptionsName(rule)) {
    throw new Error(
      `Options type mismatch for ${rule}: expected ${getOptionsName(
        rule,
      )} but got ${typeName}`,
    );
  }
  const typeEndMatch = getMatch(content, "\n};\n", endNameMatch.end)!;
  optionsTypes[rule] = content.slice(match.start, typeEndMatch.end);
}

await build({
  ...commonOptions,
  entryPoints: rules.map((r) => ({ in: `src/rules/${r}/${r}.ts`, out: r })),
  outdir: "dist/rules",
  splitting: true,
});

writeFileSync(
  "dist/rules.js",
  rules.map((r) => `export { ${r} } from "./rules/${r}.js";`).join("\n"),
);
writeFileSync(
  "dist/rules.d.ts",
  'import type { Rule } from "./types.d.ts";\n\n'
    + rules
      .map((r) => {
        const prefix = `export declare const ${r}:`;
        const args =
          r in optionsTypes ? `(options: ${getOptionsName(r)})` : "()";
        return prefix + args + ` => Rule<"core/${r}", unknown>;`;
      })
      .join("\n")
    + "\n"
    + rules
      .map((r) => (optionsTypes[r] ? `\n${optionsTypes[r]}` : ""))
      .join(""),
);

writeFileSync(
  "dist/allRules.js",
  [
    "export const allRules = async (config) => {",
    "  const rules = [];",
    "  for (const key in config) {",
    "    if (!config[key] || config[key] === 'off') continue;",
    ...rules.map(
      (r) =>
        `    if (key === "core/${r}") rules.push(import("./rules/${r}.js").then((m) => m.${r}));`,
    ),
    "  }",
    "  return await Promise.all(rules);",
    "};",
  ].join("\n"),
);
writeFileSync(
  "dist/allRules.d.ts",
  [
    "import type { AllRulesPreset } from './types.d.ts';",
    `import type { ${rules
      .map((r) => (r in optionsTypes ? getOptionsName(r) : ""))
      .filter(Boolean)
      .join(", ")} } from './rules.d.ts';`,
    "type Props = {",
    ...rules.map((r) => {
      const arg =
        r in optionsTypes
          ? `${getOptionsName(r)} | "on" | "off"`
          : '"on" | "off"';
      return `  "core/${r}"?: ${arg};`;
    }),
    "};",
    "export declare const allRules: AllRulesPreset<keyof Props, Props>;",
  ].join("\n"),
);

await build({
  ...commonOptions,
  entryPoints: ["src/cli.ts", "src/plugin.ts", "src/ruleTester.ts"],
  outdir: "dist",
  splitting: true,
});
execSync(
  "tsc src/ruleTester.ts --declaration --noCheck --emitDeclarationOnly --outDir dist/ruleTester --target es2023 --module es2022 --moduleResolution bundler",
  { stdio: "inherit" },
);
renameSync("dist/ruleTester/ruleTester.d.ts", "dist/ruleTester.d.ts");
rmSync("dist/ruleTester", { recursive: true });

await build({
  ...commonOptions,
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
});
execSync(
  "tsc src/index.ts --declaration --noCheck --emitDeclarationOnly --outDir dist --target es2023 --module es2022 --moduleResolution bundler",
  { stdio: "inherit" },
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
        "./rules": { types: "./rules.d.ts", import: "./rules.js" },
        "./allRules": { types: "./allRules.d.ts", import: "./allRules.js" },
        "./plugin": { import: "./plugin.js" },
        "./ruleTester": {
          types: "./ruleTester.d.ts",
          import: "./ruleTester.js",
        },
      },
      bin: { "type-lint": "cli.js" },
      peerDependencies: packageJSON.peerDependencies,
      dependencies: packageJSON.dependencies,
    },
    null,
    2,
  ),
);
