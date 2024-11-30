/* eslint-disable @typescript-eslint/prefer-literal-enum-member -- the enums come from TS so to make merging upstream easier we purposely avoid adding literal values. */
import { SyntaxKind } from "typescript";
import type { AST } from "../../types.ts";

export enum OperatorPrecedence {
  // Expression:
  //     AssignmentExpression
  //     Expression `,` AssignmentExpression
  Comma,

  // NOTE: `Spread` is higher than `Comma` due to how it is parsed in |ElementList|
  // SpreadElement:
  //     `...` AssignmentExpression
  Spread,

  // AssignmentExpression:
  //     ConditionalExpression
  //     YieldExpression
  //     ArrowFunction
  //     AsyncArrowFunction
  //     LeftHandSideExpression `=` AssignmentExpression
  //     LeftHandSideExpression AssignmentOperator AssignmentExpression
  //
  // NOTE: AssignmentExpression is broken down into several precedences due to the requirements
  //       of the parenthesize rules.

  // AssignmentExpression: YieldExpression
  // YieldExpression:
  //     `yield`
  //     `yield` AssignmentExpression
  //     `yield` `*` AssignmentExpression
  Yield,

  // AssignmentExpression: LeftHandSideExpression `=` AssignmentExpression
  // AssignmentExpression: LeftHandSideExpression AssignmentOperator AssignmentExpression
  // AssignmentOperator: one of
  //     `*=` `/=` `%=` `+=` `-=` `<<=` `>>=` `>>>=` `&=` `^=` `|=` `**=`
  Assignment,

  // NOTE: `Conditional` is considered higher than `Assignment` here, but in reality they have
  //       the same precedence.
  // AssignmentExpression: ConditionalExpression
  // ConditionalExpression:
  //     ShortCircuitExpression
  //     ShortCircuitExpression `?` AssignmentExpression `:` AssignmentExpression
  // ShortCircuitExpression:
  //     LogicalORExpression
  //     CoalesceExpression
  Conditional,

  // CoalesceExpression:
  //     CoalesceExpressionHead `??` BitwiseORExpression
  // CoalesceExpressionHead:
  //     CoalesceExpression
  //     BitwiseORExpression
  Coalesce = Conditional, // NOTE: This is wrong

  // LogicalORExpression:
  //     LogicalANDExpression
  //     LogicalORExpression `||` LogicalANDExpression
  LogicalOR,

  // LogicalANDExpression:
  //     BitwiseORExpression
  //     LogicalANDExpression `&&` BitwiseORExpression
  LogicalAND,

  // BitwiseORExpression:
  //     BitwiseXORExpression
  //     BitwiseORExpression `^` BitwiseXORExpression
  BitwiseOR,

  // BitwiseXORExpression:
  //     BitwiseANDExpression
  //     BitwiseXORExpression `^` BitwiseANDExpression
  BitwiseXOR,

  // BitwiseANDExpression:
  //     EqualityExpression
  //     BitwiseANDExpression `^` EqualityExpression
  BitwiseAND,

  // EqualityExpression:
  //     RelationalExpression
  //     EqualityExpression `==` RelationalExpression
  //     EqualityExpression `!=` RelationalExpression
  //     EqualityExpression `===` RelationalExpression
  //     EqualityExpression `!==` RelationalExpression
  Equality,

  // RelationalExpression:
  //     ShiftExpression
  //     RelationalExpression `<` ShiftExpression
  //     RelationalExpression `>` ShiftExpression
  //     RelationalExpression `<=` ShiftExpression
  //     RelationalExpression `>=` ShiftExpression
  //     RelationalExpression `instanceof` ShiftExpression
  //     RelationalExpression `in` ShiftExpression
  //     [+TypeScript] RelationalExpression `as` Type
  Relational,

  // ShiftExpression:
  //     AdditiveExpression
  //     ShiftExpression `<<` AdditiveExpression
  //     ShiftExpression `>>` AdditiveExpression
  //     ShiftExpression `>>>` AdditiveExpression
  Shift,

  // AdditiveExpression:
  //     MultiplicativeExpression
  //     AdditiveExpression `+` MultiplicativeExpression
  //     AdditiveExpression `-` MultiplicativeExpression
  Additive,

  // MultiplicativeExpression:
  //     ExponentiationExpression
  //     MultiplicativeExpression MultiplicativeOperator ExponentiationExpression
  // MultiplicativeOperator: one of `*`, `/`, `%`
  Multiplicative,

  // ExponentiationExpression:
  //     UnaryExpression
  //     UpdateExpression `**` ExponentiationExpression
  Exponentiation,

  // UnaryExpression:
  //     UpdateExpression
  //     `delete` UnaryExpression
  //     `void` UnaryExpression
  //     `typeof` UnaryExpression
  //     `+` UnaryExpression
  //     `-` UnaryExpression
  //     `~` UnaryExpression
  //     `!` UnaryExpression
  //     AwaitExpression
  // UpdateExpression:            // TODO: Do we need to investigate the precedence here?
  //     `++` UnaryExpression
  //     `--` UnaryExpression
  Unary,

  // UpdateExpression:
  //     LeftHandSideExpression
  //     LeftHandSideExpression `++`
  //     LeftHandSideExpression `--`
  Update,

  // LeftHandSideExpression:
  //     NewExpression
  //     CallExpression
  // NewExpression:
  //     MemberExpression
  //     `new` NewExpression
  LeftHandSide,

  // CallExpression:
  //     CoverCallExpressionAndAsyncArrowHead
  //     SuperCall
  //     ImportCall
  //     CallExpression Arguments
  //     CallExpression `[` Expression `]`
  //     CallExpression `.` IdentifierName
  //     CallExpression TemplateLiteral
  // MemberExpression:
  //     PrimaryExpression
  //     MemberExpression `[` Expression `]`
  //     MemberExpression `.` IdentifierName
  //     MemberExpression TemplateLiteral
  //     SuperProperty
  //     MetaProperty
  //     `new` MemberExpression Arguments
  Member,

  // TODO: JSXElement?
  // PrimaryExpression:
  //     `this`
  //     IdentifierReference
  //     Literal
  //     ArrayLiteral
  //     ObjectLiteral
  //     FunctionExpression
  //     ClassExpression
  //     GeneratorExpression
  //     AsyncFunctionExpression
  //     AsyncGeneratorExpression
  //     RegularExpressionLiteral
  //     TemplateLiteral
  //     CoverParenthesizedExpressionAndArrowParameterList
  Primary,

  Highest = Primary,
  Lowest = Comma,
  // -1 is lower than all other precedences. Returning it will cause binary expression
  // parsing to stop.
  Invalid = -1,
}

export function getOperatorPrecedenceForNode(
  node: AST.AnyNode,
): OperatorPrecedence {
  switch (node.kind) {
    case SyntaxKind.SpreadElement:
      return OperatorPrecedence.Spread;

    case SyntaxKind.YieldExpression:
    case SyntaxKind.ArrowFunction:
      return OperatorPrecedence.Yield;

    case SyntaxKind.ConditionalExpression:
      return OperatorPrecedence.Conditional;

    case SyntaxKind.BinaryExpression:
      switch (node.operatorToken.kind) {
        case SyntaxKind.CommaToken:
          return OperatorPrecedence.Comma;
        case SyntaxKind.EqualsEqualsToken:
        case SyntaxKind.PlusEqualsToken:
        case SyntaxKind.MinusEqualsToken:
        case SyntaxKind.AsteriskAsteriskEqualsToken:
        case SyntaxKind.AsteriskEqualsToken:
        case SyntaxKind.SlashEqualsToken:
        case SyntaxKind.PercentEqualsToken:
        case SyntaxKind.LessThanLessThanEqualsToken:
        case SyntaxKind.GreaterThanGreaterThanEqualsToken:
        case SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
        case SyntaxKind.AmpersandEqualsToken:
        case SyntaxKind.CaretEqualsToken:
        case SyntaxKind.BarEqualsToken:
        case SyntaxKind.BarBarEqualsToken:
        case SyntaxKind.AmpersandAmpersandEqualsToken:
        case SyntaxKind.QuestionQuestionEqualsToken:
          return OperatorPrecedence.Assignment;

        default:
          return getBinaryOperatorPrecedence(node.operatorToken.kind);
      }

    case SyntaxKind.TypeAssertionExpression:
    case SyntaxKind.NonNullExpression:
    case SyntaxKind.PrefixUnaryExpression:
    case SyntaxKind.AwaitExpression:
      return OperatorPrecedence.Unary;

    case SyntaxKind.PostfixUnaryExpression:
      return OperatorPrecedence.Update;

    case SyntaxKind.CallExpression:
      return OperatorPrecedence.LeftHandSide;

    case SyntaxKind.NewExpression:
      return node.arguments && node.arguments.length > 0
        ? OperatorPrecedence.Member
        : OperatorPrecedence.LeftHandSide;

    case SyntaxKind.TaggedTemplateExpression:
    case SyntaxKind.PropertyAccessExpression:
    case SyntaxKind.ElementAccessExpression:
    case SyntaxKind.MetaProperty:
      return OperatorPrecedence.Member;

    case SyntaxKind.AsExpression:
      return OperatorPrecedence.Relational;

    case SyntaxKind.ThisKeyword:
    case SyntaxKind.SuperKeyword:
    case SyntaxKind.Identifier:
    case SyntaxKind.PrivateIdentifier:
    case SyntaxKind.StringLiteral:
    case SyntaxKind.NumericLiteral:
    case SyntaxKind.BigIntLiteral:
    case SyntaxKind.TrueKeyword:
    case SyntaxKind.FalseKeyword:
    case SyntaxKind.NullKeyword:
    case SyntaxKind.RegularExpressionLiteral:
    case SyntaxKind.ArrayLiteralExpression:
    case SyntaxKind.ObjectLiteralExpression:
    case SyntaxKind.FunctionExpression:
    case SyntaxKind.ClassExpression:
    case SyntaxKind.TemplateExpression:
    case SyntaxKind.JsxElement:
    case SyntaxKind.JsxFragment:
      // we don't have nodes for these cases
      // case SyntaxKind.ParenthesizedExpression:
      // case SyntaxKind.OmittedExpression:
      return OperatorPrecedence.Primary;

    default:
      return OperatorPrecedence.Invalid;
  }
}

export function getOperatorPrecedence(
  nodeKind: SyntaxKind,
  operatorKind: SyntaxKind,
  hasArguments?: boolean,
): OperatorPrecedence {
  switch (nodeKind) {
    // A list of comma-separated expressions. This node is only created by transformations.
    case SyntaxKind.CommaListExpression:
      return OperatorPrecedence.Comma;

    case SyntaxKind.SpreadElement:
      return OperatorPrecedence.Spread;

    case SyntaxKind.YieldExpression:
      return OperatorPrecedence.Yield;

    case SyntaxKind.ConditionalExpression:
      return OperatorPrecedence.Conditional;

    case SyntaxKind.BinaryExpression:
      switch (operatorKind) {
        case SyntaxKind.AmpersandAmpersandEqualsToken:
        case SyntaxKind.AmpersandEqualsToken:
        case SyntaxKind.AsteriskAsteriskEqualsToken:
        case SyntaxKind.AsteriskEqualsToken:
        case SyntaxKind.BarBarEqualsToken:
        case SyntaxKind.BarEqualsToken:
        case SyntaxKind.CaretEqualsToken:
        case SyntaxKind.EqualsToken:
        case SyntaxKind.GreaterThanGreaterThanEqualsToken:
        case SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
        case SyntaxKind.LessThanLessThanEqualsToken:
        case SyntaxKind.MinusEqualsToken:
        case SyntaxKind.PercentEqualsToken:
        case SyntaxKind.PlusEqualsToken:
        case SyntaxKind.QuestionQuestionEqualsToken:
        case SyntaxKind.SlashEqualsToken:
          return OperatorPrecedence.Assignment;

        case SyntaxKind.CommaToken:
          return OperatorPrecedence.Comma;

        default:
          return getBinaryOperatorPrecedence(operatorKind);
      }

    // TODO: Should prefix `++` and `--` be moved to the `Update` precedence?
    case SyntaxKind.TypeAssertionExpression:
    case SyntaxKind.NonNullExpression:
    case SyntaxKind.PrefixUnaryExpression:
    case SyntaxKind.TypeOfExpression:
    case SyntaxKind.VoidExpression:
    case SyntaxKind.DeleteExpression:
    case SyntaxKind.AwaitExpression:
      return OperatorPrecedence.Unary;

    case SyntaxKind.PostfixUnaryExpression:
      return OperatorPrecedence.Update;

    case SyntaxKind.CallExpression:
      return OperatorPrecedence.LeftHandSide;

    case SyntaxKind.NewExpression:
      return hasArguments
        ? OperatorPrecedence.Member
        : OperatorPrecedence.LeftHandSide;

    case SyntaxKind.TaggedTemplateExpression:
    case SyntaxKind.PropertyAccessExpression:
    case SyntaxKind.ElementAccessExpression:
    case SyntaxKind.MetaProperty:
      return OperatorPrecedence.Member;

    case SyntaxKind.AsExpression:
    case SyntaxKind.SatisfiesExpression:
      return OperatorPrecedence.Relational;

    case SyntaxKind.ThisKeyword:
    case SyntaxKind.SuperKeyword:
    case SyntaxKind.Identifier:
    case SyntaxKind.PrivateIdentifier:
    case SyntaxKind.NullKeyword:
    case SyntaxKind.TrueKeyword:
    case SyntaxKind.FalseKeyword:
    case SyntaxKind.NumericLiteral:
    case SyntaxKind.BigIntLiteral:
    case SyntaxKind.StringLiteral:
    case SyntaxKind.ArrayLiteralExpression:
    case SyntaxKind.ObjectLiteralExpression:
    case SyntaxKind.FunctionExpression:
    case SyntaxKind.ArrowFunction:
    case SyntaxKind.ClassExpression:
    case SyntaxKind.RegularExpressionLiteral:
    case SyntaxKind.NoSubstitutionTemplateLiteral:
    case SyntaxKind.TemplateExpression:
    case SyntaxKind.ParenthesizedExpression:
    case SyntaxKind.OmittedExpression:
    case SyntaxKind.JsxElement:
    case SyntaxKind.JsxSelfClosingElement:
    case SyntaxKind.JsxFragment:
      return OperatorPrecedence.Primary;

    default:
      return OperatorPrecedence.Invalid;
  }
}

export function getBinaryOperatorPrecedence(
  kind: SyntaxKind,
): OperatorPrecedence {
  switch (kind) {
    case SyntaxKind.MinusToken:
    case SyntaxKind.PlusToken:
      return OperatorPrecedence.Additive;

    case SyntaxKind.EqualsEqualsEqualsToken:
    case SyntaxKind.EqualsEqualsToken:
    case SyntaxKind.ExclamationEqualsEqualsToken:
    case SyntaxKind.ExclamationEqualsToken:
      return OperatorPrecedence.Equality;

    case SyntaxKind.QuestionQuestionToken:
      return OperatorPrecedence.Coalesce;

    case SyntaxKind.AsteriskToken:
    case SyntaxKind.PercentToken:
    case SyntaxKind.SlashToken:
      return OperatorPrecedence.Multiplicative;

    case SyntaxKind.AsteriskAsteriskToken:
      return OperatorPrecedence.Exponentiation;

    case SyntaxKind.AmpersandToken:
      return OperatorPrecedence.BitwiseAND;

    case SyntaxKind.AmpersandAmpersandToken:
      return OperatorPrecedence.LogicalAND;

    case SyntaxKind.CaretToken:
      return OperatorPrecedence.BitwiseXOR;

    case SyntaxKind.AsKeyword:
    case SyntaxKind.GreaterThanEqualsToken:
    case SyntaxKind.GreaterThanToken:
    case SyntaxKind.InKeyword:
    case SyntaxKind.InstanceOfKeyword:
    case SyntaxKind.LessThanEqualsToken:
    case SyntaxKind.LessThanToken:
      // case 'as': -- we don't have a token for this
      return OperatorPrecedence.Relational;

    case SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
    case SyntaxKind.GreaterThanGreaterThanToken:
    case SyntaxKind.LessThanLessThanToken:
      return OperatorPrecedence.Shift;

    case SyntaxKind.BarToken:
      return OperatorPrecedence.BitwiseOR;

    case SyntaxKind.BarBarToken:
      return OperatorPrecedence.LogicalOR;

    default:
      break;
  }

  // -1 is lower than all other precedences.  Returning it will cause binary expression
  // parsing to stop.
  return -1;
}
