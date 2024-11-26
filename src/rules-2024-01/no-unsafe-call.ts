import { isIntrinsicAnyType } from "ts-api-utils";
import { SyntaxKind } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Context } from "../types.ts";

const messages = {
  unsafeCall: "Unsafe call of an `any` typed value.",
  unsafeNew: "Unsafe construction of an any type value.",
  unsafeTemplateTag: "Unsafe any typed template tag.",
};

export const noUnsafeCall = createRule(() => ({
  name: "core/noUnsafeCall",
  visitor: {
    CallExpression(node, context) {
      if (node.expression.kind === SyntaxKind.ImportKeyword) return;
      checkCall(node.expression, node, messages.unsafeCall, context);
    },
    NewExpression(node, context) {
      checkCall(node.expression, node, messages.unsafeNew, context);
    },
    TaggedTemplateExpression(node, context) {
      checkCall(node.tag, node, messages.unsafeTemplateTag, context);
    },
  },
}));

function checkCall(
  node: AST.AnyNode,
  reportingNode: AST.AnyNode,
  message: string,
  context: Context,
): void {
  const type = context.utils.getConstrainedTypeAtLocation(node);
  if (isIntrinsicAnyType(type)) {
    context.report({ node: reportingNode, message });
  }
}

export const test = () =>
  ruleTester({
    ruleFn: noUnsafeCall,
    valid: [
      `
function foo(x: () => void) {
  x();
}
    `,
      `
function foo(x?: { a: () => void }) {
  x?.a();
}
    `,
      `
function foo(x: { a?: () => void }) {
  x.a?.();
}
    `,
      "new Map();",
      "String.raw`foo`;",
      "const x = import('./foo');",
      // https://github.com/typescript-eslint/typescript-eslint/issues/1825
      `
      let foo: any = 23;
      String(foo); // ERROR: Unsafe call of an any typed value
    `,
      // TS 3.9 changed this to be safe
      `
      function foo<T extends any>(x: T) {
        x();
      }
    `,
    ],
    invalid: [
      {
        code: `
function foo(x: any) {
  x();
}
      `,
        errors: [
          {
            message: messages.unsafeCall,
          },
        ],
      },
      {
        code: `
function foo(x: any) {
  x?.();
}
      `,
        errors: [
          {
            message: messages.unsafeCall,
          },
        ],
      },
      {
        code: `
function foo(x: any) {
  x.a.b.c.d.e.f.g();
}
      `,
        errors: [
          {
            message: messages.unsafeCall,
          },
        ],
      },
      {
        code: `
function foo(x: any) {
  x.a.b.c.d.e.f.g?.();
}
      `,
        errors: [
          {
            message: messages.unsafeCall,
          },
        ],
      },
      {
        code: `
function foo(x: { a: any }) {
  x.a();
}
      `,
        errors: [
          {
            message: messages.unsafeCall,
          },
        ],
      },
      {
        code: `
function foo(x: { a: any }) {
  x?.a();
}
      `,
        errors: [
          {
            message: messages.unsafeCall,
          },
        ],
      },
      {
        code: `
function foo(x: { a: any }) {
  x.a?.();
}
      `,
        errors: [
          {
            message: messages.unsafeCall,
          },
        ],
      },
      {
        code: `
function foo(x: any) {
  new x();
}
      `,
        errors: [
          {
            message: messages.unsafeNew,
          },
        ],
      },
      {
        code: `
function foo(x: { a: any }) {
  new x.a();
}
      `,
        errors: [
          {
            message: messages.unsafeNew,
          },
        ],
      },
      {
        code: `
function foo(x: any) {
  x\`foo\`;
}
      `,
        errors: [
          {
            message: messages.unsafeTemplateTag,
          },
        ],
      },
      {
        code: `
function foo(x: { tag: any }) {
  x.tag\`foo\`;
}
      `,
        errors: [
          {
            message: messages.unsafeTemplateTag,
          },
        ],
      },
    ],
  });
