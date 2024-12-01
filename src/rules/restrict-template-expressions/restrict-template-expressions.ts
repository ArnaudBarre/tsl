import { isIntrinsicAnyType, isIntrinsicNeverType } from "ts-api-utils";
import { SyntaxKind, type Type, TypeFlags } from "typescript";
import { getTypeName } from "../_utils/index.ts";
import { createRule } from "../../public-utils.ts";
import { typeHasFlag } from "../../types-utils.ts";
import type { Context } from "../../types.ts";

export const messages = {
  invalidType: (params: { type: string }) =>
    `Invalid type "${params.type}" of template literal expression.`,
};

type OptionTester = (
  type: Type,
  context: Context<Options>,
  recursivelyCheckType: (type: Type, context: Context<Options>) => boolean,
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
        (context.checker.isArrayType(type) ||
          context.checker.isTupleType(type)) &&
        recursivelyCheckType(type.getNumberIndexType()!, context),
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

type Options = {
  /** Types to allow in template expressions. */
  allow?: string[];
  /** Whether to allow `any` typed values in template expressions. Defaults to `false`. */
  allowAny?: boolean;
  /** Whether to allow `array` typed values in template expressions. Defaults to `false`. */
  allowArray?: boolean;
  /** Whether to allow `boolean` typed values in template expressions. Defaults to `false`. */
  allowBoolean?: boolean;
  /** Whether to allow `never` typed values in template expressions. Defaults to `true`. */
  allowNever?: boolean;
  /** Whether to allow `nullish` typed values in template expressions. Defaults to `false`. */
  allowNullish?: boolean;
  /** Whether to allow `number` typed values in template expressions. Defaults to `true`. */
  allowNumber?: boolean;
  /** Whether to allow `regexp` typed values in template expressions. Defaults to `false`. */
  allowRegExp?: boolean;
};
export const restrictTemplateExpressions = createRule((_options?: Options) => {
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

  function recursivelyCheckType(
    innerType: Type,
    context: Context<Options>,
  ): boolean {
    if (innerType.isUnion()) {
      return innerType.types.every((t) => recursivelyCheckType(t, context));
    }

    if (innerType.isIntersection()) {
      return innerType.types.some((t) => recursivelyCheckType(t, context));
    }

    return (
      typeHasFlag(innerType, TypeFlags.StringLike) ||
      enabledOptionTesters.some(({ tester }) =>
        tester(innerType, context, recursivelyCheckType),
      )
    );
  }

  return {
    name: "core/restrictTemplateExpressions",
    visitor: {
      TemplateExpression(node, context) {
        // don't check tagged template literals
        if (node.parent.kind === SyntaxKind.TaggedTemplateExpression) {
          return;
        }

        for (const span of node.templateSpans) {
          const identifier =
            span.expression.kind === SyntaxKind.NewExpression ||
            span.expression.kind === SyntaxKind.CallExpression
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
  };
});
