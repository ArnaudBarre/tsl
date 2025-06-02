import { awaitThenable } from "./rules/awaitThenable/awaitThenable.ts";
import { dotNotation } from "./rules/dotNotation/dotNotation.ts";
import { noArrayDelete } from "./rules/noArrayDelete/noArrayDelete.ts";
import { noBaseToString } from "./rules/noBaseToString/noBaseToString.ts";
import { noConfusingVoidExpression } from "./rules/noConfusingVoidExpression/noConfusingVoidExpression.ts";
import { noFloatingPromises } from "./rules/noFloatingPromises/noFloatingPromises.ts";
import { noForInArray } from "./rules/noForInArray/noForInArray.ts";
import { noImpliedEval } from "./rules/noImpliedEval/noImpliedEval.ts";
import { noMeaninglessVoidOperator } from "./rules/noMeaninglessVoidOperator/noMeaninglessVoidOperator.ts";
import { noMisusedPromises } from "./rules/noMisusedPromises/noMisusedPromises.ts";
import { noMisusedSpread } from "./rules/noMisusedSpread/noMisusedSpread.ts";
import { nonNullableTypeAssertionStyle } from "./rules/nonNullableTypeAssertionStyle/nonNullableTypeAssertionStyle.ts";
import { noRedundantTypeConstituents } from "./rules/noRedundantTypeConstituents/noRedundantTypeConstituents.ts";
import { noUnnecessaryBooleanLiteralCompare } from "./rules/noUnnecessaryBooleanLiteralCompare/noUnnecessaryBooleanLiteralCompare.ts";
import { noUnnecessaryCondition } from "./rules/noUnnecessaryCondition/noUnnecessaryCondition.ts";
import { noUnnecessaryTemplateExpression } from "./rules/noUnnecessaryTemplateExpression/noUnnecessaryTemplateExpression.ts";
import { noUnnecessaryTypeArguments } from "./rules/noUnnecessaryTypeArguments/noUnnecessaryTypeArguments.ts";
import { noUnnecessaryTypeAssertion } from "./rules/noUnnecessaryTypeAssertion/noUnnecessaryTypeAssertion.ts";
import { noUnnecessaryTypeConversion } from "./rules/noUnnecessaryTypeConversion/noUnnecessaryTypeConversion.ts";
import { noUnsafeUnaryMinus } from "./rules/noUnsafeUnaryMinus/noUnsafeUnaryMinus.ts";
import { onlyThrowError } from "./rules/onlyThrowError/onlyThrowError.ts";
import { preferFind } from "./rules/preferFind/preferFind.ts";
import { preferIncludes } from "./rules/preferIncludes/preferIncludes.ts";
import { preferNullishCoalescing } from "./rules/preferNullishCoalescing/preferNullishCoalescing.ts";
import { preferOptionalChain } from "./rules/preferOptionalChain/preferOptionalChain.ts";
import { preferReduceTypeParameter } from "./rules/preferReduceTypeParameter/preferReduceTypeParameter.ts";
import { preferReturnThisType } from "./rules/preferReturnThisType/preferReturnThisType.ts";
import { preferStringStartsEndsWith } from "./rules/preferStringStartsEndsWith/preferStringStartsEndsWith.ts";
import { restrictPlusOperands } from "./rules/restrictPlusOperands/restrictPlusOperands.ts";
import { restrictTemplateExpressions } from "./rules/restrictTemplateExpressions/restrictTemplateExpressions.ts";
import { returnAwait } from "./rules/returnAwait/returnAwait.ts";
import { switchExhaustivenessCheck } from "./rules/switchExhaustivenessCheck/switchExhaustivenessCheck.ts";
import type { Config, Rule } from "./types.ts";

export type {
  AST,
  Checker,
  Config,
  Context,
  ReportDescriptor,
  Rule,
} from "./types.ts";
export { defineRule } from "./rules/_utils/index.ts";

export const defineConfig = <const BaseRuleName extends string>(
  config: Config<BaseRuleName>,
) => config;

export type RulesSet<
  RulesFnsMap extends Record<string, (...args: any) => Rule>,
> = RulesFnsMap & {
  all: <
    PartialConfig extends Partial<{
      [key in keyof RulesFnsMap]: Parameters<
        RulesFnsMap[key]
      >[0] extends undefined
        ? "on" | "off"
        : Parameters<RulesFnsMap[key]>[0] | "on" | "off";
    }>,
  >(
    config?: PartialConfig,
  ) => Array<
    {
      [K in keyof RulesFnsMap]: PartialConfig[K] extends "off"
        ? never
        : ReturnType<RulesFnsMap[K]>;
    }[keyof RulesFnsMap]
  >;
};

export const createRulesSet = <
  T extends Record<string, (...args: any) => Rule>,
>(
  rulesFunctions: T,
) =>
  ({
    ...rulesFunctions,
    all: (config) => {
      const rules: Rule[] = [];
      for (const key in rulesFunctions) {
        if (config?.[key] === "off") continue;
        rules.push(
          rulesFunctions[key](
            config?.[key] === "on" ? undefined : config?.[key],
          ),
        );
      }
      return rules;
    },
  }) as RulesSet<T>;

export const core = createRulesSet({
  awaitThenable,
  dotNotation,
  noArrayDelete,
  noBaseToString,
  noConfusingVoidExpression,
  noFloatingPromises,
  noForInArray,
  noImpliedEval,
  noMeaninglessVoidOperator,
  noMisusedPromises,
  noMisusedSpread,
  nonNullableTypeAssertionStyle,
  noRedundantTypeConstituents,
  noUnnecessaryBooleanLiteralCompare,
  noUnnecessaryCondition,
  noUnnecessaryTemplateExpression,
  noUnnecessaryTypeArguments,
  noUnnecessaryTypeAssertion,
  noUnnecessaryTypeConversion,
  noUnsafeUnaryMinus,
  onlyThrowError,
  preferFind,
  preferIncludes,
  preferNullishCoalescing,
  preferOptionalChain,
  preferReduceTypeParameter,
  preferReturnThisType,
  preferStringStartsEndsWith,
  restrictPlusOperands,
  restrictTemplateExpressions,
  returnAwait,
  switchExhaustivenessCheck,
});
