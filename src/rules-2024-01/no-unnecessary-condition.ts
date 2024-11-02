import {
  getCallSignaturesOfType,
  intersectionTypeParts,
  isBooleanLiteralType,
  isFalsyType,
  isTrueLiteralType,
  isTypeFlagSet,
  unionTypeParts,
} from "ts-api-utils";
import ts, { SyntaxKind, TypeFlags } from "typescript";
import { createRule } from "../public-utils.ts";
import { isLiteralKind, isLogicalExpression } from "../rules-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import { typeHasFlag } from "../types-utils.ts";
import type { AST, Context as ContextGeneric } from "../types.ts";

const messages = {
  alwaysTruthy: "Unnecessary conditional, value is always truthy.",
  alwaysFalsy: "Unnecessary conditional, value is always falsy.",
  alwaysTruthyFunc:
    "This callback should return a conditional, but return is always truthy.",
  alwaysFalsyFunc:
    "This callback should return a conditional, but return is always falsy.",
  neverNullish:
    "Unnecessary conditional, expected left-hand side of `??` operator to be possibly null or undefined.",
  alwaysNullish:
    "Unnecessary conditional, left-hand side of `??` operator is always `null` or `undefined`.",
  literalBooleanExpression:
    "Unnecessary conditional, both sides of the expression are literal values.",
  noOverlapBooleanExpression:
    "Unnecessary conditional, the types have no overlap.",
  never: "Unnecessary conditional, value is `never`.",
  neverOptionalChain: "Unnecessary optional chain on a non-nullish value.",
};

type Context = ContextGeneric<{ allowConstantLoopConditions: boolean }>;

export const noUnnecessaryCondition = createRule({
  name: "no-unnecessary-condition",
  parseOptions: (options?: { allowConstantLoopConditions?: boolean }) => ({
    allowConstantLoopConditions: false,
    ...options,
  }),
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
        default:
          checkIfBinaryExpressionIsNecessaryConditional(node, context);
      }
    },
    CallExpression: checkCallExpression,
    ConditionalExpression(node, context) {
      checkNode(node.condition, context);
    },
    DoStatement(node, context) {
      checkIfLoopIsNecessaryConditional(node.expression, context);
    },
    ForStatement(node, context) {
      if (node.condition) {
        checkIfLoopIsNecessaryConditional(node.condition, context);
      }
    },
    IfStatement(node, context) {
      checkNode(node.expression, context);
    },
    WhileStatement(node, context) {
      checkIfLoopIsNecessaryConditional(node.expression, context);
    },
    PropertyAccessExpression(node, context) {
      if (node.questionDotToken) {
        if (isOptionableExpression(node.expression, context)) return;
        context.report({
          node: node.questionDotToken,
          message: messages.neverOptionalChain,
        });
      }
    },
    ElementAccessExpression(node, context) {
      if (node.questionDotToken) {
        if (isOptionableExpression(node.expression, context)) return;
        context.report({
          node: node.questionDotToken,
          message: messages.neverOptionalChain,
        });
      }
    },
  },
});

function nodeIsArrayType(node: AST.Expression, context: Context): boolean {
  const nodeType = context.utils.getConstrainedTypeAtLocation(node);
  return context.checker.isArrayType(nodeType);
}
function nodeIsTupleType(node: AST.Expression, context: Context): boolean {
  const nodeType = context.utils.getConstrainedTypeAtLocation(node);
  return context.checker.isTupleType(nodeType);
}

function isArrayIndexExpression(
  node: AST.Expression,
  context: Context,
): boolean {
  return (
    node.kind === SyntaxKind.ElementAccessExpression &&
    // ...into an array type
    (nodeIsArrayType(node.expression, context) ||
      // ... or a tuple type
      (nodeIsTupleType(node.expression, context) &&
        // Exception: literal index into a tuple - will have a sound type
        !isLiteralKind(node.argumentExpression.kind)))
  );
}

/**
 * Checks if a conditional node is necessary:
 * if the type of the node is always true or always false, it's not necessary.
 */
function checkNode(
  node: AST.Expression,
  context: Context,
  isUnaryNotArgument = false,
): void {
  // Check if the node is Unary Negation expression and handle it
  if (node.kind === SyntaxKind.PrefixUnaryExpression) {
    return checkNode(node.operand, context, true);
  }

  // Since typescript array index signature types don't represent the
  //  possibility of out-of-bounds access, if we're indexing into an array
  //  just skip the check, to avoid false positives
  if (isArrayIndexExpression(node, context)) {
    return;
  }

  // When checking logical expressions, only check the right side
  //  as the left side has been checked by checkLogicalExpressionForUnnecessaryConditionals
  //
  // Unless the node is nullish coalescing, as it's common to use patterns like `nullBool ?? true` to to strict
  //  boolean checks if we inspect the right here, it'll usually be a constant condition on purpose.
  // In this case it's better to inspect the type of the expression as a whole.
  if (
    node.kind === SyntaxKind.BinaryExpression &&
    isLogicalExpression(node.operatorToken) &&
    node.operatorToken.kind !== SyntaxKind.QuestionQuestionToken
  ) {
    return checkNode(node.right, context);
  }

  const type = context.utils.getConstrainedTypeAtLocation(node);

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

  if (isTypeFlagSet(type, TypeFlags.Never)) {
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

  if (message) context.report({ node, message });
}

function checkNodeForNullish(node: AST.Expression, context: Context): void {
  const type = context.utils.getConstrainedTypeAtLocation(node);

  // Conditional is always necessary if it involves `any`, `unknown` or a naked type parameter
  if (
    isTypeFlagSet(
      type,
      TypeFlags.Any | TypeFlags.Unknown | TypeFlags.TypeParameter,
    )
  ) {
    return;
  }

  let message: string | null = null;
  if (isTypeFlagSet(type, TypeFlags.Never)) {
    message = messages.never;
  } else if (!isPossiblyNullish(type)) {
    message = messages.neverNullish;
  } else if (unionTypeParts(type).every(isNullishType)) {
    message = messages.alwaysNullish;
  }

  if (message) context.report({ node, message });
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
const BOOL_OPERATORS = new Set([
  SyntaxKind.LessThanToken, // <
  SyntaxKind.GreaterThanToken, // >
  SyntaxKind.LessThanEqualsToken, // <=
  SyntaxKind.GreaterThanEqualsToken, // >=
  SyntaxKind.EqualsEqualsToken, // ==
  SyntaxKind.EqualsEqualsEqualsToken, // ===
  SyntaxKind.ExclamationEqualsToken, // !=
  SyntaxKind.ExclamationEqualsEqualsToken, // !==
]);
function checkIfBinaryExpressionIsNecessaryConditional(
  node: AST.BinaryExpression,
  context: Context,
): void {
  if (!BOOL_OPERATORS.has(node.operatorToken.kind)) {
    return;
  }
  const leftType = context.utils.getConstrainedTypeAtLocation(node.left);
  const rightType = context.utils.getConstrainedTypeAtLocation(node.right);
  if (isLiteral(leftType) && isLiteral(rightType)) {
    context.report({ node, message: messages.literalBooleanExpression });
    return;
  }

  // Workaround for https://github.com/microsoft/TypeScript/issues/37160
  const UNDEFINED = TypeFlags.Undefined;
  const NULL = TypeFlags.Null;
  const VOID = TypeFlags.Void;
  const isComparable = (type: ts.Type, flag: TypeFlags): boolean => {
    // Allow comparison to `any`, `unknown` or a naked type parameter.
    flag |= TypeFlags.Any | TypeFlags.Unknown | TypeFlags.TypeParameter;

    // Allow loose comparison to nullish values.
    if (
      node.operatorToken.kind === SyntaxKind.EqualsEqualsToken ||
      node.operatorToken.kind === SyntaxKind.ExclamationEqualsToken
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
): void {
  /**
   * Allow:
   *   while (true) {}
   *   for (;true;) {}
   *   do {} while (true)
   */
  if (
    context.options.allowConstantLoopConditions &&
    isTrueLiteralType(context.utils.getConstrainedTypeAtLocation(testNode))
  ) {
    return;
  }

  checkNode(testNode, context);
}

const ARRAY_PREDICATE_FUNCTIONS = new Set(["filter", "find", "some", "every"]);
function isArrayPredicateFunction(
  node: AST.CallExpression,
  context: Context,
): boolean {
  const { expression: callee } = node;
  return (
    // looks like `something.filter` or `something.find`
    callee.kind === SyntaxKind.PropertyAccessExpression &&
    callee.name.kind === SyntaxKind.Identifier &&
    ARRAY_PREDICATE_FUNCTIONS.has(callee.name.text) &&
    // and the left-hand side is an array, according to the types
    (nodeIsArrayType(callee.expression, context) ||
      nodeIsTupleType(callee.expression, context))
  );
}
function checkCallExpression(node: AST.CallExpression, context: Context): void {
  if (node.questionDotToken) {
    if (isOptionableExpression(node.expression, context)) return;
    context.report({
      node: node.questionDotToken,
      message: messages.neverOptionalChain,
    });
  }

  // If this is something like arr.filter(x => /*condition*/), check `condition`
  if (isArrayPredicateFunction(node, context) && node.arguments.length) {
    const callback = node.arguments[0]!;
    // Inline defined functions
    if (
      callback.kind === SyntaxKind.ArrowFunction ||
      callback.kind === SyntaxKind.FunctionExpression
    ) {
      // Two special cases, where we can directly check the node that's returned:
      // () => something
      if (callback.body.kind !== SyntaxKind.Block) {
        return checkNode(callback.body, context);
      }
      // () => { return something; }
      const callbackBody = callback.body.statements;
      if (
        callbackBody.length === 1 &&
        callbackBody[0].kind === SyntaxKind.ReturnStatement &&
        callbackBody[0].expression
      ) {
        return checkNode(callbackBody[0].expression, context);
      }
      // Potential enhancement: could use code-path analysis to check
      //   any function with a single return statement
      // (Value to complexity ratio is dubious however)
    }
    // Otherwise just do type analysis on the function as a whole.
    const returnTypes = getCallSignaturesOfType(
      context.utils.getConstrainedTypeAtLocation(callback),
    ).map((sig) => sig.getReturnType());
    if (returnTypes.length === 0) {
      // Not a callable function
      return;
    }
    // Predicate is always necessary if it involves `any` or `unknown`
    if (
      returnTypes.some((t) =>
        isTypeFlagSet(t, TypeFlags.Any | TypeFlags.Unknown),
      )
    ) {
      return;
    }
    if (!returnTypes.some(isPossiblyFalsy)) {
      return context.report({
        node: callback,
        message: messages.alwaysTruthyFunc,
      });
    }
    if (!returnTypes.some(isPossiblyTruthy)) {
      return context.report({
        node: callback,
        message: messages.alwaysFalsyFunc,
      });
    }
  }
}

function isOptionableExpression(
  node: AST.Expression,
  context: Context,
): boolean {
  const type = context.utils.getConstrainedTypeAtLocation(node);
  if (isTypeFlagSet(type, TypeFlags.Any | TypeFlags.Unknown)) {
    return true;
  }

  if (
    node.kind === SyntaxKind.PropertyAccessExpression &&
    node.name.kind === SyntaxKind.Identifier
  ) {
    const expressionType = context.utils
      .getConstrainedTypeAtLocation(node.expression)
      .getNonNullableType();
    return unionTypeParts(expressionType).some((part) => {
      const propType = context.checker.getTypeOfPropertyOfType(
        part,
        node.name.text,
      );
      if (propType) return possiblyRequiresOptional(propType);
      return !!context.checker.getIndexInfoOfType(part, ts.IndexKind.String);
    });
  }

  if (node.kind === SyntaxKind.ElementAccessExpression) {
    const expressionType = context.utils
      .getConstrainedTypeAtLocation(node.expression)
      .getNonNullableType();
    const propertyType = context.utils.getConstrainedTypeAtLocation(
      node.argumentExpression,
    );
    return unionTypeParts(expressionType).some((part) => {
      return possiblyRequiresOptionalPropertyType(part, propertyType, context);
    });
  }

  if (node.kind === SyntaxKind.CallExpression) {
    const prevType = context.utils.getConstrainedTypeAtLocation(
      node.expression,
    );
    return getCallSignaturesOfType(prevType).some((sig) =>
      possiblyRequiresOptional(sig.getReturnType()),
    );
  }

  return possiblyRequiresOptional(type);
}

function possiblyRequiresOptionalPropertyType(
  objType: ts.Type,
  propertyType: ts.Type,
  context: Context,
): boolean {
  if (propertyType.isUnion()) {
    return propertyType.types.some((type) =>
      possiblyRequiresOptionalPropertyType(objType, type, context),
    );
  }
  if (propertyType.isNumberLiteral() || propertyType.isStringLiteral()) {
    const propType = context.checker.getTypeOfPropertyOfType(
      objType,
      propertyType.value.toString(),
    );
    if (propType) return possiblyRequiresOptional(propType);
  }
  return true;
}

const possiblyRequiresOptional = (type: ts.Type) =>
  type.isUnion() ? type.types.some(requireOptional) : requireOptional(type);
const requireOptional = (type: ts.Type) =>
  isTypeFlagSet(type, requiresOptionalFlag);
const requiresOptionalFlag =
  TypeFlags.TypeParameter |
  TypeFlags.Any |
  TypeFlags.Unknown |
  TypeFlags.Null |
  TypeFlags.Void |
  TypeFlags.Undefined;

const isTruthyLiteral = (type: ts.Type): boolean =>
  isTrueLiteralType(type) || (type.isLiteral() && !!type.value);

let latencies: number[][] = [];

function recordData(): void {
  if (!latencies[0]) latencies[0] = [];
  latencies[0].push(4);
}

recordData();

const isPossiblyFalsy = (type: ts.Type): boolean =>
  unionTypeParts(type)
    // Intersections like `string & {}` can also be possibly falsy,
    // requiring us to look into the intersection.
    .flatMap((type) => intersectionTypeParts(type))
    // PossiblyFalsy flag includes literal values, so exclude ones that
    // are definitely truthy
    .filter((t) => !isTruthyLiteral(t))
    .some((type) => isTypeFlagSet(type, TypeFlags.PossiblyFalsy));

const isPossiblyTruthy = (type: ts.Type): boolean =>
  unionTypeParts(type)
    .map((type) => intersectionTypeParts(type))
    .some((intersectionParts) =>
      // It is possible to define intersections that are always falsy,
      // like `"" & { __brand: string }`.
      intersectionParts.every((type) => !isFalsyType(type)),
    );

// Nullish utilities
const nullishFlag = TypeFlags.Undefined | TypeFlags.Null;
const isNullishType = (type: ts.Type): boolean =>
  isTypeFlagSet(type, nullishFlag);

const isPossiblyNullish = (type: ts.Type): boolean =>
  unionTypeParts(type).some(isNullishType);

// isLiteralType only covers numbers and strings, this is a more exhaustive check.
const isLiteral = (type: ts.Type): boolean =>
  isBooleanLiteralType(type) ||
  type.flags === TypeFlags.Undefined ||
  type.flags === TypeFlags.Null ||
  type.flags === TypeFlags.Void ||
  type.isLiteral();

const necessaryConditionTest = (condition: string): string => `
declare const b1: ${condition};
declare const b2: boolean;
const t1 = b1 && b2;
`;
const unnecessaryConditionTest = (
  condition: string,
  messageId: keyof typeof messages,
) => ({
  code: necessaryConditionTest(condition),
  error: messages[messageId],
});

export const test = () =>
  ruleTester({
    rule: noUnnecessaryCondition,
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
    `,
      `
declare function foo(): number | void;
const result1 = foo() === undefined;
const result2 = foo() == null;
    `,
      `
declare function foo<T>(): T;
foo()?.a`,
      necessaryConditionTest("false | 5"),
      // Truthy literal and falsy literal
      necessaryConditionTest('boolean | "foo"'),
      // boolean and truthy literal
      necessaryConditionTest("0 | boolean"),
      // boolean and falsy literal
      necessaryConditionTest("boolean | object"),
      // boolean and always-truthy type
      necessaryConditionTest("false | object"),
      // always truthy type and falsy literal
      // always falsy type and always truthy type
      necessaryConditionTest("null | object"),
      necessaryConditionTest("undefined | true"),
      necessaryConditionTest("void | true"),
      // "branded" type
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
      necessaryConditionTest("any"),
      // any
      necessaryConditionTest("unknown"),
      // unknown

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
    `,
      // Boolean expressions
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
      // Predicate functions
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
    `,
      // Ignores non-array methods of the same name
      `
const notArray = {
  filter: (func: () => boolean) => func(),
  find: (func: () => boolean) => func(),
};
notArray.filter(() => true);
notArray.find(() => true);
    `,
      // Nullish coalescing operator
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
      // Indexing cases
      `
declare const arr: object[];
if (arr[42]) {
} // looks unnecessary from the types, but isn't

const tuple = [{}] as [object];
declare const n: number;
if (tuple[n]) {
}
    `,
      // Optional-chaining indexing
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
declare const returnsArr: undefined | (() => string[]);
if (returnsArr?.()[42]) {
}
returnsArr?.()[42]?.toUpperCase();
    `,
      // Doesn't check the right-hand side of a logical expression
      //  in a non-conditional context
      {
        code: `
declare const b1: boolean;
declare const b2: true;
const x = b1 && b2;
      `,
      },
      {
        code: `
while (true) {}
for (; true; ) {}
do {} while (true);
      `,
        options: {
          allowConstantLoopConditions: true,
        },
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
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/7700
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
        code: `
type BrandedKey = string & { __brand: string };
type Foo = { [key: BrandedKey]: string } | null;
declare const foo: Foo;
const key = '1' as BrandedKey;
foo?.[key]?.trim();
      `,
      },
      {
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
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/2421
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
declare let foo: number;
foo &&= 1;
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/6264
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
      `,
        errors: [
          [messages.alwaysTruthy, 4, 12],
          [messages.alwaysTruthy, 5, 12],
          [messages.alwaysTruthy, 6, 5],
          [messages.alwaysTruthy, 8, 11],
          [messages.alwaysTruthy, 10, 8],
          [messages.alwaysTruthy, 11, 14],
          [messages.alwaysTruthy, 12, 17],
          [messages.alwaysTruthy, 15, 12],
          [messages.alwaysTruthy, 16, 18],
        ],
      },
      // Ensure that it's complaining about the right things
      unnecessaryConditionTest("object", "alwaysTruthy"),
      unnecessaryConditionTest("object | true", "alwaysTruthy"),
      unnecessaryConditionTest('"" | false', "alwaysFalsy"),
      // Two falsy literals
      unnecessaryConditionTest('"always truthy"', "alwaysTruthy"),
      unnecessaryConditionTest(`undefined`, "alwaysFalsy"),
      unnecessaryConditionTest("null", "alwaysFalsy"),
      unnecessaryConditionTest("void", "alwaysFalsy"),
      unnecessaryConditionTest("never", "never"),
      unnecessaryConditionTest("string & number", "never"),
      // More complex logical expressions
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
          [messages.alwaysTruthy, 4, 5],
          [messages.alwaysFalsy, 6, 11],
          [messages.alwaysTruthy, 8, 17],
        ],
      },
      // Generic type params
      {
        code: `
function test<T extends object>(t: T) {
  return t ? 'yes' : 'no';
}
      `,
        errors: [[messages.alwaysTruthy, 3, 10]],
      },
      {
        code: `
function test<T extends false>(t: T) {
  return t ? 'yes' : 'no';
}
      `,
        errors: [[messages.alwaysFalsy, 3, 10]],
      },
      {
        code: `
function test<T extends 'a' | 'b'>(t: T) {
  return t ? 'yes' : 'no';
}
      `,
        errors: [[messages.alwaysTruthy, 3, 10]],
      },
      // Boolean expressions
      {
        code: `
function test(a: 'a') {
  return a === 'a';
}
      `,
        errors: [[messages.literalBooleanExpression, 3, 10]],
      },
      {
        code: `
const y = 1;
if (y === 0) {
}
      `,
        errors: [[messages.literalBooleanExpression, 3, 5]],
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
        errors: [[messages.literalBooleanExpression, 8, 5]],
      },
      // Workaround https://github.com/microsoft/TypeScript/issues/37160
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
          [messages.noOverlapBooleanExpression, 3, 14],
          [messages.noOverlapBooleanExpression, 4, 14],
          [messages.noOverlapBooleanExpression, 5, 14],
          [messages.noOverlapBooleanExpression, 6, 14],
          [messages.noOverlapBooleanExpression, 7, 14],
          [messages.noOverlapBooleanExpression, 8, 14],
          [messages.noOverlapBooleanExpression, 9, 14],
          [messages.noOverlapBooleanExpression, 10, 14],
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
          [messages.noOverlapBooleanExpression, 7, 14],
          [messages.noOverlapBooleanExpression, 8, 14],
          [messages.noOverlapBooleanExpression, 9, 14],
          [messages.noOverlapBooleanExpression, 10, 14],
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
          [messages.noOverlapBooleanExpression, 3, 14],
          [messages.noOverlapBooleanExpression, 4, 14],
          [messages.noOverlapBooleanExpression, 5, 14],
          [messages.noOverlapBooleanExpression, 6, 14],
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
          [messages.noOverlapBooleanExpression, 3, 14],
          [messages.noOverlapBooleanExpression, 4, 14],
          [messages.noOverlapBooleanExpression, 5, 14],
          [messages.noOverlapBooleanExpression, 6, 14],
          [messages.noOverlapBooleanExpression, 7, 14],
          [messages.noOverlapBooleanExpression, 8, 14],
          [messages.noOverlapBooleanExpression, 9, 14],
          [messages.noOverlapBooleanExpression, 10, 14],
          [messages.noOverlapBooleanExpression, 11, 14],
          [messages.noOverlapBooleanExpression, 12, 15],
          [messages.noOverlapBooleanExpression, 13, 15],
          [messages.noOverlapBooleanExpression, 14, 15],
          [messages.noOverlapBooleanExpression, 15, 15],
          [messages.noOverlapBooleanExpression, 16, 15],
          [messages.noOverlapBooleanExpression, 17, 15],
          [messages.noOverlapBooleanExpression, 18, 15],
        ],
      },
      // Nullish coalescing operator
      {
        code: `
function test(a: string) {
  return a ?? 'default';
}
      `,
        errors: [[messages.neverNullish, 3, 10]],
      },
      {
        code: `
function test(a: string | false) {
  return a ?? 'default';
}
      `,
        errors: [[messages.neverNullish, 3, 10]],
      },
      {
        code: `
function test<T extends string>(a: T) {
  return a ?? 'default';
}
      `,
        errors: [[messages.neverNullish, 3, 10]],
      },
      // nullish + array index without optional chaining
      {
        code: `
function test(a: { foo: string }[]) {
  return a[0].foo ?? 'default';
}
      `,
        errors: [[messages.neverNullish, 3, 10]],
      },
      {
        code: `
function test(a: null) {
  return a ?? 'default';
}
      `,
        errors: [[messages.alwaysNullish, 3, 10]],
      },
      {
        code: `
function test(a: null[]) {
  return a[0] ?? 'default';
}
      `,
        errors: [[messages.alwaysNullish, 3, 10]],
      },
      {
        code: `
function test<T extends null>(a: T) {
  return a ?? 'default';
}
      `,
        errors: [[messages.alwaysNullish, 3, 10]],
      },
      {
        code: `
function test(a: never) {
  return a ?? 'default';
}
      `,
        errors: [[messages.never, 3, 10]],
      },
      // Predicate functions
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
          [messages.alwaysTruthy, 2, 24],
          [messages.alwaysFalsy, 4, 10],
          [messages.alwaysFalsy, 9, 25],
          [messages.alwaysFalsy, 13, 25],
          [messages.alwaysFalsy, 17, 25],
        ],
      },
      // Indexing cases
      {
        // This is an error because 'dict' doesn't represent
        //  the potential for undefined in its types
        code: `
declare const dict: Record<string, object>;
if (dict['mightNotExist']) {
}
      `,
        errors: [[messages.alwaysTruthy, 3, 5]],
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
          [messages.alwaysTruthy, 3, 5],
          [messages.neverOptionalChain, 5, 9],
        ],
      },
      {
        // Shouldn't mistake this for an array indexing case
        code: `
declare const arr: object[];
if (arr.filter) {
}
      `,
        errors: [[messages.alwaysTruthy, 3, 5]],
      },
      {
        code: `
function truthy() {
  return [];
}
function falsy() {}
[1, 3, 5].filter(truthy);
[1, 2, 3].find(falsy);
      `,
        errors: [
          [messages.alwaysTruthyFunc, 6, 18],
          [messages.alwaysFalsyFunc, 7, 16],
        ],
      },
      //       {
      //         code: `
      // const isTruthy = <T>(t: T) => t;
      // // Valid: numbers can be truthy or falsy (0).
      // [0,1,2,3].filter(isTruthy);
      // // Invalid: arrays are always falsy.
      // [[1,2], [3,4]].filter(isTruthy);
      //       `,
      //         errors: [[messages.alwaysTruthy, 6, 23]],
      //       },
      {
        code: `
while (true) {}
for (; true; ) {}
do {} while (true);
      `,
        options: {
          allowConstantLoopConditions: false,
        },
        errors: [
          [messages.alwaysTruthy, 2, 8],
          [messages.alwaysTruthy, 3, 8],
          [messages.alwaysTruthy, 4, 14],
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
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 5,
          },
          {
            message: messages.neverOptionalChain,
            line: 5,
            column: 5,
          },
          {
            message: messages.neverOptionalChain,
            line: 8,
            column: 3,
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
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 5,
          },
          {
            message: messages.neverOptionalChain,
            line: 5,
            column: 5,
          },
          {
            message: messages.neverOptionalChain,
            line: 8,
            column: 3,
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
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 5,
          },
          {
            message: messages.neverOptionalChain,
            line: 5,
            column: 5,
          },
          {
            message: messages.neverOptionalChain,
            line: 8,
            column: 3,
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
            column: 9,
          },
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 14,
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
            column: 9,
          },
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 14,
          },
          {
            message: messages.neverOptionalChain,
            line: 3,
            column: 19,
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
            column: 9,
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 14,
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 22,
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
            column: 9,
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 22,
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
            column: 9,
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 23,
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
          },
        ],
      },
      {
        code: `
declare const x: { a: { b: number } }[];
x[0].a?.b;
      `,
        errors: [[messages.neverOptionalChain, 3, 7]],
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
          },
        ],
      },
      // https://github.com/typescript-eslint/typescript-eslint/issues/2384
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
          },
        ],
      },
      // https://github.com/typescript-eslint/typescript-eslint/issues/2255
      {
        code: `
const a = null;
if (!a) {
}
      `,
        errors: [[messages.alwaysTruthy, 3, 6]],
      },
      {
        code: `
const a = true;
if (!a) {
}
      `,
        errors: [[messages.alwaysFalsy, 3, 6]],
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
        errors: [[messages.never, 7, 6]],
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
            column: 16,
          },
          {
            message: messages.neverOptionalChain,
            line: 4,
            column: 21,
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
          },
        ],
      },
      // "branded" types
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
