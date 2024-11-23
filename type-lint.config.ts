import { defineConfig } from "./src/public-utils.ts";
import { awaitThenable } from "./src/rules/await-thenable.ts";
import { dotNotation } from "./src/rules/dot-notation.ts";
import { noArrayDelete } from "./src/rules/no-array-delete.ts";
import { noConfusingVoidExpression } from "./src/rules/no-confusing-void-expression.ts";
import { noFloatingPromises } from "./src/rules/no-floating-promises.ts";
import { noForInArray } from "./src/rules/no-for-in-array.ts";
import { noImpliedEval } from "./src/rules/no-implied-eval.ts";
import { noMeaninglessVoidOperator } from "./src/rules/no-meaningless-void-operator.ts";
import { noMisusedPromises } from "./src/rules/no-misused-promises.ts";
import { noRedundantTypeConstituents } from "./src/rules/no-redundant-type-constituents.ts";
import { noUnnecessaryCondition } from "./src/rules/no-unnecessary-condition.ts";
import { noUnnecessaryTemplateExpression } from "./src/rules/no-unnecessary-template-expression.ts";
import { noUnnecessaryTypeArguments } from "./src/rules/no-unnecessary-type-arguments.ts";
import { noUnnecessaryTypeAssertion } from "./src/rules/no-unnecessary-type-assertion.ts";
import { noUnsafeUnaryMinus } from "./src/rules/no-unsafe-unary-minus.ts";
import { nonNullableTypeAssertionStyle } from "./src/rules/non-nullable-type-assertion-style.ts";
import { onlyThrowError } from "./src/rules/only-throw-error.ts";
import { preferFind } from "./src/rules/prefer-find.ts";
import { preferIncludes } from "./src/rules/prefer-includes.ts";
import { preferNullishCoalescing } from "./src/rules/prefer-nullish-coalescing.ts";
import { preferOptionalChain } from "./src/rules/prefer-optional-chain.ts";
import { preferReduceTypeParameter } from "./src/rules/prefer-reduce-type-parameter.ts";
import { preferReturnThisType } from "./src/rules/prefer-return-this-type.ts";

export default defineConfig({
  rules: [
    awaitThenable,
    dotNotation,
    noArrayDelete,
    noConfusingVoidExpression,
    noFloatingPromises,
    noForInArray,
    noImpliedEval,
    noMeaninglessVoidOperator,
    noMisusedPromises,
    noRedundantTypeConstituents,
    noUnnecessaryCondition,
    noUnnecessaryTemplateExpression,
    noUnnecessaryTypeArguments,
    noUnnecessaryTypeAssertion,
    noUnsafeUnaryMinus,
    nonNullableTypeAssertionStyle,
    onlyThrowError,
    preferFind,
    preferIncludes,
    preferNullishCoalescing,
    preferOptionalChain,
    preferReduceTypeParameter,
    preferReturnThisType,
  ],
  options: {
    "no-misused-promises": {
      checksVoidReturn: { arguments: false, attributes: false },
    },
    "no-confusing-void-expression": { ignoreArrowShorthand: true },
  },
});
