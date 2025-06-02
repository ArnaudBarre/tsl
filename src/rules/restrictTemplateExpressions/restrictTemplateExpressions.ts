import { isIntrinsicAnyType, isIntrinsicNeverType } from "ts-api-utils";
import { SyntaxKind, type Type, TypeFlags } from "typescript";
import { defineRule, getTypeName, typeHasFlag } from "../_utils/index.ts";
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
  type: Type,
  context: Context,
  recursivelyCheckType: (type: Type, context: Context) => boolean,
) => boolean;

const testTypeFlag =
  (flagsToCheck: TypeFlags): OptionTester =>
  (type) =>
    typeHasFlag(type, flagsToCheck);

const optionTesters = (
  [
    ["Any", isIntrinsicAnyType],
    [
      "Array",
      (type, context, recursivelyCheckType): boolean =>
        (context.checker.isArrayType(type) || context.checker.isTupleType(type))
        && recursivelyCheckType(type.getNumberIndexType()!, context),
    ],
    ["Boolean", testTypeFlag(TypeFlags.BooleanLike)],
    ["Nullish", testTypeFlag(TypeFlags.Null | TypeFlags.Undefined)],
    ["Number", testTypeFlag(TypeFlags.NumberLike | TypeFlags.BigIntLike)],
    [
      "RegExp",
      (type, context): boolean =>
        getTypeName(context.rawChecker, type) === "RegExp",
    ],
    ["Never", isIntrinsicNeverType],
  ] as const satisfies [string, OptionTester][]
).map(([type, tester]) => ({
  type,
  option: `allow${type}` as const,
  tester,
}));

export function restrictTemplateExpressions(
  _options?: RestrictTemplateExpressionsOptions,
) {
  const options = {
    allow: ["Error", "URL", "URLSearchParams"],
    allowAny: false,
    allowBoolean: true,
    allowNullish: false,
    allowNumber: true,
    allowRegExp: false,
    ..._options,
  };

  const enabledOptionTesters = optionTesters.filter(
    ({ option }) => options[option],
  );

  function recursivelyCheckType(innerType: Type, context: Context): boolean {
    if (innerType.isUnion()) {
      return innerType.types.every((t) => recursivelyCheckType(t, context));
    }

    if (innerType.isIntersection()) {
      return innerType.types.some((t) => recursivelyCheckType(t, context));
    }

    return (
      typeHasFlag(innerType, TypeFlags.StringLike)
      || enabledOptionTesters.some(({ tester }) =>
        tester(innerType, context, recursivelyCheckType),
      )
    );
  }
  return defineRule({
    name: "core/restrictTemplateExpressions",
    visitor: {
      TemplateExpression(node, context) {
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

          if (!recursivelyCheckType(expressionType, context)) {
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
  });
}
