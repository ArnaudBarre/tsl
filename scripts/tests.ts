const rules = new Bun.Glob("src/rules/*.ts");

const fileFocus = process.argv[2];

for await (let rule of rules.scan()) {
  if (fileFocus && rule.split("/").pop() !== fileFocus) continue;
  const module = await import(`../${rule}`);
  if (module.test) {
    module.test();
  } else {
    console.log(`No tests for ${rule}`);
  }
}

export {};
