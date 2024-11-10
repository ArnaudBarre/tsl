import ts from "typescript";
import type { AnyNode, SourceFile, Visitor } from "./ast.ts";
import { getContextUtils } from "./getContextUtils.ts";
import { run } from "./rules-utils.ts";
import type {
  AST,
  Checker,
  Config,
  Context,
  ReportDescriptor,
  Suggestion,
  UnknownRule,
} from "./types.ts";
import { visitorEntries } from "./visitorEntries.ts";

const timing = !!process.env["TIMING"];

export const initRules = (
  getProgram: () => ts.Program,
  config: Config<UnknownRule[]>,
) => {
  const contextUtils = getContextUtils(getProgram);
  const rulesTimingMap: Record<string, number> = {};
  const filesTimingMap: Record<string, number> = {};

  const rulesWithOptions: {
    rule: UnknownRule;
    context: Context<unknown, unknown>;
    visitor: Visitor<unknown, unknown>;
  }[] = [];
  for (const rule of config.rules) {
    const input = config.options?.[rule.name];
    if (input === "off") continue;
    const start = timing ? performance.now() : 0;
    const options = rule.parseOptions?.(input);
    rulesWithOptions.push({
      rule,
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
        report: undefined as unknown as (descriptor: ReportDescriptor) => void,
        options,
        data: undefined,
      },
      visitor:
        typeof rule.visitor === "function"
          ? rule.visitor(options)
          : rule.visitor,
    });
    if (timing) rulesTimingMap[rule.name] = performance.now() - start;
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
            const start = timing ? performance.now() : 0;
            ruleWithOptions.visitor[key]!(node as any, ruleWithOptions.context);
            if (timing) {
              rulesTimingMap[ruleWithOptions.rule.name] +=
                performance.now() - start;
            }
          }
        };
      }
    }
  }

  let ignoreComments: {
    start: number;
    end: number;
    line: number;
    ruleName: string | undefined;
    local: boolean;
    used: boolean;
  }[] = [];
  const commentsStarts = new Set<number>();
  let lineStarts: readonly number[] = [];

  const visit = (node: AST.AnyNode) => {
    const text = node.getFullText();
    const nodeStart = node.getFullStart();
    ts.forEachLeadingCommentRange(text, 0, (start, end, kind) => {
      const commentStart = nodeStart + start;
      if (commentsStarts.has(commentStart)) return;
      commentsStarts.add(commentStart);
      const single = kind === ts.SyntaxKind.SingleLineCommentTrivia;
      const comment = text.slice(start + 3, single ? end : end - 2);
      if (comment.startsWith("type-lint-ignore")) {
        const ruleName = comment.split(" ", 2).at(1);
        const line =
          lineStarts.findLastIndex((lineStart) => commentStart >= lineStart) +
          1;
        ignoreComments.push({
          line,
          start: commentStart,
          end: nodeStart + end,
          ruleName,
          local: single,
          used: false,
        });
      }
    });

    if (
      node.kind === ts.SyntaxKind.SourceFile &&
      ignoreComments.some((it) => it.ruleName === undefined && !it.local)
    ) {
      // File is ignored
      ignoreComments = [];
      return;
    }

    entryMap[node.kind]?.(node);
    // @ts-expect-error
    node.forEachChild(visit);
    exitMap[node.kind]?.(node);
  };

  type Report = ReportDescriptor & { type: "rule"; rule: UnknownRule };
  return {
    lint: (
      sourceFile: SourceFile,
      onReport: (
        report:
          | Report
          | {
              type: "ignore";
              start: number;
              end: number;
              message: string;
              suggestions: Suggestion[];
            },
      ) => void,
    ) => {
      if (sourceFile.fileName.includes("node_modules")) return;
      if (config.ignore?.some((p) => sourceFile.fileName.includes(p))) return;
      const start = timing ? performance.now() : 0;
      const reports: Report[] = [];
      for (const { rule, context } of rulesWithOptions) {
        context.sourceFile = sourceFile;
        context.report = (props) => {
          reports.push({ type: "rule", rule, ...props });
        };
        if (rule.createData) {
          const start = timing ? performance.now() : 0;
          context.data = rule.createData(context);
          if (timing) {
            rulesTimingMap[rule.name] += performance.now() - start;
          }
        }
      }
      ignoreComments = [];
      commentsStarts.clear();
      lineStarts = sourceFile.getLineStarts();
      visit(sourceFile);
      for (const report of reports) {
        const timingStart = timing ? performance.now() : 0;
        const start = report.node.getStart();
        const line =
          lineStarts.findLastIndex((lineStart) => start >= lineStart) + 1;
        const ignoreComment = ignoreComments.find((comment) => {
          if (comment.ruleName && comment.ruleName !== report.rule.name) {
            return false;
          }
          return !comment.local || comment.line === line - 1;
        });
        if (ignoreComment) {
          ignoreComment.used = true;
          continue;
        }
        onReport(report);
        if (timing) {
          rulesTimingMap[report.rule.name] += performance.now() - timingStart;
        }
      }
      for (const comment of ignoreComments) {
        if (comment.used) continue;
        const lineStart = lineStarts[comment.line - 1];
        const lineEnd = lineStarts.at(comment.line);
        const { start, length } = run(() => {
          const fileText = sourceFile.getText();
          const lineText = fileText.slice(lineStart, lineEnd).trim();
          const commentText = fileText.slice(comment.start, comment.end);
          if (lineText === commentText) {
            return {
              start: lineStart,
              length: (lineEnd ?? comment.end) - lineStart,
            };
          }
          return { start: comment.start, length: comment.end - comment.start };
        });
        onReport({
          type: "ignore",
          start: comment.start,
          end: comment.end,
          message: "Unused ignore comment",
          suggestions: [
            {
              message: "Remove unused ignore comment",
              changes: [{ start, length, newText: "" }],
            },
          ],
        });
      }
      if (timing) {
        filesTimingMap[sourceFile.fileName] = performance.now() - start;
      }
    },
    timing: timing ? { Rule: rulesTimingMap, File: filesTimingMap } : undefined,
  };
};
