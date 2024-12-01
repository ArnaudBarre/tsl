import {
  intersectionTypeParts,
  isIntrinsicAnyType,
  isObjectType,
  isTypeFlagSet,
  unionTypeParts,
} from "ts-api-utils";
import ts, { SyntaxKind, type Type, TypeFlags } from "typescript";
import { getTypeName } from "../_utils/index.ts";
import { createRule } from "../../public-utils.ts";
import { typeHasFlag } from "../../types-utils.ts";

export const messages = {
  bigintAndNumber: (params: { left: string; right: string }) =>
    `Numeric '+' operations must either be both bigints or both numbers. Got \`${params.left}\` + \`${params.right}\`.`,
  invalid: (params: { stringLike: string; type: string }) =>
    `Invalid operand for a '+' operation. Operands must each be a number or ${params.stringLike}. Got \`${params.type}\`.`,
  mismatched: (params: { stringLike: string; left: string; right: string }) =>
    `Operands of '+' operations must be a number or ${params.stringLike}. Got \`${params.left}\` + \`${params.right}\`.`,
};

export const restrictPlusOperands = createRule(
  (_options?: {
    /** Whether to allow `any` typed values. Defaults to `false`. */
    allowAny?: boolean;
    /** Whether to allow `boolean` typed values. Defaults to `true`. */
    allowBoolean?: boolean;
    /** Whether to allow potentially `null` or `undefined` typed values. Defaults to `false`. */
    allowNullish?: boolean;
    /** Whether to allow `bigint`/`number` typed values and `string` typed values to be added together. Defaults to `true`. */
    allowNumberAndString?: boolean;
    /** Whether to allow `regexp` typed values. Defaults to `false`. */
    allowRegExp?: boolean;
  }) => {
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
            node.operatorToken.kind !== SyntaxKind.PlusToken &&
            node.operatorToken.kind !== SyntaxKind.PlusEqualsToken
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
            leftType === rightType &&
            isTypeFlagSet(
              leftType,
              ts.TypeFlags.BigIntLike |
                ts.TypeFlags.NumberLike |
                ts.TypeFlags.StringLike,
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
              isTypeFlagSetInUnion(
                baseType,
                ts.TypeFlags.ESSymbolLike |
                  ts.TypeFlags.Never |
                  ts.TypeFlags.Unknown,
              ) ||
              (!options.allowAny &&
                isTypeFlagSetInUnion(baseType, ts.TypeFlags.Any)) ||
              (!options.allowBoolean &&
                isTypeFlagSetInUnion(baseType, ts.TypeFlags.BooleanLike)) ||
              (!options.allowNullish &&
                typeHasFlag(
                  baseType,
                  ts.TypeFlags.Null | ts.TypeFlags.Undefined,
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

            // RegExps also contain ts.TypeFlags.Any & ts.TypeFlags.Object
            for (const subBaseType of unionTypeParts(baseType)) {
              const typeName = getTypeName(context.rawChecker, subBaseType);
              if (
                typeName === "RegExp"
                  ? !options.allowRegExp ||
                    isTypeFlagSet(otherType, ts.TypeFlags.NumberLike)
                  : (!options.allowAny && isIntrinsicAnyType(subBaseType)) ||
                    isDeeplyObjectType(subBaseType)
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
              !options.allowNumberAndString &&
              isTypeFlagSetInUnion(baseType, ts.TypeFlags.StringLike) &&
              isTypeFlagSetInUnion(otherType, ts.TypeFlags.NumberLike)
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
              isTypeFlagSetInUnion(baseType, ts.TypeFlags.NumberLike) &&
              isTypeFlagSetInUnion(otherType, ts.TypeFlags.BigIntLike)
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

function isDeeplyObjectType(type: Type): boolean {
  return type.isIntersection()
    ? intersectionTypeParts(type).every(isObjectType)
    : unionTypeParts(type).every(isObjectType);
}

function isTypeFlagSetInUnion(type: Type, flag: TypeFlags): boolean {
  return unionTypeParts(type).some((subType) => isTypeFlagSet(subType, flag));
}
