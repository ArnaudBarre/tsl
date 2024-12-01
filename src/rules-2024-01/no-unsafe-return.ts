import { isIntrinsicAnyType } from "ts-api-utils";
import ts, { SyntaxKind, TypeFlags } from "typescript";
import { createRule } from "../public-utils.ts";
import { getContextualType, getParentFunctionNode } from "../rules/_utils";
import { ruleTester } from "../ruleTester.ts";
import {
  isTypeAnyArrayType,
  isTypeUnknownArrayType,
  typeHasFlag,
} from "../types-utils.ts";
import type { AST, Checker, Context } from "../types.ts";
import { isUnsafeAssignment } from "./no-unsafe-argument.ts";

const messages = {
  unsafeReturn: (params: { type: string }) =>
    `Unsafe return of an \`${params.type}\` typed value.`,
  unsafeReturnAssignment: (params: { sender: string; receiver: string }) =>
    `Unsafe return of type \`${params.sender}\` from function with return type \`${params.receiver}\`.`,
};

export const noUnsafeReturn = createRule(() => ({
  name: "core/noUnsafeReturn",
  visitor: {
    ReturnStatement(node, context) {
      const argument = node.expression;
      if (!argument) return;
      checkReturn(argument, node, context);
    },
    ArrowFunction(node, context) {
      if (node.body.kind !== SyntaxKind.Block) {
        checkReturn(node.body, node.body, context);
      }
    },
  },
}));

function checkReturn(
  returnNode: AST.Expression,
  reportingNode: AST.AnyNode,
  context: Context,
): void {
  const tsNode = returnNode;
  const anyType = isAnyOrAnyArrayTypeDiscriminated(tsNode, context.checker);
  const functionNode = getParentFunctionNode(returnNode);
  if (!functionNode) return;

  // function has an explicit return type, so ensure it's a safe return
  const returnNodeType = context.utils.getConstrainedTypeAtLocation(returnNode);
  const functionTSNode = functionNode;

  // function expressions will not have their return type modified based on receiver typing
  // so we have to use the contextual typing in these cases, i.e.
  // const foo1: () => Set<string> = () => new Set<any>();
  // the return type of the arrow function is Set<any> even though the variable is typed as Set<string>
  let functionType =
    functionTSNode.kind === SyntaxKind.FunctionExpression ||
    functionTSNode.kind === SyntaxKind.ArrowFunction
      ? getContextualType(context.checker, functionTSNode)
      : context.checker.getTypeAtLocation(functionNode);
  if (!functionType) {
    functionType = context.checker.getTypeAtLocation(functionNode);
  }

  // If there is an explicit type annotation *and* that type matches the actual
  // function return type, we shouldn't complain (it's intentional, even if unsafe)
  if (functionTSNode.type) {
    for (const signature of functionType.getCallSignatures()) {
      if (
        returnNodeType === signature.getReturnType() ||
        typeHasFlag(
          signature.getReturnType(),
          ts.TypeFlags.Any | ts.TypeFlags.Unknown,
        )
      ) {
        return;
      }
    }
  }

  if (anyType !== "Safe") {
    // Allow cases when the declared return type of the function is either unknown or unknown[]
    // and the function is returning any or any[].
    for (const signature of functionType.getCallSignatures()) {
      const functionReturnType = signature.getReturnType();
      if (
        anyType === "Any" &&
        typeHasFlag(functionReturnType, TypeFlags.Unknown)
      ) {
        return;
      }
      if (
        anyType === "AnyArray" &&
        isTypeUnknownArrayType(functionReturnType, context.checker)
      ) {
        return;
      }
    }

    // If the function return type was not unknown/unknown[], mark usage as unsafeReturn.
    context.report({
      node: reportingNode,
      message: messages.unsafeReturn({
        type: anyType === "Any" ? "any" : "any[]",
      }),
    });
    return;
  }

  for (const signature of functionType.getCallSignatures()) {
    const functionReturnType = signature.getReturnType();
    const result = isUnsafeAssignment(
      returnNodeType,
      functionReturnType,
      context.checker,
      returnNode,
    );
    if (!result) {
      return;
    }

    const { sender, receiver } = result;
    context.report({
      node: reportingNode,
      message: messages.unsafeReturnAssignment({
        sender: context.checker.typeToString(sender),
        receiver: context.checker.typeToString(receiver),
      }),
    });
    return;
  }
}

export function isAnyOrAnyArrayTypeDiscriminated(
  node: ts.Node,
  checker: Checker,
) {
  const type = checker.getTypeAtLocation(node);
  if (isIntrinsicAnyType(type)) return "Any";
  if (isTypeAnyArrayType(type, checker)) return "AnyArray";
  return "Safe";
}

export const test = () =>
  ruleTester({
    ruleFn: noUnsafeReturn,
    valid: [
      `
function foo() {
  return;
}
    `,
      `
function foo() {
  return 1;
}
    `,
      `
function foo() {
  return '';
}
    `,
      `
function foo() {
  return true;
}
    `,
      // this actually types as `never[]`
      `
function foo() {
  return [];
}
    `,
      // explicit any return type is allowed, if you want to be unsafe like that
      `
function foo(): any {
  return {} as any;
}
    `,
      // explicit any array return type is allowed, if you want to be unsafe like that
      `
function foo(): any[] {
  return [] as any[];
}
    `,
      // explicit any generic return type is allowed, if you want to be unsafe like that
      `
function foo(): Set<any> {
  return new Set<any>();
}
    `,
      // TODO - this should error, but it's hard to detect, as the type references are different
      `
function foo(): ReadonlySet<number> {
  return new Set<any>();
}
    `,
      `
function foo(): Set<number> {
  return new Set([1]);
}
    `,
      `
      type Foo<T = number> = { prop: T };
      function foo(): Foo {
        return { prop: 1 } as Foo<number>;
      }
    `,
      `
      type Foo = { prop: any };
      function foo(): Foo {
        return { prop: '' } as Foo;
      }
    `,
      // TS 3.9 changed this to be safe
      `
      function fn<T extends any>(x: T) {
        return x;
      }
    `,
      `
      function fn<T extends any>(x: T): unknown {
        return x as any;
      }
    `,
      `
      function fn<T extends any>(x: T): unknown[] {
        return x as any[];
      }
    `,
      `
      function fn<T extends any>(x: T): Set<unknown> {
        return x as Set<any>;
      }
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/2109
      `
      function test(): Map<string, string> {
        return new Map();
      }
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/3549
      `
      function foo(): any {
        return [] as any[];
      }
    `,
      `
      function foo(): unknown {
        return [] as any[];
      }
    `,
    ],
    invalid: [
      {
        code: `
function foo() {
  return 1 as any;
}
      `,
        errors: [
          {
            message: messages.unsafeReturn({
              type: "any",
            }),
          },
        ],
      },
      {
        code: `
function foo() {
  return Object.create(null);
}
      `,
        errors: [
          {
            message: messages.unsafeReturn({
              type: "any",
            }),
          },
        ],
      },
      {
        code: `
const foo = () => {
  return 1 as any;
};
      `,
        errors: [
          {
            message: messages.unsafeReturn({
              type: "any",
            }),
          },
        ],
      },
      {
        code: "const foo = () => Object.create(null);",
        errors: [
          {
            message: messages.unsafeReturn({
              type: "any",
            }),
          },
        ],
      },
      {
        code: `
function foo() {
  return [] as any[];
}
      `,
        errors: [
          {
            message: messages.unsafeReturn({
              type: "any[]",
            }),
          },
        ],
      },
      {
        code: `
function foo() {
  return [] as Array<any>;
}
      `,
        errors: [
          {
            message: messages.unsafeReturn({
              type: "any[]",
            }),
          },
        ],
      },
      {
        code: `
function foo() {
  return [] as readonly any[];
}
      `,
        errors: [
          {
            message: messages.unsafeReturn({
              type: "any[]",
            }),
          },
        ],
      },
      {
        code: `
function foo() {
  return [] as Readonly<any[]>;
}
      `,
        errors: [
          {
            message: messages.unsafeReturn({
              type: "any[]",
            }),
          },
        ],
      },
      {
        code: `
const foo = () => {
  return [] as any[];
};
      `,
        errors: [
          {
            message: messages.unsafeReturn({
              type: "any[]",
            }),
          },
        ],
      },
      {
        code: "const foo = () => [] as any[];",
        errors: [
          {
            message: messages.unsafeReturn({
              type: "any[]",
            }),
          },
        ],
      },
      {
        code: `
function foo(): Set<string> {
  return new Set<any>();
}
      `,
        errors: [
          {
            message: messages.unsafeReturnAssignment({
              sender: "Set<any>",
              receiver: "Set<string>",
            }),
          },
        ],
      },
      {
        code: `
function foo(): Map<string, string> {
  return new Map<string, any>();
}
      `,
        errors: [
          {
            message: messages.unsafeReturnAssignment({
              sender: "Map<string, any>",
              receiver: "Map<string, string>",
            }),
          },
        ],
      },
      {
        code: `
function foo(): Set<string[]> {
  return new Set<any[]>();
}
      `,
        errors: [
          {
            message: messages.unsafeReturnAssignment({
              sender: "Set<any[]>",
              receiver: "Set<string[]>",
            }),
          },
        ],
      },
      {
        code: `
function foo(): Set<Set<Set<string>>> {
  return new Set<Set<Set<any>>>();
}
      `,
        errors: [
          {
            message: messages.unsafeReturnAssignment({
              sender: "Set<Set<Set<any>>>",
              receiver: "Set<Set<Set<string>>>",
            }),
          },
        ],
      },
      {
        code: `
type Fn = () => Set<string>;
const foo1: Fn = () => new Set<any>();
const foo2: Fn = function test() {
  return new Set<any>();
};
      `,
        errors: [
          {
            message: messages.unsafeReturnAssignment({
              sender: "Set<any>",
              receiver: "Set<string>",
            }),
            line: 3,
          },
          {
            message: messages.unsafeReturnAssignment({
              sender: "Set<any>",
              receiver: "Set<string>",
            }),
            line: 5,
          },
        ],
      },
      {
        code: `
type Fn = () => Set<string>;
function receiver(arg: Fn) {}
receiver(() => new Set<any>());
receiver(function test() {
  return new Set<any>();
});
      `,
        errors: [
          {
            message: messages.unsafeReturnAssignment({
              sender: "Set<any>",
              receiver: "Set<string>",
            }),
            line: 4,
          },
          {
            message: messages.unsafeReturnAssignment({
              sender: "Set<any>",
              receiver: "Set<string>",
            }),
            line: 6,
          },
        ],
      },
    ],
  });
