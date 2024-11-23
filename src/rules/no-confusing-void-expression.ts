import {
  getCallSignaturesOfType,
  isIntrinsicVoidType,
  isTypeFlagSet,
  unionTypeParts,
} from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import type { AnyNode } from "../ast.ts";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Infer, Suggestion } from "../types.ts";
import { getParentFunctionNode, isLogicalExpression } from "./utils";

const messages = {
  invalidVoidExpr:
    "Placing a void expression inside another expression is forbidden. " +
    "Move it to its own statement instead.",
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
  invalidVoidExprWrapVoid:
    "Void expressions used inside another expression " +
    "must be moved to its own statement " +
    "or marked explicitly with the `void` operator.",
  voidExprWrapVoid: "Mark with an explicit `void` operator.",
  addBraces: "Add braces.",
  removeReturn: "Remove the `return` keyword.",
  moveBeforeReturn: "Move before the `return` keyword.",
};

type Context = Infer<typeof noConfusingVoidExpression>["Context"];
export const noConfusingVoidExpression = createRule({
  name: "no-confusing-void-expression",
  parseOptions: (options?: {
    ignoreArrowShorthand?: boolean;
    ignoreVoidOperator?: boolean;
    ignoreVoidReturningFunctions?: boolean;
  }) => ({
    ignoreArrowShorthand: false,
    ignoreVoidOperator: false,
    ignoreVoidReturningFunctions: false,
    ...options,
  }),
  visitor: (options) => {
    return {
      AwaitExpression: (node, context) => checkVoidExpression(node, context),
      CallExpression: (node, context) => checkVoidExpression(node, context),
      TaggedTemplateExpression: (node, context) =>
        checkVoidExpression(node, context),
    };

    function checkVoidExpression(
      node:
        | AST.AwaitExpression
        | AST.CallExpression
        | AST.TaggedTemplateExpression,
      context: Context,
    ): void {
      const type = context.utils.getConstrainedTypeAtLocation(node);
      if (!isTypeFlagSet(type, ts.TypeFlags.VoidLike)) {
        // not a void expression
        return;
      }

      const invalidAncestor = findInvalidAncestor(node, context);
      if (invalidAncestor === null) {
        // void expression is in valid position
        return;
      }

      const wrapVoidFix = (node: AST.Expression): Suggestion["changes"] => [
        { start: node.getStart(), length: 0, newText: "void " },
      ];

      if (invalidAncestor.kind === SyntaxKind.ArrowFunction) {
        // handle arrow function shorthand

        if (options.ignoreVoidReturningFunctions) {
          const returnsVoid = isVoidReturningFunctionNode(
            invalidAncestor,
            context,
          );

          if (returnsVoid) {
            return;
          }
        }

        if (options.ignoreVoidOperator) {
          // handle wrapping with `void`
          context.report({
            node,
            message: messages.invalidVoidExprArrowWrapVoid,
            suggestions: [
              {
                message: messages.voidExprWrapVoid,
                changes: wrapVoidFix(node),
              },
            ],
          });
          return;
        }

        // handle wrapping with braces
        const arrowFunction = invalidAncestor;
        context.report({
          node,
          message: messages.invalidVoidExprArrow,
          suggestions: canFix(arrowFunction, context)
            ? [
                {
                  message: messages.addBraces,
                  changes: [
                    {
                      start: arrowFunction.body.getStart(),
                      length: 0,
                      newText: "{ ",
                    },
                    {
                      start: arrowFunction.body.getEnd() + 1,
                      length: 0,
                      newText: " }",
                    },
                  ],
                },
              ]
            : undefined,
        });
        return;
      }

      if (invalidAncestor.kind === SyntaxKind.ReturnStatement) {
        // handle return statement

        if (options.ignoreVoidReturningFunctions) {
          const functionNode = getParentFunctionNode(invalidAncestor);

          if (functionNode) {
            const returnsVoid = isVoidReturningFunctionNode(
              functionNode,
              context,
            );

            if (returnsVoid) {
              return;
            }
          }
        }

        if (options.ignoreVoidOperator) {
          // handle wrapping with `void`
          context.report({
            node,
            message: messages.invalidVoidExprReturnWrapVoid,
            suggestions: [
              {
                message: messages.voidExprWrapVoid,
                changes: wrapVoidFix(node),
              },
            ],
          });
          return;
        }

        if (isFinalReturn(invalidAncestor)) {
          // remove the `return` keyword
          context.report({
            node,
            message: messages.invalidVoidExprReturnLast,
            suggestions: canFix(invalidAncestor, context)
              ? () => {
                  const returnValue = invalidAncestor.expression!;
                  const returnValueText = returnValue.getFullText().trimStart();
                  let newReturnStmtText = `${returnValueText};`;
                  if (isPreventingASI(returnValueText)) {
                    // put a semicolon at the beginning of the line
                    newReturnStmtText = `;${newReturnStmtText}`;
                  }
                  return [
                    {
                      message: messages.removeReturn,
                      changes: [
                        { node: invalidAncestor, newText: newReturnStmtText },
                      ],
                    },
                  ];
                }
              : undefined,
          });
          return;
        }

        // move before the `return` keyword
        context.report({
          node,
          message: messages.invalidVoidExprReturn,
          suggestions: () => {
            const returnValue = invalidAncestor.expression!;
            const returnValueText = returnValue.getFullText().trimStart();
            let newReturnStmtText = `${returnValueText}; return;`;
            if (isPreventingASI(returnValueText)) {
              // put a semicolon at the beginning of the line
              newReturnStmtText = `;${newReturnStmtText}`;
            }
            if (invalidAncestor.parent.kind !== SyntaxKind.Block) {
              // e.g. `if (cond) return console.error();`
              // add braces if not inside a block
              newReturnStmtText = `{ ${newReturnStmtText} }`;
            }
            return [
              {
                message: messages.moveBeforeReturn,
                changes: [
                  { node: invalidAncestor, newText: newReturnStmtText },
                ],
              },
            ];
          },
        });
        return;
      }

      // handle generic case
      if (options.ignoreVoidOperator) {
        context.report({
          node,
          message: messages.invalidVoidExprWrapVoid,
          suggestions: [
            { message: messages.voidExprWrapVoid, changes: wrapVoidFix(node) },
          ],
        });
        return;
      }

      context.report({
        node,
        message: messages.invalidVoidExpr,
      });
    }

    /**
     * Inspects the void expression's ancestors and finds closest invalid one.
     * By default anything other than an ExpressionStatement is invalid.
     * Parent expressions which can be used for their short-circuiting behavior
     * are ignored and their parents are checked instead.
     * @param node The void expression node to check.
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

      if (
        parent.kind === SyntaxKind.ConditionalExpression &&
        (parent.whenTrue === node || parent.whenFalse === node)
      ) {
        // e.g. `cond ? console.log(true) : console.log(false)`
        // this is valid only if the next ancestor is valid
        return findInvalidAncestor(parent, context);
      }

      if (
        parent.kind === SyntaxKind.ArrowFunction &&
        // e.g. `() => console.log("foo")`
        // this is valid with an appropriate option
        options.ignoreArrowShorthand
      ) {
        return null;
      }

      if (
        parent.kind === SyntaxKind.VoidExpression &&
        // e.g. `void console.log("foo")`
        // this is valid with an appropriate option
        options.ignoreVoidOperator
      ) {
        return null;
      }

      if (
        (parent.kind === SyntaxKind.PropertyAccessExpression &&
          parent.questionDotToken) ||
        parent.kind === SyntaxKind.ParenthesizedExpression
      ) {
        // e.g. console?.log('foo'), (foo ? a() : b())
        return findInvalidAncestor(parent, context);
      }

      // Any other parent is invalid.
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
          SyntaxKind.ArrowFunction,
          SyntaxKind.FunctionDeclaration,
          SyntaxKind.FunctionExpression,
        ].includes(blockParent.kind)
      ) {
        // e.g. `if (cond) { return; }`
        // not in a top-level function block
        return false;
      }

      // must be the last child of the block
      return block.statements.indexOf(node) === block.statements.length - 1;
    }

    /**
     * Checks whether the given text, if placed on its own line,
     * would prevent automatic semicolon insertion on the line before.
     *
     * This happens if the line begins with `(`, `[` or `` ` ``
     */
    function isPreventingASI(text: string): boolean {
      return ["(", "[", "`"].includes(text[0]);
    }

    function canFix(
      node: AST.ReturnStatement | AST.ArrowFunction,
      context: Context,
    ): boolean {
      const targetNode =
        node.kind === SyntaxKind.ReturnStatement ? node.expression! : node;

      const type = context.utils.getConstrainedTypeAtLocation(targetNode);
      return isTypeFlagSet(type, ts.TypeFlags.VoidLike);
    }

    function isFunctionReturnTypeIncludesVoid(functionType: ts.Type): boolean {
      const callSignatures = getCallSignaturesOfType(functionType);

      return callSignatures.some((signature) => {
        const returnType = signature.getReturnType();

        return unionTypeParts(returnType).some(isIntrinsicVoidType);
      });
    }

    function isVoidReturningFunctionNode(
      functionNode:
        | AST.ArrowFunction
        | AST.FunctionDeclaration
        | AST.MethodDeclaration
        | AST.FunctionExpression,
      context: Context,
    ): boolean {
      // Game plan:
      //   - If the function node has a type annotation, check if it includes `void`.
      //     - If it does then the function is safe to return `void` expressions in.
      //   - Otherwise, check if the function is a function-expression or an arrow-function.
      //   -   If it is, get its contextual type and bail if we cannot.
      //   - Return based on whether the contextual type includes `void` or not

      if (functionNode.type) {
        const returnType = context.checker.getTypeFromTypeNode(
          functionNode.type,
        );

        return unionTypeParts(returnType).some(isIntrinsicVoidType);
      }

      if (
        functionNode.kind === SyntaxKind.FunctionExpression ||
        functionNode.kind === SyntaxKind.ArrowFunction
      ) {
        const functionType = context.checker.getContextualType(functionNode);

        if (functionType) {
          return unionTypeParts(functionType).some(
            isFunctionReturnTypeIncludesVoid,
          );
        }
      }

      return false;
    }
  },
});

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
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): void {
  return console.log('bar');
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const test = (): void => {
  return console.log('bar');
};
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const test = (): void => console.log('bar');
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): void {
  {
    return console.log('foo');
  }
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const obj = {
  test(): void {
    return console.log('foo');
  },
};
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
class Foo {
  test(): void {
    return console.log('foo');
  }
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test() {
  function nestedTest(): void {
    return console.log('foo');
  }
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = () => void;
const test = (() => console.log()) as Foo;
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = {
  foo: () => void;
};
const test: Foo = {
  foo: () => console.log(),
};
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const test = {
  foo: () => console.log(),
} as {
  foo: () => void;
};
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const test: {
  foo: () => void;
} = {
  foo: () => console.log(),
};
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = {
  foo: { bar: () => void };
};

const test = {
  foo: { bar: () => console.log() },
} as Foo;
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = {
  foo: { bar: () => void };
};

const test: Foo = {
  foo: { bar: () => console.log() },
};
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type MethodType = () => void;

class App {
  private method: MethodType = () => console.log();
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
interface Foo {
  foo: () => void;
}

function bar(): Foo {
  return {
    foo: () => console.log(),
  };
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = () => () => () => void;
const x: Foo = () => () => () => console.log();
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = {
  foo: () => void;
};

const test = {
  foo: () => console.log(),
} as Foo;
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = () => void;
const test: Foo = () => console.log('foo');
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        tsx: true,
        code: "const foo = <button onClick={() => console.log()} />;",
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
declare function foo(arg: () => void): void;
foo(() => console.log());
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
declare function foo(arg: (() => void) | (() => string)): void;
foo(() => console.log());
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
declare function foo(arg: (() => void) | (() => string) | string): void;
foo(() => console.log());
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
declare function foo(arg: () => void | string): void;
foo(() => console.log());
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
declare function foo(options: { cb: () => void }): void;
foo({ cb: () => console.log() });
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const obj = {
  foo: { bar: () => console.log() },
} as {
  foo: { bar: () => void };
};
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): void & void {
  return console.log('foo');
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = void;

declare function foo(): Foo;

function test(): Foo {
  return foo();
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = void;
const test = (): Foo => console.log('err');
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const test: () => any = (): void => console.log();
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): void | string {
  return console.log('bar');
}
      `,
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
export function makeDate(): Date;
export function makeDate(m: number): void;
export function makeDate(m?: number): Date | void {
  if (m !== undefined) {
    return console.log('123');
  }
  return new Date();
}

declare const test: (cb: () => void) => void;

test((() => {
  return console.log('123');
}) as typeof makeDate | (() => string));
      `,
      },
    ],
    invalid: [
      {
        code: `
        const x = console.log('foo');
      `,
        errors: [
          {
            column: 19,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        const x = console?.log('foo');
      `,
        errors: [
          {
            column: 19,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        console.error(console.log('foo'));
      `,
        errors: [
          {
            column: 23,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        [console.log('foo')];
      `,
        errors: [
          {
            column: 10,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        ({ x: console.log('foo') });
      `,
        errors: [
          {
            column: 15,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        void console.log('foo');
      `,
        errors: [
          {
            column: 14,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        console.log('foo') ? true : false;
      `,
        errors: [
          {
            column: 9,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        (console.log('foo') && true) || false;
      `,
        errors: [
          {
            column: 10,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        (cond && console.log('ok')) || console.log('error');
      `,
        errors: [
          {
            column: 18,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
        !console.log('foo');
      `,
        errors: [
          {
            column: 10,
            message: messages.invalidVoidExpr,
          },
        ],
      },
      {
        code: `
function notcool(input: string) {
  return input, console.log(input);
}
      `,
        errors: [
          {
            column: 17,
            line: 3,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
function notcool(input: string) {
  input, console.log(input);
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: "() => console.log('foo');",
        errors: [
          {
            column: 7,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        code: "foo => foo && console.log(foo);",
        errors: [
          {
            column: 15,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        code: "(foo: undefined) => foo && console.log(foo);",
        errors: [
          {
            column: 28,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        code: "foo => foo || console.log(foo);",
        errors: [
          {
            column: 15,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        code: "(foo: undefined) => foo || console.log(foo);",
        errors: [
          {
            column: 28,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        code: "(foo: void) => foo || console.log(foo);",
        errors: [
          {
            column: 23,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        code: "foo => (foo ? console.log(true) : console.log(false));",
        errors: [
          {
            column: 15,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
          {
            column: 35,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
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
          {
            column: 18,
            line: 3,
            message: messages.invalidVoidExprReturn,
            suggestions: [
              {
                message: messages.moveBeforeReturn,
                output: `
        function f() {
          console.log('foo'); return;
          console.log('bar');
        }
      `,
              },
            ],
          },
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
          {
            column: 18,
            line: 4,
            message: messages.invalidVoidExprReturn,
            suggestions: [
              {
                message: messages.moveBeforeReturn,
                output: `
        function f() {
          console.log('foo')
          ;['bar', 'baz'].forEach(console.log); return;
          console.log('quux')
        }
      `,
              },
            ],
          },
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
          {
            column: 18,
            line: 4,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
        function f() {
          console.log('foo');
          console.log('bar');
        }
      `,
              },
            ],
          },
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
          {
            column: 18,
            line: 4,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
        function f() {
          console.log('foo')
          ;['bar', 'baz'].forEach(console.log);
        }
      `,
              },
            ],
          },
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
          {
            column: 20,
            line: 4,
            message: messages.invalidVoidExprReturn,
            suggestions: [
              {
                message: messages.moveBeforeReturn,
                output: `
        const f = () => {
          if (cond) {
            console.error('foo'); return;
          }
          console.log('bar');
        };
      `,
              },
            ],
          },
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
          {
            column: 28,
            line: 3,
            message: messages.invalidVoidExprReturn,
            suggestions: [
              {
                message: messages.moveBeforeReturn,
                output: `
        const f = function () {
          if (cond) { console.error('foo'); return; }
          console.log('bar');
        };
      `,
              },
            ],
          },
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
          {
            column: 24,
            line: 4,
            message: messages.invalidVoidExprReturnLast,
          },
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
          {
            column: 26,
            line: 4,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
        const f = function () {
          let undef = undefined;
          undef ? console.log('foo') : undef;
        };
      `,
              },
            ],
          },
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
          {
            column: 25,
            line: 4,
            message: messages.invalidVoidExprReturnLast,
          },
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
          {
            column: 25,
            line: 4,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
        const f = function () {
          let bar = void 0;
          bar || console.log('foo');
        };
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        let num = 1;
        const foo = () => (num ? console.log('foo') : num);
      `,
        errors: [
          {
            column: 34,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        code: `
        let bar = void 0;
        const foo = () => (bar ? console.log('foo') : bar);
      `,
        errors: [
          {
            column: 34,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "return console.log('foo');",
        errors: [
          {
            column: 8,
            line: 1,
            message: messages.invalidVoidExprReturnWrapVoid,
            suggestions: [
              {
                message: messages.voidExprWrapVoid,
                output: "return void console.log('foo');",
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "console.error(console.log('foo'));",
        errors: [
          {
            column: 15,
            line: 1,
            message: messages.invalidVoidExprWrapVoid,
            suggestions: [
              {
                message: messages.voidExprWrapVoid,
                output: "console.error(void console.log('foo'));",
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "console.log('foo') ? true : false;",
        errors: [
          {
            column: 1,
            line: 1,
            message: messages.invalidVoidExprWrapVoid,
            suggestions: [
              {
                message: messages.voidExprWrapVoid,
                output: "void console.log('foo') ? true : false;",
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "const x = foo ?? console.log('foo');",
        errors: [
          {
            column: 18,
            line: 1,
            message: messages.invalidVoidExprWrapVoid,
            suggestions: [
              {
                message: messages.voidExprWrapVoid,
                output: "const x = foo ?? void console.log('foo');",
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "foo => foo || console.log(foo);",
        errors: [
          {
            column: 15,
            line: 1,
            message: messages.invalidVoidExprArrowWrapVoid,
            suggestions: [
              {
                message: messages.voidExprWrapVoid,
                output: "foo => foo || void console.log(foo);",
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidOperator: true },
        code: "!!console.log('foo');",
        errors: [
          {
            column: 3,
            line: 1,
            message: messages.invalidVoidExprWrapVoid,
            suggestions: [
              {
                message: messages.voidExprWrapVoid,
                output: "!!void console.log('foo');",
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test() {
  return console.log('foo');
}
      `,
        errors: [
          {
            column: 10,
            line: 3,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
function test() {
  console.log('foo');
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: "const test = () => console.log('foo');",
        errors: [
          {
            column: 20,
            line: 1,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const test = () => {
  return console.log('foo');
};
      `,
        errors: [
          {
            column: 10,
            line: 3,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
const test = () => {
  console.log('foo');
};
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function foo(): void {
  const bar = () => {
    return console.log();
  };
}
      `,
        errors: [
          {
            column: 12,
            line: 4,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
function foo(): void {
  const bar = () => {
    console.log();
  };
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
        (): any => console.log('foo');
      `,
        errors: [
          {
            column: 20,
            line: 2,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
        (): unknown => console.log('foo');
      `,
        errors: [
          {
            column: 24,
            line: 2,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): void {
  () => () => console.log();
}
      `,
        errors: [
          {
            column: 15,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = any;
(): Foo => console.log();
      `,
        errors: [
          {
            column: 12,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = unknown;
(): Foo => console.log();
      `,
        errors: [
          {
            column: 12,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): any {
  () => () => console.log();
}
      `,
        errors: [
          {
            column: 15,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): unknown {
  return console.log();
}
      `,
        errors: [
          {
            column: 10,
            line: 3,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
function test(): unknown {
  console.log();
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): any {
  return console.log();
}
      `,
        errors: [
          {
            column: 10,
            line: 3,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
function test(): any {
  console.log();
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = () => any;
(): Foo => () => console.log();
      `,
        errors: [
          {
            column: 18,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = () => unknown;
(): Foo => () => console.log();
      `,
        errors: [
          {
            column: 18,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = () => any;
const test: Foo = () => console.log();
      `,
        errors: [
          {
            column: 25,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = () => unknown;
const test: Foo = () => console.log();
      `,
        errors: [
          {
            column: 25,
            line: 3,
            message: messages.invalidVoidExprArrow,
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
type Foo = () => void;

const foo: Foo = function () {
  function bar() {
    return console.log();
  }
};
      `,
        errors: [
          {
            column: 12,
            line: 6,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
type Foo = () => void;

const foo: Foo = function () {
  function bar() {
    console.log();
  }
};
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
const foo = function () {
  function bar() {
    return console.log();
  }
};
      `,
        errors: [
          {
            column: 12,
            line: 4,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
const foo = function () {
  function bar() {
    console.log();
  }
};
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(): void;
function test(arg: string): any;
function test(arg?: string): any | void {
  if (arg) {
    return arg;
  }
  return console.log();
}
      `,
        errors: [
          {
            column: 10,
            line: 8,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
function test(): void;
function test(arg: string): any;
function test(arg?: string): any | void {
  if (arg) {
    return arg;
  }
  console.log();
}
      `,
              },
            ],
          },
        ],
      },
      {
        options: { ignoreVoidReturningFunctions: true },
        code: `
function test(arg: string): any;
function test(): void;
function test(arg?: string): any | void {
  if (arg) {
    return arg;
  }
  return console.log();
}
      `,
        errors: [
          {
            column: 10,
            line: 8,
            message: messages.invalidVoidExprReturnLast,
            suggestions: [
              {
                message: messages.removeReturn,
                output: `
function test(arg: string): any;
function test(): void;
function test(arg?: string): any | void {
  if (arg) {
    return arg;
  }
  console.log();
}
      `,
              },
            ],
          },
        ],
      },
    ],
  });
