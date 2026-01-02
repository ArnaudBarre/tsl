import { expect, test } from "bun:test";
import { ruleTester } from "../../ruleTester.ts";
import {
  messages,
  noUselessDefaultAssignment,
} from "./noUselessDefaultAssignment.ts";

test("noUselessDefaultAssignment", () => {
  const hasError = ruleTester({
    ruleFn: noUselessDefaultAssignment,
    valid: [
      `
      function Bar({ foo = '' }: { foo?: string }) {
        return foo;
      }
    `,
      `
      const { foo } = { foo: 'bar' };
    `,
      `
      [1, 2, 3, undefined].map((a = 42) => a + 1);
    `,
      `
      function test(a?: number) {
        return a;
      }
    `,
      `
      const obj: { a?: string } = {};
      const { a = 'default' } = obj;
    `,
      `
      function test(a: string | undefined = 'default') {
        return a;
      }
    `,
      `
      (a: string = 'default') => a;
    `,
      `
      function test(a: string = 'default') {
        return a;
      }
    `,
      `
      class C {
        public test(a: string = 'default') {
          return a;
        }
      }
    `,
      `
      const obj: { a: string | undefined } = { a: undefined };
      const { a = 'default' } = obj;
    `,
      `
      function test(arr: number[] | undefined = []) {
        return arr;
      }
    `,
      `
      function Bar({ nested: { foo = '' } = {} }: { nested?: { foo?: string } }) {
        return foo;
      }
    `,
      `
      function test(a: any = 'default') {
        return a;
      }
    `,
      `
      function test(a: unknown = 'default') {
        return a;
      }
    `,
      `
      function test(a = 5) {
        return a;
      }
    `,
      `
      function createValidator(): () => void {
        return (param = 5) => {};
      }
    `,
      `
      function Bar({ foo = '' }: { foo: any }) {
        return foo;
      }
    `,
      `
      function Bar({ foo = '' }: { foo: unknown }) {
        return foo;
      }
    `,
      `
      function getValue(): undefined;
      function getValue(box: { value: string }): string;
      function getValue({ value = '' }: { value?: string } = {}): string | undefined {
        return value;
      }
    `,
      `
      function getValueObject({ value = '' }: Partial<{ value: string }>) {
        return value;
      }
    `,
      `
      const { value = 'default' } = someUnknownFunction();
    `,
      `
      const [value = 'default'] = someUnknownFunction();
    `,
      `
      for (const { value = 'default' } of []) {
      }
    `,
      `
      for (const [value = 'default'] of []) {
      }
    `,
      `
      declare const x: [[number | undefined]];
      const [[a = 1]] = x;
    `,
      `
      function foo(x: string = '') {}
    `,
      `
      class C {
        method(x: string = '') {}
      }
    `,
      `
      const foo = (x: string = '') => {};
    `,
      `
      const obj = { ab: { x: 1 } };
      const {
        ['a' + 'b']: { x = 1 },
      } = obj;
    `,
      `
      const obj = { ab: 1 };
      const { ['a' + 'b']: x = 1 } = obj;
    `,
      `
      for ([[a = 1]] of []) {
      }
    `,
      {
        code: `
        declare const g: Array<string>;
        const [foo = ''] = g;
      `,
        compilerOptions: { noUncheckedIndexedAccess: true },
      },
      {
        code: `
        declare const g: Record<string, string>;
        const { foo = '' } = g;
      `,
        compilerOptions: { noUncheckedIndexedAccess: true },
      },
      {
        code: `
        declare const h: { [key: string]: string };
        const { bar = '' } = h;
      `,
        compilerOptions: { noUncheckedIndexedAccess: true },
      },
      `
      declare const g: Array<string>;
      const [foo = ''] = g;
    `,
      `
      declare const g: Record<string, string>;
      const { foo = '' } = g;
    `,
      `
      declare const h: { [key: string]: string };
      const { bar = '' } = h;
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/11849
      `
      type Merge = boolean | ((incoming: string[]) => void);

      const policy: { merge: Merge } = {
        merge: (incoming: string[] = []) => {
          incoming;
        },
      };
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/11846
      `
      const [a, b = ''] = 'somestr'.split('.');
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/11846
      `
      declare const params: string[];
      const [c = '123'] = params;
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/11846
      `
      declare function useCallback<T>(callback: T);
      useCallback((value: number[] = []) => {});
    `,
      `
      declare const tuple: [string];
      const [a, b = 'default'] = tuple;
    `,
    ],
    invalid: [
      {
        code: `
        function Bar({ foo = '' }: { foo: string }) {
          return foo;
        }
      `,
        errors: [
          {
            message: messages.uselessDefaultProperty,
            line: 2,
            column: 30,
            endColumn: 32,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function Bar({ foo }: { foo: string }) {
          return foo;
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        class C {
          public method({ foo = '' }: { foo: string }) {
            return foo;
          }
        }
      `,
        errors: [
          {
            message: messages.uselessDefaultProperty,
            line: 3,
            column: 33,
            endColumn: 35,
            suggestions: [
              {
                message: messages.fix,
                output: `
        class C {
          public method({ foo }: { foo: string }) {
            return foo;
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
        const { 'literal-key': literalKey = 'default' } = { 'literal-key': 'value' };
      `,
        errors: [
          {
            message: messages.uselessDefaultProperty,
            line: 2,
            column: 45,
            endColumn: 54,
            suggestions: [
              {
                message: messages.fix,
                output: `
        const { 'literal-key': literalKey } = { 'literal-key': 'value' };
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        [1, 2, 3].map((a = 42) => a + 1);
      `,
        errors: [
          {
            message: messages.uselessDefaultParameter,
            line: 2,
            column: 28,
            endColumn: 30,
            suggestions: [
              {
                message: messages.fix,
                output: `
        [1, 2, 3].map((a) => a + 1);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function getValue(): undefined;
        function getValue(box: { value: string }): string;
        function getValue({ value = '' }: { value: string } = {}): string | undefined {
          return value;
        }
      `,
        errors: [
          {
            message: messages.uselessDefaultProperty,
            line: 4,
            column: 37,
            endColumn: 39,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function getValue(): undefined;
        function getValue(box: { value: string }): string;
        function getValue({ value }: { value: string } = {}): string | undefined {
          return value;
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function getValue([value = '']: [string]) {
          return value;
        }
      `,
        errors: [
          {
            message: messages.uselessDefaultProperty,
            line: 2,
            column: 36,
            endColumn: 38,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function getValue([value]: [string]) {
          return value;
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const x: { hello: { world: string } };

        const {
          hello: { world = '' },
        } = x;
      `,
        errors: [
          {
            message: messages.uselessDefaultProperty,
            line: 5,
            column: 28,
            endColumn: 30,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const x: { hello: { world: string } };

        const {
          hello: { world },
        } = x;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const x: { hello: Array<{ world: string }> };

        const {
          hello: [{ world = '' }],
        } = x;
      `,
        errors: [
          {
            message: messages.uselessDefaultProperty,
            line: 5,
            column: 29,
            endColumn: 31,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const x: { hello: Array<{ world: string }> };

        const {
          hello: [{ world }],
        } = x;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        interface B {
          foo: (b: boolean | string) => void;
        }

        const h: B = {
          foo: (b = false) => {},
        };
      `,
        errors: [
          {
            message: messages.uselessDefaultParameter,
            line: 7,
            column: 21,
            endColumn: 26,
            suggestions: [
              {
                message: messages.fix,
                output: `
        interface B {
          foo: (b: boolean | string) => void;
        }

        const h: B = {
          foo: (b) => {},
        };
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function foo(a = undefined) {}
      `,
        errors: [
          {
            message: messages.preferOptionalSyntax,
            line: 2,
            column: 26,
            endColumn: 35,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function foo(a) {}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        const { a = undefined } = {};
      `,
        errors: [
          {
            message: messages.uselessUndefined,
            line: 2,
            column: 21,
            endColumn: 30,
            suggestions: [
              {
                message: messages.fix,
                output: `
        const { a } = {};
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        const [a = undefined] = [];
      `,
        errors: [
          {
            message: messages.uselessUndefined,
            line: 2,
            column: 20,
            endColumn: 29,
            suggestions: [
              {
                message: messages.fix,
                output: `
        const [a] = [];
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function foo({ a = undefined }) {}
      `,
        errors: [
          {
            message: messages.uselessUndefined,
            line: 2,
            column: 28,
            endColumn: 37,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function foo({ a }) {}
      `,
              },
            ],
          },
        ],
      },
      // https://github.com/typescript-eslint/typescript-eslint/issues/11847
      {
        code: `
        function myFunction(p1: string, p2: number | undefined = undefined) {
          console.log(p1, p2);
        }
      `,
        errors: [
          {
            message: messages.preferOptionalSyntax,
            line: 2,
            column: 66,
            endColumn: 75,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function myFunction(p1: string, p2?: number | undefined) {
          console.log(p1, p2);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        type SomeType = number | undefined;
        function f(
          /* comment */ x /* comment 2 */ : /* comment 3 */ SomeType /* comment 4 */ = /* comment 5 */ undefined,
        ) {}
      `,
        errors: [
          {
            message: messages.preferOptionalSyntax,
            line: 4,
            column: 104,
            endColumn: 113,
            suggestions: [
              {
                message: messages.fix,
                output: `
        type SomeType = number | undefined;
        function f(
          /* comment */ x? /* comment 2 */ : /* comment 3 */ SomeType,
        ) {}
      `,
              },
            ],
          },
        ],
      },
    ],
  });
  expect(hasError).toEqual(false);
});
