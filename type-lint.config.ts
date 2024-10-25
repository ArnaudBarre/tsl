import { defineConfig } from "./src/public-utils.ts";
import { noUnnecessaryCondition } from "./src/rules/no-unnecessary-condition.ts";

export default defineConfig({
  rules: [
    // awaitThenable,
    // dotNotation,
    // noBaseToString,
    // noConfusingVoidExpression,
    // noFloatingPromises,
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
