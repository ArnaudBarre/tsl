import { isIntrinsicAnyType, isIntrinsicNeverType } from "ts-api-utils";
import { SyntaxKind, type Type, TypeFlags } from "typescript";
import { defineRule, getTypeName } from "../_utils/index.ts";
import type { Context } from "../../types.ts";

export const messages = {
  invalidType: (params: { type: string }) =>
    `Invalid type "${params.type}" of template literal expression.`,
};

export type RestrictTemplateExpressionsOptions = {
  /**
   * Types to allow in template expressions.
   * @default ["Error", "URL", "URLSearchParams"]
   */
  allow?: string[];
  /**
   * Whether to allow `any` typed values in template expressions.
   * @default false
   */
  allowAny?: boolean;
  /**
   * Whether to allow `array` typed values in template expressions.
   * @default false
   */
  allowArray?: boolean;
  /**
   * Whether to allow `boolean` typed values in template expressions.
   * @default false
   */
  allowBoolean?: boolean;
  /**
   * Whether to allow `never` typed values in template expressions.
   * @default true
   */
  allowNever?: boolean;
  /**
   * Whether to allow `nullish` typed values in template expressions.
   * @default false
   */
  allowNullish?: boolean;
  /**
   * Whether to allow `number` typed values in template expressions.
   * @default true
   */
  allowNumber?: boolean;
  /**
   * Whether to allow `regexp` typed values in template expressions.
   * @default false
   */
  allowRegExp?: boolean;
};

type OptionTester = (
  context: Context,
  type: Type,
  recursivelyCheckType: (context: Context, type: Type) => boolean,
) => boolean;

const optionTesters = (
  [
    ["Any", (_, type) => isIntrinsicAnyType(type)],
    [
      "Array",
      (context, type, recursivelyCheckType): boolean =>
        (context.checker.isArrayType(type) || context.checker.isTupleType(type))
        && recursivelyCheckType(context, type.getNumberIndexType()!),
    ],
    [
      "Boolean",
      (context, type) =>
        context.utils.typeOrUnionHasFlag(type, TypeFlags.BooleanLike),
    ],
    [
      "Nullish",
      (context, type) =>
        context.utils.typeOrUnionHasFlag(
          type,
          TypeFlags.Null | TypeFlags.Undefined,
        ),
    ],
    [
      "Number",
      (context, type) =>
        context.utils.typeOrUnionHasFlag(
          type,
          TypeFlags.NumberLike | TypeFlags.BigIntLike,
        ),
    ],
    [
      "RegExp",
      (context, type): boolean =>
        getTypeName(context.checker, type) === "RegExp",
    ],
    ["Never", (_, type) => isIntrinsicNeverType(type)],
  ] as const satisfies [string, OptionTester][]
).map(([type, tester]) => ({
  type,
  option: `allow${type}` as const,
  tester,
}));

// https://typescript-eslint.io/rules/restrict-template-expressions
export const restrictTemplateExpressions = defineRule(
  (_options?: RestrictTemplateExpressionsOptions) => {
    const options = {
      allow: ["Error", "URL", "URLSearchParams"],
      allowAny: false,
      allowArray: false,
      allowNever: false,
      allowBoolean: false,
      allowNullish: false,
      allowNumber: true,
      allowRegExp: false,
      ..._options,
    };

    const enabledOptionTesters = optionTesters.filter(
      ({ option }) => options[option],
    );

    function recursivelyCheckType(context: Context, innerType: Type): boolean {
      if (innerType.isUnion()) {
        return innerType.types.every((t) => recursivelyCheckType(context, t));
      }

      if (innerType.isIntersection()) {
        return innerType.types.some((t) => recursivelyCheckType(context, t));
      }

      return (
        context.utils.typeOrUnionHasFlag(innerType, TypeFlags.StringLike)
        || enabledOptionTesters.some(({ tester }) =>
          tester(context, innerType, recursivelyCheckType),
        )
      );
    }
    return {
      name: "core/restrictTemplateExpressions",
      visitor: {
        TemplateExpression(context, node) {
          // don't check tagged template literals
          if (node.parent.kind === SyntaxKind.TaggedTemplateExpression) {
            return;
          }

          for (const span of node.templateSpans) {
            const identifier =
              span.expression.kind === SyntaxKind.NewExpression
              || span.expression.kind === SyntaxKind.CallExpression
                ? span.expression.expression
                : span.expression;
            if (options.allow.includes(identifier.getText())) {
              return;
            }

            const expressionType = context.utils.getConstrainedTypeAtLocation(
              span.expression,
            );

            if (!recursivelyCheckType(context, expressionType)) {
              context.report({
                node: span.expression,
                message: messages.invalidType({
                  type: context.checker.typeToString(expressionType),
                }),
              });
            }
          }
        },
      },
    };
  },
);
