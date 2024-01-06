import ts from "typescript";
import type { SourceFile } from "./ast.ts";
import { getContextUtils } from "./getContextUtils.ts";
import type {
  AnyRule,
  Checker,
  Context,
  Infer,
  ReportDescriptor,
  Rule,
} from "./types.ts";
import { visit } from "./visit.ts";

type CaseProps<TRule extends Rule> = {
  code: string;
  tsx?: boolean;
  options?: Infer<TRule>["OptionsInput"];
  compilerOptions?: ts.CompilerOptions;
};
export { type defaultCompilerOptions };

const defaultCompilerOptions: ts.CompilerOptions = {
  module: ts.ModuleKind.ESNext,
  lib: ["ES2022"],
  target: ts.ScriptTarget.ESNext,
  noEmit: true,
  skipLibCheck: true,
  strict: true,
  types: [],
};

const programsCache = new Map<string, (filename: string) => ts.Program>();
const filesMap = new Map<string, string>();

const getProgram = (compilerOptions: ts.CompilerOptions | undefined) => {
  const compilerOptionsInput = compilerOptions
    ? { ...defaultCompilerOptions, ...compilerOptions }
    : defaultCompilerOptions;
  const cacheKey = JSON.stringify(compilerOptionsInput);
  const cachedProgram = programsCache.get(cacheKey);
  if (cachedProgram) return cachedProgram;
  const host = ts.createCompilerHost(compilerOptionsInput, true);
  const originalReadFile = host.readFile;
  host.readFile = (file) => {
    if (filesMap.has(file)) return filesMap.get(file);
    return originalReadFile(file);
  };
  const lib = "node_modules/typescript/lib/lib.es2022.d.ts";
  const base = ts.createProgram([lib], compilerOptionsInput, host);
  const fn = (filename: string) =>
    ts.createProgram([lib, filename], compilerOptionsInput, host, base);
  programsCache.set(cacheKey, fn);
  return fn;
};

export const ruleTester = <TRule extends AnyRule>({
  rule,
  tsx,
  valid,
  invalid,
}: {
  rule: TRule;
  tsx?: boolean;
  valid: (CaseProps<TRule> | string)[];
  invalid: (CaseProps<TRule> & {
    error?: string;
    errors?: { message: string; line?: number; column?: number }[];
  })[];
}) => {
  const runCase = (caseProps: CaseProps<TRule>, index: number) => {
    const options = rule.parseOptions?.(caseProps.options);
    const useTSX = tsx ? caseProps.tsx !== false : caseProps.tsx === true;
    const filename = `${rule.name}/${index}.${useTSX ? "tsx" : "ts"}`;
    filesMap.set(filename, caseProps.code);
    const program = getProgram(caseProps.compilerOptions)(filename);
    const checker = program.getTypeChecker() as unknown as Checker;
    const compilerOptions = program.getCompilerOptions();
    const visitor =
      typeof rule.visitor === "function" ? rule.visitor(options) : rule.visitor;
    const reports: ReportDescriptor[] = [];
    const sourceFile = program.getSourceFile(filename) as unknown as SourceFile;
    const context: Context<
      Infer<TRule>["OptionsOutput"],
      Infer<TRule>["Data"]
    > = {
      sourceFile,
      checker,
      compilerOptions,
      utils: getContextUtils(checker),
      report(descriptor) {
        reports.push(descriptor);
      },
      options,
      data: undefined,
    };
    if (rule.createData) context.data = rule.createData(context);
    visit(sourceFile, visitor, context);
    return reports;
  };

  console.log(rule.name);
  for (const [index, _validCase] of valid.entries()) {
    const validCase =
      typeof _validCase === "string" ? { code: _validCase } : _validCase;
    const reports = runCase(validCase, index);
    if (reports.length !== 0) {
      console.error(`Reports for valid case ${index} (${validCase.code})`);
      for (const report of reports) {
        console.log(`  - ${report.message}`);
      }
    }
  }
  for (const [index, invalidCase] of invalid.entries()) {
    const reports = runCase(invalidCase, index);
    if (reports.length === 0) {
      console.error(
        `No reports for invalid case ${index} (${invalidCase.code})`,
      );
    } else {
      const errors =
        invalidCase.errors ??
        (invalidCase.error ? [{ message: invalidCase.error }] : []);
      if (errors.length === 0) throw new Error("Unexpected empty errors");
      for (const [idx, error] of errors.entries()) {
        if (reports[idx].message !== error.message) {
          console.error(
            `Wrong message for invalid case ${index}: expected ${error.message}, got ${reports[idx].message}`,
          );
        }
      }
    }
  }
};
