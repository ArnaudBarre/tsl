import ts from "typescript";
import type { AnyNode, SourceFile, Visitor } from "./ast.ts";
import { getContextUtils } from "./getContextUtils.ts";
import type {
  AST,
  Checker,
  Config,
  Context,
  ReportDescriptor,
  UnknownRule,
} from "./types.ts";
import { visitorEntries } from "./visitorEntries.ts";

export const initRules = (
  program: ts.Program,
  config: Config<UnknownRule[]>,
) => {
  const checker = program.getTypeChecker() as unknown as Checker;
  const compilerOptions = program.getCompilerOptions();
  const contextUtils = getContextUtils(checker);

  const rulesWithOptions: {
    rule: UnknownRule;
    context: Context<unknown, unknown>;
    visitor: Visitor<unknown, unknown>;
  }[] = [];
  for (const rule of config.rules) {
    const input = config.options?.[rule.name];
    if (input === "off") continue;
    const options = rule.parseOptions?.(input);
    rulesWithOptions.push({
      rule,
      context: {
        sourceFile: undefined as unknown as SourceFile,
        program,
        checker,
        compilerOptions,
        utils: contextUtils,
        report: undefined as unknown as (descriptor: ReportDescriptor) => void,
        options,
        data: undefined,
      },
      visitor:
        typeof rule.visitor === "function"
          ? rule.visitor(options)
          : rule.visitor,
    });
  }

  const entryMap: Record<number, ((node: AnyNode) => void) | undefined> = {};
  const exitMap: Record<number, ((node: AnyNode) => void) | undefined> = {};
  for (const [keySuffix, map] of [
    ["", entryMap],
    [":exit", exitMap],
  ] as const) {
    for (const [kind, _key] of visitorEntries) {
      const key = (_key + keySuffix) as keyof Visitor;
      const rulesWithKey: typeof rulesWithOptions = [];
      for (const ruleWithOptions of rulesWithOptions) {
        if (ruleWithOptions.visitor[key]) {
          rulesWithKey.push(ruleWithOptions);
        }
      }
      if (rulesWithKey.length) {
        map[kind] = (node) => {
          for (const ruleWithOptions of rulesWithKey) {
            ruleWithOptions.visitor[key]!(node as any, ruleWithOptions.context);
          }
        };
      }
    }
  }

  const visit = (node: AST.AnyNode) => {
    entryMap[node.kind]?.(node);
    // @ts-expect-error
    node.forEachChild(visit);
    exitMap[node.kind]?.(node);
  };

  return (
    sourceFile: SourceFile,
    report: (descriptor: ReportDescriptor & { rule: UnknownRule }) => void,
  ) => {
    if (sourceFile.fileName.includes("node_modules")) return;
    if (config.ignore?.some((p) => sourceFile.fileName.includes(p))) return;
    for (const { rule, context } of rulesWithOptions) {
      context.sourceFile = sourceFile;
      context.report = (props) => report({ ...props, rule });
      if (rule.createData) context.data = rule.createData(context);
    }
    visit(sourceFile);
  };
};
