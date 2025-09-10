import { isTrueLiteralType, isTypeParameter } from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import { findTruthinessAssertedArgument } from "../_utils/findTruthinessAssertedArgument.ts";
import {
  getOperatorPrecedenceForNode,
  OperatorPrecedence,
} from "../_utils/getOperatorPrecedence.ts";
import {
  defineRule,
  hasModifier,
  isArrayMethodCallWithPredicate,
  isFunction,
} from "../_utils/index.ts";
import type { AST, Context, Suggestion } from "../../types.ts";

export const messages = {
  conditionErrorAny: (p: { context: string }) =>
    `Unexpected any value in ${p.context}. An explicit comparison or type conversion is required.`,
  conditionErrorNullableBoolean: (p: { context: string }) =>
    `Unexpected nullable boolean value in ${p.context}. Please handle the nullish case explicitly.`,
  conditionErrorNullableEnum: (p: { context: string }) =>
    `Unexpected nullable enum value in ${p.context}. Please handle the nullish/zero/NaN cases explicitly.`,
  conditionErrorNullableNumber: (p: { context: string }) =>
    `Unexpected nullable number value in ${p.context}. Please handle the nullish/zero/NaN cases explicitly.`,
  conditionErrorNullableObject: (p: { context: string }) =>
    `Unexpected nullable object value in ${p.context}. An explicit null check is required.`,
  conditionErrorNullableString: (p: { context: string }) =>
    `Unexpected nullable string value in ${p.context}. Please handle the nullish/empty cases explicitly.`,
  conditionErrorNullish: (p: { context: string }) =>
    `Unexpected nullish value in ${p.context}. The condition is always false.`,
  conditionErrorNumber: (p: { context: string }) =>
    `Unexpected number value in ${p.context}. An explicit zero/NaN check is required.`,
  conditionErrorObject: (p: { context: string }) =>
    `Unexpected object value in ${p.context}. The condition is always true.`,
  conditionErrorOther: (p: { context: string }) =>
    `Unexpected value in ${p.context}. A boolean expression is required.`,
  conditionErrorString: (p: { context: string }) =>
    `Unexpected string value in ${p.context}. An explicit empty string check is required.`,
  conditionFixCastBoolean:
    "Explicitly convert value to a boolean (`Boolean(value)`)",
  conditionFixCompareArrayLengthNonzero:
    "Change condition to check array's length (`value.length > 0`)",
  conditionFixCompareArrayLengthZero:
    "Change condition to check array's length (`value.length === 0`)",
  conditionFixCompareEmptyString:
    'Change condition to check for empty string (`value !== ""`)',
  conditionFixCompareFalse:
    "Change condition to check if false (`value === false`)",
  conditionFixCompareNaN:
    "Change condition to check for NaN (`!Number.isNaN(value)`)",
  conditionFixCompareNullish:
    "Change condition to check for null/undefined (`value != null`)",
  conditionFixCompareStringLength:
    "Change condition to check string's length (`value.length !== 0`)",
  conditionFixCompareTrue:
    "Change condition to check if true (`value === true`)",
  conditionFixCompareZero: "Change condition to check for 0 (`value !== 0`)",
  conditionFixDefaultEmptyString:
    'Explicitly treat nullish value the same as an empty string (`value ?? ""`)',
  conditionFixDefaultFalse:
    "Explicitly treat nullish value the same as false (`value ?? false`)",
  conditionFixDefaultZero:
    "Explicitly treat nullish value the same as 0 (`value ?? 0`)",
  explicitBooleanReturnType:
    "Add an explicit `boolean` return type annotation.",
  predicateCannotBeAsync:
    "Predicate function should not be 'async'; expected a boolean return type.",
};

export type StrictBooleanExpressionsOptions = {
  /**
   * Whether to allow `any`s in a boolean context.
   * @default false
   */
  allowAny?: boolean;
  /**
   * Whether to allow nullable `boolean`s in a boolean context.
   * @default false
   */
  allowNullableBoolean?: boolean;
  /**
   * Whether to allow nullable `enum`s in a boolean context.
   * @default false
   */
  allowNullableEnum?: boolean;
  /**
   * Whether to allow nullable `number`s in a boolean context.
   * @default false
   */
  allowNullableNumber?: boolean;
  /**
   * Whether to allow nullable `object`s, `symbol`s, and functions in a boolean context.
   * @default true
   */
  allowNullableObject?: boolean;
  /**
   * Whether to allow nullable `string`s in a boolean context.
   * @default false
   */
  allowNullableString?: boolean;
  /**
   * Whether to allow `number`s in a boolean context.
   * @default true
   */
  allowNumber?: boolean;
  /**
   * Whether to allow `string`s in a boolean context.
   * @default true
   */
  allowString?: boolean;
};

type ConditionErrorMessageId =
  | "conditionErrorAny"
  | "conditionErrorNullableBoolean"
  | "conditionErrorNullableEnum"
  | "conditionErrorNullableNumber"
  | "conditionErrorNullableObject"
  | "conditionErrorNullableString"
  | "conditionErrorNullish"
  | "conditionErrorNumber"
  | "conditionErrorObject"
  | "conditionErrorOther"
  | "conditionErrorString";

type Data = { checkedNodes: Set<ts.Node> };

// https://typescript-eslint.io/rules/strict-boolean-expressions
export const strictBooleanExpressions = defineRule(
  (_options?: StrictBooleanExpressionsOptions) => {
    const options = {
      allowAny: false,
      allowNullableBoolean: false,
      allowNullableEnum: false,
      allowNullableNumber: false,
      allowNullableObject: true,
      allowNullableString: false,
      allowNumber: true,
      allowString: true,
      ..._options,
    };

    /**
     * Inspects the arguments of a logical expression (`&&`, `||`).
     *
     * If the logical expression is a descendant of a test expression,
     * the `isCondition` flag should be set to true.
     * Otherwise, if the logical expression is there on it's own,
     * it's used for control flow and is not a condition itself.
     */
    function traverseLogicalExpression(
      context: Context<Data>,
      node: AST.BinaryExpression,
      isCondition: boolean,
    ): void {
      // left argument is always treated as a condition
      traverseNode(context, node.left, true);
      // if the logical expression is used for control flow,
      // then its right argument is used for its side effects only
      traverseNode(context, node.right, isCondition);
    }

    function traverseCallExpression(
      context: Context<Data>,
      node: AST.CallExpression,
    ): void {
      const assertedArgument = findTruthinessAssertedArgument(context, node);
      if (assertedArgument != null) {
        traverseNode(context, assertedArgument, true);
      }
      if (isArrayMethodCallWithPredicate(context, node)) {
        const predicate = node.arguments.at(0);
        if (predicate) {
          checkArrayMethodCallPredicate(context, predicate);
        }
      }
    }

    /**
     * Dedicated function to check array method predicate calls. Reports predicate
     * arguments that don't return a boolean value.
     */
    function checkArrayMethodCallPredicate(
      context: Context,
      predicateNode: AST.Expression,
    ): void {
      const isFunctionExpression = isFunction(predicateNode);

      // custom message for accidental `async` function expressions
      if (
        isFunctionExpression
        && hasModifier(predicateNode, SyntaxKind.AsyncKeyword)
      ) {
        context.report({
          node: predicateNode,
          message: messages.predicateCannotBeAsync,
        });
        return;
      }

      const returnTypes = context.checker
        .getTypeAtLocation(predicateNode)
        .getCallSignatures()
        .map((signature) => {
          const type = signature.getReturnType();

          if (isTypeParameter(type)) {
            return context.checker.getBaseConstraintOfType(type) ?? type;
          }

          return type;
        });
      const flattenTypes = [
        ...new Set(
          returnTypes.flatMap((type) => context.utils.unionConstituents(type)),
        ),
      ];

      const types = inspectVariantTypes(context, flattenTypes);
      const reportType = determineReportType(types);

      if (reportType == null) {
        return;
      }

      const suggestions: Suggestion[] = [];
      if (
        isFunctionExpression
        && predicateNode.body.kind !== SyntaxKind.Block
      ) {
        suggestions.push(
          ...getSuggestionsForConditionError(
            predicateNode.body,
            reportType,
            context,
          ),
        );
      }

      if (isFunctionExpression && !predicateNode.type) {
        const changes: Suggestion["changes"] = [];
        const parenthesisLessArrowFunction =
          predicateNode.kind === SyntaxKind.ArrowFunction
          && !predicateNode.getText().startsWith("(");
        if (parenthesisLessArrowFunction) {
          changes.push({
            start: predicateNode.getStart(),
            length: 0,
            newText: "(",
          });
        }
        changes.push({
          start:
            predicateNode.kind === SyntaxKind.ArrowFunction
              ? predicateNode.equalsGreaterThanToken.getStart() - 1
              : predicateNode.body.getStart(),
          length: 0,
          newText: parenthesisLessArrowFunction ? "): boolean" : ": boolean",
        });

        suggestions.push({
          message: messages.explicitBooleanReturnType,
          changes,
        });
      }

      context.report({
        node: predicateNode,
        message: messages[reportType]({
          context: "array predicate return type",
        }),
        suggestions,
      });
      return;
    }

    /**
     * Inspects any node.
     *
     * If it's a logical expression then it recursively traverses its arguments.
     * If it's any other kind of node then it's type is finally checked against the rule,
     * unless `isCondition` flag is set to false, in which case
     * it's assumed to be used for side effects only and is skipped.
     */
    function traverseNode(
      context: Context<Data>,
      node: AST.Expression,
      isCondition: boolean,
    ): void {
      // prevent checking the same node multiple times
      if (context.data.checkedNodes.has(node)) return;
      context.data.checkedNodes.add(node);
      if (node.kind === SyntaxKind.ParenthesizedExpression) {
        traverseNode(context, node.expression, isCondition);
        return;
      }

      // for logical operator, we check its operands
      if (
        node.kind === SyntaxKind.BinaryExpression
        && (node.operatorToken.kind === SyntaxKind.AmpersandAmpersandToken
          || node.operatorToken.kind === SyntaxKind.BarBarToken)
      ) {
        traverseLogicalExpression(context, node, isCondition);
        return;
      }

      // skip if node is not a condition
      if (!isCondition) return;

      checkNode(context, node);
    }

    function determineReportType(
      types: Set<VariantType>,
    ): ConditionErrorMessageId | undefined {
      const is = (...wantedTypes: readonly VariantType[]): boolean =>
        types.size === wantedTypes.length
        && wantedTypes.every((type) => types.has(type));

      // boolean
      if (is("boolean") || is("truthy boolean")) {
        // boolean is always ok
        return undefined;
      }

      // never
      if (is("never")) {
        // never is always okay
        return undefined;
      }

      // nullish
      if (is("nullish")) {
        // condition is always false
        return "conditionErrorNullish";
      }

      // Known edge case: boolean `true` and nullish values are always valid boolean expressions
      if (is("nullish", "truthy boolean")) {
        return;
      }

      // nullable boolean
      if (is("nullish", "boolean")) {
        return !options.allowNullableBoolean
          ? "conditionErrorNullableBoolean"
          : undefined;
      }

      // Known edge case: truthy primitives and nullish values are always valid boolean expressions
      if (
        (options.allowNumber && is("nullish", "truthy number"))
        || (options.allowString && is("nullish", "truthy string"))
      ) {
        return;
      }

      // string
      if (is("string") || is("truthy string")) {
        return !options.allowString ? "conditionErrorString" : undefined;
      }

      // nullable string
      if (is("nullish", "string")) {
        return !options.allowNullableString
          ? "conditionErrorNullableString"
          : undefined;
      }

      // number
      if (is("number") || is("truthy number")) {
        return !options.allowNumber ? "conditionErrorNumber" : undefined;
      }

      // nullable number
      if (is("nullish", "number")) {
        return !options.allowNullableNumber
          ? "conditionErrorNullableNumber"
          : undefined;
      }

      // object
      if (is("object")) {
        return "conditionErrorObject";
      }

      // nullable object
      if (is("nullish", "object")) {
        return !options.allowNullableObject
          ? "conditionErrorNullableObject"
          : undefined;
      }

      // nullable enum
      if (
        is("nullish", "number", "enum")
        || is("nullish", "string", "enum")
        || is("nullish", "truthy number", "enum")
        || is("nullish", "truthy string", "enum")
        // mixed enums
        || is("nullish", "truthy number", "truthy string", "enum")
        || is("nullish", "truthy number", "string", "enum")
        || is("nullish", "truthy string", "number", "enum")
        || is("nullish", "number", "string", "enum")
      ) {
        return !options.allowNullableEnum
          ? "conditionErrorNullableEnum"
          : undefined;
      }

      // any
      if (is("any")) {
        return !options.allowAny ? "conditionErrorAny" : undefined;
      }

      return "conditionErrorOther";
    }

    function getSuggestionsForConditionError(
      node: AST.Expression,
      conditionError: ConditionErrorMessageId,
      context: Context,
    ): Suggestion[] {
      function wrapNode(
        message: string,
        text: string,
        newPrecedence: keyof typeof OperatorPrecedence,
        targetNode: AST.AnyNode = node,
      ): Suggestion {
        const parentPrecedence =
          targetNode.parent.kind === SyntaxKind.CallExpression
            ? // We are repclaing a function argument, so parentehsis are never needed
              OperatorPrecedence.Lowest
            : getOperatorPrecedenceForNode(targetNode.parent as AST.AnyNode);
        const newText =
          parentPrecedence > OperatorPrecedence[newPrecedence]
          // Like Prettier, force wrap coallesce in ternaries
          || (targetNode.parent.kind === SyntaxKind.ConditionalExpression
            && newPrecedence === "Coalesce")
            ? `(${text})`
            : text;
        return { message, changes: [{ node: targetNode, newText }] };
      }
      function wrapParentNode(
        message: string,
        text: string,
        newPrecedence: keyof typeof OperatorPrecedence,
      ): Suggestion {
        return wrapNode(message, text, newPrecedence, node.parent);
      }

      const nodeText = node.getText();
      const nodePrecedence = getOperatorPrecedenceForNode(node);
      switch (conditionError) {
        case "conditionErrorAny":
          return [
            wrapNode(
              messages.conditionFixCastBoolean,
              `Boolean(${nodeText})`,
              "LeftHandSide",
            ),
          ];

        case "conditionErrorNullableBoolean":
          if (isLogicalNegationExpression(node.parent)) {
            // if (!nullableBoolean)
            return [
              wrapNode(
                messages.conditionFixDefaultFalse,
                `${nodeText} ?? false`,
                "Coalesce",
              ),
              wrapParentNode(
                messages.conditionFixCompareFalse,
                `${nodeText} === false`,
                "Equality",
              ),
            ];
          }
          // if (nullableBoolean)
          return [
            wrapNode(
              messages.conditionFixDefaultFalse,
              `${nodeText} ?? false`,
              "Coalesce",
            ),
            wrapNode(
              messages.conditionFixCompareTrue,
              `${nodeText} === true`,
              "Equality",
            ),
          ];

        case "conditionErrorNullableEnum":
          if (isLogicalNegationExpression(node.parent)) {
            return [
              wrapParentNode(
                messages.conditionFixCompareNullish,
                `${nodeText} == null`,
                "Equality",
              ),
            ];
          }
          return [
            wrapNode(
              messages.conditionFixCompareNullish,
              `${nodeText} != null`,
              "Equality",
            ),
          ];

        case "conditionErrorNullableNumber":
          if (isLogicalNegationExpression(node.parent)) {
            // if (!nullableNumber)
            return [
              wrapParentNode(
                messages.conditionFixCompareNullish,
                `${nodeText} == null`,
                "Equality",
              ),
              wrapNode(
                messages.conditionFixDefaultZero,
                `${nodeText} ?? 0`,
                "Coalesce",
              ),
              wrapNode(
                messages.conditionFixCastBoolean,
                `Boolean(${nodeText})`,
                "LeftHandSide",
              ),
            ];
          }
          // if (nullableNumber)
          return [
            wrapNode(
              messages.conditionFixCompareNullish,
              `${node.getText()} != null`,
              "Equality",
            ),
            wrapNode(
              messages.conditionFixDefaultZero,
              `${node.getText()} ?? 0`,
              "Coalesce",
            ),
            wrapNode(
              messages.conditionFixCastBoolean,
              `Boolean(${node.getText()})`,
              "LeftHandSide",
            ),
          ];

        case "conditionErrorNullableObject":
          if (isLogicalNegationExpression(node.parent)) {
            // if (!nullableObject)
            return [
              wrapParentNode(
                messages.conditionFixCompareNullish,
                `${nodeText} == null`,
                "Equality",
              ),
            ];
          }
          // if (nullableObject)
          return [
            wrapNode(
              messages.conditionFixCompareNullish,
              `${nodeText} != null`,
              "Equality",
            ),
          ];

        case "conditionErrorNullableString":
          if (isLogicalNegationExpression(node.parent)) {
            // if (!nullableString)
            return [
              wrapParentNode(
                messages.conditionFixCompareNullish,
                `${nodeText} == null`,
                "Equality",
              ),
              wrapNode(
                messages.conditionFixDefaultEmptyString,
                `${nodeText} ?? ""`,
                "Coalesce",
              ),
              wrapNode(
                messages.conditionFixCastBoolean,
                `Boolean(${nodeText})`,
                "LeftHandSide",
              ),
            ];
          }
          // if (nullableString)
          return [
            wrapNode(
              messages.conditionFixCompareNullish,
              `${nodeText} != null`,
              "Equality",
            ),
            wrapNode(
              messages.conditionFixDefaultEmptyString,
              `${nodeText} ?? ""`,
              "Coalesce",
            ),
            wrapNode(
              messages.conditionFixCastBoolean,
              `Boolean(${nodeText})`,
              "LeftHandSide",
            ),
          ];

        case "conditionErrorNumber":
          if (isArrayLengthExpression(context, node)) {
            if (isLogicalNegationExpression(node.parent)) {
              // if (!array.length)
              return [
                wrapParentNode(
                  messages.conditionFixCompareArrayLengthZero,
                  `${nodeText} === 0`,
                  "Equality",
                ),
              ];
            }
            // if (array.length)
            return [
              wrapNode(
                messages.conditionFixCompareArrayLengthNonzero,
                `${nodeText} > 0`,
                "Relational",
              ),
            ];
          }
          if (isLogicalNegationExpression(node.parent)) {
            // if (!number)
            return [
              wrapParentNode(
                messages.conditionFixCompareZero,
                `${nodeText} === 0`,
                "Equality",
              ),
              // TODO: don't suggest this for bigint because it can't be NaN
              wrapParentNode(
                messages.conditionFixCompareNaN,
                `Number.isNaN(${node.getText()})`,
                "LeftHandSide",
              ),
              wrapNode(
                messages.conditionFixCastBoolean,
                `Boolean(${node.getText()})`,
                "LeftHandSide",
              ),
            ];
          }
          // if (number)
          return [
            wrapNode(
              messages.conditionFixCompareZero,
              `${nodeText} !== 0`,
              "Equality",
            ),
            wrapNode(
              messages.conditionFixCompareNaN,
              `!Number.isNaN(${nodeText})`,
              "Unary",
            ),
            wrapNode(
              messages.conditionFixCastBoolean,
              `Boolean(${node.getText()})`,
              "LeftHandSide",
            ),
          ];

        case "conditionErrorString":
          if (isLogicalNegationExpression(node.parent)) {
            // if (!string)
            return [
              wrapParentNode(
                messages.conditionFixCompareStringLength,
                nodePrecedence < OperatorPrecedence.Member
                  ? `(${nodeText}).length === 0`
                  : `${nodeText}.length === 0`,
                "Equality",
              ),
              wrapParentNode(
                messages.conditionFixCompareEmptyString,
                `${nodeText} === ""`,
                "Equality",
              ),
              wrapNode(
                messages.conditionFixCastBoolean,
                `Boolean(${nodeText})`,
                "LeftHandSide",
              ),
            ];
          }
          // if (string)
          return [
            wrapNode(
              messages.conditionFixCompareStringLength,
              nodePrecedence < OperatorPrecedence.Member
                ? `(${nodeText}).length > 0`
                : `${nodeText}.length > 0`,
              "Relational",
            ),
            wrapNode(
              messages.conditionFixCompareEmptyString,
              `${nodeText} !== ""`,
              "Equality",
            ),
            wrapNode(
              messages.conditionFixCastBoolean,
              `Boolean(${node.getText()})`,
              "LeftHandSide",
            ),
          ];

        case "conditionErrorObject":
        case "conditionErrorNullish":
        case "conditionErrorOther":
          return [];
      }
    }

    /**
     * This function does the actual type check on a node.
     * It analyzes the type of a node and checks if it is allowed in a boolean context.
     */
    function checkNode(context: Context, node: AST.Expression): void {
      const type = context.utils.getConstrainedTypeAtLocation(node);
      const types = inspectVariantTypes(
        context,
        context.utils.unionConstituents(type),
      );
      const reportType = determineReportType(types);

      if (reportType != null) {
        context.report({
          node,
          message: messages[reportType]({ context: "conditional" }),
          suggestions: getSuggestionsForConditionError(
            node,
            reportType,
            context,
          ),
        });
      }
    }

    /** The types we care about */
    type VariantType =
      | "any"
      | "boolean"
      | "enum"
      | "never"
      | "nullish"
      | "number"
      | "object"
      | "string"
      | "truthy boolean"
      | "truthy number"
      | "truthy string";

    /**
     * Check union variants for the types we care about
     */
    function inspectVariantTypes(
      context: Context,
      types: ts.Type[],
    ): Set<VariantType> {
      const variantTypes = new Set<VariantType>();

      if (
        types.some((type) =>
          context.utils.typeHasFlag(
            type,
            ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.VoidLike,
          ),
        )
      ) {
        variantTypes.add("nullish");
      }
      const booleans = types.filter((type) =>
        context.utils.typeHasFlag(type, ts.TypeFlags.BooleanLike),
      );

      // If incoming type is either "true" or "false", there will be one type
      // object with intrinsicName set accordingly
      // If incoming type is boolean, there will be two type objects with
      // intrinsicName set "true" and "false" each because of ts-api-utils.context.utils.unionConstituents()
      if (booleans.length === 1) {
        variantTypes.add(
          isTrueLiteralType(booleans[0]) ? "truthy boolean" : "boolean",
        );
      } else if (booleans.length === 2) {
        variantTypes.add("boolean");
      }

      const strings = types.filter((type) =>
        context.utils.typeHasFlag(type, ts.TypeFlags.StringLike),
      );

      if (strings.length) {
        if (
          strings.every((type) => type.isStringLiteral() && type.value !== "")
        ) {
          variantTypes.add("truthy string");
        } else {
          variantTypes.add("string");
        }
      }

      const numbers = types.filter((type) =>
        context.utils.typeHasFlag(
          type,
          ts.TypeFlags.NumberLike | ts.TypeFlags.BigIntLike,
        ),
      );

      if (numbers.length) {
        if (
          numbers.every((type) => type.isNumberLiteral() && type.value !== 0)
        ) {
          variantTypes.add("truthy number");
        } else {
          variantTypes.add("number");
        }
      }

      if (
        types.some((type) =>
          context.utils.typeHasFlag(type, ts.TypeFlags.EnumLike),
        )
      ) {
        variantTypes.add("enum");
      }

      if (
        types.some(
          (type) =>
            !context.utils.typeHasFlag(
              type,
              ts.TypeFlags.Null
                | ts.TypeFlags.Undefined
                | ts.TypeFlags.VoidLike
                | ts.TypeFlags.BooleanLike
                | ts.TypeFlags.StringLike
                | ts.TypeFlags.NumberLike
                | ts.TypeFlags.BigIntLike
                | ts.TypeFlags.TypeParameter
                | ts.TypeFlags.Any
                | ts.TypeFlags.Unknown
                | ts.TypeFlags.Never,
            ),
        )
      ) {
        variantTypes.add(
          types.some((type) => isBrandedBoolean(context, type))
            ? "boolean"
            : "object",
        );
      }

      if (
        types.some((type) =>
          context.utils.typeHasFlag(
            type,
            ts.TypeFlags.TypeParameter
              | ts.TypeFlags.Any
              | ts.TypeFlags.Unknown,
          ),
        )
      ) {
        variantTypes.add("any");
      }

      if (
        types.some((type) =>
          context.utils.typeHasFlag(type, ts.TypeFlags.Never),
        )
      ) {
        variantTypes.add("never");
      }

      return variantTypes;
    }

    return {
      name: "core/strictBooleanExpressions",
      createData: () => ({ checkedNodes: new Set<ts.Node>() }),
      visitor: {
        CallExpression: traverseCallExpression,
        ConditionalExpression(context, node) {
          traverseNode(context, node.condition, true);
        },
        DoStatement(context, node) {
          traverseNode(context, node.expression, true);
        },
        ForStatement(context, node) {
          if (node.condition) {
            traverseNode(context, node.condition, true);
          }
        },
        IfStatement(context, node) {
          traverseNode(context, node.expression, true);
        },
        BinaryExpression(context, node) {
          if (
            node.operatorToken.kind === SyntaxKind.AmpersandAmpersandToken
            || node.operatorToken.kind === SyntaxKind.BarBarToken
          ) {
            traverseLogicalExpression(context, node, false);
          }
        },
        PrefixUnaryExpression(context, node) {
          if (node.operator === SyntaxKind.ExclamationToken) {
            traverseNode(context, node.operand, true);
          }
        },
        WhileStatement(context, node) {
          traverseNode(context, node.expression, true);
        },
      },
    };
  },
);

function isLogicalNegationExpression(
  node: AST.AnyNode,
): node is AST.PrefixUnaryExpression {
  return (
    node.kind === SyntaxKind.PrefixUnaryExpression
    && node.operator === SyntaxKind.ExclamationToken
  );
}

function isArrayLengthExpression(
  context: Context,
  node: AST.Expression,
): node is AST.PropertyAccessExpression {
  if (node.kind !== SyntaxKind.PropertyAccessExpression) {
    return false;
  }
  if (node.name.text !== "length") {
    return false;
  }
  const objectType = context.utils.getConstrainedTypeAtLocation(
    node.expression,
  );
  return context.utils
    .unionConstituents(objectType)
    .every((part) => context.checker.isArrayType(part));
}

/**
 * Verify is the type is a branded boolean (e.g. `type Foo = boolean & { __brand: 'Foo' }`)
 *
 * @param type The type checked
 */
function isBrandedBoolean(context: Context, type: ts.Type): boolean {
  return (
    type.isIntersection()
    && type.types.some((childType) => isBooleanType(context, childType))
  );
}

function isBooleanType(context: Context, expressionType: ts.Type): boolean {
  return context.utils.typeHasFlag(
    expressionType,
    ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral,
  );
}
