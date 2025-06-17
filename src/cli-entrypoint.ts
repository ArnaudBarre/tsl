#!/usr/bin/env node
import type { Session } from "node:inspector";

declare global {
  const __VERSION__: string;
  /* eslint-disable no-var */
  var __type_lint_start: number;
  var __type_lint_profile_session: Session | undefined;
  /* eslint-enable no-var */
}

globalThis.__type_lint_start = performance.now();
const cmd = process.argv[2] as string | undefined;

if (cmd === "-v" || cmd === "--version") {
  console.log(__VERSION__);
  process.exit();
}

if (cmd === "--help") {
  console.log(`Usage: type-lint [options]

Options:
  -p, --project=path   Path to the tsconfig to lint (default: tsconfig.json)
  --lint-only          Don't run tsc first, only lint the files (not recommended)
  -v, --version        Print the version
  -t, --timing         Print timing information
  --help               Print this help message
  --profile            Profile the linting process
`);
  process.exit();
}

const main = async () => {
  await import("./cli.ts");
};

if (process.argv.includes("--profile")) {
  const inspector = await import("inspector");
  const session = new inspector.Session();
  globalThis.__type_lint_profile_session = session;
  session.connect();
  session.post("Profiler.enable", () => {
    session.post("Profiler.start", main);
  });
} else {
  await main();
}
