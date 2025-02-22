import {
  getCallSignaturesOfType,
  intersectionTypeParts,
  isBooleanLiteralType,
  isFalseLiteralType,
  isFalsyType,
  isSymbolFlagSet,
  isTrueLiteralType,
  isTypeParameter,
  unionTypeParts,
} from "ts-api-utils";
import ts, { SyntaxKind, TypeFlags } from "typescript";
import {
  getTypeName,
  getValueOfLiteralType,
  isArrayMethodCallWithPredicate,
  isLiteralKind,
  isLogicalExpression,
  isTypeRecurser,
  typeHasFlag,
} from "../_utils/index.ts";
import { createRule } from "../../index.ts";
import type { AST, Checker, Context } from "../../types.ts";

export const messages = {
  alwaysFalsy: "Unnecessary conditional, value is always falsy.",
  alwaysFalsyFunc:
    "This callback should return a conditional, but return is always falsy.",
  alwaysNullish:
    "Unnecessary conditional, left-hand side of `??` operator is always `null` or `undefined`.",
  alwaysTruthy: "Unnecessary conditional, value is always truthy.",
  alwaysTruthyFunc:
    "This callback should return a conditional, but return is always truthy.",
  comparisonBetweenLiteralTypes: (params: {
    trueOrFalse: string;
    left: string;
    operator: string;
    right: string;
  }) =>
    `Unnecessary conditional, comparison is always ${params.trueOrFalse}, since ${params.left} ${params.operator} ${params.right} is ${params.trueOrFalse}.`,
  never: "Unnecessary conditional, value is `never`.",
  neverNullish:
    "Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined.",
  neverOptionalChain: "Unnecessary optional chain on a non-nullish value.",
  noOverlapBooleanExpression:
    "Unnecessary conditional, the types have no overlap.",
  typeGuardAlreadyIsType: (params: { typeGuardOrAssertionFunction: string }) =>
    `Unnecessary conditional, expression already has the type being checked by the ${params.typeGuardOrAssertionFunction}.`,
  removeOptionalChain: "Remove unnecessary optional chain.",
};

export type NoUnnecessaryConditionOptions = {
  /**
   * Whether to ignore constant loop conditions, such as `while (true)`.
   * @default "never"
   */
  allowConstantLoopConditions?: "always" | "never" | "only-allowed-literals";
  /**
   * Whether to check the asserted argument of a type predicate function for unnecessary conditions.
   * @default false
   */
  checkTypePredicates?: boolean;
};

type ParsedOptions = {
  allowConstantLoopConditions: "always" | "never" | "only-allowed-literals";
  checkTypePredicates: boolean;
};

export const noUnnecessaryCondition = createRule(
  (_options?: NoUnnecessaryConditionOptions) => {
    const options: ParsedOptions = {
      allowConstantLoopConditions: "never",
      checkTypePredicates: false,
      ..._options,
    };
    return {
      name: "core/noUnnecessaryCondition",
      visitor: {
        BinaryExpression(node, context) {
          switch (node.operatorToken.kind) {
            case SyntaxKind.BarBarEqualsToken:
            case SyntaxKind.AmpersandAmpersandEqualsToken:
              // Similar to checkLogicalExpressionForUnnecessaryConditionals, since
              // a ||= b is equivalent to a || (a = b)
              checkNode(node.left, context);
              break;
            case SyntaxKind.QuestionQuestionEqualsToken:
              checkNodeForNullish(node.left, context);
              break;
            case SyntaxKind.QuestionQuestionToken:
              checkNodeForNullish(node.left, context);
              break;
            case SyntaxKind.BarBarToken:
            case SyntaxKind.AmpersandAmpersandToken:
              // Only checks the left side, since the right side might not be "conditional" at all.
              // The right side will be checked if the LogicalExpression is used in a conditional context
              checkNode(node.left, context);
              break;
            case SyntaxKind.LessThanToken:
            case SyntaxKind.GreaterThanToken:
            case SyntaxKind.LessThanEqualsToken:
            case SyntaxKind.GreaterThanEqualsToken:
            case SyntaxKind.EqualsEqualsToken:
            case SyntaxKind.EqualsEqualsEqualsToken:
            case SyntaxKind.ExclamationEqualsToken:
            case SyntaxKind.ExclamationEqualsEqualsToken:
              checkIfBoolExpressionIsNecessaryConditional(
                node,
                node.left,
                node.right,
                node.operatorToken.kind,
                context,
              );
              break;
            default:
              break;
          }
        },
        CallExpression(node, context) {
          checkCallExpression(node, context, options);
        },
        ConditionalExpression(node, context) {
          checkNode(node.condition, context);
        },
        DoStatement(node, context) {
          checkIfLoopIsNecessaryConditional(node.expression, context, options);
        },
        ForStatement(node, context) {
          if (node.condition) {
            checkIfLoopIsNecessaryConditional(node.condition, context, options);
          }
        },
        IfStatement(node, context) {
          checkNode(node.expression, context);
        },
        PropertyAccessExpression(node, context) {
          if (node.questionDotToken) {
            checkOptionalChain(node, ".", context);
          }
        },
        ElementAccessExpression(node, context) {
          if (node.questionDotToken) {
            checkOptionalChain(node, "", context);
          }
        },
        CaseClause(node, context) {
          checkIfBoolExpressionIsNecessaryConditional(
            node.expression,
            node.parent.parent.expression,
            node.expression,
            SyntaxKind.EqualsEqualsEqualsToken,
            context,
          );
        },
        WhileStatement(node, context) {
          if (
            options.allowConstantLoopConditions === "only-allowed-literals" &&
            (node.expression.kind === SyntaxKind.TrueKeyword ||
              node.expression.kind === SyntaxKind.FalseKeyword ||
              (node.expression.kind === SyntaxKind.NumericLiteral &&
                (node.expression.text === "0" || node.expression.text === "1")))
          ) {
            return;
          }

          checkIfLoopIsNecessaryConditional(node.expression, context, options);
        },
      },
    };
  },
);

function nodeIsArrayType(node: AST.Expression, context: Context): boolean {
  const nodeType = context.utils.getConstrainedTypeAtLocation(node);
  return unionTypeParts(nodeType).some((part) =>
    context.checker.isArrayType(part),
  );
}

function nodeIsTupleType(node: AST.Expression, context: Context): boolean {
  const nodeType = context.utils.getConstrainedTypeAtLocation(node);
  return unionTypeParts(nodeType).some((part) =>
    context.checker.isTupleType(part),
  );
}

function isArrayIndexExpression(
  node: AST.Expression,
  context: Context,
): boolean {
  return (
    // Is an index signature
    node.kind === SyntaxKind.ElementAccessExpression &&
    // ...into an array type
    (nodeIsArrayType(node.expression, context) ||
      // ... or a tuple type
      (nodeIsTupleType(node.expression, context) &&
        // Exception: literal index into a tuple - will have a sound type
        !isLiteralKind(node.argumentExpression.kind)))
  );
}

// Conditional is always necessary if it involves:
//    `any` or `unknown` or a naked type variable
function isConditionalAlwaysNecessary(type: ts.Type): boolean {
  return typeHasFlag(
    type,
    TypeFlags.Any | TypeFlags.Unknown | TypeFlags.TypeVariable,
  );
}

function isNullableMemberExpression(
  node: AST.PropertyAccessExpression | AST.ElementAccessExpression,
  context: Context,
): boolean {
  const objectType = context.checker.getTypeAtLocation(node.expression);
  if (node.kind === SyntaxKind.ElementAccessExpression) {
    const propertyType = context.checker.getTypeAtLocation(
      node.argumentExpression,
    );
    return isNullablePropertyType(context, objectType, propertyType);
  }
  const property = node.name;

  // Get the actual property name, to account for private properties (this.#prop).
  const propertyName = property.getText();

  const propertyType = objectType
    .getProperties()
    .find((prop) => prop.name === propertyName);

  if (propertyType && isSymbolFlagSet(propertyType, ts.SymbolFlags.Optional)) {
    return true;
  }

  return false;
}

/**
 * Checks if a conditional node is necessary:
 * if the type of the node is always true or always false, it's not necessary.
 */
function checkNode(
  expression: AST.Expression,
  context: Context,
  isUnaryNotArgument = false,
  node = expression,
): void {
  // Check if the node is Unary Negation expression and handle it
  if (expression.kind === SyntaxKind.PrefixUnaryExpression) {
    checkNode(expression.operand, context, !isUnaryNotArgument, node);
    return;
  }

  // Since typescript array index signature types don't represent the
  //  possibility of out-of-bounds access, if we're indexing into an array
  //  just skip the check, to avoid false positives
  if (isArrayIndexExpression(expression, context)) {
    return;
  }

  // When checking logical expressions, only check the right side
  //  as the left side has been checked by checkLogicalExpressionForUnnecessaryConditionals
  //
  // Unless the node is nullish coalescing, as it's common to use patterns like `nullBool ?? true` to to strict
  //  boolean checks if we inspect the right here, it'll usually be a constant condition on purpose.
  // In this case it's better to inspect the type of the expression as a whole.
  if (
    expression.kind === SyntaxKind.BinaryExpression &&
    isLogicalExpression(expression.operatorToken) &&
    expression.operatorToken.kind !== SyntaxKind.QuestionQuestionToken
  ) {
    checkNode(expression.right, context);
    return;
  }

  const type = context.utils.getConstrainedTypeAtLocation(expression);

  if (isConditionalAlwaysNecessary(type)) {
    return;
  }
  let message: string | null = null;

  if (typeHasFlag(type, ts.TypeFlags.Never)) {
    message = messages.never;
  } else if (!isPossiblyTruthy(type)) {
    message = !isUnaryNotArgument
      ? messages.alwaysFalsy
      : messages.alwaysTruthy;
  } else if (!isPossiblyFalsy(type)) {
    message = !isUnaryNotArgument
      ? messages.alwaysTruthy
      : messages.alwaysFalsy;
  }

  if (message) {
    context.report({ node, message });
  }
}

function checkNodeForNullish(node: AST.Expression, context: Context): void {
  const type = context.utils.getConstrainedTypeAtLocation(node);

  // Conditional is always necessary if it involves `any`, `unknown` or a naked type parameter
  if (
    typeHasFlag(
      type,
      ts.TypeFlags.Any |
        ts.TypeFlags.Unknown |
        ts.TypeFlags.TypeParameter |
        ts.TypeFlags.TypeVariable,
    )
  ) {
    return;
  }

  let message: string | null = null;
  if (typeHasFlag(type, ts.TypeFlags.Never)) {
    message = messages.never;
  } else if (
    !isPossiblyNullish(type) &&
    !(
      (node.kind === SyntaxKind.PropertyAccessExpression ||
        node.kind === SyntaxKind.ElementAccessExpression) &&
      isNullableMemberExpression(node, context)
    )
  ) {
    // Since typescript array index signature types don't represent the
    //  possibility of out-of-bounds access, if we're indexing into an array
    //  just skip the check, to avoid false positives
    if (
      !isArrayIndexExpression(node, context) &&
      !(
        node.kind === SyntaxKind.PropertyAccessExpression &&
        optionChainContainsOptionArrayIndex(node, context)
      )
    ) {
      message = messages.neverNullish;
    }
  } else if (isAlwaysNullish(type)) {
    message = messages.alwaysNullish;
  }

  if (message) {
    context.report({ node, message });
  }
}

/**
 * Checks that a binary expression is necessarily conditional, reports otherwise.
 * If both sides of the binary expression are literal values, it's not a necessary condition.
 *
 * NOTE: It's also unnecessary if the types that don't overlap at all
 *    but that case is handled by the Typescript compiler itself.
 *    Known exceptions:
 *      - https://github.com/microsoft/TypeScript/issues/32627
 *      - https://github.com/microsoft/TypeScript/issues/37160 (handled)
 */
function checkIfBoolExpressionIsNecessaryConditional(
  node: AST.Expression,
  left: AST.Expression,
  right: AST.Expression,
  operator: BooleanOperator,
  context: Context,
): void {
  const leftType = context.utils.getConstrainedTypeAtLocation(left);
  const rightType = context.utils.getConstrainedTypeAtLocation(right);

  const leftStaticValue = toStaticValue(leftType);
  const rightStaticValue = toStaticValue(rightType);

  if (leftStaticValue != null && rightStaticValue != null) {
    const conditionIsTrue = booleanComparison(
      leftStaticValue.value,
      operator,
      rightStaticValue.value,
    );

    context.report({
      node,
      message: messages.comparisonBetweenLiteralTypes({
        trueOrFalse: conditionIsTrue ? "true" : "false",
        left: context.checker.typeToString(leftType),
        operator: displayBooleanOperator(operator),
        right: context.checker.typeToString(rightType),
      }),
    });
    return;
  }

  // Workaround for https://github.com/microsoft/TypeScript/issues/37160
  const UNDEFINED = ts.TypeFlags.Undefined;
  const NULL = ts.TypeFlags.Null;
  const VOID = ts.TypeFlags.Void;
  const isComparable = (type: ts.Type, flag: ts.TypeFlags): boolean => {
    // Allow comparison to `any`, `unknown` or a naked type parameter.
    flag |=
      ts.TypeFlags.Any |
      ts.TypeFlags.Unknown |
      ts.TypeFlags.TypeParameter |
      ts.TypeFlags.TypeVariable;

    // Allow loose comparison to nullish values.
    if (
      operator === SyntaxKind.EqualsEqualsToken ||
      operator === SyntaxKind.ExclamationEqualsToken
    ) {
      flag |= NULL | UNDEFINED | VOID;
    }

    return typeHasFlag(type, flag);
  };

  if (
    (leftType.flags === UNDEFINED &&
      !isComparable(rightType, UNDEFINED | VOID)) ||
    (rightType.flags === UNDEFINED &&
      !isComparable(leftType, UNDEFINED | VOID)) ||
    (leftType.flags === NULL && !isComparable(rightType, NULL)) ||
    (rightType.flags === NULL && !isComparable(leftType, NULL))
  ) {
    context.report({
      node,
      message: messages.noOverlapBooleanExpression,
    });
    return;
  }
}

/**
 * Checks that a testable expression of a loop is necessarily conditional, reports otherwise.
 */
function checkIfLoopIsNecessaryConditional(
  testNode: AST.Expression,
  context: Context,
  options: ParsedOptions,
): void {
  if (
    options.allowConstantLoopConditions === "always" &&
    isTrueLiteralType(context.utils.getConstrainedTypeAtLocation(testNode))
  ) {
    return;
  }

  checkNode(testNode, context);
}

function checkCallExpression(
  node: AST.CallExpression,
  context: Context,
  options: ParsedOptions,
): void {
  if (node.questionDotToken) {
    checkOptionalChain(node, "", context);
  }

  if (options.checkTypePredicates) {
    const truthinessAssertedArgument = findTruthinessAssertedArgument(
      context,
      node,
    );
    if (truthinessAssertedArgument != null) {
      checkNode(truthinessAssertedArgument, context);
    }

    const typeGuardAssertedArgument = findTypeGuardAssertedArgument(
      context,
      node,
    );
    if (typeGuardAssertedArgument != null) {
      const typeOfArgument = context.utils.getConstrainedTypeAtLocation(
        typeGuardAssertedArgument.argument,
      );
      if (typeOfArgument === typeGuardAssertedArgument.type) {
        context.report({
          node: typeGuardAssertedArgument.argument,
          message: messages.typeGuardAlreadyIsType({
            typeGuardOrAssertionFunction: typeGuardAssertedArgument.asserts
              ? "assertion function"
              : "type guard",
          }),
        });
      }
    }
  }

  // If this is something like arr.filter(x => /*condition*/), check `condition`
  if (isArrayMethodCallWithPredicate(context, node) && node.arguments.length) {
    const callback = node.arguments[0];
    // Inline defined functions
    if (
      callback.kind === SyntaxKind.ArrowFunction ||
      callback.kind === SyntaxKind.FunctionExpression
    ) {
      // Two special cases, where we can directly check the node that's returned:
      // () => something
      if (callback.body.kind !== SyntaxKind.Block) {
        checkNode(callback.body, context);
        return;
      }
      // () => { return something; }
      const callbackBody = callback.body.statements;
      if (
        callbackBody.length === 1 &&
        callbackBody[0].kind === SyntaxKind.ReturnStatement &&
        callbackBody[0].expression
      ) {
        checkNode(callbackBody[0].expression, context);
        return;
      }
      // Potential enhancement: could use code-path analysis to check
      //   any function with a single return statement
      // (Value to complexity ratio is dubious however)
    }
    // Otherwise just do type analysis on the function as a whole.
    const returnTypes = getCallSignaturesOfType(
      context.utils.getConstrainedTypeAtLocation(callback),
    ).map((sig) => {
      const returnType = sig.getReturnType();
      if (isTypeParameter(returnType)) {
        return context.checker.getBaseConstraintOfType(returnType);
      }
      return returnType;
    });

    if (returnTypes.length === 0) {
      // Not a callable function, e.g. `any`
      return;
    }

    let hasFalsyReturnTypes = false;
    let hasTruthyReturnTypes = false;

    for (const type of returnTypes) {
      // Predicate is always necessary if it involves `any` or `unknown`
      if (
        !type ||
        typeHasFlag(type, TypeFlags.Any) ||
        typeHasFlag(type, TypeFlags.Unknown)
      ) {
        return;
      }

      if (isPossiblyFalsy(type)) {
        hasFalsyReturnTypes = true;
      }

      if (isPossiblyTruthy(type)) {
        hasTruthyReturnTypes = true;
      }

      // bail early if both a possibly-truthy and a possibly-falsy have been detected
      if (hasFalsyReturnTypes && hasTruthyReturnTypes) {
        return;
      }
    }

    if (!hasFalsyReturnTypes) {
      context.report({
        node: callback,
        message: messages.alwaysTruthyFunc,
      });
      return;
    }

    if (!hasTruthyReturnTypes) {
      context.report({
        node: callback,
        message: messages.alwaysFalsyFunc,
      });
      return;
    }
  }
}

/**
 * Inspect a call expression to see if it's a call to an assertion function.
 * If it is, return the node of the argument that is asserted.
 */
export function findTruthinessAssertedArgument(
  context: Context,
  node: AST.CallExpression,
): AST.Expression | undefined {
  // If the call looks like `assert(expr1, expr2, ...c, d, e, f)`, then we can
  // only care if `expr1` or `expr2` is asserted, since anything that happens
  // within or after a spread argument is out of scope to reason about.
  const checkableArguments: AST.Expression[] = [];
  for (const argument of node.arguments) {
    if (argument.kind === SyntaxKind.SpreadElement) {
      break;
    }
    checkableArguments.push(argument);
  }

  // nothing to do
  if (checkableArguments.length === 0) {
    return undefined;
  }

  const signature = context.checker.getResolvedSignature(node);

  if (signature == null) {
    return undefined;
  }

  const firstTypePredicateResult =
    context.checker.getTypePredicateOfSignature(signature);

  if (firstTypePredicateResult == null) {
    return undefined;
  }

  const { kind, parameterIndex, type } = firstTypePredicateResult;
  if (!(kind === ts.TypePredicateKind.AssertsIdentifier && type == null)) {
    return undefined;
  }

  return checkableArguments.at(parameterIndex);
}

/**
 * Inspect a call expression to see if it's a call to an assertion function.
 * If it is, return the node of the argument that is asserted and other useful info.
 */
export function findTypeGuardAssertedArgument(
  context: Context,
  node: AST.CallExpression,
): { argument: AST.Expression; asserts: boolean; type: ts.Type } | undefined {
  // If the call looks like `assert(expr1, expr2, ...c, d, e, f)`, then we can
  // only care if `expr1` or `expr2` is asserted, since anything that happens
  // within or after a spread argument is out of scope to reason about.
  const checkableArguments: AST.Expression[] = [];
  for (const argument of node.arguments) {
    if (argument.kind === SyntaxKind.SpreadElement) {
      break;
    }
    checkableArguments.push(argument);
  }

  // nothing to do
  if (checkableArguments.length === 0) {
    return undefined;
  }

  const callSignature = context.checker.getResolvedSignature(node);

  if (callSignature == null) {
    return undefined;
  }

  const typePredicateInfo =
    context.checker.getTypePredicateOfSignature(callSignature);

  if (typePredicateInfo == null) {
    return undefined;
  }

  const { kind, parameterIndex, type } = typePredicateInfo;
  if (
    !(
      (kind === ts.TypePredicateKind.AssertsIdentifier ||
        kind === ts.TypePredicateKind.Identifier) &&
      type != null
    )
  ) {
    return undefined;
  }

  if (parameterIndex >= checkableArguments.length) {
    return undefined;
  }

  return {
    argument: checkableArguments[parameterIndex],
    asserts: kind === ts.TypePredicateKind.AssertsIdentifier,
    type,
  };
}

function optionChainContainsOptionArrayIndex(
  node:
    | AST.CallExpression
    | AST.PropertyAccessExpression
    | AST.ElementAccessExpression,
  context: Context,
): boolean {
  return (
    node.questionDotToken !== undefined &&
    isArrayIndexExpression(node.expression, context)
  );
}

function isNullablePropertyType(
  context: Context,
  objType: ts.Type,
  propertyType: ts.Type,
): boolean {
  if (propertyType.isUnion()) {
    return propertyType.types.some((type) =>
      isNullablePropertyType(context, objType, type),
    );
  }
  if (propertyType.isNumberLiteral() || propertyType.isStringLiteral()) {
    const propType = getTypeOfPropertyOfName(
      context.checker,
      objType,
      propertyType.value.toString(),
    );
    if (propType) {
      return isNullableType(propType);
    }
  }
  const typeName = getTypeName(context.rawChecker, propertyType);
  return context.checker
    .getIndexInfosOfType(objType)
    .some((info) => getTypeName(context.rawChecker, info.keyType) === typeName);
}

function isNullableType(type: ts.Type): boolean {
  return typeHasFlag(
    type,
    TypeFlags.Any |
      TypeFlags.Unknown |
      TypeFlags.Null |
      TypeFlags.Undefined |
      TypeFlags.Void,
  );
}

function getTypeOfPropertyOfName(
  checker: Checker,
  type: ts.Type,
  name: string,
  escapedName?: ts.__String,
): ts.Type | undefined {
  // Most names are directly usable in the checker and aren't different from escaped names
  if (
    !escapedName ||
    !(escapedName.startsWith("__@") || escapedName.startsWith("__#"))
  ) {
    return checker.getTypeOfPropertyOfType(type, name);
  }

  // Symbolic names may differ in their escaped name compared to their human-readable name
  // https://github.com/typescript-eslint/typescript-eslint/issues/2143
  const escapedProperty = type
    .getProperties()
    .find((property) => property.escapedName === escapedName);

  return escapedProperty
    ? checker.getDeclaredTypeOfSymbol(escapedProperty)
    : undefined;
}

// Checks whether a member expression is nullable or not regardless of it's previous node.
//  Example:
//  ```
//  // 'bar' is nullable if 'foo' is null.
//  // but this function checks regardless of 'foo' type, so returns 'true'.
//  declare const foo: { bar : { baz: string } } | null
//  foo?.bar;
//  ```
function isMemberExpressionNullableOriginFromObject(
  node: AST.PropertyAccessExpression | AST.ElementAccessExpression,
  context: Context,
): boolean {
  const prevType = context.utils.getConstrainedTypeAtLocation(node.expression);
  const property =
    node.kind === SyntaxKind.PropertyAccessExpression
      ? node.name
      : node.argumentExpression;
  if (prevType.isUnion() && property.kind === SyntaxKind.Identifier) {
    const isOwnNullable = prevType.types.some((type) => {
      if (node.kind === SyntaxKind.ElementAccessExpression) {
        const propertyType = context.utils.getConstrainedTypeAtLocation(
          node.argumentExpression,
        );
        return isNullablePropertyType(context, type, propertyType);
      }
      const propType = getTypeOfPropertyOfName(
        context.checker,
        type,
        property.text,
      );

      if (propType) {
        return isNullableType(propType);
      }

      const usingNoUncheckedIndexedAccess =
        context.compilerOptions.noUncheckedIndexedAccess ?? false;

      return context.checker.getIndexInfosOfType(type).some((info) => {
        const isStringTypeName =
          getTypeName(context.rawChecker, info.keyType) === "string";
        return (
          isStringTypeName &&
          (usingNoUncheckedIndexedAccess || isNullableType(info.type))
        );
      });
    });
    return !isOwnNullable && isNullableType(prevType);
  }
  return false;
}

function isCallExpressionNullableOriginFromCallee(
  node: AST.CallExpression,
  context: Context,
): boolean {
  const prevType = context.utils.getConstrainedTypeAtLocation(node.expression);

  if (prevType.isUnion()) {
    const isOwnNullable = prevType.types.some((type) => {
      const signatures = type.getCallSignatures();
      return signatures.some((sig) => isNullableType(sig.getReturnType()));
    });
    return !isOwnNullable && isNullableType(prevType);
  }

  return false;
}

function isOptionableExpression(
  node: AST.Expression,
  context: Context,
): boolean {
  const type = context.utils.getConstrainedTypeAtLocation(node);
  const isOwnNullable =
    node.kind === SyntaxKind.PropertyAccessExpression ||
    node.kind === SyntaxKind.ElementAccessExpression
      ? !isMemberExpressionNullableOriginFromObject(node, context)
      : node.kind === SyntaxKind.CallExpression
      ? !isCallExpressionNullableOriginFromCallee(node, context)
      : true;

  return (
    isConditionalAlwaysNecessary(type) ||
    (isOwnNullable && isNullableType(type))
  );
}

function checkOptionalChain(
  node:
    | AST.CallExpression
    | AST.PropertyAccessExpression
    | AST.ElementAccessExpression,
  fix: "" | ".",
  context: Context,
): void {
  // Since typescript array index signature types don't represent the
  //  possibility of out-of-bounds access, if we're indexing into an array
  //  just skip the check, to avoid false positives
  if (optionChainContainsOptionArrayIndex(node, context)) {
    return;
  }

  if (isOptionableExpression(node.expression, context)) {
    return;
  }

  context.report({
    node: node.questionDotToken!,
    message: messages.neverOptionalChain,
    suggestions: [
      {
        message: messages.removeOptionalChain,
        changes: [{ node: node.questionDotToken!, newText: fix }],
      },
    ],
  });
}

// Truthiness utilities
export function isPossiblyFalsy(type: ts.Type): boolean {
  return isTypeRecurser(type, (t) => {
    return t.isLiteral()
      ? !getValueOfLiteralType(t)
      : t.flags === TypeFlags.Any ||
          t.flags === TypeFlags.Unknown ||
          t.flags === TypeFlags.Null ||
          t.flags === TypeFlags.Undefined ||
          t.flags === TypeFlags.Void ||
          t.flags === TypeFlags.String ||
          t.flags === TypeFlags.Number ||
          t.flags === TypeFlags.BigInt ||
          t.flags === TypeFlags.Boolean ||
          isFalseLiteralType(t);
  });
}

const isPossiblyTruthy = (type: ts.Type): boolean =>
  unionTypeParts(type).some((type) =>
    // It is possible to define intersections that are always falsy,
    // like `"" & { __brand: string }`.
    intersectionTypeParts(type).every((t2) => !isFalsyType(t2)),
  );

// Nullish utilities
const nullishFlag = ts.TypeFlags.Undefined | ts.TypeFlags.Null;
const isNullishType = (type: ts.Type): boolean =>
  typeHasFlag(type, nullishFlag);

const isPossiblyNullish = (type: ts.Type): boolean =>
  unionTypeParts(type).some(isNullishType);

const isAlwaysNullish = (type: ts.Type): boolean =>
  unionTypeParts(type).every(isNullishType);

function toStaticValue(
  type: ts.Type,
):
  | { value: bigint | boolean | number | string | null | undefined }
  | undefined {
  // type.isLiteral() only covers numbers/bigints and strings, hence the rest of the branches.
  if (isBooleanLiteralType(type)) {
    return { value: isTrueLiteralType(type) };
  }
  if (type.flags === ts.TypeFlags.Undefined) {
    return { value: undefined };
  }
  if (type.flags === ts.TypeFlags.Null) {
    return { value: null };
  }
  if (type.isLiteral()) {
    return { value: getValueOfLiteralType(type) };
  }

  return undefined;
}

type BooleanOperator =
  | SyntaxKind.ExclamationEqualsToken
  | SyntaxKind.ExclamationEqualsEqualsToken
  | SyntaxKind.LessThanToken
  | SyntaxKind.LessThanEqualsToken
  | SyntaxKind.EqualsEqualsToken
  | SyntaxKind.EqualsEqualsEqualsToken
  | SyntaxKind.GreaterThanToken
  | SyntaxKind.GreaterThanEqualsToken;
function booleanComparison(
  left: unknown,
  operator: BooleanOperator,
  right: unknown,
): boolean {
  switch (operator) {
    case SyntaxKind.ExclamationEqualsToken:
      // eslint-disable-next-line eqeqeq -- intentionally comparing with loose equality
      return left != right;
    case SyntaxKind.ExclamationEqualsEqualsToken:
      return left !== right;
    case SyntaxKind.LessThanToken:
      // @ts-expect-error: we don't care if the comparison seems unintentional.
      return left < right;
    case SyntaxKind.LessThanEqualsToken:
      // @ts-expect-error: we don't care if the comparison seems unintentional.
      return left <= right;
    case SyntaxKind.EqualsEqualsToken:
      // eslint-disable-next-line eqeqeq -- intentionally comparing with loose equality
      return left == right;
    case SyntaxKind.EqualsEqualsEqualsToken:
      return left === right;
    case SyntaxKind.GreaterThanToken:
      // @ts-expect-error: we don't care if the comparison seems unintentional.
      return left > right;
    case SyntaxKind.GreaterThanEqualsToken:
      // @ts-expect-error: we don't care if the comparison seems unintentional.
      return left >= right;
  }
}

function displayBooleanOperator(operator: BooleanOperator) {
  switch (operator) {
    case SyntaxKind.ExclamationEqualsToken:
      return "!=";
    case SyntaxKind.ExclamationEqualsEqualsToken:
      return "!==";
    case SyntaxKind.LessThanToken:
      return "<";
    case SyntaxKind.LessThanEqualsToken:
      return "<=";
    case SyntaxKind.EqualsEqualsToken:
      return "==";
    case SyntaxKind.EqualsEqualsEqualsToken:
      return "===";
    case SyntaxKind.GreaterThanToken:
      return ">";
    case SyntaxKind.GreaterThanEqualsToken:
      return ">=";
  }
}
