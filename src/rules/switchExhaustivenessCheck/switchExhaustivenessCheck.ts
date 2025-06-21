import { isIntrinsicUndefinedType } from "ts-api-utils";
import ts, { SyntaxKind, TypeFlags } from "typescript";
import { defineRule, requiresQuoting } from "../_utils/index.ts";
import type { AST, Context, Suggestion } from "../../types.ts";

export const messages = {
  addMissingCases: "Add branches for missing cases.",
  addDefaultCase: "Add a default case.",
  dangerousDefaultCase:
    "The switch statement is exhaustive, so the default case is unnecessary.",
  switchIsNotExhaustive: (params: { missingCases: string }) =>
    `Switch is not exhaustive. Cases not matched: ${params.missingCases}`,
};

export type SwitchExhaustivenessCheckOptions = {
  /**
   * If `true`, allow `default` cases on switch statements with exhaustive
   * cases.
   * @default true
   */
  allowDefaultCaseForExhaustiveSwitch?: boolean;
  /**
   * If `true`, require a `default` clause for switches on non-union types.
   * @default false
   */
  requireDefaultForNonUnion?: boolean;
  /**
   * If `true`, the `default` clause is used to determine whether the switch statement is exhaustive for union types.
   * @default false
   */
  considerDefaultExhaustiveForUnions?: boolean;
};

type SwitchMetadata = {
  containsNonLiteralType: boolean;
  defaultCase: AST.DefaultClause | undefined;
  missingLiteralCasesTypes: ts.Type[];
  symbolName: string | undefined;
};

export const switchExhaustivenessCheck = defineRule(
  (_options?: SwitchExhaustivenessCheckOptions) => {
    const options = {
      allowDefaultCaseForExhaustiveSwitch: true,
      considerDefaultExhaustiveForUnions: false,
      requireDefaultForNonUnion: false,
      ..._options,
    };

    function getSwitchMetadata(
      node: AST.SwitchStatement,
      context: Context,
    ): SwitchMetadata {
      const defaultCase = node.caseBlock.clauses.find(
        (clause) => clause.kind === SyntaxKind.DefaultClause,
      );

      const discriminantType = context.utils.getConstrainedTypeAtLocation(
        node.expression,
      );

      const symbolName = discriminantType.getSymbol()?.escapedName as
        | string
        | undefined;

      const containsNonLiteralType = doesTypeContainNonLiteralType(
        context,
        discriminantType,
      );

      const caseTypes = new Set<ts.Type>();
      for (const clause of node.caseBlock.clauses) {
        if (clause.kind === SyntaxKind.DefaultClause) continue;

        const caseType = context.utils.getConstrainedTypeAtLocation(
          clause.expression,
        );
        caseTypes.add(caseType);
      }

      const missingLiteralCasesTypes: ts.Type[] = [];

      for (const unionPart of context.utils.unionConstituents(
        discriminantType,
      )) {
        for (const intersectionPart of context.utils.intersectionConstituents(
          unionPart,
        )) {
          if (
            caseTypes.has(intersectionPart)
            || !isTypeLiteralLikeType(context, intersectionPart)
          ) {
            continue;
          }

          // "missing", "optional" and "undefined" types are different runtime objects,
          // but all of them have TypeFlags.Undefined type flag
          if (
            [...caseTypes].some(isIntrinsicUndefinedType)
            && isIntrinsicUndefinedType(intersectionPart)
          ) {
            continue;
          }

          missingLiteralCasesTypes.push(intersectionPart);
        }
      }

      return {
        containsNonLiteralType,
        defaultCase,
        missingLiteralCasesTypes,
        symbolName,
      };
    }

    function checkSwitchExhaustive(
      node: AST.SwitchStatement,
      switchMetadata: SwitchMetadata,
      context: Context,
    ): void {
      const { defaultCase, missingLiteralCasesTypes, symbolName } =
        switchMetadata;

      // If considerDefaultExhaustiveForUnions is enabled, the presence of a default case
      // always makes the switch exhaustive.
      if (options.considerDefaultExhaustiveForUnions && defaultCase != null) {
        return;
      }

      if (missingLiteralCasesTypes.length > 0) {
        const truncate = missingLiteralCasesTypes.length > 5;

        context.report({
          node: node.expression,
          message: messages.switchIsNotExhaustive({
            missingCases: (truncate
              ? missingLiteralCasesTypes.slice(0, 4)
              : missingLiteralCasesTypes
            )
              .map((missingType) =>
                context.utils.typeHasFlag(missingType, TypeFlags.ESSymbolLike)
                  ? `typeof ${missingType.getSymbol()?.escapedName as string}`
                  : context.checker.typeToString(missingType),
              )
              .concat(
                truncate
                  ? `(... ${missingLiteralCasesTypes.length - 4} more)`
                  : [],
              )
              .join(" | "),
          }),
          suggestions: () => {
            const changes = fixSwitch(
              context,
              node,
              missingLiteralCasesTypes,
              symbolName?.toString(),
            );
            return [{ message: messages.addMissingCases, changes }];
          },
        });
      }
    }

    function fixSwitch(
      context: Context,
      node: AST.SwitchStatement,
      missingBranchTypes: (ts.Type | "default")[],
      symbolName?: string,
    ): Suggestion["changes"] {
      const clauses = node.caseBlock.clauses;
      const lastCase = clauses.at(-1);
      let defaultCaseIndex = clauses.findIndex(
        (clause) => clause.kind === SyntaxKind.DefaultClause,
      );

      const caseIndent = lastCase
        ? " ".repeat(getColumn(lastCase))
        : " ".repeat(getColumn(node) + 2);

      const missingCases = [];
      for (const missingBranchType of missingBranchTypes) {
        if (missingBranchType === "default") {
          missingCases.push(`default:\n${caseIndent}  break;`);
          continue;
        }

        const missingBranchName = missingBranchType.getSymbol()?.escapedName;
        let caseTest = context.utils.typeHasFlag(
          missingBranchType,
          TypeFlags.ESSymbolLike,
        )
          ? missingBranchName!
          : context.checker.typeToString(missingBranchType);

        if (
          symbolName
          && missingBranchName !== undefined
          && requiresQuoting(
            missingBranchName.toString(),
            context.compilerOptions.target,
          )
        ) {
          const escapedBranchName = missingBranchName
            .replaceAll("'", "\\'")
            .replaceAll("\n", "\\n")
            .replaceAll("\r", "\\r");

          caseTest = `${symbolName}['${escapedBranchName}']`;
        }

        missingCases.push(`case ${caseTest}:\n${caseIndent}  break;`);
      }

      if (lastCase) {
        if (defaultCaseIndex !== -1) {
          while (clauses.at(defaultCaseIndex - 1)?.statements.length === 0) {
            defaultCaseIndex--;
          }
          return [
            {
              start: clauses.at(defaultCaseIndex)!.getStart(),
              length: 0,
              newText: missingCases
                .map((code) => `${code}\n${caseIndent}`)
                .join(""),
            },
          ];
        }
        return [
          {
            start: lastCase.getEnd(),
            length: 0,
            newText: missingCases
              .map((code) => `\n${caseIndent}${code}`)
              .join(""),
          },
        ];
      } else {
        return [
          {
            start: node.caseBlock.getStart() + 1,
            length: 0,
            newText: missingCases
              .map((code) => `\n${caseIndent}${code}`)
              .join(""),
          },
        ];
      }
    }

    function checkSwitchUnnecessaryDefaultCase(
      switchMetadata: SwitchMetadata,
      context: Context,
    ): void {
      if (options.allowDefaultCaseForExhaustiveSwitch) {
        return;
      }

      const { containsNonLiteralType, defaultCase, missingLiteralCasesTypes } =
        switchMetadata;

      if (
        missingLiteralCasesTypes.length === 0
        && defaultCase !== undefined
        && !containsNonLiteralType
      ) {
        context.report({
          node: defaultCase,
          message: messages.dangerousDefaultCase,
        });
      }
    }

    function checkSwitchNoUnionDefaultCase(
      node: AST.SwitchStatement,
      switchMetadata: SwitchMetadata,
      context: Context,
    ): void {
      if (!options.requireDefaultForNonUnion) {
        return;
      }

      const { containsNonLiteralType, defaultCase } = switchMetadata;

      if (containsNonLiteralType && defaultCase === undefined) {
        context.report({
          node: node.expression,
          message: messages.switchIsNotExhaustive({
            missingCases: "default",
          }),
          suggestions: () => {
            const changes = fixSwitch(context, node, ["default"], undefined);
            return [{ message: messages.addDefaultCase, changes }];
          },
        });
      }
    }
    return {
      name: "core/switchExhaustivenessCheck",
      visitor: {
        SwitchStatement(node, context) {
          const switchMetadata = getSwitchMetadata(node, context);
          checkSwitchExhaustive(node, switchMetadata, context);
          checkSwitchUnnecessaryDefaultCase(switchMetadata, context);
          checkSwitchNoUnionDefaultCase(node, switchMetadata, context);
        },
      },
    };
  },
);

function isTypeLiteralLikeType(context: Context, type: ts.Type): boolean {
  return context.utils.typeHasFlag(
    type,
    TypeFlags.Literal
      | TypeFlags.Undefined
      | TypeFlags.Null
      | TypeFlags.UniqueESSymbol,
  );
}

/**
 * For example:
 *
 * - `"foo" | "bar"` is a type with all literal types.
 * - `"foo" | number` is a type that contains non-literal types.
 * - `"foo" & { bar: 1 }` is a type that contains non-literal types.
 *
 * Default cases are never superfluous in switches with non-literal types.
 */
function doesTypeContainNonLiteralType(
  context: Context,
  type: ts.Type,
): boolean {
  return context.utils
    .unionConstituents(type)
    .some((type) =>
      context.utils
        .intersectionConstituents(type)
        .every((subType) => !isTypeLiteralLikeType(context, subType)),
    );
}

function getColumn(node: AST.AnyNode) {
  return node.getSourceFile().getLineAndCharacterOfPosition(node.getStart())
    .character;
}
