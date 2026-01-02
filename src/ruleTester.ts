import ts, { ModuleResolutionKind, NodeFlags, SyntaxKind } from "typescript";
import type { SourceFile, Visitor } from "./ast.ts";
import { getContextUtils } from "./getContextUtils.ts";
import type { AST, Checker, Context, ReportDescriptor, Rule } from "./types.ts";
import { visitorEntries } from "./visitorEntries.ts";

// tsl-ignore core/unusedExport
export function print(...args: any[]) {
  console.log(...args.map((value) => transform(value, new Set())));
}

const allFlags = Object.entries(NodeFlags).filter(
  (entry): entry is [string, number] => typeof entry[1] === "number",
);
const syntaxKinds = {} as Record<SyntaxKind, string>;
for (const [key, value] of Object.entries(SyntaxKind)) {
  if (typeof value === "number" && !syntaxKinds[value]) {
    syntaxKinds[value] = key;
  }
}
const transform = (
  value: unknown,
  alreadyTransformed: Set<unknown>,
): unknown => {
  if (alreadyTransformed.has(value)) return value;
  alreadyTransformed.add(value);
  if (Array.isArray(value)) {
    return value.map((value) => transform(value, alreadyTransformed));
  }
  if (typeof value === "object" && value) {
    if (isNode(value)) {
      const node: {
        kind: string;
        text: string;
        start: number;
        end: number;
        flags?: string[];
      } = {
        kind: syntaxKinds[value.kind],
        text: value.getText(),
        start: value.getStart(),
        end: value.getEnd(),
      };
      if (value.flags !== NodeFlags.None) {
        node.flags = allFlags
          .filter(([_, flag]) => value.flags & flag)
          .map(([name]) => name);
      }
      return node;
    } else {
      return Object.fromEntries(
        Object.entries(value).map(([key, value]) => [
          key,
          transform(value, alreadyTransformed),
        ]),
      );
    }
  }
  return value;
};
const isNode = (value: object): value is AST.AnyNode =>
  "kind" in value && typeof value.kind === "number";

type CaseProps<RuleFn extends (options?: unknown) => Rule<unknown>> = {
  /** Parse code as TSX */
  tsx?: boolean;
  compilerOptions?: ts.CompilerOptions;
  options?: Parameters<RuleFn>[0];
  code: string;
};
type ProjectWideCaseProps<RuleFn extends (options?: unknown) => Rule<unknown>> =
  {
    compilerOptions?: ts.CompilerOptions;
    options?: Parameters<RuleFn>[0];
    files: { fileName: `${string}.${"ts" | "tsx"}`; code: string }[];
  };
type ErrorReport = {
  fileName?: string;
  message: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  suggestions?: { message: string; output: string }[];
};
type SetupCase<TRule extends (options?: unknown) => Rule<unknown>> = {
  compilerOptionsKey: string;
  files: { path: string; fileName: string; code: string }[];
  options?: Parameters<TRule>[0];
  isValid: boolean;
  index: number;
  errors: ErrorReport[] | null;
};

const defaultCompilerOptions = {
  module: ts.ModuleKind.ESNext,
  lib: ["es2022"],
  target: ts.ScriptTarget.ESNext,
  moduleDetection: ts.ModuleDetectionKind.Force,
  moduleResolution: ModuleResolutionKind.Bundler,
  noEmit: true,
  isolatedModules: true,
  skipLibCheck: true,
  strict: true,
  types: [],
} satisfies ts.CompilerOptions;

const typeFocus = process.argv[3];
const indexFocus = process.argv[4];

export type ValidTestCase<TRule extends (options?: any) => Rule<unknown>> =
  | ProjectWideCaseProps<TRule>
  | CaseProps<TRule>
  | string;
export type InvalidTestCase<
  TRule extends (options?: unknown) => Rule<unknown>,
> =
  | (CaseProps<TRule>
      & (
        | { error: string }
        | {
            errors: (
              | Omit<ErrorReport, "fileName">
              | [message: string, line?: number, column?: number]
            )[];
          }
      ))
  | (ProjectWideCaseProps<TRule> & {
      errors: ErrorReport[];
    });

/**
 * Output API is still a bit raw (it prints differences to the console and returns a 'hasError' boolean)
 * Feel free to open an issue if you need help or have ideas for improvements.
 */
export const ruleTester = <RuleFn extends (options?: any) => Rule<unknown>>({
  ruleFn,
  tsx,
  valid,
  invalid,
}: {
  ruleFn: RuleFn;
  /** Parse code as TSX, @default false */
  tsx?: boolean;
  valid: ValidTestCase<RuleFn>[];
  invalid: InvalidTestCase<RuleFn>[];
}): boolean => {
  let hasError = false;
  const compilerOptionsToFiles = new Map<string, string[]>();
  const filesMap = new Map<string, string>();
  const cases: SetupCase<RuleFn>[] = [];

  const setupCase = (
    caseProps: CaseProps<RuleFn> | ProjectWideCaseProps<RuleFn>,
    isValid: boolean,
    index: number,
    errors: ErrorReport[] | null,
  ) => {
    const useTSX =
      "files" in caseProps
        ? caseProps.files.some((file) => file.fileName.endsWith(".tsx"))
        : tsx
          ? caseProps.tsx !== false
          : caseProps.tsx === true;
    const caseFolder = `${isValid ? "valid" : "invalid"}-${index}`;
    const files =
      "files" in caseProps
        ? caseProps.files.map((file) => ({
            path: `${caseFolder}/${file.fileName}`,
            fileName: file.fileName,
            code: file.code,
          }))
        : [
            {
              path: `${caseFolder}/file.${useTSX ? "tsx" : "ts"}`,
              fileName: `file.${useTSX ? "tsx" : "ts"}`,
              code: caseProps.code,
            },
          ];
    for (const file of files) {
      filesMap.set(file.path, file.code);
    }
    const compilerOptionsInput =
      caseProps.compilerOptions !== undefined || useTSX
        ? {
            ...defaultCompilerOptions,
            jsx: useTSX ? ts.JsxEmit.ReactJSX : undefined,
            ...caseProps.compilerOptions,
            lib: [
              ...defaultCompilerOptions.lib,
              ...(caseProps.compilerOptions?.lib ?? []),
            ],
          }
        : defaultCompilerOptions;
    const compilerOptionsKey = JSON.stringify(compilerOptionsInput);
    const current = compilerOptionsToFiles.get(compilerOptionsKey);
    if (current) {
      current.push(...files.map((f) => f.path));
    } else {
      compilerOptionsToFiles.set(compilerOptionsKey, [
        ...files.map((f) => f.path),
        ...compilerOptionsInput.lib.map(
          (lib) => `node_modules/typescript/lib/lib.${lib}.d.ts`,
        ),
      ]);
    }
    cases.push({
      compilerOptionsKey,
      files,
      options: caseProps.options,
      isValid,
      index,
      errors,
    });
  };

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
      "error" in invalidCase
        ? [{ message: invalidCase.error }]
        : invalidCase.errors.map((e) =>
            Array.isArray(e) ? { message: e[0], line: e[1], column: e[2] } : e,
          );
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
    const domLib = "node_modules/typescript/lib/lib.dom.d.ts";
    const program = ts.createProgram(
      [
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
    const rule = ruleFn(caseProps.options);
    const program = compilerOptionsToProgram.get(caseProps.compilerOptionsKey)!;
    const compilerOptions = program.getCompilerOptions();
    const reports: ReportDescriptor[] = [];
    const filesData: { sourceFile: SourceFile; data: unknown }[] = [];
    for (const file of caseProps.files) {
      const sourceFile = program.getSourceFile(
        file.path,
      ) as unknown as SourceFile;
      const context: Context = {
        sourceFile,
        program,
        get checker() {
          return program.getTypeChecker() as unknown as Checker;
        },
        get rawChecker() {
          return program.getTypeChecker();
        },
        compilerOptions,
        utils: getContextUtils(() => program),
        report(descriptor) {
          reports.push(descriptor);
        },
        data: undefined,
      };
      if (rule.createData) context.data = rule.createData(context);
      const visit = (node: AST.AnyNode) => {
        const nodeType = visitorEntries.find((e) => e[0] === node.kind)?.[1];
        if (nodeType) {
          rule.visitor[nodeType]?.(context, node as any);
        }
        // @ts-expect-error
        node.forEachChild(visit);
        if (nodeType) {
          rule.visitor[`${nodeType}_exit` as keyof Visitor]?.(
            context,
            node as any,
          );
        }
      };
      visit(sourceFile);
      filesData.push({ sourceFile, data: context.data });
    }
    rule.aggregate?.(
      {
        program,
        checker: program.getTypeChecker() as unknown as Checker,
        compilerOptions,
        utils: getContextUtils(() => program),
        report(descriptor) {
          reports.push(descriptor);
        },
      },
      filesData,
    );
    const displayCode =
      caseProps.files.length > 1
        ? caseProps.files.map((file) => file.fileName).join(", ")
        : caseProps.files[0].code;
    if (caseProps.isValid) {
      if (reports.length !== 0) {
        console.error(
          `Reports for valid case ${caseProps.index} (${displayCode})`,
        );
        hasError = true;
        for (const report of reports) {
          console.log(`  - ${report.message}`);
        }
      }
    } else {
      if (reports.length === 0) {
        console.error(
          `No reports for invalid case ${caseProps.index} (${displayCode})`,
        );
        hasError = true;
      } else {
        let introLogged = false;
        for (
          let i = 0;
          i < Math.max(caseProps.errors!.length, reports.length);
          i++
        ) {
          const log = (
            prefix: string,
            expected: string | undefined,
            got: string | undefined,
          ) => {
            if (!introLogged) {
              console.error(
                `Report(s) mismatch for invalid case ${caseProps.index} (${displayCode})`,
              );
              hasError = true;
              introLogged = true;
            }
            const whiteSpaceDiff =
              expected !== undefined
              && got !== undefined
              && expected.replaceAll(/ /g, "") === got.replaceAll(/ /g, "");
            /* tsl-ignore core/restrictTemplateExpressions */
            console.log(
              `  #${i}${prefix}: Expected: ${
                whiteSpaceDiff ? expected.replaceAll(/ /g, "·") : expected
              }
           ${" ".repeat(prefix.length)}Got: ${
             whiteSpaceDiff ? got.replaceAll(/ /g, "·") : got
           }`,
            );
          };
          const expected = caseProps.errors!.at(i);
          const got = reports.at(i);
          if (expected?.message !== got?.message) {
            log("", expected?.message, got?.message);
            continue;
          }
          if (!expected || !got) continue;
          const fileWithError = expected.fileName
            ? caseProps.files.find(
                (file) => file.fileName === expected.fileName,
              )
            : caseProps.files[0];
          if (fileWithError === undefined) {
            log(
              " filename",
              `One of ${caseProps.files.map((file) => file.fileName).join(", ")}`,
              expected.fileName,
            );
            continue;
          }
          const sourceFile = program.getSourceFile(
            fileWithError.path,
          ) as unknown as SourceFile;
          if (expected.line !== undefined) {
            const gotStart = "node" in got ? got.node.getStart() : got.start;
            const gotLine =
              sourceFile.getLineAndCharacterOfPosition(gotStart).line + 1;
            if (expected.line !== gotLine) {
              log(" line", `${expected.line}`, `${gotLine}`);
              continue;
            }
          }
          if (expected.column !== undefined) {
            const gotStart = "node" in got ? got.node.getStart() : got.start;
            const gotColumn =
              sourceFile.getLineAndCharacterOfPosition(gotStart).character + 1;
            if (expected.column !== gotColumn) {
              log(" column", `${expected.column}`, `${gotColumn}`);
              continue;
            }
          }
          if (expected.endLine !== undefined) {
            const gotEnd = "node" in got ? got.node.getEnd() : got.end;
            const gotEndLine =
              sourceFile.getLineAndCharacterOfPosition(gotEnd).line + 1;
            if (expected.endLine !== gotEndLine) {
              log(" end line", `${expected.endLine}`, `${gotEndLine}`);
              continue;
            }
          }
          if (expected.endColumn !== undefined) {
            const gotEnd = "node" in got ? got.node.getEnd() : got.end;
            const gotEndColumn =
              sourceFile.getLineAndCharacterOfPosition(gotEnd).character + 1;
            if (expected.endColumn !== gotEndColumn) {
              log(" end column", `${expected.endColumn}`, `${gotEndColumn}`);
              continue;
            }
          }
          const gotSuggestions =
            typeof got.suggestions === "function"
              ? got.suggestions()
              : got.suggestions;
          for (
            let si = 0;
            si
            < Math.max(
              expected.suggestions?.length ?? 0,
              gotSuggestions?.length ?? 0,
            );
            si++
          ) {
            const expectedSuggestion = expected.suggestions?.at(si);
            const gotSuggestion = gotSuggestions?.at(si);
            if (expectedSuggestion?.message !== gotSuggestion?.message) {
              log(
                ` suggestion ${si}`,
                expectedSuggestion?.message,
                gotSuggestion?.message,
              );
            }
            if (expectedSuggestion && gotSuggestion) {
              const gotChanges = gotSuggestion.changes
                .map((it) =>
                  "node" in it
                    ? {
                        start: it.node.getStart(),
                        end: it.node.getEnd(),
                        newText: it.newText,
                      }
                    : "length" in it
                      ? {
                          start: it.start,
                          end: it.start + it.length,
                          newText: it.newText,
                        }
                      : {
                          start: it.start,
                          end: it.end,
                          newText: it.newText,
                        },
                )
                .sort((a, b) => a.start - b.start);
              const hasOverlap = gotChanges.some(
                (it, i) => i > 0 && it.start < gotChanges[i - 1].end,
              );
              if (hasOverlap) {
                log(` suggestion ${si} changes`, "No overlap", "Overlap");
              }
              const gotOutput = gotChanges.reduceRight(
                (acc, it) =>
                  acc.slice(0, it.start) + it.newText + acc.slice(it.end),
                fileWithError.code,
              );
              if (expectedSuggestion.output !== gotOutput) {
                log(
                  ` suggestion ${si} output`,
                  expectedSuggestion.output,
                  gotOutput,
                );
              }
            }
          }
        }
      }
    }
  }

  return hasError;
};
