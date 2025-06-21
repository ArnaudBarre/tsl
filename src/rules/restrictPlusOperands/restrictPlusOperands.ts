import { isIntrinsicAnyType, isObjectType } from "ts-api-utils";
import ts, { SyntaxKind, TypeFlags } from "typescript";
import { defineRule, getTypeName } from "../_utils/index.ts";
import type { Context } from "../../types.ts";

export type RestrictPlusOperandsOptions = {
  /**
   * Whether to allow `any` typed values.
   * @default false
   */
  allowAny?: boolean;
  /**
   * Whether to allow `boolean` typed values.
   * @default true
   */
  allowBoolean?: boolean;
  /**
   * Whether to allow potentially `null` or `undefined` typed values.
   * @default false
   */
  allowNullish?: boolean;
  /**
   * Whether to allow `bigint`/`number` typed values and `string` typed values to be added together.
   * @default true
   */
  allowNumberAndString?: boolean;
  /**
   * Whether to allow `regexp` typed values.
   * @default false
   */
  allowRegExp?: boolean;
};

export const messages = {
  bigintAndNumber: (params: { left: string; right: string }) =>
    `Numeric '+' operations must either be both bigints or both numbers. Got \`${params.left}\` + \`${params.right}\`.`,
  invalid: (params: { stringLike: string; type: string }) =>
    `Invalid operand for a '+' operation. Operands must each be a number or ${params.stringLike}. Got \`${params.type}\`.`,
  mismatched: (params: { stringLike: string; left: string; right: string }) =>
    `Operands of '+' operations must be a number or ${params.stringLike}. Got \`${params.left}\` + \`${params.right}\`.`,
};

export const restrictPlusOperands = defineRule(
  (_options?: RestrictPlusOperandsOptions) => {
    const options = {
      allowAny: false,
      allowBoolean: true,
      allowNullish: false,
      allowNumberAndString: true,
      allowRegExp: false,
      ..._options,
    };
    const stringLikes = [
      options.allowNumberAndString && "`number`",
      options.allowBoolean && "`boolean`",
      options.allowRegExp && "`RegExp`",
      options.allowNullish && "`null`",
      options.allowNullish && "`undefined`",
      options.allowAny && "`any`",
    ].filter((value) => typeof value === "string");
    const stringLike = stringLikes.length
      ? stringLikes.length === 1
        ? `string, allowing a string + ${stringLikes[0]}`
        : `string, allowing a string + any of: ${stringLikes.join(", ")}`
      : "string";
    return {
      name: "core/restrictPlusOperands",
      visitor: {
        BinaryExpression(node, context) {
          if (
            node.operatorToken.kind !== SyntaxKind.PlusToken
            && node.operatorToken.kind !== SyntaxKind.PlusEqualsToken
          ) {
            return;
          }

          const leftType = context.utils.getConstrainedTypeAtLocation(
            node.left,
          );
          const rightType = context.utils.getConstrainedTypeAtLocation(
            node.right,
          );

          if (
            leftType === rightType
            && context.utils.typeHasFlag(
              leftType,
              TypeFlags.BigIntLike
                | TypeFlags.NumberLike
                | TypeFlags.StringLike,
            )
          ) {
            return;
          }

          let hadIndividualComplaint = false;

          for (const [baseNode, baseType, otherType] of [
            [node.left, leftType, rightType],
            [node.right, rightType, leftType],
          ] as const) {
            if (
              context.utils.typeOrUnionHasFlag(
                baseType,
                TypeFlags.ESSymbolLike | TypeFlags.Never | TypeFlags.Unknown,
              )
              || (!options.allowAny
                && context.utils.typeOrUnionHasFlag(baseType, TypeFlags.Any))
              || (!options.allowBoolean
                && context.utils.typeOrUnionHasFlag(
                  baseType,
                  TypeFlags.BooleanLike,
                ))
              || (!options.allowNullish
                && context.utils.typeOrUnionHasFlag(
                  baseType,
                  TypeFlags.Null | TypeFlags.Undefined,
                ))
            ) {
              context.report({
                node: baseNode,
                message: messages.invalid({
                  type: context.checker.typeToString(baseType),
                  stringLike,
                }),
              });
              hadIndividualComplaint = true;
              continue;
            }

            // RegExps also contain TypeFlags.Any & TypeFlags.Object
            for (const subBaseType of context.utils.unionConstituents(
              baseType,
            )) {
              const typeName = getTypeName(context.rawChecker, subBaseType);
              if (
                typeName === "RegExp"
                  ? !options.allowRegExp
                    || context.utils.typeHasFlag(
                      otherType,
                      TypeFlags.NumberLike,
                    )
                  : (!options.allowAny && isIntrinsicAnyType(subBaseType))
                    || isDeeplyObjectType(context, subBaseType)
              ) {
                context.report({
                  node: baseNode,
                  message: messages.invalid({
                    type: context.checker.typeToString(subBaseType),
                    stringLike,
                  }),
                });
                hadIndividualComplaint = true;
              }
            }
          }

          if (hadIndividualComplaint) {
            return;
          }

          for (const [baseType, otherType] of [
            [leftType, rightType],
            [rightType, leftType],
          ] as const) {
            if (
              !options.allowNumberAndString
              && context.utils.typeOrUnionHasFlag(
                baseType,
                TypeFlags.StringLike,
              )
              && context.utils.typeOrUnionHasFlag(
                otherType,
                TypeFlags.NumberLike | TypeFlags.BigIntLike,
              )
            ) {
              context.report({
                node,
                message: messages.mismatched({
                  left: context.checker.typeToString(leftType),
                  right: context.checker.typeToString(rightType),
                  stringLike,
                }),
              });
              return;
            }

            if (
              context.utils.typeOrUnionHasFlag(baseType, TypeFlags.NumberLike)
              && context.utils.typeOrUnionHasFlag(
                otherType,
                TypeFlags.BigIntLike,
              )
            ) {
              context.report({
                node,
                message: messages.bigintAndNumber({
                  left: context.checker.typeToString(leftType),
                  right: context.checker.typeToString(rightType),
                }),
              });
              return;
            }
          }
        },
      },
    };
  },
);

function isDeeplyObjectType(context: Context, type: ts.Type): boolean {
  return type.isIntersection()
    ? context.utils.intersectionConstituents(type).every(isObjectType)
    : context.utils.unionConstituents(type).every(isObjectType);
}
