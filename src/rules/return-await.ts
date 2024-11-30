import { SyntaxKind } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Context, Suggestion } from "../types.ts";
import { isHigherPrecedenceThanUnary } from "./utils/index.ts";
import { needsToBeAwaited } from "./utils/needsToBeAwaited.ts";

const messages = {
  requiredPromiseAwait: "Returned value must be awaited.",
  addAwait: "Add await operator.",
};

type FunctionNode =
  | AST.ArrowFunction
  | AST.FunctionDeclaration
  | AST.FunctionExpression;

export const returnAwait = createRule(() => ({
  name: "core/returnAwait",
  // Keep track of (async) function stack
  createData: (): boolean[] => [],
  visitor: {
    ArrowFunction: enterFunction,
    "ArrowFunction:exit"(node, context) {
      context.data.pop();
      if (isAsyncFunction(node) && node.body.kind !== SyntaxKind.Block) {
        for (const expression of findPossiblyReturnedNodes(node.body)) {
          checkExpression(expression, context);
        }
      }
    },
    FunctionDeclaration: enterFunction,
    "FunctionDeclaration:exit"(_, context) {
      context.data.pop();
    },
    FunctionExpression: enterFunction,
    "FunctionExpression:exit"(_, context) {
      context.data.pop();
    },

    ReturnStatement(node, context) {
      if (!context.data.at(-1) || !node.expression) return;
      for (const expression of findPossiblyReturnedNodes(node.expression)) {
        checkExpression(expression, context);
      }
    },
  },
}));

function isAsyncFunction(node: FunctionNode): boolean {
  return (
    node.modifiers?.some(
      (modifier) => modifier.kind === SyntaxKind.AsyncKeyword,
    ) ?? false
  );
}

function enterFunction(node: FunctionNode, context: Context<boolean[]>): void {
  context.data.push(isAsyncFunction(node));
}

function findPossiblyReturnedNodes(node: AST.Expression): AST.Expression[] {
  if (node.kind === SyntaxKind.ConditionalExpression) {
    return [
      ...findPossiblyReturnedNodes(node.whenTrue),
      ...findPossiblyReturnedNodes(node.whenFalse),
    ];
  }
  if (node.kind === SyntaxKind.ParenthesizedExpression) {
    return findPossiblyReturnedNodes(node.expression);
  }
  return [node];
}

function checkExpression(node: AST.Expression, context: Context): void {
  if (node.kind === SyntaxKind.AwaitExpression) return;
  const type = context.checker.getTypeAtLocation(node);
  if (needsToBeAwaited(context, node, type) !== "Always") return;
  context.report({
    node,
    message: messages.requiredPromiseAwait,
    suggestions: () => {
      const changes: Suggestion["changes"] = [];
      if (isHigherPrecedenceThanUnary(node)) {
        changes.push({ start: node.getStart(), length: 0, newText: "await " });
      } else {
        changes.push({ start: node.getStart(), length: 0, newText: "await (" });
        changes.push({ start: node.getEnd(), length: 0, newText: ")" });
      }
      return [{ message: messages.addAwait, changes }];
    },
  });
}

export const test = () =>
  ruleTester({
    ruleFn: returnAwait,
    valid: [
      `
      function test() {
        return;
      }
    `,
      `
      function test() {
        return 1;
      }
    `,
      `
      async function test() {
        return;
      }
    `,
      `
      async function test() {
        return 1;
      }
    `,
      "const test = () => 1;",
      "const test = async () => 1;",
      `
      async function test() {
        try {
          const one = await Promise.resolve(1);
          return one;
        } catch (e) {
          const two = await Promise.resolve(2);
          return two;
        } finally {
          console.log('cleanup');
        }
      }
    `,
      `
      async function test() {
        return await Promise.resolve(1);
      }
      `,
      "const test = async () => await Promise.resolve(1);",
      `
      async function test() {
        try {
          return await Promise.resolve(1);
        } catch (e) {
          return await Promise.resolve(2);
        } finally {
          console.log('cleanup');
        }
      }
      `,
      `
      declare function foo(): Promise<boolean>;

      function bar(baz: boolean): Promise<boolean> | boolean {
        if (baz) {
          return true;
        } else {
          return foo();
        }
      }
      `,
      `
      async function test(): Promise<string> {
        const res = await Promise.resolve('{}');
        try {
          return JSON.parse(res);
        } catch (error) {
          return res;
        }
      }
      `,
      `
async function wrapper<T>(value: T) {
  return value;
}
      `,
      `
async function wrapper<T extends unknown>(value: T) {
  return await value;
}
      `,
      `
async function wrapper<T extends any>(value: T) {
  return await value;
}
      `,
      `
class C<T> {
  async wrapper<T>(value: T) {
    return await value;
  }
}
      `,
      `
class C<R> {
  async wrapper<T extends R>(value: T) {
    return await value;
  }
}
      `,
      `
class C<R extends unknown> {
  async wrapper<T extends R>(value: T) {
    return await value;
  }
}
      `,
    ],
    invalid: [
      {
        code: `
        async function test() {
          try {
            return Promise.resolve(1);
          } catch (e) {
            return Promise.resolve(2);
          } finally {
            console.log('cleanup');
          }
        }
      `,
        errors: [
          {
            message: messages.requiredPromiseAwait,
            line: 4,
            suggestions: [
              {
                message: messages.addAwait,
                output: `
        async function test() {
          try {
            return await Promise.resolve(1);
          } catch (e) {
            return Promise.resolve(2);
          } finally {
            console.log('cleanup');
          }
        }
      `,
              },
            ],
          },
          {
            message: messages.requiredPromiseAwait,
            line: 6,
            suggestions: [
              {
                message: messages.addAwait,
                output: `
        async function test() {
          try {
            return Promise.resolve(1);
          } catch (e) {
            return await Promise.resolve(2);
          } finally {
            console.log('cleanup');
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
        async function test() {
          return Promise.resolve(1);
        }
      `,
        errors: [
          {
            message: messages.requiredPromiseAwait,
            line: 3,
            suggestions: [
              {
                message: messages.addAwait,
                output: `
        async function test() {
          return await Promise.resolve(1);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: "const test = async () => Promise.resolve(1);",
        errors: [
          {
            message: messages.requiredPromiseAwait,
            line: 1,
            suggestions: [
              {
                message: messages.addAwait,
                output: "const test = async () => await Promise.resolve(1);",
              },
            ],
          },
        ],
      },
      {
        code: `
async function foo() {}
async function bar() {}
async function baz() {}
async function qux() {}
async function buzz() {
  return (await foo()) ? bar() : baz();
}
      `,
        errors: [
          {
            message: messages.requiredPromiseAwait,
            line: 7,
            suggestions: [
              {
                message: messages.addAwait,
                output: `
async function foo() {}
async function bar() {}
async function baz() {}
async function qux() {}
async function buzz() {
  return (await foo()) ? await bar() : baz();
}
      `,
              },
            ],
          },
          {
            message: messages.requiredPromiseAwait,
            line: 7,
            suggestions: [
              {
                message: messages.addAwait,
                output: `
async function foo() {}
async function bar() {}
async function baz() {}
async function qux() {}
async function buzz() {
  return (await foo()) ? bar() : await baz();
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
async function foo() {}
async function bar() {}
async function baz() {}
async function qux() {}
async function buzz() {
  return (await foo())
    ? (
      bar ? bar() : baz()
    ) : baz ? baz() : bar();
}
      `,
        errors: [
          {
            message: messages.requiredPromiseAwait,
            line: 9,
            suggestions: [
              {
                message: messages.addAwait,
                output: `
async function foo() {}
async function bar() {}
async function baz() {}
async function qux() {}
async function buzz() {
  return (await foo())
    ? (
      bar ? await bar() : baz()
    ) : baz ? baz() : bar();
}
      `,
              },
            ],
          },
          {
            message: messages.requiredPromiseAwait,
            line: 9,
            suggestions: [
              {
                message: messages.addAwait,
                output: `
async function foo() {}
async function bar() {}
async function baz() {}
async function qux() {}
async function buzz() {
  return (await foo())
    ? (
      bar ? bar() : await baz()
    ) : baz ? baz() : bar();
}
      `,
              },
            ],
          },
          {
            message: messages.requiredPromiseAwait,
            line: 10,
            suggestions: [
              {
                message: messages.addAwait,
                output: `
async function foo() {}
async function bar() {}
async function baz() {}
async function qux() {}
async function buzz() {
  return (await foo())
    ? (
      bar ? bar() : baz()
    ) : baz ? await baz() : bar();
}
      `,
              },
            ],
          },
          {
            message: messages.requiredPromiseAwait,
            line: 10,
            suggestions: [
              {
                message: messages.addAwait,
                output: `
async function foo() {}
async function bar() {}
async function baz() {}
async function qux() {}
async function buzz() {
  return (await foo())
    ? (
      bar ? bar() : baz()
    ) : baz ? baz() : await bar();
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
async function foo() {}
async function bar() {}
async function buzz() {
  return (await foo()) ? await 1 : bar();
}
      `,
        errors: [
          {
            message: messages.requiredPromiseAwait,
            line: 5,
            suggestions: [
              {
                message: messages.addAwait,
                output: `
async function foo() {}
async function bar() {}
async function buzz() {
  return (await foo()) ? await 1 : await bar();
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
async function foo() {}
async function bar() {}
async function baz() {}
const buzz = async () => ((await foo()) ? bar() : baz());
      `,
        errors: [
          {
            message: messages.requiredPromiseAwait,
            line: 5,
            suggestions: [
              {
                message: messages.addAwait,
                output: `
async function foo() {}
async function bar() {}
async function baz() {}
const buzz = async () => ((await foo()) ? await bar() : baz());
      `,
              },
            ],
          },
          {
            message: messages.requiredPromiseAwait,
            line: 5,
            suggestions: [
              {
                message: messages.addAwait,
                output: `
async function foo() {}
async function bar() {}
async function baz() {}
const buzz = async () => ((await foo()) ? bar() : await baz());
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
async function foo() {}
async function bar() {}
const buzz = async () => ((await foo()) ? await 1 : bar());
      `,
        errors: [
          {
            message: messages.requiredPromiseAwait,
            line: 4,
            suggestions: [
              {
                message: messages.addAwait,
                output: `
async function foo() {}
async function bar() {}
const buzz = async () => ((await foo()) ? await 1 : await bar());
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const bleh: any;
async function f() {
  if (cond) {
    using something = bleh;
    if (anotherCondition) {
      return Promise.resolve(2);
    }
  }
}
      `,
        errors: [
          {
            message: messages.requiredPromiseAwait,
            line: 7,
            suggestions: [
              {
                message: messages.addAwait,
                output: `
declare const bleh: any;
async function f() {
  if (cond) {
    using something = bleh;
    if (anotherCondition) {
      return await Promise.resolve(2);
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
declare const bleh: any;
async function f() {
  if (cond) {
    await using something = bleh;
    if (anotherCondition) {
      return Promise.resolve(2);
    }
  }
}
      `,
        errors: [
          {
            message: messages.requiredPromiseAwait,
            line: 7,
            suggestions: [
              {
                message: messages.addAwait,
                output: `
declare const bleh: any;
async function f() {
  if (cond) {
    await using something = bleh;
    if (anotherCondition) {
      return await Promise.resolve(2);
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
declare const bleh: any;
async function f() {
  if (cond) {
    using something = bleh;
  } else if (anotherCondition) {
    return Promise.resolve(2);
  }
}
      `,
        errors: [
          {
            message: messages.requiredPromiseAwait,
            line: 7,
            suggestions: [
              {
                message: messages.addAwait,
                output: `
declare const bleh: any;
async function f() {
  if (cond) {
    using something = bleh;
  } else if (anotherCondition) {
    return await Promise.resolve(2);
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
