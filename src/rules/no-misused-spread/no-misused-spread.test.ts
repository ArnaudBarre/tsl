import { ruleTester } from "../../ruleTester.ts";
import { messages, noMisusedSpread } from "./no-misused-spread.ts";

export const test = () =>
  ruleTester({
    ruleFn: noMisusedSpread,
    valid: [
      "const a = [...[1, 2, 3]];",
      "const a = [...([1, 2, 3] as const)];",
      `
      declare const data: any;
      const a = [...data];
    `,
      `
      declare const data: unknown;
      const a = [...data];
    `,
      `
      const a = [1, 2, 3];
      const b = [...a];
    `,
      `
      const a = [1, 2, 3] as const;
      const b = [...a];
    `,
      `
      declare function getArray(): number[];
      const a = [...getArray()];
    `,
      `
      declare function getTuple(): readonly number[];
      const a = [...getTuple()];
    `,
      `
      const iterator = {
        *[Symbol.iterator]() {
          yield 1;
          yield 2;
          yield 3;
        },
      };

      const a = [...iterator];
    `,
      `
      declare const data: Iterable<number> | number[];

      const a = [...data];
    `,
      `
      declare const data: Iterable<number> & number[];

      const a = [...data];
    `,
      `
      declare function getIterable(): Iterable<number>;

      const a = [...getIterable()];
    `,
      `
      declare const data: Uint8Array;

      const a = [...data];
    `,
      `
      declare const data: TypedArray;

      const a = [...data];
    `,
      "const o = { ...{ a: 1, b: 2 } };",
      "const o = { ...({ a: 1, b: 2 } as const) };",
      `
      declare const obj: any;

      const o = { ...obj };
    `,
      `
      declare const obj: { a: number; b: number } | any;

      const o = { ...obj };
    `,
      `
      declare const obj: { a: number; b: number } & any;

      const o = { ...obj };
    `,
      `
      const obj = { a: 1, b: 2 };
      const o = { ...obj };
    `,
      `
      declare const obj: { a: number; b: number };
      const o = { ...obj };
    `,
      `
      declare function getObject(): { a: number; b: number };
      const o = { ...getObject() };
    `,
      `
      function f() {}

      f.prop = 1;

      const o = { ...f };
    `,
      `
      const f = () => {};

      f.prop = 1;

      const o = { ...f };
    `,
      `
      function* generator() {}

      generator.prop = 1;

      const o = { ...generator };
    `,
      `
      declare const promiseLike: PromiseLike<number>;

      const o = { ...promiseLike };
    `,
      {
        tsx: true,
        code: `
        const obj = { a: 1, b: 2 };
        const o = <div {...x} />;
      `,
      },
      {
        tsx: true,
        code: `
        declare const obj: { a: number; b: number } | any;
        const o = <div {...x} />;
      `,
      },
      `
      interface A {}

      declare const a: A;

      const o = { ...a };
    `, // This case is being flagged by TS already, but since we check in the code
      // for `Iterable`s, it catches string as well, so this test exists to ensure
      // we don't flag it.
      `
      const o = { ...'test' };
    `,
    ],
    invalid: [
      {
        code: "const a = [...'test'];",
        errors: [
          {
            message: messages.noStringSpread,
            line: 1,
            column: 12,
            endColumn: 21,
          },
        ],
      },
      {
        code: `
        function withText<Text extends string>(text: Text) {
          return [...text];
        }
      `,
        errors: [
          {
            message: messages.noStringSpread,
            line: 3,
            column: 19,
            endColumn: 26,
          },
        ],
      },
      {
        code: `
        const test = 'hello';
        const a = [...test];
      `,
        errors: [
          {
            message: messages.noStringSpread,
            line: 3,
            column: 20,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        const test = \`he\${'ll'}o\`;
        const a = [...test];
      `,
        errors: [
          {
            message: messages.noStringSpread,
            line: 3,
            column: 20,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare const test: string;
        const a = [...test];
      `,
        errors: [
          {
            message: messages.noStringSpread,
            line: 3,
            column: 20,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare const test: string | number[];
        const a = [...test];
      `,
        errors: [
          {
            message: messages.noStringSpread,
            line: 3,
            column: 20,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare const test: string & { __brand: 'test' };
        const a = [...test];
      `,
        errors: [
          {
            message: messages.noStringSpread,
            line: 3,
            column: 20,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare const test: number | (boolean | (string & { __brand: true }));
        const a = [...test];
      `,
        errors: [
          {
            message: messages.noStringSpread,
            line: 3,
            column: 20,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare function getString(): string;
        const a = [...getString()];
      `,
        errors: [
          {
            message: messages.noStringSpread,
            line: 3,
            column: 20,
            endColumn: 34,
          },
        ],
      },
      {
        code: `
        declare function textIdentity(...args: string[]);

        declare const text: string;

        textIdentity(...text);
      `,
        errors: [
          {
            message: messages.noStringSpread,
            line: 6,
            column: 22,
            endColumn: 29,
          },
        ],
      },
      {
        code: `
        declare function textIdentity(...args: string[]);

        declare const text: string;

        textIdentity(...text, 'and', ...text);
      `,
        errors: [
          {
            message: messages.noStringSpread,
            line: 6,
            column: 22,
            endColumn: 29,
          },
          {
            message: messages.noStringSpread,
            line: 6,
            column: 38,
            endColumn: 45,
          },
        ],
      },
      {
        code: `
        declare function textIdentity(...args: string[]);

        function withText<Text extends string>(text: Text) {
          textIdentity(...text);
        }
      `,
        errors: [
          {
            message: messages.noStringSpread,
            line: 5,
            column: 24,
            endColumn: 31,
          },
        ],
      },
      {
        code: `
        declare function getString<T extends string>(): T;
        const a = [...getString()];
      `,
        errors: [
          {
            message: messages.noStringSpread,
            line: 3,
            column: 20,
            endColumn: 34,
          },
        ],
      },
      {
        code: `
        declare function getString(): string & { __brand: 'test' };
        const a = [...getString()];
      `,
        errors: [
          {
            message: messages.noStringSpread,
            line: 3,
            column: 20,
            endColumn: 34,
          },
        ],
      },
      {
        code: "const o = { ...[1, 2, 3] };",
        errors: [
          {
            message: messages.noArraySpreadInObject,
            line: 1,
            column: 13,
            endColumn: 25,
          },
        ],
      },
      {
        code: `
        const arr = [1, 2, 3];
        const o = { ...arr };
      `,
        errors: [
          {
            message: messages.noArraySpreadInObject,
            line: 3,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        const arr = [1, 2, 3] as const;
        const o = { ...arr };
      `,
        errors: [
          {
            message: messages.noArraySpreadInObject,
            line: 3,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare const arr: number[];
        const o = { ...arr };
      `,
        errors: [
          {
            message: messages.noArraySpreadInObject,
            line: 3,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare const arr: readonly number[];
        const o = { ...arr };
      `,
        errors: [
          {
            message: messages.noArraySpreadInObject,
            line: 3,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare const arr: number[] | string[];
        const o = { ...arr };
      `,
        errors: [
          {
            message: messages.noArraySpreadInObject,
            line: 3,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare const arr: number[] & string[];
        const o = { ...arr };
      `,
        errors: [
          {
            message: messages.noArraySpreadInObject,
            line: 3,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare function getArray(): number[];
        const o = { ...getArray() };
      `,
        errors: [
          {
            message: messages.noArraySpreadInObject,
            line: 3,
            column: 21,
            endColumn: 34,
          },
        ],
      },
      {
        code: `
        declare function getArray(): readonly number[];
        const o = { ...getArray() };
      `,
        errors: [
          {
            message: messages.noArraySpreadInObject,
            line: 3,
            column: 21,
            endColumn: 34,
          },
        ],
      },
      {
        code: "const o = { ...new Set([1, 2, 3]) };",
        errors: [
          {
            message: messages.noIterableSpreadInObject,
            line: 1,
            column: 13,
            endColumn: 34,
          },
        ],
      },
      {
        code: `
        const set = new Set([1, 2, 3]);
        const o = { ...set };
      `,
        errors: [
          {
            message: messages.noIterableSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare const set: Set<number>;
        const o = { ...set };
      `,
        errors: [
          {
            message: messages.noIterableSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare const set: WeakSet<object>;
        const o = { ...set };
      `,
        errors: [
          {
            message: messages.noClassInstanceSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare const set: ReadonlySet<number>;
        const o = { ...set };
      `,
        errors: [
          {
            message: messages.noIterableSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare const set: Set<number> | { a: number };
        const o = { ...set };
      `,
        errors: [
          {
            message: messages.noIterableSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare function getSet(): Set<number>;
        const o = { ...getSet() };
      `,
        errors: [
          {
            message: messages.noIterableSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 32,
          },
        ],
      },
      {
        code: `
        const o = {
          ...new Map([
            ['test-1', 1],
            ['test-2', 2],
          ]),
        };
      `,
        errors: [
          {
            message: messages.noMapSpreadInObject,
            line: 3,
            column: 11,
            endLine: 6,
            endColumn: 13,
          },
        ],
      },
      {
        code: `
        const map = new Map([
          ['test-1', 1],
          ['test-2', 2],
        ]);

        const o = { ...map };
      `,
        errors: [
          {
            message: messages.noMapSpreadInObject,
            line: 7,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare const map: Map<string, number>;
        const o = { ...map };
      `,
        errors: [
          {
            message: messages.noMapSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare const map: ReadonlyMap<string, number>;
        const o = { ...map };
      `,
        errors: [
          {
            message: messages.noMapSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare const map: WeakMap<{ a: number }, string>;
        const o = { ...map };
      `,
        errors: [
          {
            message: messages.noMapSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare const map: Map<string, number> | { a: number };
        const o = { ...map };
      `,
        errors: [
          {
            message: messages.noMapSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        declare function getMap(): Map<string, number>;
        const o = { ...getMap() };
      `,
        errors: [
          {
            message: messages.noMapSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 32,
          },
        ],
      },
      {
        code: `
        declare const a: Map<boolean, string> & Set<number>;
        const o = { ...a };
      `,
        errors: [
          {
            message: messages.noMapSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 25,
          },
        ],
      },
      {
        code: `
        const ref = new WeakRef({ a: 1 });
        const o = { ...ref };
      `,
        errors: [
          {
            message: messages.noClassInstanceSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        const promise = new Promise(() => {});
        const o = { ...promise };
      `,
        errors: [
          {
            message: messages.noPromiseSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 31,
          },
        ],
      },
      {
        code: `
        function withPromise<P extends Promise<void>>(promise: P) {
          return { ...promise };
        }
      `,
        errors: [
          {
            message: messages.noPromiseSpreadInObject,
            line: 3,
            column: 20,
            endColumn: 30,
          },
        ],
      },
      {
        code: `
        declare const maybePromise: Promise<number> | { a: number };
        const o = { ...maybePromise };
      `,
        errors: [
          {
            message: messages.noPromiseSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 36,
          },
        ],
      },
      {
        code: `
        declare const promise: Promise<number> & { a: number };
        const o = { ...promise };
      `,
        errors: [
          {
            message: messages.noPromiseSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 31,
          },
        ],
      },
      {
        code: `
        declare function getPromise(): Promise<number>;
        const o = { ...getPromise() };
      `,
        errors: [
          {
            message: messages.noPromiseSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 36,
          },
        ],
      },
      {
        code: `
        declare function getPromise<T extends Promise<number>>(arg: T): T;
        const o = { ...getPromise() };
      `,
        errors: [
          {
            message: messages.noPromiseSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 36,
          },
        ],
      },
      {
        code: `
        function f() {}

        const o = { ...f };
      `,
        errors: [
          {
            message: messages.noFunctionSpreadInObject,
            line: 4,
            column: 21,
            endColumn: 25,
          },
        ],
      },
      {
        code: `
        interface FunctionWithProps {
          (): string;
          prop: boolean;
        }

        type FunctionWithoutProps = () => string;

        declare const obj: FunctionWithProps | FunctionWithoutProps | object;

        const o = { ...obj };
      `,
        errors: [
          {
            message: messages.noFunctionSpreadInObject,
            line: 11,
            column: 21,
            endColumn: 27,
          },
        ],
      },
      {
        code: `
        const f = () => {};

        const o = { ...f };
      `,
        errors: [
          {
            message: messages.noFunctionSpreadInObject,
            line: 4,
            column: 21,
            endColumn: 25,
          },
        ],
      },
      {
        code: `
        declare function f(): void;

        const o = { ...f };
      `,
        errors: [
          {
            message: messages.noFunctionSpreadInObject,
            line: 4,
            column: 21,
            endColumn: 25,
          },
        ],
      },
      {
        code: `
        declare function getFunction(): () => void;

        const o = { ...getFunction() };
      `,
        errors: [
          {
            message: messages.noFunctionSpreadInObject,
            line: 4,
            column: 21,
            endColumn: 37,
          },
        ],
      },
      {
        code: `
        declare const f: () => void;

        const o = { ...f };
      `,
        errors: [
          {
            message: messages.noFunctionSpreadInObject,
            line: 4,
            column: 21,
            endColumn: 25,
          },
        ],
      },
      {
        code: `
        declare const f: () => void | { a: number };

        const o = { ...f };
      `,
        errors: [
          {
            message: messages.noFunctionSpreadInObject,
            line: 4,
            column: 21,
            endColumn: 25,
          },
        ],
      },
      {
        code: `
        function* generator() {}

        const o = { ...generator };
      `,
        errors: [
          {
            message: messages.noFunctionSpreadInObject,
            line: 4,
            column: 21,
            endColumn: 33,
          },
        ],
      },
      {
        code: `
        const iterator = {
          *[Symbol.iterator]() {
            yield 'test';
          },
        };

        const o = { ...iterator };
      `,
        errors: [
          {
            message: messages.noIterableSpreadInObject,
            line: 8,
            column: 21,
            endColumn: 32,
          },
        ],
      },
      {
        code: `
        declare const iterator: Iterable<string>;

        const o = { ...iterator };
      `,
        errors: [
          {
            message: messages.noIterableSpreadInObject,
            line: 4,
            column: 21,
            endColumn: 32,
          },
        ],
      },
      {
        code: `
        declare const iterator: Iterable<string> | { a: number };

        const o = { ...iterator };
      `,
        errors: [
          {
            message: messages.noIterableSpreadInObject,
            line: 4,
            column: 21,
            endColumn: 32,
          },
        ],
      },
      {
        code: `
        declare function getIterable(): Iterable<string>;

        const o = { ...getIterable() };
      `,
        errors: [
          {
            message: messages.noIterableSpreadInObject,
            line: 4,
            column: 21,
            endColumn: 37,
          },
        ],
      },
      {
        code: `
        class A {
          [Symbol.iterator]() {
            return {
              next() {
                return { done: true, value: undefined };
              },
            };
          }
        }

        const a = { ...new A() };
      `,
        errors: [
          {
            message: messages.noIterableSpreadInObject,
            line: 12,
            column: 21,
            endColumn: 31,
          },
        ],
      },
      {
        code: `
        const o = { ...new Date() };
      `,
        errors: [
          {
            message: messages.noClassInstanceSpreadInObject,
            line: 2,
            column: 21,
            endColumn: 34,
          },
        ],
      },
      {
        code: `
        declare class HTMLElementLike {}
        declare const element: HTMLElementLike;
        const o = { ...element };
      `,
        errors: [
          {
            message: messages.noClassInstanceSpreadInObject,
            line: 4,
            column: 21,
            endColumn: 31,
          },
        ],
      },
      {
        code: `
        declare const regex: RegExp;
        const o = { ...regex };
      `,
        errors: [
          {
            message: messages.noClassInstanceSpreadInObject,
            line: 3,
            column: 21,
            endColumn: 29,
          },
        ],
      },
      {
        code: `
        class A {
          a = 1;
          public b = 2;
          private c = 3;
          protected d = 4;
          static e = 5;
        }

        const o = { ...new A() };
      `,
        errors: [
          {
            message: messages.noClassInstanceSpreadInObject,
            line: 10,
            column: 21,
            endColumn: 31,
          },
        ],
      },
      {
        code: `
        class A {
          a = 1;
        }

        const a = new A();

        const o = { ...a };
      `,
        errors: [
          {
            message: messages.noClassInstanceSpreadInObject,
            line: 8,
            column: 21,
            endColumn: 25,
          },
        ],
      },
      {
        code: `
        class A {
          a = 1;
        }

        declare const a: A;

        const o = { ...a };
      `,
        errors: [
          {
            message: messages.noClassInstanceSpreadInObject,
            line: 8,
            column: 21,
            endColumn: 25,
          },
        ],
      },
      {
        code: `
        class A {
          a = 1;
        }

        declare function getA(): A;

        const o = { ...getA() };
      `,
        errors: [
          {
            message: messages.noClassInstanceSpreadInObject,
            line: 8,
            column: 21,
            endColumn: 30,
          },
        ],
      },
      {
        code: `
        class A {
          a = 1;
        }

        declare function getA<T extends A>(arg: T): T;

        const o = { ...getA() };
      `,
        errors: [
          {
            message: messages.noClassInstanceSpreadInObject,
            line: 8,
            column: 21,
            endColumn: 30,
          },
        ],
      },
      {
        code: `
        class A {
          a = 1;
        }

        class B extends A {}

        const o = { ...new B() };
      `,
        errors: [
          {
            message: messages.noClassInstanceSpreadInObject,
            line: 8,
            column: 21,
            endColumn: 31,
          },
        ],
      },
      {
        code: `
        class A {
          a = 1;
        }

        declare const a: A | { b: string };

        const o = { ...a };
      `,
        errors: [
          {
            message: messages.noClassInstanceSpreadInObject,
            line: 8,
            column: 21,
            endColumn: 25,
          },
        ],
      },
      {
        code: `
        class A {
          a = 1;
        }

        declare const a: A & { b: string };

        const o = { ...a };
      `,
        errors: [
          {
            message: messages.noClassInstanceSpreadInObject,
            line: 8,
            column: 21,
            endColumn: 25,
          },
        ],
      },
      {
        code: `
        class A {}

        const o = { ...A };
      `,
        errors: [
          {
            message: messages.noClassDeclarationSpreadInObject,
            line: 4,
            column: 21,
            endColumn: 25,
          },
        ],
      },
      {
        code: `
        const A = class {};

        const o = { ...A };
      `,
        errors: [
          {
            message: messages.noClassDeclarationSpreadInObject,
            line: 4,
            column: 21,
            endColumn: 25,
          },
        ],
      },
      {
        code: `
        class Declaration {
          declaration?: boolean;
        }
        const Expression = class {
          expression?: boolean;
        };

        declare const either: typeof Declaration | typeof Expression;

        const o = { ...either };
      `,
        errors: [
          {
            message: messages.noClassDeclarationSpreadInObject,
            line: 11,
            column: 21,
            endColumn: 30,
          },
        ],
      },
      {
        code: `
        const A = Set<number>;

        const o = { ...A };
      `,
        errors: [
          {
            message: messages.noClassDeclarationSpreadInObject,
            line: 4,
            column: 21,
            endColumn: 25,
          },
        ],
      },
      {
        code: `
        const a = {
          ...class A {
            static value = 1;
            nonStatic = 2;
          },
        };
      `,
        errors: [
          {
            message: messages.noClassDeclarationSpreadInObject,
            line: 3,
            column: 11,
            endLine: 6,
            endColumn: 12,
          },
        ],
      },
      {
        code: `
        const a = { ...(class A { static value = 1 }) }
      `,
        errors: [
          {
            message: messages.noClassDeclarationSpreadInObject,
            line: 2,
            column: 21,
            endColumn: 54,
          },
        ],
      },
      {
        code: `
        const a = { ...new (class A { static value = 1; })() };
      `,
        errors: [
          {
            message: messages.noClassInstanceSpreadInObject,
            line: 2,
            column: 21,
            endColumn: 61,
          },
        ],
      },
      {
        tsx: true,
        code: `
        const o = <div {...[1, 2, 3]} />;
      `,
        errors: [
          {
            message: messages.noArraySpreadInObject,
            line: 2,
            column: 24,
            endColumn: 38,
          },
        ],
      },
      {
        tsx: true,
        code: `
        class A {}

        const o = <div {...A} />;
      `,
        errors: [
          {
            message: messages.noClassDeclarationSpreadInObject,
            line: 4,
            column: 24,
            endColumn: 30,
          },
        ],
      },
      {
        tsx: true,
        code: `
        const o = <div {...new Date()} />;
      `,
        errors: [
          {
            message: messages.noClassInstanceSpreadInObject,
            line: 2,
            column: 24,
            endColumn: 39,
          },
        ],
      },
      {
        tsx: true,
        code: `
        function f() {}

        const o = <div {...f} />;
      `,
        errors: [
          {
            message: messages.noFunctionSpreadInObject,
            line: 4,
            column: 24,
            endColumn: 30,
          },
        ],
      },
      {
        tsx: true,
        code: `
        const o = <div {...new Set([1, 2, 3])} />;
      `,
        errors: [
          {
            message: messages.noIterableSpreadInObject,
            line: 2,
            column: 24,
            endColumn: 47,
          },
        ],
      },
      {
        tsx: true,
        code: `
        declare const map: Map<string, number>;

        const o = <div {...map} />;
      `,
        errors: [
          {
            message: messages.noMapSpreadInObject,
            line: 4,
            column: 24,
            endColumn: 32,
          },
        ],
      },
      {
        tsx: true,
        code: `
        const promise = new Promise(() => {});

        const o = <div {...promise} />;
      `,
        errors: [
          {
            message: messages.noPromiseSpreadInObject,
            line: 4,
            column: 24,
            endColumn: 36,
          },
        ],
      },
    ],
  });
