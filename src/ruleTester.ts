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
type ErrorReport = { message: string; line?: number; column?: number };
type SetupCase<TRule extends Rule> = {
  compilerOptionsKey: string;
  filename: string;
  code: string;
  options?: Infer<TRule>["OptionsInput"];
  isValid: boolean;
  index: number;
  errors: ErrorReport[] | null;
};

const defaultCompilerOptions: ts.CompilerOptions = {
  module: ts.ModuleKind.ESNext,
  lib: ["ES2022"],
  target: ts.ScriptTarget.ESNext,
  noEmit: true,
  skipLibCheck: true,
  strict: true,
  types: [],
};

const typeFocus = process.argv[3];
const indexFocus = process.argv[4];
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
  const compilerOptionsToFiles = new Map<string, string[]>();
  const filesMap = new Map<string, string>();
  const cases: SetupCase<TRule>[] = [];

  const setupCase = (
    caseProps: CaseProps<TRule>,
    isValid: boolean,
    index: number,
    errors: ErrorReport[] | null,
  ) => {
    const useTSX = tsx ? caseProps.tsx !== false : caseProps.tsx === true;
    const filename = `${rule.name}/${isValid ? "valid" : "invalid"}-${index}.${
      useTSX ? "tsx" : "ts"
    }`;
    filesMap.set(filename, caseProps.code);
    const compilerOptionsInput = caseProps.compilerOptions
      ? { ...defaultCompilerOptions, ...caseProps.compilerOptions }
      : defaultCompilerOptions;
    const compilerOptionsKey = JSON.stringify(compilerOptionsInput);
    const cachedProgram = compilerOptionsToFiles.get(compilerOptionsKey);
    if (cachedProgram) {
      cachedProgram.push(filename);
    } else {
      compilerOptionsToFiles.set(compilerOptionsKey, [filename]);
    }
    cases.push({
      compilerOptionsKey,
      filename,
      code: caseProps.code,
      options: caseProps.options,
      isValid,
      index,
      errors,
    });
  };

  console.log(rule.name);
  for (const [index, _validCase] of valid.entries()) {
    if (typeFocus && typeFocus !== "valid") continue;
    if (indexFocus && indexFocus !== index.toString()) continue;
    const validCase =
      typeof _validCase === "string" ? { code: _validCase } : _validCase;
    setupCase(validCase, true, index, null);
  }
  for (const [index, invalidCase] of invalid.entries()) {
    if (typeFocus && typeFocus !== "invalid") continue;
    if (indexFocus && indexFocus !== index.toString()) continue;
    const errors =
      invalidCase.errors ??
      (invalidCase.error ? [{ message: invalidCase.error }] : []);
    if (errors.length === 0) {
      throw new Error(`Invalid case ${index} has no errors`);
    }
    setupCase(invalidCase, false, index, errors);
  }

  const compilerOptionsToProgram = new Map<string, ts.Program>();
  for (const [optionsKey, files] of compilerOptionsToFiles.entries()) {
    const compilerOptionsInput = JSON.parse(optionsKey);
    const host = ts.createCompilerHost(compilerOptionsInput, true);
    const originalReadFile = host.readFile;
    host.readFile = (file) => {
      if (filesMap.has(file)) return filesMap.get(file);
      return originalReadFile(file);
    };
    const esLib = "node_modules/typescript/lib/lib.es2022.d.ts";
    const domLib = "node_modules/typescript/lib/lib.dom.d.ts";
    compilerOptionsToProgram.set(
      optionsKey,
      ts.createProgram([esLib, domLib, ...files], compilerOptionsInput, host),
    );
  }

  for (const caseProps of cases) {
    const options = rule.parseOptions?.(caseProps.options);
    const program = compilerOptionsToProgram.get(caseProps.compilerOptionsKey)!;
    const checker = program.getTypeChecker() as unknown as Checker;
    const compilerOptions = program.getCompilerOptions();
    const visitor =
      typeof rule.visitor === "function" ? rule.visitor(options) : rule.visitor;
    const reports: ReportDescriptor[] = [];
    const sourceFile = program.getSourceFile(
      caseProps.filename,
    ) as unknown as SourceFile;
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
    if (caseProps.isValid) {
      if (reports.length !== 0) {
        console.error(
          `Reports for valid case ${caseProps.index} (${caseProps.code})`,
        );
        for (const report of reports) {
          console.log(`  - ${report.message}`);
        }
      }
    } else {
      if (reports.length === 0) {
        console.error(
          `No reports for invalid case ${caseProps.index} (${caseProps.code})`,
        );
      } else {
        for (const [idx, error] of caseProps.errors!.entries()) {
          if (reports[idx].message !== error.message) {
            console.error(
              `Wrong message for invalid case ${caseProps.index}: expected ${error.message}, got ${reports[idx].message}`,
            );
          }
        }
      }
    }
  }
};
