import { type InterfaceType, SyntaxKind } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Infer } from "../types.ts";

const messages = {
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

const createData = (): Data | undefined => undefined;
type Context = Infer<typeof createData>["Context"];
export const preferReturnThisType = createRule(() => ({
  name: "core/preferReturnThisType",
  createData,
  visitor: {
    ClassDeclaration(node, context) {
      const className = node.name?.text;
      if (!className) return;
      context.data = {
        currentClass: {
          className,
          type: context.checker.getTypeAtLocation(node) as InterfaceType,
        },
      };
    },
    "ClassDeclaration:exit"(_, context) {
      context.data = undefined;
    },
    MethodDeclaration(node, context) {
      functionEnter(context, node);
    },
    "MethodDeclaration:exit"(_, context) {
      if (!context.data) return;
      functionExit(context);
      context.data.currentMethod = undefined;
    },
    PropertyDeclaration(node, context) {
      if (
        node.initializer?.kind === SyntaxKind.FunctionExpression ||
        node.initializer?.kind === SyntaxKind.ArrowFunction
      ) {
        functionEnter(context, node.initializer);
        if (
          node.initializer.kind === SyntaxKind.ArrowFunction &&
          node.initializer.body.kind !== SyntaxKind.Block
        ) {
          checkReturnExpression(context, node.initializer.body);
        }
      }
    },
    "PropertyDeclaration:exit"(_, context) {
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
  context: Context,
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
    firstArg?.name.kind === SyntaxKind.Identifier &&
    firstArg.name.text === "this"
  ) {
    return;
  }

  context.data.currentMethod = {
    hasReturnThis: false,
    hasReturnClassType: false,
    currentTypeNode: node,
  };
}

function functionExit(context: Context) {
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

function checkReturnExpression(context: Context, node: AST.Expression): void {
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
  context: Context,
): AST.TypeReferenceNode | undefined {
  if (
    typeNode.kind === SyntaxKind.TypeReference &&
    typeNode.typeName.kind === SyntaxKind.Identifier &&
    typeNode.typeName.text === name
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

export const test = () =>
  ruleTester({
    ruleFn: preferReturnThisType,
    valid: [
      `
class Foo {
  f1() {}
  f2(): Foo {
    return new Foo();
  }
  f3() {
    return this;
  }
  f4(): this {
    return this;
  }
  f5(): any {
    return this;
  }
  f6(): unknown {
    return this;
  }
  f7(foo: Foo): Foo {
    return Math.random() > 0.5 ? foo : this;
  }
  f10(this: Foo, that: Foo): Foo;
  f11(): Foo {
    return;
  }
  f13(this: Foo): Foo {
    return this;
  }
  f14(): { f14: Function } {
    return this;
  }
  f15(): Foo | this {
    return Math.random() > 0.5 ? new Foo() : this;
  }
}
    `,
      `
class Foo {
  f1 = () => {};
  f2 = (): Foo => {
    return new Foo();
  };
  f3 = () => this;
  f4 = (): this => {
    return this;
  };
  f5 = (): Foo => new Foo();
  f6 = '';
}
    `,
      `
const Foo = class {
  bar() {
    return this;
  }
};
    `,
      `
class Base {}
class Derived extends Base {
  f(): Base {
    return this;
  }
}
    `,
    ],
    invalid: [
      {
        code: `
class Foo {
  f(): Foo {
    return this;
  }
}
      `,
        errors: [
          {
            message: messages.useThisType,
            line: 3,
            column: 8,
            suggestions: [
              {
                message: messages.fix,
                output: `
class Foo {
  f(): this {
    return this;
  }
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class Foo {
  f(): Foo {
    const self = this;
    return self;
  }
}
      `,
        errors: [
          {
            message: messages.useThisType,
            line: 3,
            column: 8,
            suggestions: [
              {
                message: messages.fix,
                output: `
class Foo {
  f(): this {
    const self = this;
    return self;
  }
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class Foo {
  f = (): Foo => {
    return this;
  };
}
      `,
        errors: [
          {
            message: messages.useThisType,
            line: 3,
            column: 11,
            suggestions: [
              {
                message: messages.fix,
                output: `
class Foo {
  f = (): this => {
    return this;
  };
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class Foo {
  f = (): Foo => {
    const self = this;
    return self;
  };
}
      `,
        errors: [
          {
            message: messages.useThisType,
            line: 3,
            column: 11,
            suggestions: [
              {
                message: messages.fix,
                output: `
class Foo {
  f = (): this => {
    const self = this;
    return self;
  };
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class Foo {
  f = (): Foo => this;
}
      `,
        errors: [
          {
            message: messages.useThisType,
            line: 3,
            column: 11,
            suggestions: [
              {
                message: messages.fix,
                output: `
class Foo {
  f = (): this => this;
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class Foo {
  f1(): Foo | undefined {
    return this;
  }
  f2(): this | undefined {
    return this;
  }
}
      `,
        errors: [
          {
            message: messages.useThisType,
            line: 3,
            column: 9,
            suggestions: [
              {
                message: messages.fix,
                output: `
class Foo {
  f1(): this | undefined {
    return this;
  }
  f2(): this | undefined {
    return this;
  }
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class Foo {
  bar(): Foo | undefined {
    if (Math.random() > 0.5) {
      return this;
    }
  }
}
      `,
        errors: [
          {
            message: messages.useThisType,
            line: 3,
            column: 10,
            suggestions: [
              {
                message: messages.fix,
                output: `
class Foo {
  bar(): this | undefined {
    if (Math.random() > 0.5) {
      return this;
    }
  }
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class Foo {
  bar(num: 1 | 2): Foo {
    switch (num) {
      case 1:
        return this;
      case 2:
        return this;
    }
  }
}
      `,
        errors: [
          {
            message: messages.useThisType,
            line: 3,
            column: 20,
            suggestions: [
              {
                message: messages.fix,
                output: `
class Foo {
  bar(num: 1 | 2): this {
    switch (num) {
      case 1:
        return this;
      case 2:
        return this;
    }
  }
}
      `,
              },
            ],
          },
        ],
      },
      {
        // https://github.com/typescript-eslint/typescript-eslint/issues/3842
        code: `
class Animal<T> {
  eat(): Animal<T> {
    console.log("I'm moving!");
    return this;
  }
}
      `,
        errors: [
          {
            message: messages.useThisType,
            line: 3,
            column: 10,
            endColumn: 19,
            suggestions: [
              {
                message: messages.fix,
                output: `
class Animal<T> {
  eat(): this {
    console.log("I'm moving!");
    return this;
  }
}
      `,
              },
            ],
          },
        ],
      },
    ],
  });
