import { defineConfig } from "./src/public-utils.ts";
import { noUnnecessaryCondition } from "./src/rules-2024-01/no-unnecessary-condition.ts";
import { awaitThenable } from "./src/rules/await-thenable.ts";
import { dotNotation } from "./src/rules/dot-notation.ts";
import { noArrayDelete } from "./src/rules/no-array-delete.ts";
import { noFloatingPromises } from "./src/rules/no-floating-promises.ts";
import { noForInArray } from "./src/rules/no-for-in-array.ts";
import { noImpliedEval } from "./src/rules/no-implied-eval.ts";

export default defineConfig({
  rules: [
    awaitThenable,
    dotNotation,
    noArrayDelete,
    noFloatingPromises,
    noForInArray,
    noImpliedEval,
    // noBaseToString,
    // noConfusingVoidExpression,
    // noMeaninglessVoidOperator,
    // noMisusedPromises,
    // noRedundantTypeConstituents,
    // noThrowLiteral,
    // noUnnecessaryBooleanLiteralCompare,
    noUnnecessaryCondition,
    // noUnnecessaryTypeArguments,
    // noUnnecessaryTypeAssertion,
    // noUnsafeArgument,
    // noUnsafeAssignment,
    // {
    //   name: "no-console",
    //   visitor: {
    //     PropertyAccessExpression(node, context) {
    //       if (
    //         node.expression.kind === ts.SyntaxKind.Identifier &&
    //         node.expression.text === "console"
    //       ) {
    //         context.report({
    //           node,
    //           message: "Unexpected console usage",
    //           suggestions: [
    //             {
    //               title: "Remove the log",
    //               changes: [{ node: node.parent, newText: "" }],
    //             },
    //           ],
    //         });
    //       }
    //     },
    //   },
    // },
  ],
  options: {
    // "no-misused-promises": {
    //   checksVoidReturn: { arguments: false, attributes: false },
    // },
    // "no-confusing-void-expression": { ignoreArrowShorthand: true },
  },
});
