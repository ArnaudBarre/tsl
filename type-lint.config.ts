import { defineConfig } from "./src/public-utils.ts";
import { awaitThenable } from "./src/rules/await-thenable/await-thenable.ts";
import { dotNotation } from "./src/rules/dot-notation/dot-notation.ts";
import { noArrayDelete } from "./src/rules/no-array-delete/no-array-delete.ts";
import { noConfusingVoidExpression } from "./src/rules/no-confusing-void-expression/no-confusing-void-expression.ts";
import { noFloatingPromises } from "./src/rules/no-floating-promises/no-floating-promises.ts";
import { noForInArray } from "./src/rules/no-for-in-array/no-for-in-array.ts";
import { noImpliedEval } from "./src/rules/no-implied-eval/no-implied-eval.ts";
import { noMeaninglessVoidOperator } from "./src/rules/no-meaningless-void-operator/no-meaningless-void-operator.ts";
import { noMisusedPromises } from "./src/rules/no-misused-promises/no-misused-promises.ts";
import { noRedundantTypeConstituents } from "./src/rules/no-redundant-type-constituents/no-redundant-type-constituents.ts";
import { noUnnecessaryCondition } from "./src/rules/no-unnecessary-condition/no-unnecessary-condition.ts";
import { noUnnecessaryTemplateExpression } from "./src/rules/no-unnecessary-template-expression/no-unnecessary-template-expression.ts";
import { noUnnecessaryTypeArguments } from "./src/rules/no-unnecessary-type-arguments/no-unnecessary-type-arguments.ts";
import { noUnnecessaryTypeAssertion } from "./src/rules/no-unnecessary-type-assertion/no-unnecessary-type-assertion.ts";
import { noUnsafeUnaryMinus } from "./src/rules/no-unsafe-unary-minus/no-unsafe-unary-minus.ts";
import { nonNullableTypeAssertionStyle } from "./src/rules/non-nullable-type-assertion-style/non-nullable-type-assertion-style.ts";
import { onlyThrowError } from "./src/rules/only-throw-error/only-throw-error.ts";
import { preferFind } from "./src/rules/prefer-find/prefer-find.ts";
import { preferIncludes } from "./src/rules/prefer-includes/prefer-includes.ts";
import { preferNullishCoalescing } from "./src/rules/prefer-nullish-coalescing/prefer-nullish-coalescing.ts";
import { preferOptionalChain } from "./src/rules/prefer-optional-chain/prefer-optional-chain.ts";
import { preferReduceTypeParameter } from "./src/rules/prefer-reduce-type-parameter/prefer-reduce-type-parameter.ts";
import { preferReturnThisType } from "./src/rules/prefer-return-this-type/prefer-return-this-type.ts";
import { preferStringStartsEndsWith } from "./src/rules/prefer-string-starts-ends-with/prefer-string-starts-ends-with.ts";
import { restrictPlusOperands } from "./src/rules/restrict-plus-operands/restrict-plus-operands.ts";
import { restrictTemplateExpressions } from "./src/rules/restrict-template-expressions/restrict-template-expressions.ts";
import { returnAwait } from "./src/rules/return-await/return-await.ts";
import { switchExhaustivenessCheck } from "./src/rules/switch-exhaustiveness-check/switch-exhaustiveness-check.ts";

export default defineConfig({
  rules: [
    awaitThenable(),
    dotNotation(),
    noArrayDelete(),
    noConfusingVoidExpression({ ignoreArrowShorthand: true }),
    noFloatingPromises(),
    noForInArray(),
    noImpliedEval(),
    noMeaninglessVoidOperator(),
    noMisusedPromises({
      checksVoidReturn: { arguments: false, attributes: false },
    }),
    noRedundantTypeConstituents(),
    noUnnecessaryCondition(),
    noUnnecessaryTemplateExpression(),
    noUnnecessaryTypeArguments(),
    noUnnecessaryTypeAssertion(),
    noUnsafeUnaryMinus(),
    nonNullableTypeAssertionStyle(),
    onlyThrowError(),
    preferFind(),
    preferIncludes(),
    preferNullishCoalescing(),
    preferOptionalChain(),
    preferReduceTypeParameter(),
    preferReturnThisType(),
    preferStringStartsEndsWith(),
    restrictPlusOperands(),
    restrictTemplateExpressions(),
    returnAwait(),
    switchExhaustivenessCheck({ considerDefaultExhaustiveForUnions: true }),
  ],
});
