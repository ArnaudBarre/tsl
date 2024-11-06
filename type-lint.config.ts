import { defineConfig } from "./src/public-utils.ts";
import { noUnnecessaryCondition } from "./src/rules-2024-01/no-unnecessary-condition.ts";
import { awaitThenable } from "./src/rules/await-thenable.ts";
import { dotNotation } from "./src/rules/dot-notation.ts";
import { noArrayDelete } from "./src/rules/no-array-delete.ts";
import { noConfusingVoidExpression } from "./src/rules/no-confusing-void-expression.ts";
import { noFloatingPromises } from "./src/rules/no-floating-promises.ts";
import { noForInArray } from "./src/rules/no-for-in-array.ts";
import { noImpliedEval } from "./src/rules/no-implied-eval.ts";
import { noMeaninglessVoidOperator } from "./src/rules/no-meaningless-void-operator.ts";
import { noMisusedPromises } from "./src/rules/no-misused-promises.ts";

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
    noUnnecessaryCondition,
  ],
  options: {
    "no-misused-promises": {
      checksVoidReturn: { arguments: false, attributes: false },
    },
    "no-confusing-void-expression": { ignoreArrowShorthand: true },
  },
});
