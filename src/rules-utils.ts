import {
  intersectionTypeParts,
  isTypeParameter,
  unionTypeParts,
} from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import type { BinaryOperatorToken } from "./ast.ts";
import type { AST, Context } from "./types.ts";

export const run = <T>(cb: () => T) => cb();

const estreeLogicalOperator = [
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.QuestionQuestionToken,
];
export const isLogicalExpression = (token: BinaryOperatorToken) =>
  estreeLogicalOperator.includes(token.kind);

const estreeLiteral = [
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.BigIntLiteral,
  ts.SyntaxKind.TrueKeyword,
  ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.NullKeyword,
  ts.SyntaxKind.RegularExpressionLiteral,
];
export const isLiteralKind = (kind: ts.SyntaxKind) =>
  estreeLiteral.includes(kind);

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
  // type-lint-ignore no-unnecessary-condition
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

export function isBuiltinSymbolLike(
  program: ts.Program,
  type: ts.Type,
  symbolName: string | string[],
): boolean {
  return isBuiltinSymbolLikeRecurser(program, type, (subType) => {
    const symbol = subType.getSymbol();
    if (!symbol) {
      return false;
    }

    const actualSymbolName = symbol.getName();

    if (
      (Array.isArray(symbolName)
        ? symbolName.some((name) => actualSymbolName === name)
        : actualSymbolName === symbolName) &&
      isSymbolFromDefaultLibrary(program, symbol)
    ) {
      return true;
    }

    return null;
  });
}

export function isBuiltinSymbolLikeRecurser(
  program: ts.Program,
  type: ts.Type,
  predicate: (subType: ts.Type) => boolean | null,
): boolean {
  if (type.isIntersection()) {
    return type.types.some((t) =>
      isBuiltinSymbolLikeRecurser(program, t, predicate),
    );
  }
  if (type.isUnion()) {
    return type.types.every((t) =>
      isBuiltinSymbolLikeRecurser(program, t, predicate),
    );
  }
  // https://github.com/JoshuaKGoldberg/ts-api-utils/issues/382
  if ((isTypeParameter as (type: ts.Type) => boolean)(type)) {
    const t = type.getConstraint();

    if (t) {
      return isBuiltinSymbolLikeRecurser(program, t, predicate);
    }

    return false;
  }

  const predicateResult = predicate(type);
  if (typeof predicateResult === "boolean") {
    return predicateResult;
  }

  const symbol = type.getSymbol();
  if (
    symbol &&
    symbol.flags & (ts.SymbolFlags.Class | ts.SymbolFlags.Interface)
  ) {
    const checker = program.getTypeChecker();
    for (const baseType of checker.getBaseTypes(type as ts.InterfaceType)) {
      if (isBuiltinSymbolLikeRecurser(program, baseType, predicate)) {
        return true;
      }
    }
  }
  return false;
}

export function isSymbolFromDefaultLibrary(
  program: ts.Program,
  symbol: ts.Symbol | undefined,
): boolean {
  if (!symbol) {
    return false;
  }

  const declarations = symbol.getDeclarations() ?? [];
  for (const declaration of declarations) {
    const sourceFile = declaration.getSourceFile();
    if (program.isSourceFileDefaultLibrary(sourceFile)) {
      return true;
    }
  }

  return false;
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
  context: Context<unknown, unknown>,
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
