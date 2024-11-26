import { isIntrinsicAnyType } from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Infer } from "../types.ts";

const messages = {
  unsafeMemberExpression: (params: { property: string }) =>
    `Unsafe member access ${params.property} on an \`any\` value.`,
  unsafeComputedMemberAccess: (params: { property: string }) =>
    `Computed name ${params.property} resolves to an any value.`,
};

type State = "Unsafe" | "Safe";
const createData = () => ({ stateCache: new Map<ts.Node, State>() });
type Context = Infer<typeof createData>["Context"];

export const noUnsafeMemberAccess = createRule(() => ({
  name: "core/noUnsafeMemberAccess",
  createData,
  visitor: {
    PropertyAccessExpression(node, context) {
      // ignore if it's parent is Heritage clause
      if (node.parent.kind === SyntaxKind.ExpressionWithTypeArguments) return;
      checkMemberExpression(node, context);
    },
    ElementAccessExpression(node, context) {
      checkMemberExpression(node, context);
      const type = context.checker.getTypeAtLocation(node.argumentExpression);
      if (isIntrinsicAnyType(type)) {
        context.report({
          node,
          message: messages.unsafeComputedMemberAccess({
            property: `[${node.argumentExpression.getText()}]`,
          }),
        });
      }
    },
  },
}));

function checkMemberExpression(
  node: AST.PropertyAccessExpression | AST.ElementAccessExpression,
  context: Context,
): State {
  const cachedState = context.data.stateCache.get(node);
  if (cachedState) {
    return cachedState;
  }

  if (
    node.expression.kind === SyntaxKind.PropertyAccessExpression ||
    node.expression.kind === SyntaxKind.ElementAccessExpression
  ) {
    const objectState = checkMemberExpression(node.expression, context);
    if (objectState === "Unsafe") {
      // if the object is unsafe, we know this will be unsafe as well
      // we don't need to report, as we have already reported on the inner member expr
      context.data.stateCache.set(node, objectState);
      return objectState;
    }
  }

  const type = context.checker.getTypeAtLocation(node.expression);
  const state = isIntrinsicAnyType(type) ? "Unsafe" : "Safe";
  context.data.stateCache.set(node, state);

  if (state === "Unsafe") {
    if (node.kind === SyntaxKind.PropertyAccessExpression) {
      const propertyName = node.name.getText();
      context.report({
        node: node.name,
        message: messages.unsafeMemberExpression({
          property: `.${propertyName}`,
        }),
      });
    } else {
      const propertyName = node.argumentExpression.getText();
      context.report({
        node: node.argumentExpression,
        message: messages.unsafeMemberExpression({
          property: `[${propertyName}]`,
        }),
      });
    }
  }

  return state;
}

export const test = () =>
  ruleTester({
    ruleFn: noUnsafeMemberAccess,
    valid: [
      `
function foo(x: { a: number }, y: any) {
  x[y++];
}
    `,
      `
function foo(x: { a: number }) {
  x.a;
}
    `,
      `
function foo(x?: { a: number }) {
  x?.a;
}
    `,
      `
function foo(x: { a: number }) {
  x['a'];
}
    `,
      `
function foo(x?: { a: number }) {
  x?.['a'];
}
    `,
      `
function foo(x: { a: number }, y: string) {
  x[y];
}
    `,
      `
function foo(x?: { a: number }, y: string) {
  x?.[y];
}
    `,
      `
function foo(x: string[]) {
  x[1];
}
    `,
      `
class B implements FG.A {}
    `,
      `
interface B extends FG.A {}
    `,
    ],
    invalid: [
      {
        code: `
function foo(x: any) {
  x.a;
}
      `,
        errors: [
          {
            message: messages.unsafeMemberExpression({
              property: ".a",
            }),
            line: 3,
            column: 5,
          },
        ],
      },
      {
        code: `
function foo(x: any) {
  x.a.b.c.d.e.f.g;
}
      `,
        errors: [
          {
            message: messages.unsafeMemberExpression({
              property: ".a",
            }),
            line: 3,
            column: 5,
          },
        ],
      },
      {
        code: `
function foo(x: { a: any }) {
  x.a.b.c.d.e.f.g;
}
      `,
        errors: [
          {
            message: messages.unsafeMemberExpression({
              property: ".b",
            }),
            line: 3,
            column: 7,
          },
        ],
      },
      {
        code: `
function foo(x: any) {
  x['a'];
}
      `,
        errors: [
          {
            message: messages.unsafeMemberExpression({
              property: "['a']",
            }),
            line: 3,
            column: 5,
          },
        ],
      },
      {
        code: `
function foo(x: any) {
  x['a']['b']['c'];
}
      `,
        errors: [
          {
            message: messages.unsafeMemberExpression({
              property: "['a']",
            }),
            line: 3,
            column: 5,
          },
        ],
      },
      {
        code: `
function foo(x: { a: number }, y: any) {
  x[y];
}
      `,
        errors: [
          {
            message: messages.unsafeComputedMemberAccess({
              property: "[y]",
            }),
            line: 3,
            column: 5,
          },
        ],
      },
      {
        code: `
function foo(x?: { a: number }, y: any) {
  x?.[y];
}
      `,
        errors: [
          {
            message: messages.unsafeComputedMemberAccess({
              property: "[y]",
            }),
            line: 3,
            column: 7,
          },
        ],
      },
      {
        code: `
function foo(x: { a: number }, y: any) {
  x[(y += 1)];
}
      `,
        errors: [
          {
            message: messages.unsafeComputedMemberAccess({
              property: "[(y += 1)]",
            }),
            line: 3,
            column: 6,
          },
        ],
      },
      {
        code: `
function foo(x: { a: number }, y: any) {
  x[1 as any];
}
      `,
        errors: [
          {
            message: messages.unsafeComputedMemberAccess({
              property: "[1 as any]",
            }),
            line: 3,
            column: 5,
          },
        ],
      },
      {
        code: `
function foo(x: { a: number }, y: any) {
  x[y()];
}
      `,
        errors: [
          {
            message: messages.unsafeComputedMemberAccess({
              property: "[y()]",
            }),
            line: 3,
            column: 5,
          },
        ],
      },
      {
        code: `
function foo(x: string[], y: any) {
  x[y];
}
      `,
        errors: [
          {
            message: messages.unsafeComputedMemberAccess({
              property: "[y]",
            }),
            line: 3,
            column: 5,
          },
        ],
      },
      {
        code: `
class C {
  getObs$: any;
  getPopularDepartments(): void {
    this.getObs$.pipe().subscribe(res => {
      console.log(res);
    });
  }
}
      `,
        errors: [
          {
            message: messages.unsafeMemberExpression({
              property: ".subscribe",
            }),
            line: 5,
            column: 25,
          },
          {
            message: messages.unsafeMemberExpression({
              property: ".pipe",
            }),
            line: 5,
            column: 18,
          },
        ],
      },
    ],
  });
