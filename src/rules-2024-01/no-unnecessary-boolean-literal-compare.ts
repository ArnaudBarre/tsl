import { isTypeFlagSet } from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Infer } from "../types.ts";

const messages = {
  direct:
    "This expression unnecessarily compares a boolean value to a boolean instead of using it directly.",
  negated:
    "This expression unnecessarily compares a boolean value to a boolean instead of negating it.",
  comparingNullableToTrueDirect:
    "This expression unnecessarily compares a nullable boolean value to true instead of using it directly.",
  comparingNullableToTrueNegated:
    "This expression unnecessarily compares a nullable boolean value to true instead of negating it.",
  comparingNullableToFalse:
    "This expression unnecessarily compares a nullable boolean value to false instead of using the ?? operator to provide a default.",
};

type Context = Infer<typeof noUnnecessaryBooleanLiteralCompare>["Context"];

interface BooleanComparison {
  expression: AST.Expression | AST.PrivateIdentifier;
  literalBooleanInComparison: boolean;
  negated: boolean;
}

interface BooleanComparisonWithTypeInformation extends BooleanComparison {
  expressionIsNullableBoolean: boolean;
}
export const noUnnecessaryBooleanLiteralCompare = createRule({
  name: "no-unnecessary-boolean-literal-compare",
  parseOptions: (options?: {
    allowComparingNullableBooleansToTrue?: boolean;
    allowComparingNullableBooleansToFalse?: boolean;
  }) => ({
    allowComparingNullableBooleansToTrue: true,
    allowComparingNullableBooleansToFalse: true,
    ...options,
  }),
  visitor: {
    BinaryExpression(node, context) {
      const comparison = getBooleanComparison(node, context);
      if (comparison === undefined) {
        return;
      }

      if (comparison.expressionIsNullableBoolean) {
        if (
          comparison.literalBooleanInComparison &&
          context.options.allowComparingNullableBooleansToTrue
        ) {
          return;
        }
        if (
          !comparison.literalBooleanInComparison &&
          context.options.allowComparingNullableBooleansToFalse
        ) {
          return;
        }
      }

      context.report({
        message: comparison.expressionIsNullableBoolean
          ? comparison.literalBooleanInComparison
            ? comparison.negated
              ? messages.comparingNullableToTrueNegated
              : messages.comparingNullableToTrueDirect
            : messages.comparingNullableToFalse
          : comparison.negated
          ? messages.negated
          : messages.direct,
        node,
      });
    },
  },
});

function getBooleanComparison(
  node: AST.BinaryExpression,
  context: Context,
): BooleanComparisonWithTypeInformation | undefined {
  const comparison = deconstructComparison(node);
  if (!comparison) {
    return undefined;
  }

  const expressionType = context.checker.getTypeAtLocation(
    comparison.expression,
  );

  if (isBooleanType(expressionType)) {
    return {
      ...comparison,
      expressionIsNullableBoolean: false,
    };
  }

  if (isNullableBoolean(expressionType)) {
    return {
      ...comparison,
      expressionIsNullableBoolean: true,
    };
  }

  return undefined;
}

function isBooleanType(expressionType: ts.Type): boolean {
  return isTypeFlagSet(
    expressionType,
    ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral,
  );
}

/**
 * checks if the expressionType is a union that
 *   1) contains at least one nullish type (null or undefined)
 *   2) contains at least once boolean type (true or false or boolean)
 *   3) does not contain any types besides nullish and boolean types
 */
function isNullableBoolean(expressionType: ts.Type): boolean {
  if (!expressionType.isUnion()) {
    return false;
  }

  const { types } = expressionType;

  const nonNullishTypes = types.filter(
    (type) => !isTypeFlagSet(type, ts.TypeFlags.Undefined | ts.TypeFlags.Null),
  );

  const hasNonNullishType = nonNullishTypes.length > 0;
  if (!hasNonNullishType) {
    return false;
  }

  const hasNullableType = nonNullishTypes.length < types.length;
  if (!hasNullableType) {
    return false;
  }

  const allNonNullishTypesAreBoolean = nonNullishTypes.every((t) =>
    isBooleanType(t),
  );
  if (!allNonNullishTypesAreBoolean) {
    return false;
  }

  return true;
}

function deconstructComparison(
  node: AST.BinaryExpression,
): BooleanComparison | undefined {
  const comparisonType = getEqualsKind(node.operatorToken);
  if (!comparisonType) return;

  for (const [against, expression] of [
    [node.right, node.left],
    [node.left, node.right],
  ]) {
    if (
      against.kind === SyntaxKind.TrueKeyword ||
      against.kind === SyntaxKind.FalseKeyword
    ) {
      return {
        literalBooleanInComparison: against.kind === SyntaxKind.TrueKeyword,
        expression,
        negated: !comparisonType.isPositive,
      };
    }
  }

  return undefined;
}

interface EqualsKind {
  isPositive: boolean;
  isStrict: boolean;
}

function getEqualsKind(
  operator: AST.BinaryOperatorToken,
): EqualsKind | undefined {
  switch (operator.kind) {
    case SyntaxKind.EqualsEqualsToken: // ==
      return { isPositive: true, isStrict: false };
    case SyntaxKind.EqualsEqualsEqualsToken: // ===
      return { isPositive: true, isStrict: true };
    case SyntaxKind.ExclamationEqualsToken: // !=
      return { isPositive: false, isStrict: false };
    case SyntaxKind.ExclamationEqualsEqualsToken: // !==
      return { isPositive: false, isStrict: true };
    default:
      return undefined;
  }
}

export const test = () =>
  ruleTester({
    rule: noUnnecessaryBooleanLiteralCompare,
    valid: [
      `
      declare const varAny: any;
      varAny === true;
    `,
      `
      declare const varAny: any;
      varAny == false;
    `,
      `
      declare const varString: string;
      varString === false;
    `,
      `
      declare const varString: string;
      varString === true;
    `,
      `
      declare const varObject: {};
      varObject === true;
    `,
      `
      declare const varObject: {};
      varObject == false;
    `,
      `
      declare const varNullOrUndefined: null | undefined;
      varNullOrUndefined === false;
    `,
      `
      declare const varBooleanOrString: boolean | string;
      varBooleanOrString === false;
    `,
      `
      declare const varBooleanOrString: boolean | string;
      varBooleanOrString == true;
    `,
      `
      declare const varTrueOrStringOrUndefined: true | string | undefined;
      varTrueOrStringOrUndefined == true;
    `,
      `
      declare const varBooleanOrUndefined: boolean | undefined;
      varBooleanOrUndefined === true;
    `,
      {
        code: `
        declare const varBooleanOrUndefined: boolean | undefined;
        varBooleanOrUndefined === true;
      `,
        options: {
          allowComparingNullableBooleansToFalse: false,
        },
      },
      {
        code: `
        declare const varBooleanOrUndefined: boolean | undefined;
        varBooleanOrUndefined === false;
      `,
        options: {
          allowComparingNullableBooleansToTrue: false,
        },
      },
      "'false' === true;",
      "'true' === false;",
    ],
    invalid: [
      {
        code: "true === true;",
        errors: [
          {
            message: messages.direct,
          },
        ],
      },
      {
        code: "false !== true;",
        errors: [
          {
            message: messages.negated,
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (varBoolean !== false) {
        }
      `,
        errors: [
          {
            message: messages.negated,
          },
        ],
      },
      {
        code: `
        declare const varTrue: true;
        if (varTrue !== true) {
        }
      `,
        errors: [
          {
            message: messages.negated,
          },
        ],
      },
      {
        code: `
        declare const varTrueOrUndefined: true | undefined;
        if (varTrueOrUndefined === true) {
        }
      `,
        options: {
          allowComparingNullableBooleansToTrue: false,
        },
        errors: [
          {
            message: messages.comparingNullableToTrueDirect,
          },
        ],
      },
      {
        code: `
        declare const varFalseOrNull: false | null;
        if (varFalseOrNull !== true) {
        }
      `,
        options: {
          allowComparingNullableBooleansToTrue: false,
        },
        errors: [
          {
            message: messages.comparingNullableToTrueNegated,
          },
        ],
      },
      {
        code: `
        declare const varBooleanOrNull: boolean | null;
        declare const otherBoolean: boolean;
        if (varBooleanOrNull === false && otherBoolean) {
        }
      `,
        options: {
          allowComparingNullableBooleansToFalse: false,
        },
        errors: [
          {
            message: messages.comparingNullableToFalse,
          },
        ],
      },
      {
        code: `
        declare const varBooleanOrNull: boolean | null;
        declare const otherBoolean: boolean;
        if (!(varBooleanOrNull === false) || otherBoolean) {
        }
      `,
        options: {
          allowComparingNullableBooleansToFalse: false,
        },
        errors: [
          {
            message: messages.comparingNullableToFalse,
          },
        ],
      },
      {
        code: `
        declare const varTrueOrFalseOrUndefined: true | false | undefined;
        declare const otherBoolean: boolean;
        if (varTrueOrFalseOrUndefined !== false && !otherBoolean) {
        }
      `,
        options: {
          allowComparingNullableBooleansToFalse: false,
        },
        errors: [
          {
            message: messages.comparingNullableToFalse,
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (false !== varBoolean) {
        }
      `,
        errors: [
          {
            message: messages.negated,
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (true !== varBoolean) {
        }
      `,
        errors: [
          {
            message: messages.negated,
          },
        ],
      },
      {
        code: `
        declare const x;
        if ((x instanceof Error) === false) {
        }
      `,
        errors: [
          {
            message: messages.direct,
          },
        ],
      },
      {
        code: `
        declare const x;
        if (false === (x instanceof Error)) {
        }
      `,
        errors: [
          {
            message: messages.direct,
          },
        ],
      },
      {
        code: `
        declare const x;
        if (x instanceof Error === false) {
        }
      `,
        errors: [
          {
            message: messages.direct,
          },
        ],
      },
      {
        code: `
        declare const x;
        if (typeof x === 'string' === false) {
        }
      `,
        errors: [
          {
            message: messages.direct,
          },
        ],
      },
      {
        code: `
        declare const x;
        if (x instanceof Error === false) {
        }
      `,
        errors: [
          {
            message: messages.direct,
          },
        ],
      },
      {
        code: `
        declare const y;
        if (false === y instanceof Error) {
        }
      `,
        errors: [
          {
            message: messages.direct,
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (!(varBoolean !== false)) {
        }
      `,
        errors: [
          {
            message: messages.negated,
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (!(varBoolean === false)) {
        }
      `,
        errors: [
          {
            message: messages.direct,
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (!(varBoolean instanceof Event == false)) {
        }
      `,
        errors: [
          {
            message: messages.direct,
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (varBoolean instanceof Event == false) {
        }
      `,
        errors: [
          {
            message: messages.direct,
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (!((varBoolean ?? false) !== false)) {
        }
      `,
        errors: [
          {
            message: messages.negated,
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (!((varBoolean ?? false) === false)) {
        }
      `,
        errors: [
          {
            message: messages.direct,
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (!((varBoolean ?? true) !== false)) {
        }
      `,
        errors: [
          {
            message: messages.negated,
          },
        ],
      },
    ],
  });
