import ts, { SyntaxKind } from "typescript";
import type { BinaryOperatorToken } from "./ast.ts";

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
