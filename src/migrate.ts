#!/usr/bin/env node
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import readline from "node:readline/promises";
import { styleText } from "node:util";
import { core, type Rule } from "./index.ts";

const files = readdirSync(process.cwd());

const config = files.find((file) => file.startsWith("eslint.config."));

if (!config) {
  console.log(
    styleText(
      "yellow",
      "No config found. Only flat config (eslint.config.js) is supported.",
    ),
  );
  process.exit(1);
}

const module: object = await import(join(process.cwd(), config));

if (!("default" in module)) throw new Error("No default export");

if (!Array.isArray(module.default)) throw new Error("Config is not an array");
const { all: _, ...rules } = core;

const addPrefix = (name: string) => `@typescript-eslint/${name}`;

const tseslintTypeAwareRules = new Set(
  [
    "await-thenable",
    "consistent-return",
    "consistent-type-exports",
    "dot-notation",
    "naming-convention",
    "no-array-delete",
    "no-base-to-string",
    "no-confusing-void-expression",
    "no-deprecated",
    "no-duplicate-type-constituents",
    "no-floating-promises",
    "no-for-in-array",
    "no-implied-eval",
    "no-meaningless-void-operator",
    "no-misused-promises",
    "no-misused-spread",
    "no-mixed-enums",
    "no-redundant-type-constituents",
    "no-unnecessary-boolean-literal-compare",
    "no-unnecessary-condition",
    "no-unnecessary-qualifier",
    "no-unnecessary-template-expression",
    "no-unnecessary-type-arguments",
    "no-unnecessary-type-assertion",
    "no-unnecessary-type-conversion",
    "no-unnecessary-type-parameters",
    "no-unsafe-argument",
    "no-unsafe-assignment",
    "no-unsafe-call",
    "no-unsafe-enum-comparison",
    "no-unsafe-member-access",
    "no-unsafe-return",
    "no-unsafe-type-assertion",
    "no-unsafe-unary-minus",
    "no-useless-default-assignment",
    "non-nullable-type-assertion-style",
    "only-throw-error",
    "prefer-destructuring",
    "prefer-find",
    "prefer-includes",
    "prefer-nullish-coalescing",
    "prefer-optional-chain",
    "prefer-promise-reject-errors",
    "prefer-readonly",
    "prefer-readonly-parameter-types",
    "prefer-reduce-type-parameter",
    "prefer-regexp-exec",
    "prefer-return-this-type",
    "prefer-string-starts-ends-with",
    "promise-function-async",
    "related-getter-setter-pairs",
    "require-array-sort-compare",
    "require-await",
    "restrict-plus-operands",
    "restrict-template-expressions",
    "return-await",
    "strict-boolean-expressions",
    "switch-exhaustiveness-check",
    "unbound-method",
    "use-unknown-in-catch-callback-variable",
  ].map((name) => addPrefix(name)),
);

const rulesWithPatches = [
  {
    name: addPrefix("prefer-promise-reject-errors"),
    patch: "promiseRejectError",
  },
  {
    name: addPrefix("use-unknown-in-catch-callback-variable"),
    patch: "unknowninCatchCallbacks",
  },
];

type RuleWithName = { name: string; ruleFn: (args?: "off") => Rule<unknown> };
const rulesMapping = new Map<string, RuleWithName>(
  Object.entries(rules).map(([name, fn]) => {
    const kebabCaseName = name.replaceAll(
      /[A-Z]/g,
      (letter) => `-${letter.toLowerCase()}`,
    );
    return [addPrefix(kebabCaseName), { name, ruleFn: fn }];
  }),
);
let hasProject = false;
let hasProjectServices = false;
const foundRules = new Map<
  string,
  { rule: RuleWithName; options: Record<string, unknown> | undefined }
>();
const missingRules = new Set<string>();
const patchesToImport = new Set<string>();
for (const config of module.default) {
  if ("rules" in config) {
    for (const [key, value] of Object.entries(config.rules)) {
      if (value === "off") continue;
      if (!tseslintTypeAwareRules.has(key)) continue;
      const tslRule = rulesMapping.get(key);
      if (tslRule) {
        if (foundRules.has(key)) continue;
        const options =
          Array.isArray(value)
          && typeof value[1] === "object"
          && value[1] !== null
            ? value[1]
            : undefined;
        foundRules.set(key, { rule: tslRule, options });
      } else {
        const patch = rulesWithPatches.find((rule) => rule.name === key);
        if (patch) {
          patchesToImport.add(patch.patch);
        } else {
          missingRules.add(key);
        }
      }
    }
  }
  const parserOptions = config.languageOptions?.parserOptions;
  if (parserOptions !== undefined) {
    hasProject ||= Boolean(parserOptions.project);
    hasProjectServices ||= Boolean(parserOptions.projectService);
  }
}

if (
  foundRules.size === 0
  && missingRules.size === 0
  && patchesToImport.size === 0
  && !hasProject
  && !hasProjectServices
) {
  console.log(
    styleText("yellow", "This ESLint config is not using type-aware linting."),
  );
  process.exit(1);
}

if (foundRules.size === 0 && missingRules.size === 0) {
  console.log(
    styleText(
      "yellow",
      "This ESLint config seems to use type-aware linting, but no rules were enabled. You can probably safely remove the `project` and `projectService` options in your ESLint config and start using tsl to get fast type-aware linting.",
    ),
  );
  process.exit(1);
}

async function readLine(question: string) {
  const int = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await int.question(`${question}: `);
  int.close();
  return answer.trim();
}

function pluralize(count: number, name: string) {
  return count === 1 ? `${count} ${name}` : `${count} ${name}s`;
}

function formatRulesSet(rules: string[]) {
  return rules.length === 1
    ? rules[0]
    : `@typescript-eslint/{${rules.map((n) => n.replace("@typescript-eslint/", "")).join(", ")}}`;
}

if (foundRules.size > 0) {
  console.log(
    styleText(
      "green",
      `${pluralize(foundRules.size, "supported rule")} found: `
        + formatRulesSet(Array.from(foundRules.keys())),
    ),
  );
}

if (missingRules.size > 0) {
  console.log(
    styleText(
      "yellow",
      `${pluralize(missingRules.size, "rule")} missing: ${formatRulesSet(
        Array.from(missingRules),
      )}`,
    ),
  );
  try {
    const answer = (
      await readLine("Do you want to continue the import? (y/n)")
    ).toLowerCase();
    if (answer !== "y" && answer !== "yes") process.exit(1);
  } catch (error) {
    process.exit(0);
  }
}

writeFileSync(
  "tsl.config.ts",
  `import { core, defineConfig } from "tsl";

export default defineConfig({
  rules: [
    ${Array.from(foundRules.values())
      .map(({ rule, options }) => {
        return `core.${rule.name}(${options ? JSON.stringify(options) : ""}),`;
      })
      .join("\n    ")}
  ],
});
`,
);

console.log(styleText("green", "tsl.config.ts was created."));

if (patchesToImport.size > 0) {
  console.log(
    styleText(
      "cyan",
      "Add `tsl/patches` to compilerOptions.types in your tsconfig.json",
    ),
  );
}

if (missingRules.size === 0) {
  const options = [
    { enable: hasProject, option: "project" },
    { enable: hasProjectServices, option: "projectService" },
  ].filter(({ enable }) => enable);
  if (options.length > 0) {
    console.log(
      styleText(
        "cyan",
        `Update your ESLint config to remove the ${options.map(({ option }) => `\`${option}\``).join(" and ")} options and the type-aware rules.`,
      ),
    );
  }
} else {
  console.log(
    styleText(
      "cyan",
      `Update your ESLint config to remove the imported type-aware rules: ${formatRulesSet(
        Array.from(foundRules.keys()),
      )}`,
    ),
  );
}
