import {
  getCallSignaturesOfType,
  intersectionTypeParts,
  isBooleanLiteralType,
  isFalsyType,
  isLiteralType,
  isSymbolFlagSet,
  isTrueLiteralType,
  unionTypeParts,
} from "ts-api-utils";
import ts, { SyntaxKind, TypeFlags } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import { typeHasFlag } from "../types-utils.ts";
import type { AST, Checker, Context } from "../types.ts";
import {
  getTypeName,
  isArrayMethodCallWithPredicate,
  isLiteralKind,
  isLogicalExpression,
} from "./_utils";

const messages = {
  alwaysFalsy: "Unnecessary conditional, value is always falsy.",
  alwaysFalsyFunc:
    "This callback should return a conditional, but return is always falsy.",
  alwaysNullish:
    "Unnecessary conditional, left-hand side of `??` operator is always `null` or `undefined`.",
  alwaysTruthy: "Unnecessary conditional, value is always truthy.",
  alwaysTruthyFunc:
    "This callback should return a conditional, but return is always truthy.",
  literalBooleanExpression: (params: { trueOrFalse: string }) =>
    `Unnecessary conditional, comparison is always ${params.trueOrFalse}. Both sides of the comparison always have a literal type.`,
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

type ParsedOptions = {
  allowConstantLoopConditions: boolean;
  checkTypePredicates: boolean;
};

export const noUnnecessaryCondition = createRule(
  (_options?: {
    allowConstantLoopConditions?: boolean;
    checkTypePredicates?: boolean;
  }) => {
    const options: ParsedOptions = {
      allowConstantLoopConditions: false,
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

  // Conditional is always necessary if it involves:
  //    `any` or `unknown` or a naked type variable
  if (
    typeHasFlag(
      type,
      TypeFlags.Any | TypeFlags.Unknown | TypeFlags.TypeVariable,
    )
  ) {
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
      message: messages.literalBooleanExpression({
        trueOrFalse: conditionIsTrue ? "true" : "false",
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
  /**
   * Allow:
   *   while (true) {}
   *   for (;true;) {}
   *   do {} while (true)
   */
  if (
    options.allowConstantLoopConditions &&
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
    ).map((sig) => sig.getReturnType());
    /* istanbul ignore if */ if (returnTypes.length === 0) {
      // Not a callable function
      return;
    }
    // Predicate is always necessary if it involves `any` or `unknown`
    if (
      returnTypes.some(
        (t) =>
          typeHasFlag(t, TypeFlags.Any) || typeHasFlag(t, TypeFlags.Unknown),
      )
    ) {
      return;
    }
    if (!returnTypes.some(isPossiblyFalsy)) {
      context.report({
        node: callback,
        message: messages.alwaysTruthyFunc,
      });
      return;
    }
    if (!returnTypes.some(isPossiblyTruthy)) {
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

      return !!context.checker.getIndexInfoOfType(type, ts.IndexKind.String);
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
    typeHasFlag(type, TypeFlags.Any | TypeFlags.Unknown) ||
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
const valueIsPseudoBigInt = (
  value: number | string | ts.PseudoBigInt,
): value is ts.PseudoBigInt => {
  return typeof value === "object";
};

const getValueOfLiteralType = (
  type: ts.LiteralType,
): bigint | number | string => {
  if (valueIsPseudoBigInt(type.value)) {
    return pseudoBigIntToBigInt(type.value);
  }
  return type.value;
};

const isFalsyBigInt = (type: ts.Type): boolean => {
  return (
    isLiteralType(type) &&
    valueIsPseudoBigInt(type.value) &&
    !getValueOfLiteralType(type)
  );
};
const isTruthyLiteral = (type: ts.Type): boolean =>
  isTrueLiteralType(type) ||
  (type.isLiteral() && !!getValueOfLiteralType(type));

const isPossiblyFalsy = (type: ts.Type): boolean =>
  unionTypeParts(type)
    // Intersections like `string & {}` can also be possibly falsy,
    // requiring us to look into the intersection.
    .flatMap((type) => intersectionTypeParts(type))
    // PossiblyFalsy flag includes literal values, so exclude ones that
    // are definitely truthy
    .filter((t) => !isTruthyLiteral(t))
    .some((type) => typeHasFlag(type, ts.TypeFlags.PossiblyFalsy));

const isPossiblyTruthy = (type: ts.Type): boolean =>
  unionTypeParts(type)
    .map((type) => intersectionTypeParts(type))
    .some((intersectionParts) =>
      // It is possible to define intersections that are always falsy,
      // like `"" & { __brand: string }`.
      intersectionParts.every(
        (type) =>
          !isFalsyType(type) &&
          // below is a workaround for ts-api-_utils bug
          // see https://github.com/JoshuaKGoldberg/ts-api-utils/issues/544
          !isFalsyBigInt(type),
      ),
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
    // Using `type.intrinsicName` instead of `type.value` because `type.value`
    // is `undefined`, contrary to what the type guard tells us.
    // See https://github.com/JoshuaKGoldberg/ts-api-utils/issues/528
    return { value: type.intrinsicName === "true" };
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

function pseudoBigIntToBigInt(value: ts.PseudoBigInt): bigint {
  return BigInt((value.negative ? "-" : "") + value.base10Value);
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

/** Tests */

const necessaryConditionTest = (condition: string): string => `
declare const b1: ${condition};
declare const b2: boolean;
const t1 = b1 && b2;
`;
const unnecessaryConditionTest = (
  condition: string,
  messageId: "alwaysFalsy" | "alwaysTruthy" | "never",
) => ({
  code: necessaryConditionTest(condition),
  errors: [{ message: messages[messageId], line: 4, column: 12 }],
});

export const test = () =>
  ruleTester({
    ruleFn: noUnnecessaryCondition,
    valid: [
      `
declare const b1: boolean;
declare const b2: boolean;
const t1 = b1 && b2;
const t2 = b1 || b2;
if (b1 && b2) {
}
while (b1 && b2) {}
for (let i = 0; b1 && b2; i++) {
  break;
}
const t1 = b1 && b2 ? 'yes' : 'no';
if (b1 && b2) {
}
while (b1 && b2) {}
for (let i = 0; b1 && b2; i++) {
  break;
}
const t1 = b1 && b2 ? 'yes' : 'no';
for (;;) {}
switch (b1) {
  case true:
  default:
}
    `,
      `
declare function foo(): number | void;
const result1 = foo() === undefined;
const result2 = foo() == null;
    `,
      `
declare const bigInt: 0n | 1n;
if (bigInt) {
}
    `,
      necessaryConditionTest("false | 5"), // Truthy literal and falsy literal
      necessaryConditionTest('boolean | "foo"'), // boolean and truthy literal
      necessaryConditionTest("0 | boolean"), // boolean and falsy literal
      necessaryConditionTest("boolean | object"), // boolean and always-truthy type
      necessaryConditionTest("false | object"), // always truthy type and falsy literal
      // always falsy type and always truthy type
      necessaryConditionTest("null | object"),
      necessaryConditionTest("undefined | true"),
      necessaryConditionTest("void | true"), // "branded" type
      necessaryConditionTest("string & {}"),
      necessaryConditionTest("string & { __brand: string }"),
      necessaryConditionTest("number & { __brand: string }"),
      necessaryConditionTest("boolean & { __brand: string }"),
      necessaryConditionTest("bigint & { __brand: string }"),
      necessaryConditionTest("string & {} & { __brand: string }"),
      necessaryConditionTest(
        "string & { __brandA: string } & { __brandB: string }",
      ),
      necessaryConditionTest("string & { __brand: string } | number"),
      necessaryConditionTest("(string | number) & { __brand: string }"),
      necessaryConditionTest("string & ({ __brand: string } | number)"),
      necessaryConditionTest('("" | "foo") & { __brand: string }'),
      necessaryConditionTest(
        "(string & { __brandA: string }) | (number & { __brandB: string })",
      ),
      necessaryConditionTest(
        '((string & { __brandA: string }) | (number & { __brandB: string }) & ("" | "foo"))',
      ),
      necessaryConditionTest(
        "{ __brandA: string} & (({ __brandB: string } & string) | ({ __brandC: string } & number))",
      ),
      necessaryConditionTest(
        '(string | number) & ("foo" | 123 | { __brandA: string })',
      ),
      necessaryConditionTest("string & string"),
      necessaryConditionTest("any"), // any
      necessaryConditionTest("unknown"), // unknown
      // Generic type params
      `
function test<T extends string>(t: T) {
  return t ? 'yes' : 'no';
}
    `,
      `
// Naked type param
function test<T>(t: T) {
  return t ? 'yes' : 'no';
}
    `,
      `
// Naked type param in union
function test<T>(t: T | []) {
  return t ? 'yes' : 'no';
}
    `, // Boolean expressions
      `
function test(a: string) {
  const t1 = a === 'a';
  const t2 = 'a' === a;
}
    `,
      `
function test(a?: string) {
  const t1 = a === undefined;
  const t2 = undefined === a;
  const t1 = a !== undefined;
  const t2 = undefined !== a;
}
    `,
      `
function test(a: null | string) {
  const t1 = a === null;
  const t2 = null === a;
  const t1 = a !== null;
  const t2 = null !== a;
}
    `,
      `
function test(a?: null | string) {
  const t1 = a == null;
  const t2 = null == a;
  const t3 = a != null;
  const t4 = null != a;
  const t5 = a == undefined;
  const t6 = undefined == a;
  const t7 = a != undefined;
  const t8 = undefined != a;
}
    `,
      `
function test(a?: string) {
  const t1 = a == null;
  const t2 = null == a;
  const t3 = a != null;
  const t4 = null != a;
  const t5 = a == undefined;
  const t6 = undefined == a;
  const t7 = a != undefined;
  const t8 = undefined != a;
}
    `,
      `
function test(a: null | string) {
  const t1 = a == null;
  const t2 = null == a;
  const t3 = a != null;
  const t4 = null != a;
  const t5 = a == undefined;
  const t6 = undefined == a;
  const t7 = a != undefined;
  const t8 = undefined != a;
}
    `,
      `
function test(a: any) {
  const t1 = a == null;
  const t2 = null == a;
  const t3 = a != null;
  const t4 = null != a;
  const t5 = a == undefined;
  const t6 = undefined == a;
  const t7 = a != undefined;
  const t8 = undefined != a;
  const t9 = a === null;
  const t10 = null === a;
  const t11 = a !== null;
  const t12 = null !== a;
  const t13 = a === undefined;
  const t14 = undefined === a;
  const t15 = a !== undefined;
  const t16 = undefined !== a;
}
    `,
      `
function test(a: unknown) {
  const t1 = a == null;
  const t2 = null == a;
  const t3 = a != null;
  const t4 = null != a;
  const t5 = a == undefined;
  const t6 = undefined == a;
  const t7 = a != undefined;
  const t8 = undefined != a;
  const t9 = a === null;
  const t10 = null === a;
  const t11 = a !== null;
  const t12 = null !== a;
  const t13 = a === undefined;
  const t14 = undefined === a;
  const t15 = a !== undefined;
  const t16 = undefined !== a;
}
    `,
      `
function test<T>(a: T) {
  const t1 = a == null;
  const t2 = null == a;
  const t3 = a != null;
  const t4 = null != a;
  const t5 = a == undefined;
  const t6 = undefined == a;
  const t7 = a != undefined;
  const t8 = undefined != a;
  const t9 = a === null;
  const t10 = null === a;
  const t11 = a !== null;
  const t12 = null !== a;
  const t13 = a === undefined;
  const t14 = undefined === a;
  const t15 = a !== undefined;
  const t16 = undefined !== a;
}
    `,
      `
function foo<T extends object>(arg: T, key: keyof T): void {
  arg[key] == null;
}
    `, // Predicate functions
      `
// with literal arrow function
[0, 1, 2].filter(x => x);

// filter with named function
function length(x: string) {
  return x.length;
}
['a', 'b', ''].filter(length);

// with non-literal array
function nonEmptyStrings(x: string[]) {
  return x.filter(length);
}

// filter-like predicate
function count(
  list: string[],
  predicate: (value: string, index: number, array: string[]) => unknown,
) {
  return list.filter(predicate).length;
}
    `, // Ignores non-array methods of the same name
      `
const notArray = {
  filter: (func: () => boolean) => func(),
  find: (func: () => boolean) => func(),
};
notArray.filter(() => true);
notArray.find(() => true);
    `, // Nullish coalescing operator
      `
function test(a: string | null) {
  return a ?? 'default';
}
    `,
      `
function test(a: string | undefined) {
  return a ?? 'default';
}
    `,
      `
function test(a: string | null | undefined) {
  return a ?? 'default';
}
    `,
      `
function test(a: unknown) {
  return a ?? 'default';
}
    `,
      `
function test<T>(a: T) {
  return a ?? 'default';
}
    `,
      `
function test<T extends string | null>(a: T) {
  return a ?? 'default';
}
    `,
      `
function foo<T extends object>(arg: T, key: keyof T): void {
  arg[key] ?? 'default';
}
    `, // Indexing cases
      `
declare const arr: object[];
if (arr[42]) {
} // looks unnecessary from the types, but isn't

const tuple = [{}] as [object];
declare const n: number;
if (tuple[n]) {
}
    `, // Optional-chaining indexing
      `
declare const arr: Array<{ value: string } & (() => void)>;
if (arr[42]?.value) {
}
arr[41]?.();

const tuple = ['foo'] as const;
declare const n: number;
tuple[n]?.toUpperCase();
    `,
      `
if (arr?.[42]) {
}
    `,
      `
type ItemA = { bar: string; baz: string };
type ItemB = { bar: string; qux: string };
declare const foo: ItemA[] | ItemB[];
foo[0]?.bar;
    `,
      `
type TupleA = [string, number];
type TupleB = [string, number];

declare const foo: TupleA | TupleB;
declare const index: number;
foo[index]?.toString();
    `,
      `
declare const returnsArr: undefined | (() => string[]);
if (returnsArr?.()[42]) {
}
returnsArr?.()[42]?.toUpperCase();
    `, // nullish + array index
      `
declare const arr: string[][];
arr[x] ?? [];
    `, // nullish + optional array index
      `
declare const arr: { foo: number }[];
const bar = arr[42]?.foo ?? 0;
    `, // Doesn't check the right-hand side of a logical expression
      //  in a non-conditional context
      {
        code: `
declare const b1: boolean;
declare const b2: true;
const x = b1 && b2;
      `,
      },
      {
        options: { allowConstantLoopConditions: true },
        code: `
while (true) {}
for (; true; ) {}
do {} while (true);
      `,
      },
      `
let variable = 'abc' as string | void;
variable?.[0];
    `,
      `
let foo: undefined | { bar: true };
foo?.bar;
    `,
      `
let foo: null | { bar: true };
foo?.bar;
    `,
      `
let foo: undefined;
foo?.bar;
    `,
      `
let foo: undefined;
foo?.bar.baz;
    `,
      `
let foo: null;
foo?.bar;
    `,
      `
let anyValue: any;
anyValue?.foo;
    `,
      `
let unknownValue: unknown;
unknownValue?.foo;
    `,
      `
let foo: undefined | (() => {});
foo?.();
    `,
      `
let foo: null | (() => {});
foo?.();
    `,
      `
let foo: undefined;
foo?.();
    `,
      `
let foo: undefined;
foo?.().bar;
    `,
      `
let foo: null;
foo?.();
    `,
      `
let anyValue: any;
anyValue?.();
    `,
      `
let unknownValue: unknown;
unknownValue?.();
    `,
      "const foo = [1, 2, 3][0];",
      `
declare const foo: { bar?: { baz: { c: string } } } | null;
foo?.bar?.baz;
    `,
      `
foo?.bar?.baz?.qux;
    `,
      `
declare const foo: { bar: { baz: string } };
foo.bar.qux?.();
    `,
      `
type Foo = { baz: number } | null;
type Bar = { baz: null | string | { qux: string } };
declare const foo: { fooOrBar: Foo | Bar } | null;
foo?.fooOrBar?.baz?.qux;
    `,
      `
type Foo = { [key: string]: string } | null;
declare const foo: Foo;

const key = '1';
foo?.[key]?.trim();
    `,
      `
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
type Key = 'bar' | 'foo';
declare const foo: Foo;
declare const key: Key;

foo?.[key].trim();
    `,
      `
interface Outer {
  inner?: {
    [key: string]: string | undefined;
  };
}

function Foo(outer: Outer, key: string): number | undefined {
  return outer.inner?.[key]?.charCodeAt(0);
}
    `,
      `
interface Outer {
  inner?: {
    [key: string]: string | undefined;
    bar: 'bar';
  };
}
type Foo = 'foo';

function Foo(outer: Outer, key: Foo): number | undefined {
  return outer.inner?.[key]?.charCodeAt(0);
}
    `,
      `
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
type Key = 'bar' | 'foo' | 'baz';
declare const foo: Foo;
declare const key: Key;

foo?.[key]?.trim();
    `, // https://github.com/typescript-eslint/typescript-eslint/issues/7700
      `
type BrandedKey = string & { __brand: string };
type Foo = { [key: BrandedKey]: string } | null;
declare const foo: Foo;
const key = '1' as BrandedKey;
foo?.[key]?.trim();
    `,
      `
type BrandedKey<S extends string> = S & { __brand: string };
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
type Key = BrandedKey<'bar'> | BrandedKey<'foo'>;
declare const foo: Foo;
declare const key: Key;
foo?.[key].trim();
    `,
      `
type BrandedKey = string & { __brand: string };
interface Outer {
  inner?: {
    [key: BrandedKey]: string | undefined;
  };
}
function Foo(outer: Outer, key: BrandedKey): number | undefined {
  return outer.inner?.[key]?.charCodeAt(0);
}
    `,
      `
interface Outer {
  inner?: {
    [key: string & { __brand: string }]: string | undefined;
    bar: 'bar';
  };
}
type Foo = 'foo' & { __brand: string };
function Foo(outer: Outer, key: Foo): number | undefined {
  return outer.inner?.[key]?.charCodeAt(0);
}
    `,
      `
type BrandedKey<S extends string> = S & { __brand: string };
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
type Key = BrandedKey<'bar'> | BrandedKey<'foo'> | BrandedKey<'baz'>;
declare const foo: Foo;
declare const key: Key;
foo?.[key]?.trim();
    `,
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
type BrandedKey = string & { __brand: string };
type Foo = { [key: BrandedKey]: string } | null;
declare const foo: Foo;
const key = '1' as BrandedKey;
foo?.[key]?.trim();
      `,
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
type BrandedKey<S extends string> = S & { __brand: string };
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
type Key = BrandedKey<'bar'> | BrandedKey<'foo'>;
declare const foo: Foo;
declare const key: Key;
foo?.[key].trim();
      `,
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
type BrandedKey = string & { __brand: string };
interface Outer {
  inner?: {
    [key: BrandedKey]: string | undefined;
  };
}
function Foo(outer: Outer, key: BrandedKey): number | undefined {
  return outer.inner?.[key]?.charCodeAt(0);
}
      `,
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
interface Outer {
  inner?: {
    [key: string & { __brand: string }]: string | undefined;
    bar: 'bar';
  };
}
type Foo = 'foo' & { __brand: string };
function Foo(outer: Outer, key: Foo): number | undefined {
  return outer.inner?.[key]?.charCodeAt(0);
}
      `,
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
type BrandedKey<S extends string> = S & { __brand: string };
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
type Key = BrandedKey<'bar'> | BrandedKey<'foo'> | BrandedKey<'baz'>;
declare const foo: Foo;
declare const key: Key;
foo?.[key]?.trim();
      `,
      },
      `
let latencies: number[][] = [];

function recordData(): void {
  if (!latencies[0]) latencies[0] = [];
  latencies[0].push(4);
}

recordData();
    `,
      `
let latencies: number[][] = [];

function recordData(): void {
  if (latencies[0]) latencies[0] = [];
  latencies[0].push(4);
}

recordData();
    `,
      `
function test(testVal?: boolean) {
  if (testVal ?? true) {
    console.log('test');
  }
}
    `,
      `
declare const x: string[];
if (!x[0]) {
}
    `, // https://github.com/typescript-eslint/typescript-eslint/issues/2421
      `
const isEven = (val: number) => val % 2 === 0;
if (!isEven(1)) {
}
    `,
      `
declare const booleanTyped: boolean;
declare const unknownTyped: unknown;

if (!(booleanTyped || unknownTyped)) {
}
    `,
      `
interface Foo {
  [key: string]: [string] | undefined;
}

type OptionalFoo = Foo | undefined;
declare const foo: OptionalFoo;
foo?.test?.length;
    `,
      `
interface Foo {
  [key: number]: [string] | undefined;
}

type OptionalFoo = Foo | undefined;
declare const foo: OptionalFoo;
foo?.[1]?.length;
    `,
      `
declare let foo: number | null;
foo ??= 1;
    `,
      `
declare let foo: number;
foo ||= 1;
    `,
      `
declare const foo: { bar: { baz?: number; qux: number } };
type Key = 'baz' | 'qux';
declare const key: Key;
foo.bar[key] ??= 1;
    `,
      `
enum Keys {
  A = 'A',
  B = 'B',
}
type Foo = {
  [Keys.A]: number | null;
  [Keys.B]: number;
};
declare const foo: Foo;
declare const key: Keys;
foo[key] ??= 1;
    `,
      {
        compilerOptions: { exactOptionalPropertyTypes: true },
        code: `
declare const foo: { bar?: number };
foo.bar ??= 1;
      `,
      },
      {
        compilerOptions: { exactOptionalPropertyTypes: true },
        code: `
declare const foo: { bar: { baz?: number } };
foo['bar'].baz ??= 1;
      `,
      },
      {
        compilerOptions: { exactOptionalPropertyTypes: true },
        code: `
declare const foo: { bar: { baz?: number; qux: number } };
type Key = 'baz' | 'qux';
declare const key: Key;
foo.bar[key] ??= 1;
      `,
      },
      `
declare let foo: number;
foo &&= 1;
    `,
      `
function foo<T extends object>(arg: T, key: keyof T): void {
  arg[key] ??= 'default';
}
    `, // https://github.com/typescript-eslint/typescript-eslint/issues/6264
      `
function get<Obj, Key extends keyof Obj>(obj: Obj, key: Key) {
  const value = obj[key];
  if (value) {
    return value;
  }
  throw new Error('BOOM!');
}

get({ foo: null }, 'foo');
    `,
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
function getElem(dict: Record<string, { foo: string }>, key: string) {
  if (dict[key]) {
    return dict[key].foo;
  } else {
    return '';
  }
}
      `,
      },
      `
type Foo = { bar: () => number | undefined } | null;
declare const foo: Foo;
foo?.bar()?.toExponential();
    `,
      `
type Foo = (() => number | undefined) | null;
declare const foo: Foo;
foo?.()?.toExponential();
    `,
      `
type FooUndef = () => undefined;
type FooNum = () => number;
type Foo = FooUndef | FooNum | null;
declare const foo: Foo;
foo?.()?.toExponential();
    `,
      `
type Foo = { [key: string]: () => number | undefined } | null;
declare const foo: Foo;
foo?.['bar']()?.toExponential();
    `,
      `
declare function foo(): void | { key: string };
const bar = foo()?.key;
    `,
      `
type fn = () => void;
declare function foo(): void | fn;
const bar = foo()?.();
    `,
      {
        compilerOptions: { exactOptionalPropertyTypes: true },
        code: `
class ConsistentRand {
  #rand?: number;

  getCachedRand() {
    this.#rand ??= Math.random();
    return this.#rand;
  }
}
      `,
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function assert(x: unknown): asserts x;

assert(Math.random() > 0.5);
      `,
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function assert(x: unknown, y: unknown): asserts x;

assert(Math.random() > 0.5, true);
      `,
      },
      {
        options: { checkTypePredicates: false }, // should not report because option is disabled.
        code: `
declare function assert(x: unknown): asserts x;
assert(true);
      `,
      },
      {
        options: { checkTypePredicates: true }, // could be argued that this should report since `thisAsserter` is truthy.
        code: `
class ThisAsserter {
  assertThis(this: unknown, arg2: unknown): asserts this {}
}

const thisAsserter: ThisAsserter = new ThisAsserter();
thisAsserter.assertThis(true);
      `,
      },
      {
        options: { checkTypePredicates: true }, // could be argued that this should report since `thisAsserter` is truthy.
        code: `
class ThisAsserter {
  assertThis(this: unknown, arg2: unknown): asserts this {}
}

const thisAsserter: ThisAsserter = new ThisAsserter();
thisAsserter.assertThis(Math.random());
      `,
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function assert(x: unknown): asserts x;
assert(...[]);
      `,
      },
      {
        options: { checkTypePredicates: true }, // ok to report if we start unpacking spread params one day.
        code: `
declare function assert(x: unknown): asserts x;
assert(...[], {});
      `,
      },
      {
        options: { checkTypePredicates: false },
        code: `
declare function assertString(x: unknown): asserts x is string;
declare const a: string;
assertString(a);
      `,
      },
      {
        options: { checkTypePredicates: false },
        code: `
declare function isString(x: unknown): x is string;
declare const a: string;
isString(a);
      `,
      },
      {
        options: { checkTypePredicates: true }, // Technically, this has type 'falafel' and not string.
        code: `
declare function assertString(x: unknown): asserts x is string;
assertString('falafel');
      `,
      },
      {
        options: { checkTypePredicates: true }, // Technically, this has type 'falafel' and not string.
        code: `
declare function isString(x: unknown): x is string;
isString('falafel');
      `,
      },
    ],
    invalid: [
      // Ensure that it's checking in all the right places
      {
        code: `
const b1 = true;
declare const b2: boolean;
const t1 = b1 && b2;
const t2 = b1 || b2;
if (b1 && b2) {
}
if (b2 && b1) {
}
while (b1 && b2) {}
while (b2 && b1) {}
for (let i = 0; b1 && b2; i++) {
  break;
}
const t1 = b1 && b2 ? 'yes' : 'no';
const t1 = b2 && b1 ? 'yes' : 'no';
switch (b1) {
  case true:
  default:
}
      `,
        errors: [
          { message: messages.alwaysTruthy, line: 4, column: 12 },
          { message: messages.alwaysTruthy, line: 5, column: 12 },
          { message: messages.alwaysTruthy, line: 6, column: 5 },
          { message: messages.alwaysTruthy, line: 8, column: 11 },
          { message: messages.alwaysTruthy, line: 10, column: 8 },
          { message: messages.alwaysTruthy, line: 11, column: 14 },
          { message: messages.alwaysTruthy, line: 12, column: 17 },
          { message: messages.alwaysTruthy, line: 15, column: 12 },
          { message: messages.alwaysTruthy, line: 16, column: 18 },
          {
            message: messages.literalBooleanExpression({ trueOrFalse: "true" }),
            line: 18,
            column: 8,
          },
        ],
      }, // Ensure that it's complaining about the right things
      unnecessaryConditionTest("object", "alwaysTruthy"),
      unnecessaryConditionTest("object | true", "alwaysTruthy"),
      unnecessaryConditionTest('"" | false', "alwaysFalsy"), // Two falsy literals
      unnecessaryConditionTest('"always truthy"', "alwaysTruthy"),
      unnecessaryConditionTest(`undefined`, "alwaysFalsy"),
      unnecessaryConditionTest("null", "alwaysFalsy"),
      unnecessaryConditionTest("void", "alwaysFalsy"),
      unnecessaryConditionTest("never", "never"),
      unnecessaryConditionTest("string & number", "never"), // More complex logical expressions
      {
        code: `
declare const falseyBigInt: 0n;
if (falseyBigInt) {
}
      `,
        errors: [{ message: messages.alwaysFalsy, line: 3, column: 5 }],
      },
      {
        code: `
declare const posbigInt: 1n;
if (posbigInt) {
}
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 5 }],
      },
      {
        code: `
declare const negBigInt: -2n;
if (negBigInt) {
}
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 5 }],
      },
      {
        code: `
declare const b1: boolean;
declare const b2: boolean;
if (true && b1 && b2) {
}
if (b1 && false && b2) {
}
if (b1 || b2 || true) {
}
      `,
        errors: [
          { message: messages.alwaysTruthy, line: 4, column: 5 },
          { message: messages.alwaysFalsy, line: 6, column: 11 },
          { message: messages.alwaysTruthy, line: 8, column: 17 },
        ],
      }, // Generic type params
      {
        code: `
function test<T extends object>(t: T) {
  return t ? 'yes' : 'no';
}
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 10 }],
      },
      {
        code: `
function test<T extends false>(t: T) {
  return t ? 'yes' : 'no';
}
      `,
        errors: [{ message: messages.alwaysFalsy, line: 3, column: 10 }],
      },
      {
        code: `
function test<T extends 'a' | 'b'>(t: T) {
  return t ? 'yes' : 'no';
}
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 10 }],
      }, // Boolean expressions
      {
        code: `
function test(a: 'a') {
  return a === 'a';
}
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({ trueOrFalse: "true" }),
            line: 3,
            column: 10,
          },
        ],
      },
      {
        code: `
declare const a: '34';
declare const b: '56';
a > b;
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({
              trueOrFalse: "false",
            }),
            line: 4,
          },
        ],
      },
      {
        code: `
const y = 1;
if (y === 0) {
}
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({
              trueOrFalse: "false",
            }),
            line: 3,
          },
        ],
      },
      {
        code: `
// @ts-expect-error
if (1 == '1') {
}
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({ trueOrFalse: "true" }),
            line: 3,
          },
        ],
      },
      {
        code: `
2.3 > 2.3;
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({
              trueOrFalse: "false",
            }),
            line: 2,
          },
        ],
      },
      {
        code: `
2.3 >= 2.3;
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({ trueOrFalse: "true" }),
            line: 2,
          },
        ],
      },
      {
        code: `
2n < 2n;
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({
              trueOrFalse: "false",
            }),
            line: 2,
          },
        ],
      },
      {
        code: `
2n <= 2n;
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({ trueOrFalse: "true" }),
            line: 2,
          },
        ],
      },
      {
        code: `
-2n !== 2n;
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({ trueOrFalse: "true" }),
            line: 2,
          },
        ],
      },
      {
        code: `
// @ts-expect-error
if (1 == '2') {
}
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({
              trueOrFalse: "false",
            }),
            line: 3,
          },
        ],
      },
      {
        code: `
// @ts-expect-error
if (1 != '2') {
}
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({ trueOrFalse: "true" }),
            line: 3,
          },
        ],
      },
      {
        code: `
enum Foo {
  a = 1,
  b = 2,
}

const x = Foo.a;
if (x === Foo.a) {
}
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({ trueOrFalse: "true" }),
            line: 8,
            column: 5,
          },
        ],
      },
      {
        // narrowed to null. always-true because of loose nullish equality
        code: `
function takesMaybeValue(a: null | object) {
  if (a) {
  } else if (a == undefined) {
  }
}
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({ trueOrFalse: "true" }),
            line: 4,
            column: 14,
            endColumn: 28,
            endLine: 4,
          },
        ],
      },
      {
        // narrowed to null. always-false because of strict undefined equality
        code: `
function takesMaybeValue(a: null | object) {
  if (a) {
  } else if (a === undefined) {
  }
}
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({
              trueOrFalse: "false",
            }),
            line: 4,
            column: 14,
            endColumn: 29,
            endLine: 4,
          },
        ],
      },
      {
        // narrowed to null. always-false because of loose nullish equality
        code: `
function takesMaybeValue(a: null | object) {
  if (a) {
  } else if (a != undefined) {
  }
}
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({
              trueOrFalse: "false",
            }),
            line: 4,
            column: 14,
            endColumn: 28,
            endLine: 4,
          },
        ],
      },
      {
        // narrowed to null. always-true because of strict undefined equality
        code: `
function takesMaybeValue(a: null | object) {
  if (a) {
  } else if (a !== undefined) {
  }
}
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({ trueOrFalse: "true" }),
            line: 4,
            column: 14,
            endColumn: 29,
            endLine: 4,
          },
        ],
      },
      {
        code: `
true === false;
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({
              trueOrFalse: "false",
            }),
          },
        ],
      },
      {
        code: `
true === true;
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({ trueOrFalse: "true" }),
          },
        ],
      },
      {
        code: `
true === undefined;
      `,
        errors: [
          {
            message: messages.literalBooleanExpression({
              trueOrFalse: "false",
            }),
          },
        ],
      }, // Workaround https://github.com/microsoft/TypeScript/issues/37160
      {
        code: `
function test(a: string) {
  const t1 = a === undefined;
  const t2 = undefined === a;
  const t3 = a !== undefined;
  const t4 = undefined !== a;
  const t5 = a === null;
  const t6 = null === a;
  const t7 = a !== null;
  const t8 = null !== a;
}
      `,
        errors: [
          { message: messages.noOverlapBooleanExpression, line: 3, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 4, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 5, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 6, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 7, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 8, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 9, column: 14 },
          {
            message: messages.noOverlapBooleanExpression,
            line: 10,
            column: 14,
          },
        ],
      },
      {
        code: `
function test(a?: string) {
  const t1 = a === undefined;
  const t2 = undefined === a;
  const t3 = a !== undefined;
  const t4 = undefined !== a;
  const t5 = a === null;
  const t6 = null === a;
  const t7 = a !== null;
  const t8 = null !== a;
}
      `,
        errors: [
          { message: messages.noOverlapBooleanExpression, line: 7, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 8, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 9, column: 14 },
          {
            message: messages.noOverlapBooleanExpression,
            line: 10,
            column: 14,
          },
        ],
      },
      {
        code: `
function test(a: null | string) {
  const t1 = a === undefined;
  const t2 = undefined === a;
  const t3 = a !== undefined;
  const t4 = undefined !== a;
  const t5 = a === null;
  const t6 = null === a;
  const t7 = a !== null;
  const t8 = null !== a;
}
      `,
        errors: [
          { message: messages.noOverlapBooleanExpression, line: 3, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 4, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 5, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 6, column: 14 },
        ],
      },
      {
        code: `
function test<T extends object>(a: T) {
  const t1 = a == null;
  const t2 = null == a;
  const t3 = a != null;
  const t4 = null != a;
  const t5 = a == undefined;
  const t6 = undefined == a;
  const t7 = a != undefined;
  const t8 = undefined != a;
  const t9 = a === null;
  const t10 = null === a;
  const t11 = a !== null;
  const t12 = null !== a;
  const t13 = a === undefined;
  const t14 = undefined === a;
  const t15 = a !== undefined;
  const t16 = undefined !== a;
}
      `,
        errors: [
          { message: messages.noOverlapBooleanExpression, line: 3, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 4, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 5, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 6, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 7, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 8, column: 14 },
          { message: messages.noOverlapBooleanExpression, line: 9, column: 14 },
          {
            message: messages.noOverlapBooleanExpression,
            line: 10,
            column: 14,
          },
          {
            message: messages.noOverlapBooleanExpression,
            line: 11,
            column: 14,
          },
          {
            message: messages.noOverlapBooleanExpression,
            line: 12,
            column: 15,
          },
          {
            message: messages.noOverlapBooleanExpression,
            line: 13,
            column: 15,
          },
          {
            message: messages.noOverlapBooleanExpression,
            line: 14,
            column: 15,
          },
          {
            message: messages.noOverlapBooleanExpression,
            line: 15,
            column: 15,
          },
          {
            message: messages.noOverlapBooleanExpression,
            line: 16,
            column: 15,
          },
          {
            message: messages.noOverlapBooleanExpression,
            line: 17,
            column: 15,
          },
          {
            message: messages.noOverlapBooleanExpression,
            line: 18,
            column: 15,
          },
        ],
      }, // Nullish coalescing operator
      {
        code: `
function test(a: string) {
  return a ?? 'default';
}
      `,
        errors: [{ message: messages.neverNullish, line: 3, column: 10 }],
      },
      {
        code: `
function test(a: string | false) {
  return a ?? 'default';
}
      `,
        errors: [{ message: messages.neverNullish, line: 3, column: 10 }],
      },
      {
        code: `
function test<T extends string>(a: T) {
  return a ?? 'default';
}
      `,
        errors: [{ message: messages.neverNullish, line: 3, column: 10 }],
      }, // nullish + array index without optional chaining
      {
        code: `
function test(a: { foo: string }[]) {
  return a[0].foo ?? 'default';
}
      `,
        errors: [{ message: messages.neverNullish, line: 3, column: 10 }],
      },
      {
        code: `
function test(a: null) {
  return a ?? 'default';
}
      `,
        errors: [{ message: messages.alwaysNullish, line: 3, column: 10 }],
      },
      {
        code: `
function test(a: null[]) {
  return a[0] ?? 'default';
}
      `,
        errors: [{ message: messages.alwaysNullish, line: 3, column: 10 }],
      },
      {
        code: `
function test<T extends null>(a: T) {
  return a ?? 'default';
}
      `,
        errors: [{ message: messages.alwaysNullish, line: 3, column: 10 }],
      },
      {
        code: `
function test(a: never) {
  return a ?? 'default';
}
      `,
        errors: [{ message: messages.never, line: 3, column: 10 }],
      },
      {
        code: `
function test<T extends { foo: number }, K extends 'foo'>(num: T[K]) {
  num ?? 'default';
}
      `,
        errors: [{ message: messages.neverNullish, line: 3, column: 3 }],
      }, // Predicate functions
      {
        code: `
[1, 3, 5].filter(() => true);
[1, 2, 3].find(() => {
  return false;
});

// with non-literal array
function nothing(x: string[]) {
  return x.filter(() => false);
}
// with readonly array
function nothing2(x: readonly string[]) {
  return x.filter(() => false);
}
// with tuple
function nothing3(x: [string, string]) {
  return x.filter(() => false);
}
      `,
        errors: [
          { message: messages.alwaysTruthy, line: 2, column: 24 },
          { message: messages.alwaysFalsy, line: 4, column: 10 },
          { message: messages.alwaysFalsy, line: 9, column: 25 },
          { message: messages.alwaysFalsy, line: 13, column: 25 },
          { message: messages.alwaysFalsy, line: 17, column: 25 },
        ],
      }, // Indexing cases
      {
        // This is an error because 'dict' doesn't represent
        //  the potential for undefined in its types
        code: `
declare const dict: Record<string, object>;
if (dict['mightNotExist']) {
}
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 5 }],
      },
      {
        // Should still check tuples when accessed with literal numbers, since they don't have
        //   unsound index signatures
        code: `
const x = [{}] as [{ foo: string }];
if (x[0]) {
}
if (x[0]?.foo) {
}
      `,
        errors: [
          { message: messages.alwaysTruthy, line: 3, column: 5 },
          {
            message: messages.neverOptionalChain,
            line: 5,
            column: 9,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
const x = [{}] as [{ foo: string }];
if (x[0]) {
}
if (x[0].foo) {
}
      `,
              },
            ],
          },
        ],
      },
      {
        // Shouldn't mistake this for an array indexing case
        code: `
declare const arr: object[];
if (arr.filter) {
}
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 5 }],
      },
      {
        code: `
function truthy() {
  return [];
}
function falsy() {}
[1, 3, 5].filter(truthy);
[1, 2, 3].find(falsy);
[1, 2, 3].findLastIndex(falsy);
      `,
        errors: [
          { message: messages.alwaysTruthyFunc, line: 6, column: 18 },
          { message: messages.alwaysFalsyFunc, line: 7, column: 16 },
          { message: messages.alwaysFalsyFunc, line: 8, column: 25 },
        ],
      }, // Supports generics
      // TODO: fix this
      //     {
      //       code: `
      // const isTruthy = <T>(t: T) => T;
      // // Valid: numbers can be truthy or falsy (0).
      // [0,1,2,3].filter(isTruthy);
      // // Invalid: arrays are always falsy.
      // [[1,2], [3,4]].filter(isTruthy);
      // `,
      //       errors: [({ line: 6, column: 23, messageId: 'alwaysTruthyFunc' })],
      //     },
      {
        options: { allowConstantLoopConditions: false },
        code: `
while (true) {}
for (; true; ) {}
do {} while (true);
      `,
        errors: [
          { message: messages.alwaysTruthy, line: 2, column: 8 },
          { message: messages.alwaysTruthy, line: 3, column: 8 },
          { message: messages.alwaysTruthy, line: 4, column: 14 },
        ],
      },
      {
        code: `
let foo = { bar: true };
foo?.bar;
foo ?. bar;
foo ?.
  bar;
foo
  ?. bar;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 4,
            endColumn: 6,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = { bar: true };
foo.bar;
foo ?. bar;
foo ?.
  bar;
foo
  ?. bar;
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 5,
            endColumn: 7,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = { bar: true };
foo?.bar;
foo . bar;
foo ?.
  bar;
foo
  ?. bar;
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 5,
            column: 5,
            endColumn: 7,
            endLine: 5,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = { bar: true };
foo?.bar;
foo ?. bar;
foo .
  bar;
foo
  ?. bar;
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 8,
            column: 3,
            endColumn: 5,
            endLine: 8,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = { bar: true };
foo?.bar;
foo ?. bar;
foo ?.
  bar;
foo
  . bar;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
let foo = () => {};
foo?.();
foo ?. ();
foo ?.
  ();
foo
  ?. ();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 4,
            endColumn: 6,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = () => {};
foo();
foo ?. ();
foo ?.
  ();
foo
  ?. ();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 5,
            endColumn: 7,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = () => {};
foo?.();
foo  ();
foo ?.
  ();
foo
  ?. ();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 5,
            column: 5,
            endColumn: 7,
            endLine: 5,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = () => {};
foo?.();
foo ?. ();
foo 
  ();
foo
  ?. ();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 8,
            column: 3,
            endColumn: 5,
            endLine: 8,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = () => {};
foo?.();
foo ?. ();
foo ?.
  ();
foo
   ();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
let foo = () => {};
foo?.(bar);
foo ?. (bar);
foo ?.
  (bar);
foo
  ?. (bar);
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 4,
            endColumn: 6,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = () => {};
foo(bar);
foo ?. (bar);
foo ?.
  (bar);
foo
  ?. (bar);
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 5,
            endColumn: 7,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = () => {};
foo?.(bar);
foo  (bar);
foo ?.
  (bar);
foo
  ?. (bar);
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 5,
            column: 5,
            endColumn: 7,
            endLine: 5,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = () => {};
foo?.(bar);
foo ?. (bar);
foo 
  (bar);
foo
  ?. (bar);
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 8,
            column: 3,
            endColumn: 5,
            endLine: 8,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let foo = () => {};
foo?.(bar);
foo ?. (bar);
foo ?.
  (bar);
foo
   (bar);
      `,
              },
            ],
          },
        ],
      },
      {
        code: "const foo = [1, 2, 3]?.[0];",
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 1,
            column: 22,
            endColumn: 24,
            endLine: 1,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: "const foo = [1, 2, 3][0];",
              },
            ],
          },
        ],
      },
      {
        code: `
declare const x: { a?: { b: string } };
x?.a?.b;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 2,
            endColumn: 4,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const x: { a?: { b: string } };
x.a?.b;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const x: { a: { b?: { c: string } } };
x.a?.b?.c;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 4,
            endColumn: 6,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const x: { a: { b?: { c: string } } };
x.a.b?.c;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
let x: { a?: string };
x?.a;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 2,
            endColumn: 4,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
let x: { a?: string };
x.a;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const foo: { bar: { baz: { c: string } } } | null;
foo?.bar?.baz;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 9,
            endColumn: 11,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const foo: { bar: { baz: { c: string } } } | null;
foo?.bar.baz;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const foo: { bar?: { baz: { qux: string } } } | null;
foo?.bar?.baz?.qux;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 14,
            endColumn: 16,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const foo: { bar?: { baz: { qux: string } } } | null;
foo?.bar?.baz.qux;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const foo: { bar: { baz: { qux?: () => {} } } } | null;
foo?.bar?.baz?.qux?.();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 14,
            endColumn: 16,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const foo: { bar: { baz: { qux?: () => {} } } } | null;
foo?.bar?.baz.qux?.();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 9,
            endColumn: 11,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const foo: { bar: { baz: { qux?: () => {} } } } | null;
foo?.bar.baz?.qux?.();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const foo: { bar: { baz: { qux: () => {} } } } | null;
foo?.bar?.baz?.qux?.();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 19,
            endColumn: 21,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const foo: { bar: { baz: { qux: () => {} } } } | null;
foo?.bar?.baz?.qux();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 14,
            endColumn: 16,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const foo: { bar: { baz: { qux: () => {} } } } | null;
foo?.bar?.baz.qux?.();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 9,
            endColumn: 11,
            endLine: 3,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const foo: { bar: { baz: { qux: () => {} } } } | null;
foo?.bar.baz?.qux?.();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type baz = () => { qux: () => {} };
declare const foo: { bar: { baz: baz } } | null;
foo?.bar?.baz?.().qux?.();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 22,
            endColumn: 24,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type baz = () => { qux: () => {} };
declare const foo: { bar: { baz: baz } } | null;
foo?.bar?.baz?.().qux();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 14,
            endColumn: 16,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type baz = () => { qux: () => {} };
declare const foo: { bar: { baz: baz } } | null;
foo?.bar?.baz().qux?.();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 9,
            endColumn: 11,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type baz = () => { qux: () => {} };
declare const foo: { bar: { baz: baz } } | null;
foo?.bar.baz?.().qux?.();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type baz = null | (() => { qux: () => {} });
declare const foo: { bar: { baz: baz } } | null;
foo?.bar?.baz?.().qux?.();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 22,
            endColumn: 24,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type baz = null | (() => { qux: () => {} });
declare const foo: { bar: { baz: baz } } | null;
foo?.bar?.baz?.().qux();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 9,
            endColumn: 11,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type baz = null | (() => { qux: () => {} });
declare const foo: { bar: { baz: baz } } | null;
foo?.bar.baz?.().qux?.();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type baz = null | (() => { qux: () => {} } | null);
declare const foo: { bar: { baz: baz } } | null;
foo?.bar?.baz?.()?.qux?.();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 23,
            endColumn: 25,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type baz = null | (() => { qux: () => {} } | null);
declare const foo: { bar: { baz: baz } } | null;
foo?.bar?.baz?.()?.qux();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 9,
            endColumn: 11,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type baz = null | (() => { qux: () => {} } | null);
declare const foo: { bar: { baz: baz } } | null;
foo?.bar.baz?.()?.qux?.();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Foo = { baz: number };
type Bar = { baz: null | string | { qux: string } };
declare const foo: { fooOrBar: Foo | Bar } | null;
foo?.fooOrBar?.baz?.qux;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 5,
            column: 14,
            endColumn: 16,
            endLine: 5,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = { baz: number };
type Bar = { baz: null | string | { qux: string } };
declare const foo: { fooOrBar: Foo | Bar } | null;
foo?.fooOrBar.baz?.qux;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const x: { a: { b: number } }[];
x[0].a?.b;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 7,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
declare const x: { a: { b: number } }[];
x[0].a.b;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
type Key = 'bar' | 'foo';
declare const foo: Foo;
declare const key: Key;

foo?.[key]?.trim();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 7,
            column: 11,
            endColumn: 13,
            endLine: 7,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
type Key = 'bar' | 'foo';
declare const foo: Foo;
declare const key: Key;

foo?.[key].trim();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
declare const foo: Foo;
const key = 'bar';
foo?.[key]?.trim();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 5,
            column: 11,
            endColumn: 13,
            endLine: 5,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = { [key: string]: string; foo: 'foo'; bar: 'bar' } | null;
declare const foo: Foo;
const key = 'bar';
foo?.[key].trim();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
interface Outer {
  inner?: {
    [key: string]: string | undefined;
    bar: 'bar';
  };
}

export function test(outer: Outer): number | undefined {
  const key = 'bar';
  return outer.inner?.[key]?.charCodeAt(0);
}
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 11,
            column: 28,
            endColumn: 30,
            endLine: 11,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
interface Outer {
  inner?: {
    [key: string]: string | undefined;
    bar: 'bar';
  };
}

export function test(outer: Outer): number | undefined {
  const key = 'bar';
  return outer.inner?.[key].charCodeAt(0);
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
interface Outer {
  inner?: {
    [key: string]: string | undefined;
    bar: 'bar';
  };
}
type Bar = 'bar';

function Foo(outer: Outer, key: Bar): number | undefined {
  return outer.inner?.[key]?.charCodeAt(0);
}
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 11,
            column: 28,
            endColumn: 30,
            endLine: 11,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
interface Outer {
  inner?: {
    [key: string]: string | undefined;
    bar: 'bar';
  };
}
type Bar = 'bar';

function Foo(outer: Outer, key: Bar): number | undefined {
  return outer.inner?.[key].charCodeAt(0);
}
      `,
              },
            ],
          },
        ],
      }, // https://github.com/typescript-eslint/typescript-eslint/issues/2384
      {
        code: `
function test(testVal?: true) {
  if (testVal ?? true) {
    console.log('test');
  }
}
      `,
        errors: [
          {
            message: messages.alwaysTruthy,
            line: 3,
            column: 7,
            endColumn: 22,
            endLine: 3,
          },
        ],
      }, // https://github.com/typescript-eslint/typescript-eslint/issues/2255
      {
        code: `
const a = null;
if (!a) {
}
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 5 }],
      },
      {
        code: `
const a = true;
if (!a) {
}
      `,
        errors: [{ message: messages.alwaysFalsy, line: 3, column: 5 }],
      },
      {
        code: `
function sayHi(): void {
  console.log('Hi!');
}

let speech: never = sayHi();
if (!speech) {
}
      `,
        errors: [{ message: messages.never, line: 7, column: 5 }],
      },
      {
        code: `
interface Foo {
  test: string;
  [key: string]: [string] | undefined;
}

type OptionalFoo = Foo | undefined;
declare const foo: OptionalFoo;
foo?.test?.length;
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 9,
            column: 10,
            endColumn: 12,
            endLine: 9,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
interface Foo {
  test: string;
  [key: string]: [string] | undefined;
}

type OptionalFoo = Foo | undefined;
declare const foo: OptionalFoo;
foo?.test.length;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
function pick<Obj extends Record<string, 1 | 2 | 3>, Key extends keyof Obj>(
  obj: Obj,
  key: Key,
): Obj[Key] {
  const k = obj[key];
  if (obj[key]) {
    return obj[key];
  }
  throw new Error('Boom!');
}

pick({ foo: 1, bar: 2 }, 'bar');
      `,
        errors: [
          {
            message: messages.alwaysTruthy,
            line: 7,
            column: 7,
            endColumn: 15,
            endLine: 7,
          },
        ],
      },
      {
        code: `
function getElem(dict: Record<string, { foo: string }>, key: string) {
  if (dict[key]) {
    return dict[key].foo;
  } else {
    return '';
  }
}
      `,
        errors: [
          {
            message: messages.alwaysTruthy,
            line: 3,
            column: 7,
            endColumn: 16,
            endLine: 3,
          },
        ],
      },
      {
        code: `
declare let foo: {};
foo ??= 1;
      `,
        errors: [
          {
            message: messages.neverNullish,
            line: 3,
            column: 1,
            endColumn: 4,
            endLine: 3,
          },
        ],
      },
      {
        code: `
declare let foo: number;
foo ??= 1;
      `,
        errors: [
          {
            message: messages.neverNullish,
            line: 3,
            column: 1,
            endColumn: 4,
            endLine: 3,
          },
        ],
      },
      {
        code: `
declare let foo: null;
foo ??= null;
      `,
        errors: [
          {
            message: messages.alwaysNullish,
            line: 3,
            column: 1,
            endColumn: 4,
            endLine: 3,
          },
        ],
      },
      {
        code: `
declare let foo: {};
foo ||= 1;
      `,
        errors: [
          {
            message: messages.alwaysTruthy,
            line: 3,
            column: 1,
            endColumn: 4,
            endLine: 3,
          },
        ],
      },
      {
        code: `
declare let foo: null;
foo ||= null;
      `,
        errors: [
          {
            message: messages.alwaysFalsy,
            line: 3,
            column: 1,
            endColumn: 4,
            endLine: 3,
          },
        ],
      },
      {
        code: `
declare let foo: {};
foo &&= 1;
      `,
        errors: [
          {
            message: messages.alwaysTruthy,
            line: 3,
            column: 1,
            endColumn: 4,
            endLine: 3,
          },
        ],
      },
      {
        code: `
declare let foo: null;
foo &&= null;
      `,
        errors: [
          {
            message: messages.alwaysFalsy,
            line: 3,
            column: 1,
            endColumn: 4,
            endLine: 3,
          },
        ],
      },
      {
        compilerOptions: { exactOptionalPropertyTypes: true },
        code: `
declare const foo: { bar: number };
foo.bar ??= 1;
      `,
        errors: [
          {
            message: messages.neverNullish,
            line: 3,
            column: 1,
            endColumn: 8,
            endLine: 3,
          },
        ],
      },
      {
        code: `
type Foo = { bar: () => number } | null;
declare const foo: Foo;
foo?.bar()?.toExponential();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 11,
            endColumn: 13,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = { bar: () => number } | null;
declare const foo: Foo;
foo?.bar().toExponential();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Foo = { bar: null | { baz: () => { qux: number } } } | null;
declare const foo: Foo;
foo?.bar?.baz()?.qux?.toExponential();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 21,
            endColumn: 23,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = { bar: null | { baz: () => { qux: number } } } | null;
declare const foo: Foo;
foo?.bar?.baz()?.qux.toExponential();
      `,
              },
            ],
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 16,
            endColumn: 18,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = { bar: null | { baz: () => { qux: number } } } | null;
declare const foo: Foo;
foo?.bar?.baz().qux?.toExponential();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Foo = (() => number) | null;
declare const foo: Foo;
foo?.()?.toExponential();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 8,
            endColumn: 10,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = (() => number) | null;
declare const foo: Foo;
foo?.().toExponential();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Foo = { [key: string]: () => number } | null;
declare const foo: Foo;
foo?.['bar']()?.toExponential();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 15,
            endColumn: 17,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = { [key: string]: () => number } | null;
declare const foo: Foo;
foo?.['bar']().toExponential();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Foo = { [key: string]: () => number } | null;
declare const foo: Foo;
foo?.['bar']?.()?.toExponential();
      `,
        errors: [
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 17,
            endColumn: 19,
            endLine: 4,
            suggestions: [
              {
                message: messages.removeOptionalChain,
                output: `
type Foo = { [key: string]: () => number } | null;
declare const foo: Foo;
foo?.['bar']?.().toExponential();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        const a = true;
        if (!!a) {
        }
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 13 }],
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function assert(x: unknown): asserts x;
assert(true);
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3 }],
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function assert(x: unknown): asserts x;
assert(false);
      `,
        errors: [{ message: messages.alwaysFalsy, line: 3, column: 8 }],
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function assert(x: unknown, y: unknown): asserts x;

assert(true, Math.random() > 0.5);
      `,
        errors: [{ message: messages.alwaysTruthy, line: 4, column: 8 }],
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function assert(x: unknown): asserts x;
assert({});
      `,
        errors: [{ message: messages.alwaysTruthy, line: 3, column: 8 }],
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function assertsString(x: unknown): asserts x is string;
declare const a: string;
assertsString(a);
      `,
        errors: [
          {
            message: messages.typeGuardAlreadyIsType({
              typeGuardOrAssertionFunction: "assertion function",
            }),
            line: 4,
          },
        ],
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function isString(x: unknown): x is string;
declare const a: string;
isString(a);
      `,
        errors: [
          {
            message: messages.typeGuardAlreadyIsType({
              typeGuardOrAssertionFunction: "type guard",
            }),
            line: 4,
          },
        ],
      },
      {
        options: { checkTypePredicates: true },
        code: `
declare function isString(x: unknown): x is string;
declare const a: string;
isString('fa' + 'lafel');
      `,
        errors: [
          {
            message: messages.typeGuardAlreadyIsType({
              typeGuardOrAssertionFunction: "type guard",
            }),
            line: 4,
          },
        ],
      }, // "branded" types
      unnecessaryConditionTest('"" & {}', "alwaysFalsy"),
      unnecessaryConditionTest('"" & { __brand: string }', "alwaysFalsy"),
      unnecessaryConditionTest(
        '("" | false) & { __brand: string }',
        "alwaysFalsy",
      ),
      unnecessaryConditionTest(
        '((string & { __brandA: string }) | (number & { __brandB: string })) & ""',
        "alwaysFalsy",
      ),
      unnecessaryConditionTest(
        '("foo" | "bar") & { __brand: string }',
        "alwaysTruthy",
      ),
      unnecessaryConditionTest(
        "(123 | true) & { __brand: string }",
        "alwaysTruthy",
      ),
      unnecessaryConditionTest(
        '(string | number) & ("foo" | 123) & { __brand: string }',
        "alwaysTruthy",
      ),
      unnecessaryConditionTest(
        '((string & { __brandA: string }) | (number & { __brandB: string })) & "foo"',
        "alwaysTruthy",
      ),
      unnecessaryConditionTest(
        '((string & { __brandA: string }) | (number & { __brandB: string })) & ("foo" | 123)',
        "alwaysTruthy",
      ),
    ],
  });
