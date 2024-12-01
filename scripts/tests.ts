import { readdirSync } from "node:fs";

const rules = readdirSync("src/rules").filter(
  (f) => !f.startsWith(".") && !f.startsWith("_"),
);

let fileFocus = process.argv[2];
if (fileFocus && !fileFocus.endsWith(".ts")) fileFocus += ".ts";

let hasError = false;

for (const rule of rules) {
  if (fileFocus && rule !== fileFocus) continue;
  const module = (await import(`../src/rules/${rule}/${rule}.test.ts`)) as {
    test?: () => boolean;
  };
  if (module.test) {
    hasError ||= module.test();
  } else {
    hasError = true;
    console.log(`No tests for ${rule}`);
  }
}

if (hasError) process.exit(1);

export {};
