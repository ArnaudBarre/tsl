import ts, { SyntaxKind, TypeFlags } from "typescript";
import { defineRule, isFunction } from "../_utils/index.ts";
import type { AST, Context, Suggestion } from "../../types.ts";

export const messages = {
  preferOptionalSyntax:
    "Using `= undefined` to make a parameter optional adds unnecessary runtime logic. Use the `?` optional syntax instead.",
  uselessDefaultProperty:
    "Default value is useless because the property is not optional.",
  uselessDefaultParameter:
    "Default value is useless because the parameter is not optional.",
  uselessUndefined:
    "Default value is useless because optional properties are already undefined by default.",
  fix: "Fix",
};

// https://typescript-eslint.io/rules/no-useless-default-assignment
export const noUselessDefaultAssignment = defineRule(() => ({
  name: "core/noUselessDefaultAssignment",
  visitor: {
    BindingElement(context, node) {
      if (!node.initializer) return;
      if (
        node.initializer.kind === SyntaxKind.Identifier
        && node.initializer.text === "undefined"
      ) {
        report(context, node, messages.uselessUndefined);
        return;
      }
      if (node.parent.kind === SyntaxKind.ArrayBindingPattern) {
        const sourceType = getSourceTypeForPattern(context, node.parent);
        if (!sourceType) return;
        if (!context.checker.isTupleType(sourceType)) return;
        const tupleArgs = context.checker.getTypeArguments(sourceType);
        const elementIndex = node.parent.elements.indexOf(node);
        if (elementIndex < 0 || elementIndex >= tupleArgs.length) return;
        const elementType = tupleArgs[elementIndex];
        if (!canBeUndefined(context, elementType)) {
          report(context, node, messages.uselessDefaultProperty);
        }
      }
      if (node.parent.kind === SyntaxKind.ObjectBindingPattern) {
        const propertyType = getTypeOfProperty(context, node);
        if (!propertyType) return;
        if (!canBeUndefined(context, propertyType)) {
          report(context, node, messages.uselessDefaultProperty);
        }
      }
    },
    Parameter(context, node) {
      if (!node.initializer) return;
      if (
        node.initializer.kind === SyntaxKind.Identifier
        && node.initializer.text === "undefined"
      ) {
        context.report({
          node: node.initializer,
          message: messages.preferOptionalSyntax,
          suggestions: () => {
            const changes: Suggestion["changes"] = [removeInitializer(node)];
            if (node.type && !node.dotDotDotToken) {
              changes.push({ start: node.name.end, length: 0, newText: "?" });
            }
            return [{ message: messages.fix, changes }];
          },
        });
        return;
      }
      if (
        node.parent.kind === SyntaxKind.ArrowFunction
        || node.parent.kind === SyntaxKind.FunctionExpression
      ) {
        const paramIndex = node.parent.parameters.indexOf(node);
        const contextualType = context.checker.getContextualType(node.parent);
        if (!contextualType) return;
        const signatures = contextualType.getCallSignatures();
        if (
          signatures.length === 0
          || (signatures[0].getDeclaration() as AST.AnyNode) === node.parent
        ) {
          return;
        }
        const params = signatures[0].getParameters();
        const paramSymbol = params.at(paramIndex);
        if (!paramSymbol) return;
        if ((paramSymbol.flags & ts.SymbolFlags.Optional) === 0) {
          const paramType = context.checker.getTypeOfSymbol(paramSymbol);
          if (!canBeUndefined(context, paramType)) {
            report(context, node, messages.uselessDefaultParameter);
          }
        }
      }
    },
  },
}));

function getTypeOfProperty(
  context: Context,
  node: AST.BindingElement,
): ts.Type | null {
  const sourceType = getSourceTypeForPattern(context, node.parent);
  if (!sourceType) return null;
  const name = node.propertyName ?? node.name;
  const key =
    name.kind === SyntaxKind.StringLiteral
    || name.kind === SyntaxKind.Identifier
      ? name.text
      : null;
  if (!key) return null;
  const symbol = sourceType.getProperty(key);
  if (!symbol) return null;
  return context.checker.getTypeOfSymbol(symbol);
}

function canBeUndefined(context: Context, type: ts.Type): boolean {
  return context.utils.typeOrUnionHasFlag(
    type,
    TypeFlags.Undefined | TypeFlags.Any | TypeFlags.Unknown,
  );
}

function getSourceTypeForPattern(
  context: Context,
  pattern: AST.ArrayBindingPattern | AST.ObjectBindingPattern,
): ts.Type | null {
  const parent = pattern.parent;
  if (parent.kind === SyntaxKind.VariableDeclaration && parent.initializer) {
    return context.checker.getTypeAtLocation(parent.initializer);
  }

  if (
    parent.kind === SyntaxKind.Parameter
    && (isFunction(parent.parent)
      || parent.parent.kind === SyntaxKind.MethodDeclaration)
  ) {
    const paramIndex = parent.parent.parameters.indexOf(parent);
    const signature = context.checker.getSignatureFromDeclaration(
      parent.parent as unknown as ts.SignatureDeclaration,
    )!;
    const params = signature.getParameters();
    return context.checker.getTypeOfSymbol(params[paramIndex]);
  }

  if (parent.kind === SyntaxKind.BindingElement) {
    const sourceType = getSourceTypeForPattern(context, parent.parent);
    if (!sourceType) return null;
    if (parent.parent.kind === SyntaxKind.ObjectBindingPattern) {
      const propertyType = getTypeOfProperty(context, parent);
      if (!propertyType) return null;
      return propertyType;
    } else {
      if (context.checker.isTupleType(sourceType)) {
        const elementIndex = parent.parent.elements.indexOf(parent);
        const tupleArgs = context.checker.getTypeArguments(sourceType);
        if (elementIndex < tupleArgs.length) {
          return tupleArgs[elementIndex];
        }
      }
      return sourceType.getNumberIndexType() ?? null;
    }
  }

  return null;
}

function report(
  context: Context,
  node: AST.BindingElement | AST.ParameterDeclaration,
  message: string,
): void {
  context.report({
    node: node.initializer!,
    message,
    suggestions: [
      { message: messages.fix, changes: [removeInitializer(node)] },
    ],
  });
}

const removeInitializer = (
  node: AST.BindingElement | AST.ParameterDeclaration,
): Suggestion["changes"][number] => ({
  start:
    node.kind === SyntaxKind.BindingElement
      ? node.name.end
      : (node.type ?? node.name).end,
  end: node.initializer!.end,
  newText: "",
});
