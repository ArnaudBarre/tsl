import { isTypeFlagSet } from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import type { AnyNode } from "../ast.ts";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Infer } from "../types.ts";
import { isLogicalExpression } from "../utils.ts";

const messages = {
  invalidVoidExpr:
    "Placing a void expression inside another expression is forbidden. " +
    "Move it to its own statement instead.",
  invalidVoidExprWrapVoid:
    "Void expressions used inside another expression " +
    "must be moved to its own statement " +
    "or marked explicitly with the `void` operator.",
  invalidVoidExprArrow:
    "Returning a void expression from an arrow function shorthand is forbidden. " +
    "Please add braces to the arrow function.",
  invalidVoidExprArrowWrapVoid:
    "Void expressions returned from an arrow function shorthand " +
    "must be marked explicitly with the `void` operator.",
  invalidVoidExprReturn:
    "Returning a void expression from a function is forbidden. " +
    "Please move it before the `return` statement.",
  invalidVoidExprReturnLast:
    "Returning a void expression from a function is forbidden. " +
    "Please remove the `return` statement.",
  invalidVoidExprReturnWrapVoid:
    "Void expressions returned from a function " +
    "must be marked explicitly with the `void` operator.",
  voidExprWrapVoid: "Mark with an explicit `void` operator.",
};

type Context = Infer<typeof noConfusingVoidExpression>["Context"];

export const noConfusingVoidExpression = createRule({
  name: "no-confusing-void-expression",
  parseOptions: (options?: {
    ignoreArrowShorthand?: boolean;
    ignoreVoidOperator?: boolean;
  }) => ({
    ignoreArrowShorthand: options?.ignoreArrowShorthand ?? false,
    ignoreVoidOperator: options?.ignoreVoidOperator ?? false,
  }),
  visitor: (options) => ({
    CallExpression(node, context) {
      const type = context.utils.getConstrainedTypeAtLocation(node);
      if (!isTypeFlagSet(type, ts.TypeFlags.VoidLike)) {
        // not a void expression
        return;
      }

      const invalidAncestor = findInvalidAncestor(node, context);
      if (invalidAncestor == null) {
        // void expression is in valid position
        return;
      }

      if (invalidAncestor.kind === SyntaxKind.ArrowFunction) {
        // handle arrow function shorthand

        if (options.ignoreVoidOperator) {
          // handle wrapping with `void`
          return context.report({
            node,
            message: messages.invalidVoidExprArrowWrapVoid,
          });
        }

        return context.report({
          node,
          message: messages.invalidVoidExprArrow,
        });
      }

      if (invalidAncestor.kind === SyntaxKind.ReturnStatement) {
        // handle return statement

        if (options.ignoreVoidOperator) {
          // handle wrapping with `void`
          return context.report({
            node,
            message: messages.invalidVoidExprReturnWrapVoid,
          });
        }

        const returnStmt = invalidAncestor;

        if (isFinalReturn(returnStmt)) {
          // remove the `return` keyword
          return context.report({
            node,
            message: messages.invalidVoidExprReturnLast,
          });
        }

        // move before the `return` keyword
        return context.report({
          node,
          message: messages.invalidVoidExprReturn,
        });
      }

      // handle generic case
      if (options.ignoreVoidOperator) {
        // this would be reported by this rule btw. such irony
        return context.report({
          node,
          message: messages.invalidVoidExprWrapVoid,
        });
      }

      context.report({
        node,
        message: messages.invalidVoidExpr,
      });
    },
  }),
});

/**
 * Inspects the void expression's ancestors and finds closest invalid one.
 * By default anything other than an ExpressionStatement is invalid.
 * Parent expressions which can be used for their short-circuiting behavior
 * are ignored and their parents are checked instead.
 * @returns Invalid ancestor node if it was found. `null` otherwise.
 */
function findInvalidAncestor(
  node: AST.AnyNode,
  context: Context,
): AST.AnyNode | null {
  const parent = node.parent as AnyNode;
  if (
    parent.kind === SyntaxKind.BinaryExpression &&
    parent.operatorToken.kind === SyntaxKind.CommaToken
  ) {
    if (node === parent.left) {
      return null;
    }
    if (node === parent.right) {
      return findInvalidAncestor(parent, context);
    }
  }

  if (parent.kind === SyntaxKind.ExpressionStatement) {
    // e.g. `{ console.log("foo"); }`
    // this is always valid
    return null;
  }

  if (
    parent.kind === SyntaxKind.BinaryExpression &&
    isLogicalExpression(parent.operatorToken)
  ) {
    if (parent.right === node) {
      // e.g. `x && console.log(x)`
      // this is valid only if the next ancestor is valid
      return findInvalidAncestor(parent, context);
    }
  }

  if (parent.kind === SyntaxKind.ConditionalExpression) {
    if (parent.whenTrue === node || parent.whenFalse === node) {
      // e.g. `cond ? console.log(true) : console.log(false)`
      // this is valid only if the next ancestor is valid
      return findInvalidAncestor(parent, context);
    }
  }

  if (parent.kind === SyntaxKind.ArrowFunction) {
    // e.g. `() => console.log("foo")`
    // this is valid with an appropriate option
    if (context.options.ignoreArrowShorthand) {
      return null;
    }
  }

  if (parent.kind === SyntaxKind.VoidExpression) {
    // e.g. `void console.log("foo")`
    // this is valid with an appropriate option
    if (context.options.ignoreVoidOperator) {
      return null;
    }
  }

  if (
    (parent.kind === SyntaxKind.PropertyAccessExpression &&
      parent.questionDotToken) ||
    parent.kind === SyntaxKind.ParenthesizedExpression
  ) {
    // e.g. console?.log('foo'), (foo ? a() : b())
    return findInvalidAncestor(parent, context);
  }

  // any other parent is invalid
  return parent;
}

/** Checks whether the return statement is the last statement in a function body. */
function isFinalReturn(node: AST.ReturnStatement): boolean {
  // the parent must be a block
  const block = node.parent;
  if (block.kind !== SyntaxKind.Block) {
    // e.g. `if (cond) return;` (not in a block)
    return false;
  }

  // the block's parent must be a function
  const blockParent = block.parent;
  if (
    ![
      SyntaxKind.FunctionDeclaration,
      SyntaxKind.FunctionExpression,
      SyntaxKind.ArrowFunction,
    ].includes(blockParent.kind)
  ) {
    // e.g. `if (cond) { return; }`
    // not in a top-level function block
    return false;
  }

  // must be the last child of the block
  return block.statements.indexOf(node) >= block.statements.length - 1;
}

export const test = () =>
  ruleTester({
    rule: noConfusingVoidExpression,
    valid: [
      "() => Math.random();",
      "console.log('foo');",
      "foo && console.log(foo);",
      "foo || console.log(foo);",
      "foo ? console.log(true) : console.log(false);",
      "console?.log('foo');",
      {
        options: { ignoreArrowShorthand: true },
        code: `
        () => console.log('foo');
      `,
      },
      {
        options: { ignoreArrowShorthand: true },
        code: `
        foo => foo && console.log(foo);
      `,
      },
      {
        options: { ignoreArrowShorthand: true },
        code: `
        foo => foo || console.log(foo);
      `,
      },
      {
        options: { ignoreArrowShorthand: true },
        code: `
        foo => (foo ? console.log(true) : console.log(false));
      `,
      },

      {
        options: { ignoreVoidOperator: true },
        code: `
        !void console.log('foo');
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        +void (foo && console.log(foo));
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        -void (foo || console.log(foo));
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        () => void ((foo && void console.log(true)) || console.log(false));
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        const x = void (foo ? console.log(true) : console.log(false));
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        !(foo && void console.log(foo));
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        !!(foo || void console.log(foo));
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        const x = (foo && void console.log(true)) || void console.log(false);
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        () => (foo ? void console.log(true) : void console.log(false));
      `,
      },
      {
        options: { ignoreVoidOperator: true },
        code: `
        return void console.log('foo');
      `,
      },

      `
function cool(input: string) {
  return console.log(input), input;
}
    `,
      {
        code: `
function cool(input: string) {
  return input, console.log(input), input;
}
      `,
      },
    ],

    invalid: [
      {
        code: `
        const x = console.log('foo');
      `,
        errors: [{ column: 19, message: messages.invalidVoidExpr }],
      },
      {
        code: `
        const x = console?.log('foo');
      `,
        errors: [{ column: 19, message: messages.invalidVoidExpr }],
      },
      {
        code: `
        console.error(console.log('foo'));
      `,
        errors: [{ column: 23, message: messages.invalidVoidExpr }],
      },
      {
        code: `
        [console.log('foo')];
      `,
        errors: [{ column: 10, message: messages.invalidVoidExpr }],
      },
      {
        code: `
        ({ x: console.log('foo') });
      `,
        errors: [{ column: 15, message: messages.invalidVoidExpr }],
      },
      {
        code: `
        void console.log('foo');
      `,
        errors: [{ column: 14, message: messages.invalidVoidExpr }],
      },
      {
        code: `
        console.log('foo') ? true : false;
      `,
        errors: [{ column: 9, message: messages.invalidVoidExpr }],
      },
      {
        code: `
        (console.log('foo') && true) || false;
      `,
        errors: [{ column: 10, message: messages.invalidVoidExpr }],
      },
      {
        code: `
        (cond && console.log('ok')) || console.log('error');
      `,
        errors: [{ column: 18, message: messages.invalidVoidExpr }],
      },
      {
        code: `
        !console.log('foo');
      `,
        errors: [{ column: 10, message: messages.invalidVoidExpr }],
      },

      {
        code: `
function notcool(input: string) {
  return input, console.log(input);
}
      `,
        errors: [
          { line: 3, column: 17, message: messages.invalidVoidExprReturnLast },
        ],
      },
      {
        code: "() => console.log('foo');",
        errors: [
          { line: 1, column: 7, message: messages.invalidVoidExprArrow },
        ],
      },
      {
        code: "foo => foo && console.log(foo);",
        errors: [
          { line: 1, column: 15, message: messages.invalidVoidExprArrow },
        ],
      },
      {
        code: "(foo: undefined) => foo && console.log(foo);",
        errors: [
          { line: 1, column: 28, message: messages.invalidVoidExprArrow },
        ],
      },
      {
        code: "foo => foo || console.log(foo);",
        errors: [
          { line: 1, column: 15, message: messages.invalidVoidExprArrow },
        ],
      },
      {
        code: "(foo: undefined) => foo || console.log(foo);",
        errors: [
          { line: 1, column: 28, message: messages.invalidVoidExprArrow },
        ],
      },
      {
        code: "(foo: void) => foo || console.log(foo);",
        errors: [
          { line: 1, column: 23, message: messages.invalidVoidExprArrow },
        ],
      },
      {
        code: "foo => (foo ? console.log(true) : console.log(false));",
        errors: [
          { line: 1, column: 15, message: messages.invalidVoidExprArrow },
          { line: 1, column: 35, message: messages.invalidVoidExprArrow },
        ],
      },
      {
        code: `
        function f() {
          return console.log('foo');
          console.log('bar');
        }
      `,
        errors: [
          { line: 3, column: 18, message: messages.invalidVoidExprReturn },
        ],
      },
      {
        code: `
        function f() {
          console.log('foo')
          return ['bar', 'baz'].forEach(console.log)
          console.log('quux')
        }
      `,
        errors: [
          { line: 4, column: 18, message: messages.invalidVoidExprReturn },
        ],
      },
      {
        code: `
        function f() {
          console.log('foo');
          return console.log('bar');
        }
      `,
        errors: [
          { line: 4, column: 18, message: messages.invalidVoidExprReturnLast },
        ],
      },
      {
        code: `
        function f() {
          console.log('foo')
          return ['bar', 'baz'].forEach(console.log)
        }
      `,
        errors: [
          { line: 4, column: 18, message: messages.invalidVoidExprReturnLast },
        ],
      },
      {
        code: `
        const f = () => {
          if (cond) {
            return console.error('foo');
          }
          console.log('bar');
        };
      `,
        errors: [
          { line: 4, column: 20, message: messages.invalidVoidExprReturn },
        ],
      },
      {
        code: `
        const f = function () {
          if (cond) return console.error('foo');
          console.log('bar');
        };
      `,
        errors: [
          { line: 3, column: 28, message: messages.invalidVoidExprReturn },
        ],
      },
      {
        code: `
        const f = function () {
          let num = 1;
          return num ? console.log('foo') : num;
        };
      `,
        errors: [
          { line: 4, column: 24, message: messages.invalidVoidExprReturnLast },
        ],
      },
      {
        code: `
        const f = function () {
          let undef = undefined;
          return undef ? console.log('foo') : undef;
        };
      `,
        errors: [
          { line: 4, column: 26, message: messages.invalidVoidExprReturnLast },
        ],
      },
      {
        code: `
        const f = function () {
          let num = 1;
          return num || console.log('foo');
        };
      `,
        errors: [
          { line: 4, column: 25, message: messages.invalidVoidExprReturnLast },
        ],
      },
      {
        code: `
        const f = function () {
          let bar = void 0;
          return bar || console.log('foo');
        };
      `,
        errors: [
          { line: 4, column: 25, message: messages.invalidVoidExprReturnLast },
        ],
      },
      {
        code: `
        let num = 1;
        const foo = () => (num ? console.log('foo') : num);
      `,
        errors: [
          { line: 3, column: 34, message: messages.invalidVoidExprArrow },
        ],
      },
      {
        code: `
        let bar = void 0;
        const foo = () => (bar ? console.log('foo') : bar);
      `,
        errors: [
          { line: 3, column: 34, message: messages.invalidVoidExprArrow },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "return console.log('foo');",
        errors: [
          {
            line: 1,
            column: 8,
            message: messages.invalidVoidExprReturnWrapVoid,
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "console.error(console.log('foo'));",
        errors: [
          {
            line: 1,
            column: 15,
            message: messages.invalidVoidExprWrapVoid,
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "console.log('foo') ? true : false;",
        errors: [
          {
            line: 1,
            column: 1,
            message: messages.invalidVoidExprWrapVoid,
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "const x = foo ?? console.log('foo');",
        errors: [
          {
            line: 1,
            column: 18,
            message: messages.invalidVoidExprWrapVoid,
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "foo => foo || console.log(foo);",
        errors: [
          {
            line: 1,
            column: 15,
            message: messages.invalidVoidExprArrowWrapVoid,
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "!!console.log('foo');",
        errors: [
          {
            line: 1,
            column: 3,
            message: messages.invalidVoidExprWrapVoid,
          },
        ],
      },
    ],
  });
