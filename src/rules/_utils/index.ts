import { intersectionTypeParts, unionTypeParts } from "ts-api-utils";
import ts, { type NodeArray, SyntaxKind, TypeFlags } from "typescript";
import type { AnyNode, BinaryOperatorToken, ModifierLike } from "../../ast.ts";
import type { AST, Checker, Context } from "../../types.ts";
import {
  getOperatorPrecedence,
  OperatorPrecedence,
} from "./getOperatorPrecedence.ts";

export const run = <T>(cb: () => T) => cb();

const estreeLogicalOperator = [
  SyntaxKind.BarBarToken,
  SyntaxKind.AmpersandAmpersandToken,
  SyntaxKind.QuestionQuestionToken,
];
export const isLogicalExpression = (token: BinaryOperatorToken) =>
  estreeLogicalOperator.includes(token.kind);

const estreeLiteral = [
  SyntaxKind.StringLiteral,
  SyntaxKind.NumericLiteral,
  SyntaxKind.BigIntLiteral,
  SyntaxKind.TrueKeyword,
  SyntaxKind.FalseKeyword,
  SyntaxKind.NullKeyword,
  SyntaxKind.RegularExpressionLiteral,
];
export const isLiteralKind = (kind: SyntaxKind) => estreeLiteral.includes(kind);

const functionTypes = [
  SyntaxKind.ArrowFunction,
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
];
export const isFunction = (
  node: AnyNode,
): node is
  | AST.ArrowFunction
  | AST.FunctionDeclaration
  | AST.FunctionExpression => functionTypes.includes(node.kind);

// Map to check exhaustiveness
const assignmentOperatorsMap: Record<
  ts.AssignmentOperator,
  ts.AssignmentOperator
> = {
  [SyntaxKind.EqualsToken]: SyntaxKind.EqualsToken,
  [SyntaxKind.PlusEqualsToken]: SyntaxKind.PlusEqualsToken,
  [SyntaxKind.MinusEqualsToken]: SyntaxKind.MinusEqualsToken,
  [SyntaxKind.AsteriskAsteriskEqualsToken]:
    SyntaxKind.AsteriskAsteriskEqualsToken,
  [SyntaxKind.AsteriskEqualsToken]: SyntaxKind.AsteriskEqualsToken,
  [SyntaxKind.SlashEqualsToken]: SyntaxKind.SlashEqualsToken,
  [SyntaxKind.PercentEqualsToken]: SyntaxKind.PercentEqualsToken,
  [SyntaxKind.AmpersandEqualsToken]: SyntaxKind.AmpersandEqualsToken,
  [SyntaxKind.BarEqualsToken]: SyntaxKind.BarEqualsToken,
  [SyntaxKind.CaretEqualsToken]: SyntaxKind.CaretEqualsToken,
  [SyntaxKind.LessThanLessThanEqualsToken]:
    SyntaxKind.LessThanLessThanEqualsToken,
  [SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]:
    SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  [SyntaxKind.GreaterThanGreaterThanEqualsToken]:
    SyntaxKind.GreaterThanGreaterThanEqualsToken,
  [SyntaxKind.BarBarEqualsToken]: SyntaxKind.BarBarEqualsToken,
  [SyntaxKind.AmpersandAmpersandEqualsToken]:
    SyntaxKind.AmpersandAmpersandEqualsToken,
  [SyntaxKind.QuestionQuestionEqualsToken]:
    SyntaxKind.QuestionQuestionEqualsToken,
};
const assignmentOperators = Object.values(
  assignmentOperatorsMap,
) as ts.BinaryOperator[];
export const isAssignmentExpression = (token: BinaryOperatorToken) =>
  assignmentOperators.includes(token.kind);

export function getParentFunctionNode(
  node: AST.AnyNode,
):
  | AST.ArrowFunction
  | AST.FunctionDeclaration
  | AST.FunctionExpression
  | AST.MethodDeclaration
  | null {
  let current = node.parent;
  // type-lint-ignore core/noUnnecessaryCondition
  while (current) {
    if (
      current.kind === SyntaxKind.ArrowFunction ||
      current.kind === SyntaxKind.FunctionDeclaration ||
      current.kind === SyntaxKind.MethodDeclaration ||
      current.kind === SyntaxKind.FunctionExpression
    ) {
      return current;
    }

    current = current.parent;
  }

  // this shouldn't happen in correct code, but someone may attempt to parse bad code
  // the parser won't error, so we shouldn't throw here
  return null;
}

const ARRAY_PREDICATE_FUNCTIONS = [
  "every",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "some",
];
export function isArrayMethodCallWithPredicate(
  context: Context<unknown>,
  node: AST.CallExpression,
): boolean {
  if (node.expression.kind !== SyntaxKind.PropertyAccessExpression) {
    return false;
  }

  if (node.expression.name.kind !== SyntaxKind.Identifier) {
    return false;
  }

  if (!ARRAY_PREDICATE_FUNCTIONS.includes(node.expression.name.text)) {
    return false;
  }

  const type = context.utils.getConstrainedTypeAtLocation(
    node.expression.expression,
  );
  return unionTypeParts(type)
    .flatMap((part) => intersectionTypeParts(part))
    .some(
      (t) => context.checker.isArrayType(t) || context.checker.isTupleType(t),
    );
}

export const hasModifier = (
  node: { readonly modifiers?: NodeArray<ModifierLike> },
  modifier: ModifierLike["kind"],
) => node.modifiers?.some((m) => m.kind === modifier) ?? false;

/**
 * Get the type name of a given type.
 * @param typeChecker The context sensitive TypeScript TypeChecker.
 * @param type The type to get the name of.
 */
export function getTypeName(
  typeChecker: ts.TypeChecker,
  type: ts.Type,
): string {
  // It handles `string` and string literal types as string.
  if ((type.flags & ts.TypeFlags.StringLike) !== 0) {
    return "string";
  }

  // If the type is a type parameter which extends primitive string types,
  // but it was not recognized as a string like. So check the constraint
  // type of the type parameter.
  if ((type.flags & ts.TypeFlags.TypeParameter) !== 0) {
    // `type.getConstraint()` method doesn't return the constraint type of
    // the type parameter for some reason. So this gets the constraint type
    // via AST.
    const symbol = type.getSymbol();
    const decls = symbol?.getDeclarations();
    const typeParamDecl = decls?.[0];
    if (
      typeParamDecl != null &&
      ts.isTypeParameterDeclaration(typeParamDecl) &&
      typeParamDecl.constraint != null
    ) {
      return getTypeName(
        typeChecker,
        typeChecker.getTypeFromTypeNode(typeParamDecl.constraint),
      );
    }
  }

  // If the type is a union and all types in the union are string like,
  // return `string`. For example:
  // - `"a" | "b"` is string.
  // - `string | string[]` is not string.
  if (
    type.isUnion() &&
    type.types
      .map((value) => getTypeName(typeChecker, value))
      .every((t) => t === "string")
  ) {
    return "string";
  }

  // If the type is an intersection and a type in the intersection is string
  // like, return `string`. For example: `string & {__htmlEscaped: void}`
  if (
    type.isIntersection() &&
    type.types
      .map((value) => getTypeName(typeChecker, value))
      .some((t) => t === "string")
  ) {
    return "string";
  }

  return typeChecker.typeToString(type);
}

export function isConstAssertion(node: AST.TypeNode): boolean {
  return (
    node.kind === SyntaxKind.TypeReference &&
    node.typeName.kind === SyntaxKind.Identifier &&
    node.typeName.text === "const"
  );
}

/**
 * Returns the contextual type of a given node.
 * Contextual type is the type of the target the node is going into.
 * i.e. the type of a called function's parameter, or the defined type of a variable declaration
 */
export function getContextualType(
  checker: Checker,
  node: AST.Expression,
): ts.Type | undefined {
  const parent = node.parent;

  if (
    parent.kind === SyntaxKind.CallExpression ||
    parent.kind === SyntaxKind.NewExpression
  ) {
    if (node === parent.expression) {
      // is the callee, so has no contextual type
      return;
    }
  } else if (
    parent.kind === SyntaxKind.VariableDeclaration ||
    parent.kind === SyntaxKind.PropertyDeclaration ||
    parent.kind === SyntaxKind.Parameter
  ) {
    return parent.type ? checker.getTypeFromTypeNode(parent.type) : undefined;
  } else if (parent.kind === SyntaxKind.JsxExpression) {
    return checker.getContextualType(parent);
  } else if (
    parent.kind === SyntaxKind.PropertyAssignment &&
    node.kind === SyntaxKind.Identifier
  ) {
    return checker.getContextualType(node);
  } else if (
    parent.kind === SyntaxKind.BinaryExpression &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    parent.right === node
  ) {
    // is RHS of assignment
    return checker.getTypeAtLocation(parent.left);
  } else if (
    ![ts.SyntaxKind.TemplateSpan, ts.SyntaxKind.JsxExpression].includes(
      parent.kind,
    )
  ) {
    // parent is not something we know we can get the contextual type of
    return;
  }
  // TODO - support return statement checking

  return checker.getContextualType(node);
}

export function isReferenceToGlobalFunction(
  node: AnyNode,
  context: Context<unknown>,
): boolean {
  const symbol = context.checker.getSymbolAtLocation(node);

  // If we can't find a symbol, assume it's global
  if (!symbol) return true;

  // If there are no declarations, it's likely global
  if (!symbol.declarations || symbol.declarations.length === 0) {
    return true;
  }

  return symbol.declarations.some(
    (decl) => decl.getSourceFile().isDeclarationFile,
  );
}

export function isHigherPrecedenceThanUnary(node: AST.AnyNode): boolean {
  const operator =
    node.kind === SyntaxKind.BinaryExpression
      ? node.operatorToken.kind
      : SyntaxKind.Unknown;
  return getOperatorPrecedence(node.kind, operator) > OperatorPrecedence.Unary;
}

/*** Indicates whether identifiers require the use of quotation marks when accessing property definitions and dot notation. */
export function requiresQuoting(
  name: string,
  target: ts.ScriptTarget | undefined,
): boolean {
  if (name.length === 0) return true;

  if (!ts.isIdentifierStart(name.charCodeAt(0), target)) return true;

  for (let i = 1; i < name.length; i += 1) {
    if (!ts.isIdentifierPart(name.charCodeAt(i), target)) {
      return true;
    }
  }

  return false;
}

export function typeHasFlag(type: ts.Type, flag: ts.TypeFlags): boolean {
  if (!type.isUnion()) return (type.flags & flag) !== 0;
  // @ts-expect-error Since typescript 5.0, this is invalid, but uses 0 as the default value of TypeFlags.
  let flags: ts.TypeFlags = 0;
  for (const t of type.types) flags |= t.flags;
  return (flags & flag) !== 0;
}

export function isTypeAnyArrayType(type: ts.Type, checker: Checker): boolean {
  return (
    checker.isArrayType(type) &&
    typeHasFlag(checker.getTypeArguments(type)[0], TypeFlags.Any)
  );
}

export function isTypeUnknownArrayType(
  type: ts.Type,
  checker: Checker,
): boolean {
  return (
    checker.isArrayType(type) &&
    typeHasFlag(checker.getTypeArguments(type)[0], TypeFlags.Unknown)
  );
}

export function isTypeRecurser(
  type: ts.Type,
  predicate: (t: ts.Type) => boolean,
): boolean {
  if (type.isUnionOrIntersection()) {
    return type.types.some((t) => isTypeRecurser(t, predicate));
  }

  return predicate(type);
}

export const getValueOfLiteralType = (
  type: ts.LiteralType,
): bigint | number | string => {
  if (typeof type.value === "object") {
    return BigInt((type.value.negative ? "-" : "") + type.value.base10Value);
  }
  return type.value;
};
