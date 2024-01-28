import ts, { ModuleResolutionKind } from "typescript";
import type { SourceFile, Visitor } from "./ast.ts";
import { getContextUtils } from "./getContextUtils.ts";
import type {
  AnyRule,
  AST,
  Checker,
  Context,
  Infer,
  ReportDescriptor,
  Rule,
} from "./types.ts";
import { visitorEntries } from "./visitorEntries.ts";

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
  moduleDetection: ts.ModuleDetectionKind.Force,
  moduleResolution: ModuleResolutionKind.Bundler,
  noEmit: true,
  isolatedModules: true,
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
    errors?: (
      | { message: string; line?: number; column?: number }
      | [message: string, line?: number, column?: number]
    )[];
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
    const compilerOptionsInput =
      caseProps.compilerOptions || useTSX
        ? {
            ...defaultCompilerOptions,
            jsx: useTSX ? ts.JsxEmit.ReactJSX : undefined,
            ...caseProps.compilerOptions,
          }
        : defaultCompilerOptions;
    const compilerOptionsKey = JSON.stringify(compilerOptionsInput);
    const current = compilerOptionsToFiles.get(compilerOptionsKey);
    if (current) {
      current.push(filename);
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
    const errors = invalidCase.errors
      ? invalidCase.errors.map((e) =>
          Array.isArray(e) ? { message: e[0], line: e[1], column: e[2] } : e,
        )
      : invalidCase.error
      ? [{ message: invalidCase.error }]
      : [];
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
    const program = ts.createProgram(
      [
        esLib,
        domLib,
        ...(compilerOptionsInput.jsx === ts.JsxEmit.ReactJSX
          ? [
              "node_modules/@types/react/index.d.ts",
              "node_modules/@types/react/jsx-runtime.d.ts",
            ]
          : []),
        ...files,
      ],
      compilerOptionsInput,
      host,
    );
    const emitResult = program.emit();
    if (indexFocus) {
      const allDiagnostics = ts
        .getPreEmitDiagnostics(program)
        .concat(emitResult.diagnostics);
      allDiagnostics.forEach((diagnostic) => {
        if (diagnostic.file) {
          let { line, character } = ts.getLineAndCharacterOfPosition(
            diagnostic.file,
            diagnostic.start!,
          );
          let message = ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            "\n",
          );
          console.log(
            `${diagnostic.file.fileName} (${line + 1},${
              character + 1
            }): ${message}`,
          );
        } else {
          console.log(
            ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
          );
        }
      });
    }
    compilerOptionsToProgram.set(optionsKey, program);
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
      program,
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
    const visit = (node: AST.AnyNode) => {
      const nodeType = visitorEntries.find((e) => e[0] === node.kind)?.[1];
      if (nodeType) {
        visitor[nodeType]?.(node as any, context);
      }
      // @ts-expect-error
      node.forEachChild(visit);
      if (nodeType) {
        visitor[`${nodeType}:exit` as keyof Visitor]?.(node as any, context);
      }
    };
    visit(sourceFile);
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
        let introLogged = false;
        for (
          let i = 0;
          i < Math.max(caseProps.errors!.length, reports.length);
          i++
        ) {
          if (caseProps.errors!.at(i)?.message !== reports.at(i)?.message) {
            if (!introLogged) {
              console.error(
                `Report(s) mismatch for invalid case ${caseProps.index} (${caseProps.code})`,
              );
              introLogged = true;
            }
            console.log(
              `  #${i}: Expected: ${caseProps.errors!.at(i)?.message}
           Got: ${reports.at(i)?.message}`,
            );
          }
        }
      }
    }
  }
};
