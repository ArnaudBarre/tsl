import ts from "typescript";
import type { AnyNode, SourceFile, Visitor } from "./ast.ts";
import { getContextUtils } from "./getContextUtils.ts";
import type {
  AggregateContext,
  AST,
  Checker,
  Config,
  Context,
  ReportDescriptor,
  Rule,
  Suggestion,
} from "./types.ts";
import { visitorEntries } from "./visitorEntries.ts";

type RuleReport = ReportDescriptor & { type: "rule"; rule: Rule<unknown> };
type UnusedIgnoreReport = {
  type: "ignore";
  start: number;
  end: number;
  message: string;
  suggestions: () => Suggestion[];
};
export type Report = RuleReport | UnusedIgnoreReport;

const matchPattern = (pattern: string, fileName: string) =>
  fileName.includes(pattern);

const run = <T>(cb: () => T) => cb();

export const initRules = async (
  getProgram: () => ts.Program,
  config: Config,
  showTiming: boolean,
) => {
  const contextUtils = getContextUtils(getProgram);
  const rulesTimingMap: Record<string, number> = {};
  const filesTimingMap: Record<string, number> = {};
  const overrides = config.overrides ?? [];

  const getOverridesKey = (fileName: string) => {
    let key = "";
    for (const override of overrides) {
      if (override.files.some((f) => matchPattern(f, fileName))) {
        key += "1";
      } else {
        key += "0";
      }
    }
    return key;
  };
  const baseRules = config.rules;

  const allRules = new Set<string>();
  const allProjectWideRules = new Set<string>();
  for (const rule of baseRules) {
    allRules.add(rule.name);
    if (rule.aggregate) allProjectWideRules.add(rule.name);
    if (showTiming) rulesTimingMap[rule.name] = 0;
  }
  if (config.overrides) {
    for (const override of config.overrides) {
      for (const rule of override.rules) {
        allRules.add(rule.name);
        if (rule.aggregate) allProjectWideRules.add(rule.name);
        if (showTiming) rulesTimingMap[rule.name] = 0;
      }
    }
  }

  type RuleWithContext = {
    rule: Rule<unknown>;
    context: Context;
    // Using a record instead of an array for fast update in plugin mode
    filesForAggregate: Record<
      string,
      { sourceFile: SourceFile; data: unknown }
    >;
  };
  const getRulesVisitFnCache = new Map<
    string /* overridesKey */,
    ReturnType<typeof getRulesVisitFn>
  >();
  const getRulesVisitFn = (
    fileName: string,
  ): {
    rulesWithContext: RuleWithContext[];
    visit: (node: AST.AnyNode) => void;
  } => {
    const overridesKey = getOverridesKey(fileName);
    const cached = getRulesVisitFnCache.get(overridesKey);
    if (cached) return cached;

    const rulesMaps: Record<string, Rule<unknown>> = {};

    for (const rule of baseRules) rulesMaps[rule.name] = rule;
    for (let i = 0; i < overrides.length; i++) {
      if (overridesKey[i] === "0") continue;
      const override = overrides[i];
      for (const rule of override.rules) rulesMaps[rule.name] = rule;
    }

    const rulesWithContext: RuleWithContext[] = [];
    for (const ruleName in rulesMaps) {
      const rule = rulesMaps[ruleName];
      rulesWithContext.push({
        rule,
        filesForAggregate: {},
        context: {
          sourceFile: undefined as unknown as SourceFile,
          get program() {
            return getProgram();
          },
          get checker() {
            return getProgram().getTypeChecker() as unknown as Checker;
          },
          get rawChecker() {
            return getProgram().getTypeChecker();
          },
          get compilerOptions() {
            return getProgram().getCompilerOptions();
          },
          utils: contextUtils,
          report: undefined as unknown as Context["report"],
          data: undefined,
        },
      });
    }

    const entryMap: Record<number, ((node: AnyNode) => void) | undefined> = {};
    const exitMap: Record<number, ((node: AnyNode) => void) | undefined> = {};
    for (const [keySuffix, map] of [
      ["", entryMap],
      ["_exit", exitMap],
    ] as const) {
      for (const [kind, _key] of visitorEntries) {
        const key = (_key + keySuffix) as keyof Visitor;
        const rulesWithKey: typeof rulesWithContext = [];
        for (const ruleWithOptions of rulesWithContext) {
          if (ruleWithOptions.rule.visitor[key]) {
            rulesWithKey.push(ruleWithOptions);
          }
        }
        if (rulesWithKey.length) {
          map[kind] = (node) => {
            for (const ruleWithOptions of rulesWithKey) {
              const start = showTiming ? performance.now() : 0;
              ruleWithOptions.rule.visitor[key]!(
                ruleWithOptions.context,
                node as any,
              );
              if (showTiming) {
                rulesTimingMap[ruleWithOptions.rule.name] +=
                  performance.now() - start;
              }
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

    const value = { rulesWithContext, visit };
    getRulesVisitFnCache.set(overridesKey, value);
    return value;
  };

  const ignoreCommentsMap: Record<
    string,
    IgnoreComment[] | "fileIgnored" | undefined
  > = {};
  const aggregateContext: AggregateContext = {
    get checker() {
      return getProgram().getTypeChecker() as unknown as Checker;
    },
    get compilerOptions() {
      return getProgram().getCompilerOptions();
    },
    get program() {
      return getProgram();
    },
    utils: contextUtils,
    report: undefined as unknown as AggregateContext["report"],
  };

  return {
    allRules,
    lint: (sourceFile: SourceFile, onReport: (report: Report) => void) => {
      if (sourceFile.fileName.includes("node_modules")) return;
      if (config.ignore?.some((p) => sourceFile.fileName.includes(p))) return;
      const { fileIgnored, ignoreComments } = getIgnoreComments(sourceFile);
      ignoreCommentsMap[sourceFile.fileName] = fileIgnored
        ? "fileIgnored"
        : ignoreComments;
      const { rulesWithContext, visit } = getRulesVisitFn(sourceFile.fileName);
      const start = showTiming ? performance.now() : 0;
      const reports: RuleReport[] = [];
      for (const { rule, context } of rulesWithContext) {
        if (fileIgnored && !rule.aggregate) continue;
        context.sourceFile = sourceFile;
        context.report = (props) => {
          if (fileIgnored) return;
          reports.push({ type: "rule", rule, ...props });
        };
        if (rule.createData) {
          const start = showTiming ? performance.now() : 0;
          context.data = rule.createData(context);
          if (showTiming) {
            rulesTimingMap[rule.name] += performance.now() - start;
          }
        }
      }
      visit(sourceFile);
      const lineStarts = sourceFile.getLineStarts();
      for (const report of reports) {
        const timingStart = showTiming ? performance.now() : 0;
        const start = "node" in report ? report.node.getStart() : report.start;
        const line = lineStarts.findLastIndex(
          (lineStart) => start >= lineStart,
        );
        const ignoreComment = ignoreComments.find(
          (comment) =>
            (!comment.local || comment.line === line)
            && comment.ruleNames.includes(report.rule.name),
        );
        if (ignoreComment) {
          ignoreComment.used = true;
          continue;
        }
        onReport(report);
        if (showTiming) {
          rulesTimingMap[report.rule.name] += performance.now() - timingStart;
        }
      }
      for (const ruleWithContext of rulesWithContext) {
        if (!ruleWithContext.rule.aggregate) continue;
        ruleWithContext.filesForAggregate[sourceFile.fileName] = {
          sourceFile,
          data: ruleWithContext.context.data,
        };
      }
      if (showTiming) {
        filesTimingMap[sourceFile.fileName] = performance.now() - start;
      }
    },
    aggregate: () => {
      const map = new Map<ts.SourceFile, Report[]>();
      const addReport = (sourceFile: ts.SourceFile, report: Report) => {
        let reports = map.get(sourceFile);
        if (!reports) {
          reports = [];
          map.set(sourceFile, reports);
        }
        reports.push(report);
      };
      for (const { rulesWithContext } of getRulesVisitFnCache.values()) {
        for (const it of rulesWithContext) {
          if (!it.rule.aggregate) continue;
          aggregateContext.report = (props) => {
            const start = "node" in props ? props.node.getStart() : props.start;
            const line = props.sourceFile
              .getLineStarts()
              .findLastIndex((lineStart) => start >= lineStart);
            const ignoreComments = ignoreCommentsMap[props.sourceFile.fileName];
            if (ignoreComments === "fileIgnored") return;
            const ignoreComment = ignoreComments?.find(
              (comment) =>
                (!comment.local || comment.line === line)
                && comment.ruleNames.includes(it.rule.name),
            );
            if (ignoreComment) {
              ignoreComment.used = true;
              return;
            }
            addReport(props.sourceFile as unknown as ts.SourceFile, {
              type: "rule",
              rule: it.rule,
              ...props,
            });
          };
          it.rule.aggregate(
            aggregateContext,
            Object.values(it.filesForAggregate),
          );
        }
      }
      return map;
    },
    getUnusedIgnoreComments: (options: {
      includeProjectWideRules: boolean;
    }) => {
      const map = new Map<ts.SourceFile, Report[]>();
      for (const sourceFile of getProgram().getSourceFiles()) {
        const comments = ignoreCommentsMap[sourceFile.fileName];
        if (comments === undefined || comments === "fileIgnored") continue;
        const reports: Report[] = [];
        for (const comment of comments) {
          if (comment.used) continue;
          if (
            !options.includeProjectWideRules
            && comment.ruleNames.some((name) => allProjectWideRules.has(name))
          ) {
            // Don't generate false positives reports if project-wide rules didn't run
            continue;
          }
          reports.push({
            type: "ignore",
            start: comment.start,
            end: comment.end,
            message: "Unused ignore comment",
            suggestions: () => {
              const lineStarts = sourceFile.getLineStarts();
              const lineStart = lineStarts[comment.line - 1];
              const lineEnd = lineStarts.at(comment.line);
              const fixLocation = run(() => {
                const fileText = sourceFile.getFullText();
                const lineText = fileText.slice(lineStart, lineEnd).trim();
                const commentText = fileText.slice(comment.start, comment.end);
                if (lineText === commentText) {
                  return {
                    start: lineStart,
                    length: (lineEnd ?? comment.end) - lineStart,
                  };
                }
                return {
                  start: comment.start,
                  length: comment.end - comment.start,
                };
              });
              return [
                {
                  message: "Remove unused ignore comment",
                  changes: [{ ...fixLocation, newText: "" }],
                },
              ];
            },
          });
        }
        if (reports.length) map.set(sourceFile, reports);
      }
      return map;
    },
    timingMaps: showTiming
      ? { Rule: rulesTimingMap, File: filesTimingMap }
      : undefined,
  };
};

type IgnoreComment = {
  start: number;
  end: number;
  line: number;
  ruleNames: string[];
  local: boolean;
  used: boolean;
};
const inlineCommentRE = /\/\/ tsl-ignore([^\n]*)/g;
const blockCommentRE = /\/\* tsl-ignore([^\n]*)\*\//g;
const getIgnoreComments = (sourceFile: SourceFile) => {
  const ignoreComments: IgnoreComment[] = [];
  const lineStarts = sourceFile.getLineStarts();
  const text = sourceFile.getFullText();
  const block = text.matchAll(blockCommentRE);
  let currentLine = 0;
  let fileIgnored = false;
  for (const match of block) {
    const base = match[1].split(":")[0].trim();
    const ruleNames = base === "" ? [] : base.split(",").map((r) => r.trim());
    if (ruleNames.length === 0 && match.index < sourceFile.getStart()) {
      fileIgnored = true;
      break;
    }
    for (let i = currentLine; i < lineStarts.length; i++) {
      if (lineStarts[i] > match.index) {
        currentLine = i;
        break;
      }
    }
    ignoreComments.push({
      line: currentLine,
      start: match.index,
      end: match.index + match[0].length,
      ruleNames,
      local: false,
      used: false,
    });
  }
  if (fileIgnored) return { fileIgnored, ignoreComments };
  const inline = text.matchAll(inlineCommentRE);
  currentLine = 0;
  for (const match of inline) {
    const ruleNames = match[1]
      .split(":")[0]
      .split(",")
      .map((r) => r.trim());
    for (let i = currentLine; i < lineStarts.length; i++) {
      if (lineStarts[i] > match.index) {
        currentLine = i;
        break;
      }
    }
    ignoreComments.push({
      line: currentLine,
      start: match.index,
      end: match.index + match[0].length,
      ruleNames,
      local: true,
      used: false,
    });
  }
  return { fileIgnored, ignoreComments };
};
