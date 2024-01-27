import { isSymbolFlagSet } from "ts-api-utils";
import ts, { SymbolFlags, SyntaxKind } from "typescript";
import type { AnyNode } from "../ast.ts";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Context } from "../types.ts";

const messages = {
  noImpliedEvalError: "Implied eval. Consider passing a function.",
  noFunctionConstructor:
    "Implied eval. Do not use the Function constructor to create functions.",
};

const FUNCTION_CONSTRUCTOR = "Function";
const GLOBAL_CANDIDATES = new Set(["global", "window", "globalThis"]);
const EVAL_LIKE_METHODS = new Set([
  "setImmediate",
  "setInterval",
  "setTimeout",
  "execScript",
]);

export const noImpliedEval = createRule({
  name: "no-implied-eval",
  visitor: {
    NewExpression: checkImpliedEval,
    CallExpression: checkImpliedEval,
  },
});

function getCalleeName(node: AST.LeftHandSideExpression): string | null {
  if (node.kind === SyntaxKind.Identifier) {
    return node.text;
  }

  if (
    node.kind === SyntaxKind.PropertyAccessExpression &&
    node.expression.kind === SyntaxKind.Identifier &&
    GLOBAL_CANDIDATES.has(node.expression.text) &&
    node.name.kind === SyntaxKind.Identifier
  ) {
    return node.name.text;
  }

  if (
    node.kind === SyntaxKind.ElementAccessExpression &&
    node.expression.kind === SyntaxKind.Identifier &&
    GLOBAL_CANDIDATES.has(node.expression.text) &&
    node.argumentExpression.kind === SyntaxKind.StringLiteral
  ) {
    return node.argumentExpression.text;
  }

  return null;
}

function isFunctionType(node: AnyNode, context: Context): boolean {
  const type = context.checker.getTypeAtLocation(node);
  const symbol = type.getSymbol();

  if (
    symbol &&
    isSymbolFlagSet(symbol, SymbolFlags.Function | SymbolFlags.Method)
  ) {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  if (symbol && symbol.escapedName === FUNCTION_CONSTRUCTOR) {
    const declarations = symbol.getDeclarations() ?? [];
    for (const declaration of declarations) {
      const sourceFile = declaration.getSourceFile();
      if (context.program.isSourceFileDefaultLibrary(sourceFile)) {
        return true;
      }
    }
  }

  const signatures = context.checker.getSignaturesOfType(
    type,
    ts.SignatureKind.Call,
  );

  return signatures.length > 0;
}

function isFunction(node: AnyNode, context: Context): boolean {
  switch (node.kind) {
    case SyntaxKind.ArrowFunction:
    case SyntaxKind.FunctionDeclaration:
    case SyntaxKind.FunctionExpression:
      return true;

    case SyntaxKind.StringLiteral:
    case SyntaxKind.NumericLiteral:
    case SyntaxKind.TrueKeyword:
    case SyntaxKind.FalseKeyword:
    case SyntaxKind.TemplateExpression:
      return false;

    case SyntaxKind.CallExpression:
      return (
        (node.expression.kind === SyntaxKind.PropertyAccessExpression &&
          node.expression.name.kind === SyntaxKind.Identifier &&
          node.expression.name.text === "bind") ||
        isFunctionType(node, context)
      );

    default:
      return isFunctionType(node, context);
  }
}

function checkImpliedEval(
  node: AST.CallExpression | AST.NewExpression,
  context: Context,
): void {
  const calleeName = getCalleeName(node.expression);
  if (calleeName == null) return;

  if (calleeName === FUNCTION_CONSTRUCTOR) {
    const type = context.checker.getTypeAtLocation(node.expression);
    const symbol = type.getSymbol();
    if (symbol) {
      const declarations = symbol.getDeclarations() ?? [];
      for (const declaration of declarations) {
        const sourceFile = declaration.getSourceFile();
        if (context.program.isSourceFileDefaultLibrary(sourceFile)) {
          context.report({ node, message: messages.noFunctionConstructor });
          return;
        }
      }
    } else {
      context.report({ node, message: messages.noFunctionConstructor });
      return;
    }
  }

  if (!node.arguments || node.arguments.length === 0) {
    return;
  }

  const [handler] = node.arguments;
  if (EVAL_LIKE_METHODS.has(calleeName) && !isFunction(handler, context)) {
    context.report({ node: handler, message: messages.noImpliedEvalError });
  }
}

export const test = () =>
  ruleTester({
    rule: noImpliedEval,
    valid: [
      "foo.setImmediate(null);",
      "foo.setInterval(null);",
      "foo.execScript(null);",
      "foo.setTimeout(null);",
      "foo();",
      "(function () {})();",

      "setTimeout(() => {}, 0);",
      "window.setTimeout(() => {}, 0);",
      "window['setTimeout'](() => {}, 0);",

      "setInterval(() => {}, 0);",
      "window.setInterval(() => {}, 0);",
      "window['setInterval'](() => {}, 0);",

      "setImmediate(() => {});",
      "window.setImmediate(() => {});",
      "window['setImmediate'](() => {});",

      "execScript(() => {});",
      "window.execScript(() => {});",
      "window['execScript'](() => {});",

      `
const foo = () => {};

setTimeout(foo, 0);
setInterval(foo, 0);
setImmediate(foo);
execScript(foo);
    `,
      `
const foo = function () {};

setTimeout(foo, 0);
setInterval(foo, 0);
setImmediate(foo);
execScript(foo);
    `,
      `
function foo() {}

setTimeout(foo, 0);
setInterval(foo, 0);
setImmediate(foo);
execScript(foo);
    `,
      `
const foo = {
  fn: () => {},
};

setTimeout(foo.fn, 0);
setInterval(foo.fn, 0);
setImmediate(foo.fn);
execScript(foo.fn);
    `,
      `
const foo = {
  fn: function () {},
};

setTimeout(foo.fn, 0);
setInterval(foo.fn, 0);
setImmediate(foo.fn);
execScript(foo.fn);
    `,
      `
const foo = {
  fn: function foo() {},
};

setTimeout(foo.fn, 0);
setInterval(foo.fn, 0);
setImmediate(foo.fn);
execScript(foo.fn);
    `,
      `
const foo = {
  fn() {},
};

setTimeout(foo.fn, 0);
setInterval(foo.fn, 0);
setImmediate(foo.fn);
execScript(foo.fn);
    `,
      `
const foo = {
  fn: () => {},
};
const fn = 'fn';

setTimeout(foo[fn], 0);
setInterval(foo[fn], 0);
setImmediate(foo[fn]);
execScript(foo[fn]);
    `,
      `
const foo = {
  fn: () => {},
};

setTimeout(foo['fn'], 0);
setInterval(foo['fn'], 0);
setImmediate(foo['fn']);
execScript(foo['fn']);
    `,
      `
const foo: () => void = () => {};

setTimeout(foo, 0);
setInterval(foo, 0);
setImmediate(foo);
execScript(foo);
    `,
      `
const foo: () => () => void = () => {
  return () => {};
};

setTimeout(foo(), 0);
setInterval(foo(), 0);
setImmediate(foo());
execScript(foo());
    `,
      `
const foo: () => () => void = () => () => {};

setTimeout(foo(), 0);
setInterval(foo(), 0);
setImmediate(foo());
execScript(foo());
    `,
      `
const foo = () => () => {};

setTimeout(foo(), 0);
setInterval(foo(), 0);
setImmediate(foo());
execScript(foo());
    `,
      `
const foo = function foo() {
  return function foo() {};
};

setTimeout(foo(), 0);
setInterval(foo(), 0);
setImmediate(foo());
execScript(foo());
    `,
      `
const foo = function () {
  return function () {
    return '';
  };
};

setTimeout(foo(), 0);
setInterval(foo(), 0);
setImmediate(foo());
execScript(foo());
    `,
      `
const foo: () => () => void = function foo() {
  return function foo() {};
};

setTimeout(foo(), 0);
setInterval(foo(), 0);
setImmediate(foo());
execScript(foo());
    `,
      `
function foo() {
  return function foo() {
    return () => {};
  };
}

setTimeout(foo()(), 0);
setInterval(foo()(), 0);
setImmediate(foo()());
execScript(foo()());
    `,
      `
class Foo {
  static fn = () => {};
}

setTimeout(Foo.fn, 0);
setInterval(Foo.fn, 0);
setImmediate(Foo.fn);
execScript(Foo.fn);
    `,
      `
class Foo {
  fn() {}
}

const foo = new Foo();

setTimeout(foo.fn, 0);
setInterval(foo.fn, 0);
setImmediate(foo.fn);
execScript(foo.fn);
    `,
      `
class Foo {
  fn() {}
}
const foo = new Foo();
const fn = foo.fn;

setTimeout(fn.bind(null), 0);
setInterval(fn.bind(null), 0);
setImmediate(fn.bind(null));
execScript(fn.bind(null));
    `,
      `
const fn = (foo: () => void) => {
  setTimeout(foo, 0);
  setInterval(foo, 0);
  setImmediate(foo);
  execScript(foo);
};
    `,
      `
const foo = (callback: Function) => {
  setTimeout(callback, 0);
};
    `,
      `
const foo = () => {};
const bar = () => {};

setTimeout(Math.radom() > 0.5 ? foo : bar, 0);
setTimeout(foo || bar, 500);
    `,
      `
class Foo {
  func1() {}
  func2(): void {
    setTimeout(this.func1.bind(this), 1);
  }
}
    `,
      `
class Foo {
  private a = {
    b: {
      c: function () {},
    },
  };
  funcw(): void {
    setTimeout(this.a.b.c.bind(this), 1);
  }
}
    `,
    ],

    invalid: [
      {
        code: `
setTimeout('x = 1', 0);
setInterval('x = 1', 0);
setImmediate('x = 1');
execScript('x = 1');
      `,
        errors: [
          {
            message: messages.noImpliedEvalError,
            line: 2,
            column: 12,
          },
          {
            message: messages.noImpliedEvalError,
            line: 3,
            column: 13,
          },
          {
            message: messages.noImpliedEvalError,
            line: 4,
            column: 14,
          },
          {
            message: messages.noImpliedEvalError,
            line: 5,
            column: 12,
          },
        ],
      },
      {
        code: `
setTimeout(undefined, 0);
setInterval(undefined, 0);
setImmediate(undefined);
execScript(undefined);
      `,
        errors: [
          {
            message: messages.noImpliedEvalError,
            line: 2,
            column: 12,
          },
          {
            message: messages.noImpliedEvalError,
            line: 3,
            column: 13,
          },
          {
            message: messages.noImpliedEvalError,
            line: 4,
            column: 14,
          },
          {
            message: messages.noImpliedEvalError,
            line: 5,
            column: 12,
          },
        ],
      },
      {
        code: `
setTimeout(1 + '' + (() => {}), 0);
setInterval(1 + '' + (() => {}), 0);
setImmediate(1 + '' + (() => {}));
execScript(1 + '' + (() => {}));
      `,
        errors: [
          {
            message: messages.noImpliedEvalError,
            line: 2,
            column: 12,
          },
          {
            message: messages.noImpliedEvalError,
            line: 3,
            column: 13,
          },
          {
            message: messages.noImpliedEvalError,
            line: 4,
            column: 14,
          },
          {
            message: messages.noImpliedEvalError,
            line: 5,
            column: 12,
          },
        ],
      },
      {
        code: `
const foo = 'x = 1';

setTimeout(foo, 0);
setInterval(foo, 0);
setImmediate(foo);
execScript(foo);
      `,
        errors: [
          {
            message: messages.noImpliedEvalError,
            line: 4,
            column: 12,
          },
          {
            message: messages.noImpliedEvalError,
            line: 5,
            column: 13,
          },
          {
            message: messages.noImpliedEvalError,
            line: 6,
            column: 14,
          },
          {
            message: messages.noImpliedEvalError,
            line: 7,
            column: 12,
          },
        ],
      },
      {
        code: `
const foo = function () {
  return 'x + 1';
};

setTimeout(foo(), 0);
setInterval(foo(), 0);
setImmediate(foo());
execScript(foo());
      `,
        errors: [
          {
            message: messages.noImpliedEvalError,
            line: 6,
            column: 12,
          },
          {
            message: messages.noImpliedEvalError,
            line: 7,
            column: 13,
          },
          {
            message: messages.noImpliedEvalError,
            line: 8,
            column: 14,
          },
          {
            message: messages.noImpliedEvalError,
            line: 9,
            column: 12,
          },
        ],
      },
      {
        code: `
const foo = function () {
  return () => 'x + 1';
};

setTimeout(foo()(), 0);
setInterval(foo()(), 0);
setImmediate(foo()());
execScript(foo()());
      `,
        errors: [
          {
            message: messages.noImpliedEvalError,
            line: 6,
            column: 12,
          },
          {
            message: messages.noImpliedEvalError,
            line: 7,
            column: 13,
          },
          {
            message: messages.noImpliedEvalError,
            line: 8,
            column: 14,
          },
          {
            message: messages.noImpliedEvalError,
            line: 9,
            column: 12,
          },
        ],
      },
      {
        code: `
const fn = function () {};

setTimeout(fn + '', 0);
setInterval(fn + '', 0);
setImmediate(fn + '');
execScript(fn + '');
      `,
        errors: [
          {
            message: messages.noImpliedEvalError,
            line: 4,
            column: 12,
          },
          {
            message: messages.noImpliedEvalError,
            line: 5,
            column: 13,
          },
          {
            message: messages.noImpliedEvalError,
            line: 6,
            column: 14,
          },
          {
            message: messages.noImpliedEvalError,
            line: 7,
            column: 12,
          },
        ],
      },
      {
        code: `
const foo: string = 'x + 1';

setTimeout(foo, 0);
setInterval(foo, 0);
setImmediate(foo);
execScript(foo);
      `,
        errors: [
          {
            message: messages.noImpliedEvalError,
            line: 4,
            column: 12,
          },
          {
            message: messages.noImpliedEvalError,
            line: 5,
            column: 13,
          },
          {
            message: messages.noImpliedEvalError,
            line: 6,
            column: 14,
          },
          {
            message: messages.noImpliedEvalError,
            line: 7,
            column: 12,
          },
        ],
      },
      {
        code: `
const foo = new String('x + 1');

setTimeout(foo, 0);
setInterval(foo, 0);
setImmediate(foo);
execScript(foo);
      `,
        errors: [
          {
            message: messages.noImpliedEvalError,
            line: 4,
            column: 12,
          },
          {
            message: messages.noImpliedEvalError,
            line: 5,
            column: 13,
          },
          {
            message: messages.noImpliedEvalError,
            line: 6,
            column: 14,
          },
          {
            message: messages.noImpliedEvalError,
            line: 7,
            column: 12,
          },
        ],
      },
      {
        code: `
const foo = 'x + 1';

setTimeout(foo as any, 0);
setInterval(foo as any, 0);
setImmediate(foo as any);
execScript(foo as any);
      `,
        errors: [
          {
            message: messages.noImpliedEvalError,
            line: 4,
            column: 12,
          },
          {
            message: messages.noImpliedEvalError,
            line: 5,
            column: 13,
          },
          {
            message: messages.noImpliedEvalError,
            line: 6,
            column: 14,
          },
          {
            message: messages.noImpliedEvalError,
            line: 7,
            column: 12,
          },
        ],
      },
      {
        code: `
const fn = (foo: string | any) => {
  setTimeout(foo, 0);
  setInterval(foo, 0);
  setImmediate(foo);
  execScript(foo);
};
      `,
        errors: [
          {
            message: messages.noImpliedEvalError,
            line: 3,
            column: 14,
          },
          {
            message: messages.noImpliedEvalError,
            line: 4,
            column: 15,
          },
          {
            message: messages.noImpliedEvalError,
            line: 5,
            column: 16,
          },
          {
            message: messages.noImpliedEvalError,
            line: 6,
            column: 14,
          },
        ],
      },
      {
        code: `
const foo = 'foo';
const bar = () => {};

setTimeout(Math.radom() > 0.5 ? foo : bar, 0);
      `,
        errors: [
          {
            message: messages.noImpliedEvalError,
            line: 5,
            column: 12,
          },
        ],
      },
      {
        code: `
window.setTimeout(\`\`, 0);
window['setTimeout'](\`\`, 0);

window.setInterval(\`\`, 0);
window['setInterval'](\`\`, 0);

window.setImmediate(\`\`);
window['setImmediate'](\`\`);

window.execScript(\`\`);
window['execScript'](\`\`);
      `,
        errors: [
          {
            message: messages.noImpliedEvalError,
            line: 2,
            column: 19,
          },
          {
            message: messages.noImpliedEvalError,
            line: 3,
            column: 22,
          },
          {
            message: messages.noImpliedEvalError,
            line: 5,
            column: 20,
          },
          {
            message: messages.noImpliedEvalError,
            line: 6,
            column: 23,
          },
          {
            message: messages.noImpliedEvalError,
            line: 8,
            column: 21,
          },
          {
            message: messages.noImpliedEvalError,
            line: 9,
            column: 24,
          },
          {
            message: messages.noImpliedEvalError,
            line: 11,
            column: 19,
          },
          {
            message: messages.noImpliedEvalError,
            line: 12,
            column: 22,
          },
        ],
      },
      {
        code: `
global.setTimeout(\`\`, 0);
global['setTimeout'](\`\`, 0);

global.setInterval(\`\`, 0);
global['setInterval'](\`\`, 0);

global.setImmediate(\`\`);
global['setImmediate'](\`\`);

global.execScript(\`\`);
global['execScript'](\`\`);
      `,
        errors: [
          {
            message: messages.noImpliedEvalError,
            line: 2,
            column: 19,
          },
          {
            message: messages.noImpliedEvalError,
            line: 3,
            column: 22,
          },
          {
            message: messages.noImpliedEvalError,
            line: 5,
            column: 20,
          },
          {
            message: messages.noImpliedEvalError,
            line: 6,
            column: 23,
          },
          {
            message: messages.noImpliedEvalError,
            line: 8,
            column: 21,
          },
          {
            message: messages.noImpliedEvalError,
            line: 9,
            column: 24,
          },
          {
            message: messages.noImpliedEvalError,
            line: 11,
            column: 19,
          },
          {
            message: messages.noImpliedEvalError,
            line: 12,
            column: 22,
          },
        ],
      },
      {
        code: `
globalThis.setTimeout(\`\`, 0);
globalThis['setTimeout'](\`\`, 0);

globalThis.setInterval(\`\`, 0);
globalThis['setInterval'](\`\`, 0);

globalThis.setImmediate(\`\`);
globalThis['setImmediate'](\`\`);

globalThis.execScript(\`\`);
globalThis['execScript'](\`\`);
      `,
        errors: [
          {
            message: messages.noImpliedEvalError,
            line: 2,
            column: 23,
          },
          {
            message: messages.noImpliedEvalError,
            line: 3,
            column: 26,
          },
          {
            message: messages.noImpliedEvalError,
            line: 5,
            column: 24,
          },
          {
            message: messages.noImpliedEvalError,
            line: 6,
            column: 27,
          },
          {
            message: messages.noImpliedEvalError,
            line: 8,
            column: 25,
          },
          {
            message: messages.noImpliedEvalError,
            line: 9,
            column: 28,
          },
          {
            message: messages.noImpliedEvalError,
            line: 11,
            column: 23,
          },
          {
            message: messages.noImpliedEvalError,
            line: 12,
            column: 26,
          },
        ],
      },
      {
        code: `
const foo: string | undefined = 'hello';
const bar = () => {};

setTimeout(foo || bar, 500);
      `,
        errors: [
          {
            message: messages.noImpliedEvalError,
            line: 5,
            column: 12,
          },
        ],
      },
      {
        code: "const fn = Function();",
        errors: [
          {
            message: messages.noFunctionConstructor,
            line: 1,
            column: 12,
          },
        ],
      },
      {
        code: "const fn = new Function('a', 'b', 'return a + b');",
        errors: [
          {
            message: messages.noFunctionConstructor,
            line: 1,
            column: 12,
          },
        ],
      },
      {
        code: "const fn = window.Function();",
        errors: [
          {
            message: messages.noFunctionConstructor,
            line: 1,
            column: 12,
          },
        ],
      },
      {
        code: "const fn = new window.Function();",
        errors: [
          {
            message: messages.noFunctionConstructor,
            line: 1,
            column: 12,
          },
        ],
      },
      {
        code: "const fn = window['Function']();",
        errors: [
          {
            message: messages.noFunctionConstructor,
            line: 1,
            column: 12,
          },
        ],
      },
      {
        code: "const fn = new window['Function']();",
        errors: [
          {
            message: messages.noFunctionConstructor,
            line: 1,
            column: 12,
          },
        ],
      },
    ],
  });
