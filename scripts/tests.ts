const rules = new Bun.Glob("src/rules/*.ts");

const focus = process.argv[2];

for await (let rule of rules.scan()) {
  if (focus && rule.split("/").pop() !== focus) continue;
  const module = await import(`../${rule}`);
  if (module.test) {
    module.test();
  } else {
    console.log(`No tests for ${rule}`);
  }
}

export {};
