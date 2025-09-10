import { isUnionType } from "ts-api-utils";
import { type InterfaceType, SyntaxKind } from "typescript";
import { defineRule } from "../_utils/index.ts";
import type { AST, Context } from "../../types.ts";

export const messages = {
  useThisType: "Use `this` type instead.",
  fix: "Fix",
};

type Data = {
  currentClass: {
    className: string;
    type: InterfaceType;
  };
  currentMethod?: {
    hasReturnThis: boolean;
    hasReturnClassType: boolean;
    currentTypeNode: AST.TypeReferenceNode;
  };
};

// https://typescript-eslint.io/rules/prefer-return-this-type
export const preferReturnThisType = defineRule(() => ({
  name: "core/preferReturnThisType",
  createData: (): Data | undefined => undefined,
  visitor: {
    ClassDeclaration(context, node) {
      if (!node.name) return;
      context.data = {
        currentClass: {
          className: node.name.text,
          type: context.checker.getTypeAtLocation(node) as InterfaceType,
        },
      };
    },
    ClassDeclaration_exit(context) {
      context.data = undefined;
    },
    MethodDeclaration(context, node) {
      functionEnter(context, node);
    },
    MethodDeclaration_exit(context) {
      if (!context.data) return;
      functionExit(context);
      context.data.currentMethod = undefined;
    },
    PropertyDeclaration(context, node) {
      if (
        node.initializer?.kind === SyntaxKind.FunctionExpression
        || node.initializer?.kind === SyntaxKind.ArrowFunction
      ) {
        functionEnter(context, node.initializer);
        if (
          node.initializer.kind === SyntaxKind.ArrowFunction
          && node.initializer.body.kind !== SyntaxKind.Block
        ) {
          checkReturnExpression(context, node.initializer.body);
        }
      }
    },
    PropertyDeclaration_exit(context) {
      if (!context.data) return;
      functionExit(context);
      context.data.currentMethod = undefined;
    },
    ReturnStatement(context, node) {
      if (!node.expression) return;
      checkReturnExpression(context, node.expression);
    },
  },
}));

function functionEnter(
  context: Context<Data | undefined>,
  func: AST.MethodDeclaration | AST.FunctionExpression | AST.ArrowFunction,
): void {
  if (!context.data) return;
  if (!func.type) return;

  const node = tryGetNameInType(context.data.currentClass.className, func.type);
  if (!node) return;

  const firstArg = func.parameters.at(0);
  if (
    firstArg?.name.kind === SyntaxKind.Identifier
    && firstArg.name.text === "this"
  ) {
    return;
  }

  context.data.currentMethod = {
    hasReturnThis: false,
    hasReturnClassType: false,
    currentTypeNode: node,
  };
}

function functionExit(context: Context<Data | undefined>) {
  const data = context.data?.currentMethod;
  if (!data) return;

  if (data.hasReturnThis && !data.hasReturnClassType) {
    context.report({
      node: data.currentTypeNode,
      message: messages.useThisType,
      suggestions: [
        {
          message: messages.fix,
          changes: [{ node: data.currentTypeNode, newText: "this" }],
        },
      ],
    });
  }
}

function checkReturnExpression(
  context: Context<Data | undefined>,
  node: AST.Expression,
): void {
  const data = context.data;
  if (!data?.currentMethod) return;

  if (node.kind === SyntaxKind.ThisKeyword) {
    data.currentMethod.hasReturnThis = true;
  }
  const type = context.checker.getTypeAtLocation(node);
  if (data.currentClass.type === type) {
    data.currentMethod.hasReturnClassType = true;
    return;
  }
  if (data.currentClass.type.thisType === type) {
    data.currentMethod.hasReturnThis = true;
    return;
  }
  if (
    isUnionType(type)
    && type.types.some((typePart) => typePart === data.currentClass.type)
  ) {
    data.currentMethod.hasReturnClassType = true;
    return;
  }
}

function tryGetNameInType(
  name: string,
  typeNode: AST.TypeNode,
): AST.TypeReferenceNode | undefined {
  if (
    typeNode.kind === SyntaxKind.TypeReference
    && typeNode.typeName.kind === SyntaxKind.Identifier
    && typeNode.typeName.text === name
  ) {
    return typeNode;
  }

  if (typeNode.kind === SyntaxKind.UnionType) {
    for (const type of typeNode.types) {
      const found = tryGetNameInType(name, type);
      if (found) return found;
    }
  }

  return undefined;
}
