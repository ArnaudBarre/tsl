import { defineConfig } from "./src/public-utils.ts";
import { noUnnecessaryCondition } from "./src/rules-2024-01/no-unnecessary-condition.ts";
import { awaitThenable } from "./src/rules/await-thenable.ts";
import { dotNotation } from "./src/rules/dot-notation.ts";
import { noArrayDelete } from "./src/rules/no-array-delete.ts";
import { noFloatingPromises } from "./src/rules/no-floating-promises.ts";

export default defineConfig({
  rules: [
    awaitThenable,
    dotNotation,
    noArrayDelete,
    noFloatingPromises,
    // noBaseToString,
    // noConfusingVoidExpression,
    // noForInArray,
    // noImpliedEval,
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
