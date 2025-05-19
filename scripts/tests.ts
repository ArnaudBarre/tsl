import { readdirSync } from "node:fs";

const rules = readdirSync("src/rules").filter(
  (f) => !f.startsWith(".") && !f.startsWith("_"),
);

let fileFocus = process.argv.at(2);
if (fileFocus?.endsWith(".ts")) fileFocus = fileFocus.slice(0, -3);
if (fileFocus?.startsWith("core/")) fileFocus = fileFocus.slice(5);
if (fileFocus?.startsWith("src/rules/")) fileFocus = fileFocus.slice(10);
let hasError = false;

for (const rule of rules) {
  if (fileFocus && rule !== fileFocus) continue;
  const module = (await import(`../src/rules/${rule}/${rule}.test.ts`)) as {
    test?: () => boolean;
  };
  if (module.test) {
    const result = module.test();
    hasError ||= result;
  } else {
    hasError = true;
    console.log(`No tests for ${rule}`);
  }
}

if (hasError) process.exit(1);

export {};
