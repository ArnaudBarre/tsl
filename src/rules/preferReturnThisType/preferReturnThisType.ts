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

export const preferReturnThisType = defineRule(() => ({
  name: "core/preferReturnThisType",
  createData: (): Data | undefined => undefined,
  visitor: {
    ClassDeclaration(node, context) {
      if (!node.name) return;
      context.data = {
        currentClass: {
          className: node.name.text,
          type: context.checker.getTypeAtLocation(node) as InterfaceType,
        },
      };
    },
    ClassDeclaration_exit(_, context) {
      context.data = undefined;
    },
    MethodDeclaration(node, context) {
      functionEnter(context, node);
    },
    MethodDeclaration_exit(_, context) {
      if (!context.data) return;
      functionExit(context);
      context.data.currentMethod = undefined;
    },
    PropertyDeclaration(node, context) {
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
    PropertyDeclaration_exit(_, context) {
      if (!context.data) return;
      functionExit(context);
      context.data.currentMethod = undefined;
    },
    ReturnStatement(node, context) {
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

  const node = tryGetNameInType(
    context.data.currentClass.className,
    func.type,
    context,
  );
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
  if (!context.data?.currentMethod) return;

  if (node.kind === SyntaxKind.ThisKeyword) {
    context.data.currentMethod.hasReturnThis = true;
  }
  const type = context.checker.getTypeAtLocation(node);
  if (context.data.currentClass.type === type) {
    context.data.currentMethod.hasReturnClassType = true;
    return;
  }
  if (context.data.currentClass.type.thisType === type) {
    context.data.currentMethod.hasReturnThis = true;
    return;
  }
}

function tryGetNameInType(
  name: string,
  typeNode: AST.TypeNode,
  context: Context<Data | undefined>,
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
      const found = tryGetNameInType(name, type, context);
      if (found) return found;
    }
  }

  return undefined;
}
