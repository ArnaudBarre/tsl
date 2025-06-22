import { isIntrinsicAnyType, isSymbolFlagSet } from "ts-api-utils";
import ts, { type NodeArray, SyntaxKind, TypeFlags } from "typescript";
import { defineRule } from "../_utils/index.ts";
import type { AnyNode, TypeNode } from "../../ast.ts";
import type { AST, Context } from "../../types.ts";

export const messages = {
  unnecessaryTypeParameter:
    "This is the default value for this type parameter, so it can be omitted.",
  removeTypeArgument: "Remove the type argument",
};

type ParameterCapableNode =
  | AST.CallExpression
  | AST.ExpressionWithTypeArguments
  | AST.ImportTypeNode
  | AST.JsxOpeningElement
  | AST.JsxSelfClosingElement
  | AST.NewExpression
  | AST.TaggedTemplateExpression
  | AST.TypeQueryNode
  | AST.TypeReferenceNode;

export const noUnnecessaryTypeArguments = defineRule(() => ({
  name: "core/noUnnecessaryTypeArguments",
  visitor: {
    CallExpression: checkParameters,
    ExpressionWithTypeArguments: checkParameters,
    ImportType: checkParameters,
    JsxOpeningElement: checkParameters,
    JsxSelfClosingElement: checkParameters,
    NewExpression: checkParameters,
    TaggedTemplateExpression: checkParameters,
    TypeQuery: checkParameters,
    TypeReference: checkParameters,
  },
}));

function checkParameters(context: Context, node: ParameterCapableNode) {
  const typeArguments = node.typeArguments;
  if (!typeArguments) return;
  const typeParameters = getTypeParametersFromNode(context, node);
  if (!typeParameters) return;
  checkTSArgsAndParameters(context, typeArguments, typeParameters);
}

function getTypeParametersFromNode(
  context: Context,
  node: ParameterCapableNode,
): readonly AST.TypeParameterDeclaration[] | undefined {
  if (node.kind === SyntaxKind.ExpressionWithTypeArguments) {
    return getTypeParametersFromType(context, node.expression);
  }

  if (node.kind === SyntaxKind.TypeReference) {
    return getTypeParametersFromType(context, node.typeName);
  }

  if (
    node.kind === SyntaxKind.CallExpression
    || node.kind === SyntaxKind.JsxOpeningElement
    || node.kind === SyntaxKind.JsxSelfClosingElement
    || node.kind === SyntaxKind.NewExpression
    || node.kind === SyntaxKind.TaggedTemplateExpression
  ) {
    return getTypeParametersFromCall(context, node);
  }

  return undefined;
}

function checkTSArgsAndParameters(
  context: Context,
  typeArguments: NodeArray<TypeNode>,
  typeParameters: readonly AST.TypeParameterDeclaration[],
): void {
  // Just check the last one. Must specify previous type parameters if the last one is specified.
  const i = typeArguments.length - 1;
  const arg = typeArguments[i];
  const param = typeParameters.at(i);
  if (!param?.default) return;

  const argType = context.checker.getTypeAtLocation(arg);
  if (context.utils.typeOrUnionHasFlag(argType, TypeFlags.TypeVariable)) {
    // This leads to false positives
    return;
  }
  const defaultType = context.checker.getTypeAtLocation(param.default);
  const isDefaultAny = isIntrinsicAnyType(defaultType);
  const isArgAny = isIntrinsicAnyType(argType);

  if ((isDefaultAny || isArgAny) && !(isDefaultAny && isArgAny)) {
    return;
  }
  if (
    context.checker.isTypeAssignableTo(argType, defaultType)
    && context.checker.isTypeAssignableTo(defaultType, argType)
  ) {
    context.report({
      node: arg,
      message: messages.unnecessaryTypeParameter,
      suggestions: [
        {
          message: messages.removeTypeArgument,
          changes: [
            {
              // Remove the preceding comma or angle bracket
              start: arg.getFullStart() - 1,
              // If only one type argument, remove the closing angle bracket
              end: i === 0 ? arg.getEnd() + 1 : arg.getEnd(),
              newText: "",
            },
          ],
        },
      ],
    });
  }
}

function getTypeParametersFromType(
  context: Context,
  type: AST.ClassDeclaration | AST.EntityName | AST.Expression,
) {
  const symAtLocation = context.checker.getSymbolAtLocation(type);
  if (!symAtLocation) return;

  const sym = getAliasedSymbol(context, symAtLocation);
  const declarations = sym.getDeclarations() as AnyNode[] | undefined;

  if (!declarations) return;

  const isInTypeContent =
    type.parent.kind === SyntaxKind.HeritageClause
    || type.parent.kind === SyntaxKind.TypeReference;

  const isTypeContextDeclaration = (decl: AnyNode) =>
    decl.kind === SyntaxKind.TypeAliasDeclaration
    || decl.kind === SyntaxKind.InterfaceDeclaration
      ? 1
      : 0;

  let typeParameters: readonly AST.TypeParameterDeclaration[] | undefined;

  for (const decl of declarations.sort((a, b) =>
    isInTypeContent
      ? isTypeContextDeclaration(a) - isTypeContextDeclaration(b)
      : isTypeContextDeclaration(b) - isTypeContextDeclaration(a),
  )) {
    if (
      decl.kind === SyntaxKind.TypeAliasDeclaration
      || decl.kind === SyntaxKind.InterfaceDeclaration
      || decl.kind === SyntaxKind.ClassDeclaration
      || decl.kind === SyntaxKind.ClassExpression
    ) {
      typeParameters = decl.typeParameters;
    }
    if (decl.kind === SyntaxKind.VariableDeclaration) {
      const type = context.checker.getTypeOfSymbol(symAtLocation);
      const sig = type.getConstructSignatures();
      typeParameters = sig.at(0)?.getDeclaration()
        .typeParameters as typeof typeParameters;
    }
    if (typeParameters) break;
  }
  return typeParameters;
}

function getTypeParametersFromCall(
  context: Context,
  node:
    | AST.CallExpression
    | AST.JsxOpeningElement
    | AST.JsxSelfClosingElement
    | AST.NewExpression
    | AST.TaggedTemplateExpression,
): readonly AST.TypeParameterDeclaration[] | undefined {
  const sig = context.checker.getResolvedSignature(node);
  const sigDecl = sig?.getDeclaration();
  if (!sigDecl) {
    return ts.isNewExpression(node)
      ? getTypeParametersFromType(context, node.expression)
      : undefined;
  }

  return sigDecl.typeParameters as AST.TypeParameterDeclaration[] | undefined;
}

function getAliasedSymbol(context: Context, symbol: ts.Symbol): ts.Symbol {
  return isSymbolFlagSet(symbol, ts.SymbolFlags.Alias)
    ? context.checker.getAliasedSymbol(symbol)
    : symbol;
}
