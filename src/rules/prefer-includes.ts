import ts, { SyntaxKind } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";

const messages = {
  preferIncludes: "Use 'includes()' method instead.",
  fix: "Replace 'indexOf()' with 'includes()'.",
};

export const preferIncludes = createRule(() => ({
  name: "core/preferIncludes",
  visitor: {
    PropertyAccessExpression(node, context) {
      if (node.name.kind !== SyntaxKind.Identifier) return;
      if (node.name.text !== "indexOf") return;
      if (node.parent.kind !== SyntaxKind.CallExpression) return;
      if (node.parent.parent.kind !== SyntaxKind.BinaryExpression) return;
      const isLeft = node.parent.parent.left === node.parent;
      const compareNode = isLeft
        ? node.parent.parent.right
        : node.parent.parent.left;
      let notIncludes = false;
      const operator = node.parent.parent.operatorToken.kind;
      switch (operator) {
        case SyntaxKind.EqualsEqualsToken:
        case SyntaxKind.EqualsEqualsEqualsToken:
        case SyntaxKind.ExclamationEqualsEqualsToken:
        case SyntaxKind.ExclamationEqualsToken:
        case SyntaxKind.GreaterThanToken:
        case SyntaxKind.LessThanEqualsToken:
          if (compareNode.kind !== SyntaxKind.PrefixUnaryExpression) return;
          if (compareNode.operand.kind !== SyntaxKind.NumericLiteral) return;
          if (compareNode.operand.text !== "1") return;
          notIncludes =
            operator === SyntaxKind.EqualsEqualsToken ||
            operator === SyntaxKind.EqualsEqualsEqualsToken ||
            operator === SyntaxKind.LessThanEqualsToken;
          break;
        case SyntaxKind.GreaterThanEqualsToken:
        case SyntaxKind.LessThanToken:
          if (compareNode.kind !== SyntaxKind.NumericLiteral) return;
          if (compareNode.text !== "0") return;
          notIncludes = operator === SyntaxKind.LessThanToken;
          break;
        default:
          return;
      }
      // Get the symbol of `indexOf` method.
      const indexOfMethodDeclarations = context.checker
        .getSymbolAtLocation(node.name)
        ?.getDeclarations();
      if (
        indexOfMethodDeclarations == null ||
        indexOfMethodDeclarations.length === 0
      ) {
        return;
      }

      // Check if every declaration of `indexOf` method has `includes` method
      // and the two methods have the same parameters.
      for (const instanceofMethodDecl of indexOfMethodDeclarations) {
        const typeDecl = instanceofMethodDecl.parent;
        const type = context.checker.getTypeAtLocation(typeDecl);
        const includesMethodDecl = type
          .getProperty("includes")
          ?.getDeclarations();
        if (
          !includesMethodDecl?.some((includesMethodDecl) =>
            hasSameParameters(includesMethodDecl, instanceofMethodDecl),
          )
        ) {
          return;
        }
      }

      context.report({
        node: node.parent.parent,
        message: messages.preferIncludes,
        suggestions: node.questionDotToken
          ? []
          : [
              {
                message: messages.fix,
                changes: [
                  { node: node.name, newText: "includes" },
                  {
                    start: node.parent.getStart(),
                    length: 0,
                    newText: notIncludes ? "!" : "",
                  },
                  isLeft
                    ? {
                        start: node.parent.end,
                        end: node.parent.parent.getEnd(),
                        newText: "",
                      }
                    : {
                        start: node.parent.parent.getStart(),
                        end: node.parent.end,
                        newText: "",
                      },
                ],
              },
            ],
      });
    },
  },
}));

function hasSameParameters(
  nodeA: ts.Declaration,
  nodeB: ts.Declaration,
): boolean {
  if (!ts.isFunctionLike(nodeA) || !ts.isFunctionLike(nodeB)) {
    return false;
  }

  const paramsA = nodeA.parameters;
  const paramsB = nodeB.parameters;
  if (paramsA.length !== paramsB.length) {
    return false;
  }

  for (let i = 0; i < paramsA.length; ++i) {
    const paramA = paramsA[i];
    const paramB = paramsB[i];

    // Check name, type, and question token once.
    if (paramA.getText() !== paramB.getText()) {
      return false;
    }
  }

  return true;
}

export const test = () =>
  ruleTester({
    ruleFn: preferIncludes,
    valid: [
      `
      function f(a: string): void {
        a.indexOf(b);
      }
    `,
      `
      function f(a: string): void {
        a.indexOf(b) + 0;
      }
    `,
      `
      function f(a: string | { value: string }): void {
        a.indexOf(b) !== -1;
      }
    `,
      `
      type UserDefined = {
        indexOf(x: any): number; // don't have 'includes'
      };
      function f(a: UserDefined): void {
        a.indexOf(b) !== -1;
      }
    `,
      `
      type UserDefined = {
        indexOf(x: any, fromIndex?: number): number;
        includes(x: any): boolean; // different parameters
      };
      function f(a: UserDefined): void {
        a.indexOf(b) !== -1;
      }
    `,
      `
      type UserDefined = {
        indexOf(x: any, fromIndex?: number): number;
        includes(x: any, fromIndex: number): boolean; // different parameters
      };
      function f(a: UserDefined): void {
        a.indexOf(b) !== -1;
      }
    `,
      `
      type UserDefined = {
        indexOf(x: any, fromIndex?: number): number;
        includes: boolean; // different type
      };
      function f(a: UserDefined): void {
        a.indexOf(b) !== -1;
      }
    `,
    ],
    invalid: [
      // positive
      {
        code: `
        function f(a: string): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: string): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: string): void {
          a.indexOf(b) != -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: string): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: string): void {
          a.indexOf(b) > -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: string): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: string): void {
          a.indexOf(b) >= 0;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: string): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      }, // negative
      {
        code: `
        function f(a: string): void {
          a.indexOf(b) === -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: string): void {
          !a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: string): void {
          a.indexOf(b) == -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: string): void {
          !a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: string): void {
          a.indexOf(b) <= -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: string): void {
          !a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: string): void {
          a.indexOf(b) < 0;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: string): void {
          !a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a?: string): void {
          a?.indexOf(b) === -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
          },
        ],
      },
      {
        code: `
        function f(a?: string): void {
          a?.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
          },
        ],
      },
      // type variation
      {
        code: `
        function f(a: any[]): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: any[]): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: ReadonlyArray<any>): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: ReadonlyArray<any>): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Int8Array): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Int8Array): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Int16Array): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Int16Array): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Int32Array): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Int32Array): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Uint8Array): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Uint8Array): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Uint16Array): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Uint16Array): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Uint32Array): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Uint32Array): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Float32Array): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Float32Array): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Float64Array): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Float64Array): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f<T>(a: T[] | ReadonlyArray<T>): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f<T>(a: T[] | ReadonlyArray<T>): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f<
          T,
          U extends
            | T[]
            | ReadonlyArray<T>
            | Int8Array
            | Uint8Array
            | Int16Array
            | Uint16Array
            | Int32Array
            | Uint32Array
            | Float32Array
            | Float64Array,
        >(a: U): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f<
          T,
          U extends
            | T[]
            | ReadonlyArray<T>
            | Int8Array
            | Uint8Array
            | Int16Array
            | Uint16Array
            | Int32Array
            | Uint32Array
            | Float32Array
            | Float64Array,
        >(a: U): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        type UserDefined = {
          indexOf(x: any): number;
          includes(x: any): boolean;
        };
        function f(a: UserDefined): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        type UserDefined = {
          indexOf(x: any): number;
          includes(x: any): boolean;
        };
        function f(a: UserDefined): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Readonly<any[]>): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Readonly<any[]>): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
    ],
  });
