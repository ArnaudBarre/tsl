import { defineConfig } from "./src/index.ts";
import { awaitThenable } from "./src/rules/awaitThenable/awaitThenable.ts";
import { dotNotation } from "./src/rules/dotNotation/dotNotation.ts";
import { noArrayDelete } from "./src/rules/noArrayDelete/noArrayDelete.ts";
import { noConfusingVoidExpression } from "./src/rules/noConfusingVoidExpression/noConfusingVoidExpression.ts";
import { noFloatingPromises } from "./src/rules/noFloatingPromises/noFloatingPromises.ts";
import { noForInArray } from "./src/rules/noForInArray/noForInArray.ts";
import { noImpliedEval } from "./src/rules/noImpliedEval/noImpliedEval.ts";
import { noMeaninglessVoidOperator } from "./src/rules/noMeaninglessVoidOperator/noMeaninglessVoidOperator.ts";
import { noMisusedPromises } from "./src/rules/noMisusedPromises/noMisusedPromises.ts";
import { noMisusedSpread } from "./src/rules/noMisusedSpread/noMisusedSpread.ts";
import { nonNullableTypeAssertionStyle } from "./src/rules/nonNullableTypeAssertionStyle/nonNullableTypeAssertionStyle.ts";
import { noRedundantTypeConstituents } from "./src/rules/noRedundantTypeConstituents/noRedundantTypeConstituents.ts";
import { noUnnecessaryCondition } from "./src/rules/noUnnecessaryCondition/noUnnecessaryCondition.ts";
import { noUnnecessaryTemplateExpression } from "./src/rules/noUnnecessaryTemplateExpression/noUnnecessaryTemplateExpression.ts";
import { noUnnecessaryTypeArguments } from "./src/rules/noUnnecessaryTypeArguments/noUnnecessaryTypeArguments.ts";
import { noUnnecessaryTypeAssertion } from "./src/rules/noUnnecessaryTypeAssertion/noUnnecessaryTypeAssertion.ts";
import { noUnnecessaryTypeConversion } from "./src/rules/noUnnecessaryTypeConversion/noUnnecessaryTypeConversion.ts";
import { noUnsafeUnaryMinus } from "./src/rules/noUnsafeUnaryMinus/noUnsafeUnaryMinus.ts";
import { onlyThrowError } from "./src/rules/onlyThrowError/onlyThrowError.ts";
import { preferFind } from "./src/rules/preferFind/preferFind.ts";
import { preferIncludes } from "./src/rules/preferIncludes/preferIncludes.ts";
import { preferNullishCoalescing } from "./src/rules/preferNullishCoalescing/preferNullishCoalescing.ts";
import { preferOptionalChain } from "./src/rules/preferOptionalChain/preferOptionalChain.ts";
import { preferReduceTypeParameter } from "./src/rules/preferReduceTypeParameter/preferReduceTypeParameter.ts";
import { preferReturnThisType } from "./src/rules/preferReturnThisType/preferReturnThisType.ts";
import { preferStringStartsEndsWith } from "./src/rules/preferStringStartsEndsWith/preferStringStartsEndsWith.ts";
import { restrictPlusOperands } from "./src/rules/restrictPlusOperands/restrictPlusOperands.ts";
import { restrictTemplateExpressions } from "./src/rules/restrictTemplateExpressions/restrictTemplateExpressions.ts";
import { returnAwait } from "./src/rules/returnAwait/returnAwait.ts";
import { switchExhaustivenessCheck } from "./src/rules/switchExhaustivenessCheck/switchExhaustivenessCheck.ts";

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
    noMisusedSpread(),
    noRedundantTypeConstituents(),
    noUnnecessaryCondition(),
    noUnnecessaryTemplateExpression(),
    noUnnecessaryTypeArguments(),
    noUnnecessaryTypeAssertion(),
    noUnnecessaryTypeConversion(),
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
