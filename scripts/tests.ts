const rules = new Bun.Glob("src/rules/*.ts");

let fileFocus = process.argv[2];
if (fileFocus && !fileFocus.endsWith(".ts")) fileFocus += ".ts";

let hasError = false;

for await (let rule of rules.scan()) {
  if (fileFocus && rule.split("/").pop() !== fileFocus) continue;
  const module = (await import(`../${rule}`)) as { test?: () => boolean };
  if (module.test) {
    hasError ||= module.test();
  } else {
    hasError = true;
    console.log(`No tests for ${rule}`);
  }
}

if (hasError) process.exit(1);

export {};
