const rules = new Bun.Glob("src/rules/*.ts");

for await (let rule of rules.scan()) {
  const module = await import(`../${rule}`);
  if (module.test) {
    module.test();
  } else {
    console.log(`No test for ${rule}`);
  }
}

export {};
