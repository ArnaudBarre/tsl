import { ruleTester } from "../../ruleTester.ts";
import { messages, noBaseToString } from "./noBaseToString.ts";

const literalListBasic: string[] = [
  "''",
  "'text'",
  "true",
  "false",
  "1",
  "1n",
  "[]",
  "/regex/",
];
const literalListNeedParen: string[] = [
  "__dirname === 'foobar'",
  "{}.constructor()",
  "() => {}",
  "function() {}",
];
const literalList = [...literalListBasic, ...literalListNeedParen];
const literalListWrapped = [
  ...literalListBasic,
  ...literalListNeedParen.map((i) => `(${i})`),
];
export const test = () =>
  ruleTester({
    ruleFn: noBaseToString,
    valid: [
      // template
      ...literalList.map((i) => `\`\${${i}}\`;`), // operator + +=
      ...literalListWrapped.flatMap((l) =>
        literalListWrapped.map((r) => `${l} + ${r};`),
      ),
      // toString()
      ...literalListWrapped.map(
        (i) => `${i === "1" ? `(${i})` : i}.toString();`,
      ),
      // variable toString() and template
      ...literalList.map(
        (i) => `
        let value = ${i};
        value.toString();
        let text = \`\${value}\`;
      `,
      ),
      // String()
      ...literalList.map((i) => `String(${i});`),
      `
function someFunction() {}
someFunction.toString();
let text = \`\${someFunction}\`;
    `,
      `
function someFunction() {}
someFunction.toLocaleString();
let text = \`\${someFunction}\`;
    `,
      "unknownObject.toString();",
      "unknownObject.toLocaleString();",
      "unknownObject.someOtherMethod();",
      `
class CustomToString {
  toString() {
    return 'Hello, world!';
  }
}
'' + new CustomToString();
    `,
      `
const literalWithToString = {
  toString: () => 'Hello, world!',
};
'' + literalWithToString;
    `,
      `
const printer = (inVar: string | number | boolean) => {
  inVar.toString();
};
printer('');
printer(1);
printer(true);
    `,
      `
const printer = (inVar: string | number | boolean) => {
  inVar.toLocaleString();
};
printer('');
printer(1);
printer(true);
    `,
      "let _ = {} * {};",
      "let _ = {} / {};",
      "let _ = ({} *= {});",
      "let _ = ({} /= {});",
      "let _ = ({} = {});",
      "let _ = {} == {};",
      "let _ = {} === {};",
      "let _ = {} in {};",
      "let _ = {} & {};",
      "let _ = {} ^ {};",
      "let _ = {} << {};",
      "let _ = {} >> {};",
      `
function tag() {}
tag\`\${{}}\`;
    `,
      `
      function tag() {}
      tag\`\${{}}\`;
    `,
      `
      interface Brand {}
      function test(v: string & Brand): string {
        return \`\${v}\`;
      }
    `,
      "'' += new Error();",
      "'' += new URL();",
      "'' += new URLSearchParams();",
      `
Number(1);
    `,
      { options: { ignoredTypeNames: ["RegExp"] }, code: "String(/regex/);" },
      {
        options: { ignoredTypeNames: ["Foo"] },
        code: `
type Foo = { a: string } | { b: string };
declare const foo: Foo;
String(foo);
      `,
      },
      `
function String(value) {
  return value;
}
declare const myValue: object;
String(myValue);
    `,
      `
import { String } from 'foo';
String({});
    `,
      `
['foo', 'bar'].join('');
    `,
      `
([{ foo: 'foo' }, 'bar'] as string[]).join('');
    `,
      `
function foo<T extends string>(array: T[]) {
  return array.join();
}
    `,
      `
class Foo {
  toString() {
    return '';
  }
}
[new Foo()].join();
    `,
      `
class Foo {
  join() {}
}
const foo = new Foo();
foo.join();
    `,
      `
declare const array: string[];
array.join('');
    `,
      `
class Foo {
  foo: string;
}
declare const array: (string & Foo)[];
array.join('');
    `,
      `
class Foo {
  foo: string;
}
class Bar {
  bar: string;
}
declare const array: (string & Foo)[] | (string & Bar)[];
array.join('');
    `,
      `
class Foo {
  foo: string;
}
class Bar {
  bar: string;
}
declare const array: (string & Foo)[] & (string & Bar)[];
array.join('');
    `,
      `
class Foo {
  foo: string;
}
class Bar {
  bar: string;
}
declare const tuple: [string & Foo, string & Bar];
tuple.join('');
    `,
      `
class Foo {
  foo: string;
}
declare const tuple: [string] & [Foo];
tuple.join('');
    `,
      `
String(['foo', 'bar']);
    `,
      `
String([{ foo: 'foo' }, 'bar'] as string[]);
    `,
      `
function foo<T extends string>(array: T[]) {
  return String(array);
}
    `,
      `
class Foo {
  toString() {
    return '';
  }
}
String([new Foo()]);
    `,
      `
declare const array: string[];
String(array);
    `,
      `
class Foo {
  foo: string;
}
declare const array: (string & Foo)[];
String(array);
    `,
      `
class Foo {
  foo: string;
}
class Bar {
  bar: string;
}
declare const array: (string & Foo)[] | (string & Bar)[];
String(array);
    `,
      `
class Foo {
  foo: string;
}
class Bar {
  bar: string;
}
declare const array: (string & Foo)[] & (string & Bar)[];
String(array);
    `,
      `
class Foo {
  foo: string;
}
class Bar {
  bar: string;
}
declare const tuple: [string & Foo, string & Bar];
String(tuple);
    `,
      `
class Foo {
  foo: string;
}
declare const tuple: [string] & [Foo];
String(tuple);
    `,
      `
['foo', 'bar'].toString();
    `,
      `
([{ foo: 'foo' }, 'bar'] as string[]).toString();
    `,
      `
function foo<T extends string>(array: T[]) {
  return array.toString();
}
    `,
      `
class Foo {
  toString() {
    return '';
  }
}
[new Foo()].toString();
    `,
      `
declare const array: string[];
array.toString();
    `,
      `
class Foo {
  foo: string;
}
declare const array: (string & Foo)[];
array.toString();
    `,
      `
class Foo {
  foo: string;
}
class Bar {
  bar: string;
}
declare const array: (string & Foo)[] | (string & Bar)[];
array.toString();
    `,
      `
class Foo {
  foo: string;
}
class Bar {
  bar: string;
}
declare const array: (string & Foo)[] & (string & Bar)[];
array.toString();
    `,
      `
class Foo {
  foo: string;
}
class Bar {
  bar: string;
}
declare const tuple: [string & Foo, string & Bar];
tuple.toString();
    `,
      `
class Foo {
  foo: string;
}
declare const tuple: [string] & [Foo];
tuple.toString();
    `,
      `
\`\${['foo', 'bar']}\`;
    `,
      `
\`\${[{ foo: 'foo' }, 'bar'] as string[]}\`;
    `,
      `
function foo<T extends string>(array: T[]) {
  return \`\${array}\`;
}
    `,
      `
class Foo {
  toString() {
    return '';
  }
}
\`\${[new Foo()]}\`;
    `,
      `
declare const array: string[];
\`\${array}\`;
    `,
      `
class Foo {
  foo: string;
}
declare const array: (string & Foo)[];
\`\${array}\`;
    `,
      `
class Foo {
  foo: string;
}
class Bar {
  bar: string;
}
declare const array: (string & Foo)[] | (string & Bar)[];
\`\${array}\`;
    `,
      `
class Foo {
  foo: string;
}
class Bar {
  bar: string;
}
declare const array: (string & Foo)[] & (string & Bar)[];
\`\${array}\`;
    `,
      `
class Foo {
  foo: string;
}
class Bar {
  bar: string;
}
declare const tuple: [string & Foo, string & Bar];
\`\${tuple}\`;
    `,
      `
class Foo {
  foo: string;
}
declare const tuple: [string] & [Foo];
\`\${tuple}\`;
    `, // don't bother trying to interpret spread args.
      `
let objects = [{}, {}];
String(...objects);
    `, // https://github.com/typescript-eslint/typescript-eslint/issues/8585
      `
type Constructable<Entity> = abstract new (...args: any[]) => Entity;

interface GuildChannel {
  toString(): \`<#\${string}>\`;
}

declare const foo: Constructable<GuildChannel & { bar: 1 }>;
class ExtendedGuildChannel extends foo {}
declare const bb: ExtendedGuildChannel;
bb.toString();
    `, // https://github.com/typescript-eslint/typescript-eslint/issues/8585 with intersection order reversed.
      `
type Constructable<Entity> = abstract new (...args: any[]) => Entity;

interface GuildChannel {
  toString(): \`<#\${string}>\`;
}

declare const foo: Constructable<{ bar: 1 } & GuildChannel>;
class ExtendedGuildChannel extends foo {}
declare const bb: ExtendedGuildChannel;
bb.toString();
    `,
      `
function foo<T>(x: T) {
  String(x);
}
    `,
      `
declare const u: unknown;
String(u);
    `,
      `
type Value = string | Value[];
declare const v: Value;

String(v);
    `,
      `
type Value = (string | Value)[];
declare const v: Value;

String(v);
    `,
      `
type Value = Value[];
declare const v: Value;

String(v);
    `,
      `
type Value = [Value];
declare const v: Value;

String(v);
    `,
      `
declare const v: ('foo' | 'bar')[][];
String(v);
    `,
    ],
    invalid: [
      {
        code: "({}).toString();",
        errors: [
          { message: messages.baseToString({ certainty: "will", name: "{}" }) },
        ],
      },
      {
        code: "({}).toLocaleString();",
        errors: [
          { message: messages.baseToString({ certainty: "will", name: "{}" }) },
        ],
      },
      {
        code: "String({});",
        errors: [
          { message: messages.baseToString({ certainty: "will", name: "{}" }) },
        ],
      },
      {
        code: `
        let someObjectOrString = Math.random() ? { a: true } : 'text';
        someObjectOrString.toString();
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "may",
              name: "someObjectOrString",
            }),
          },
        ],
      },
      {
        code: `
        let someObjectOrString = Math.random() ? { a: true } : 'text';
        someObjectOrString.toLocaleString();
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "may",
              name: "someObjectOrString",
            }),
          },
        ],
      },
      {
        code: `
        let someObjectOrObject = Math.random() ? { a: true, b: true } : { a: true };
        someObjectOrObject.toString();
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "will",
              name: "someObjectOrObject",
            }),
          },
        ],
      },
      {
        code: `
        let someObjectOrObject = Math.random() ? { a: true, b: true } : { a: true };
        someObjectOrObject.toLocaleString();
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "will",
              name: "someObjectOrObject",
            }),
          },
        ],
      },
      {
        code: `
        [{}, {}].join('');
      `,
        errors: [
          {
            message: messages.baseArrayJoin({
              certainty: "will",
              name: "[{}, {}]",
            }),
          },
        ],
      },
      {
        code: `
        const array = [{}, {}];
        array.join('');
      `,
        errors: [
          {
            message: messages.baseArrayJoin({
              certainty: "will",
              name: "array",
            }),
          },
        ],
      },
      {
        code: `
        class A {
          a: string;
        }
        [new A(), 'str'].join('');
      `,
        errors: [
          {
            message: messages.baseArrayJoin({
              certainty: "may",
              name: "[new A(), 'str']",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const array: (string | Foo)[];
        array.join('');
      `,
        errors: [
          {
            message: messages.baseArrayJoin({
              certainty: "may",
              name: "array",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const array: (string & Foo) | (string | Foo)[];
        array.join('');
      `,
        errors: [
          {
            message: messages.baseArrayJoin({
              certainty: "may",
              name: "array",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        class Bar {
          bar: string;
        }
        declare const array: Foo[] & Bar[];
        array.join('');
      `,
        errors: [
          {
            message: messages.baseArrayJoin({
              certainty: "will",
              name: "array",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const array: string[] | Foo[];
        array.join('');
      `,
        errors: [
          {
            message: messages.baseArrayJoin({
              certainty: "may",
              name: "array",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const tuple: [string, Foo];
        tuple.join('');
      `,
        errors: [
          {
            message: messages.baseArrayJoin({
              certainty: "will",
              name: "tuple",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const tuple: [Foo, Foo];
        tuple.join('');
      `,
        errors: [
          {
            message: messages.baseArrayJoin({
              certainty: "will",
              name: "tuple",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const tuple: [Foo | string, string];
        tuple.join('');
      `,
        errors: [
          {
            message: messages.baseArrayJoin({
              certainty: "may",
              name: "tuple",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const tuple: [string, string] | [Foo, Foo];
        tuple.join('');
      `,
        errors: [
          {
            message: messages.baseArrayJoin({
              certainty: "may",
              name: "tuple",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const tuple: [Foo, string] & [Foo, Foo];
        tuple.join('');
      `,
        errors: [
          {
            message: messages.baseArrayJoin({
              certainty: "will",
              name: "tuple",
            }),
          },
        ],
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
        const array = ['string', { foo: 'bar' }];
        array.join('');
      `,
        errors: [
          {
            message: messages.baseArrayJoin({
              certainty: "may",
              name: "array",
            }),
          },
        ],
      },
      {
        code: `
        type Bar = Record<string, string>;
        function foo<T extends string | Bar>(array: T[]) {
          return array.join();
        }
      `,
        errors: [
          {
            message: messages.baseArrayJoin({
              certainty: "may",
              name: "array",
            }),
          },
        ],
      },
      {
        code: `
        String([{}, {}]);
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "will",
              name: "[{}, {}]",
            }),
          },
        ],
      },
      {
        code: `
        const array = [{}, {}];
        String(array);
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "will",
              name: "array",
            }),
          },
        ],
      },
      {
        code: `
        class A {
          a: string;
        }
        String([new A(), 'str']);
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "may",
              name: "[new A(), 'str']",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const array: (string | Foo)[];
        String(array);
      `,
        errors: [
          {
            message: messages.baseToString({ certainty: "may", name: "array" }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const array: (string & Foo) | (string | Foo)[];
        String(array);
      `,
        errors: [
          {
            message: messages.baseToString({ certainty: "may", name: "array" }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        class Bar {
          bar: string;
        }
        declare const array: Foo[] & Bar[];
        String(array);
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "will",
              name: "array",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const array: string[] | Foo[];
        String(array);
      `,
        errors: [
          {
            message: messages.baseToString({ certainty: "may", name: "array" }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const tuple: [string, Foo];
        String(tuple);
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "will",
              name: "tuple",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const tuple: [Foo, Foo];
        String(tuple);
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "will",
              name: "tuple",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const tuple: [Foo | string, string];
        String(tuple);
      `,
        errors: [
          {
            message: messages.baseToString({ certainty: "may", name: "tuple" }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const tuple: [string, string] | [Foo, Foo];
        String(tuple);
      `,
        errors: [
          {
            message: messages.baseToString({ certainty: "may", name: "tuple" }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const tuple: [Foo, string] & [Foo, Foo];
        String(tuple);
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "will",
              name: "tuple",
            }),
          },
        ],
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
        const array = ['string', { foo: 'bar' }];
        String(array);
      `,
        errors: [
          {
            message: messages.baseToString({ certainty: "may", name: "array" }),
          },
        ],
      },
      {
        code: `
        type Bar = Record<string, string>;
        function foo<T extends string | Bar>(array: T[]) {
          return String(array);
        }
      `,
        errors: [
          {
            message: messages.baseToString({ certainty: "may", name: "array" }),
          },
        ],
      },
      {
        code: `
        [{}, {}].toString();
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "will",
              name: "[{}, {}]",
            }),
          },
        ],
      },
      {
        code: `
        const array = [{}, {}];
        array.toString();
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "will",
              name: "array",
            }),
          },
        ],
      },
      {
        code: `
        class A {
          a: string;
        }
        [new A(), 'str'].toString();
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "may",
              name: "[new A(), 'str']",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const array: (string | Foo)[];
        array.toString();
      `,
        errors: [
          {
            message: messages.baseToString({ certainty: "may", name: "array" }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const array: (string & Foo) | (string | Foo)[];
        array.toString();
      `,
        errors: [
          {
            message: messages.baseToString({ certainty: "may", name: "array" }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        class Bar {
          bar: string;
        }
        declare const array: Foo[] & Bar[];
        array.toString();
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "will",
              name: "array",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const array: string[] | Foo[];
        array.toString();
      `,
        errors: [
          {
            message: messages.baseToString({ certainty: "may", name: "array" }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const tuple: [string, Foo];
        tuple.toString();
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "will",
              name: "tuple",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const tuple: [Foo, Foo];
        tuple.toString();
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "will",
              name: "tuple",
            }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const tuple: [Foo | string, string];
        tuple.toString();
      `,
        errors: [
          {
            message: messages.baseToString({ certainty: "may", name: "tuple" }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const tuple: [string, string] | [Foo, Foo];
        tuple.toString();
      `,
        errors: [
          {
            message: messages.baseToString({ certainty: "may", name: "tuple" }),
          },
        ],
      },
      {
        code: `
        class Foo {
          foo: string;
        }
        declare const tuple: [Foo, string] & [Foo, Foo];
        tuple.toString();
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "will",
              name: "tuple",
            }),
          },
        ],
      },
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
        const array = ['string', { foo: 'bar' }];
        array.toString();
      `,
        errors: [
          {
            message: messages.baseToString({ certainty: "may", name: "array" }),
          },
        ],
      },
      {
        code: `
        type Bar = Record<string, string>;
        function foo<T extends string | Bar>(array: T[]) {
          return array.toString();
        }
      `,
        errors: [
          {
            message: messages.baseToString({ certainty: "may", name: "array" }),
          },
        ],
      },
      {
        code: `
        type Bar = Record<string, string>;
        function foo<T extends string | Bar>(array: T[]) {
          array[0].toString();
        }
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "may",
              name: "array[0]",
            }),
          },
        ],
      },
      {
        code: `
        type Bar = Record<string, string>;
        function foo<T extends string | Bar>(value: T) {
          value.toString();
        }
      `,
        errors: [
          {
            message: messages.baseToString({ certainty: "may", name: "value" }),
          },
        ],
      },
      {
        code: `
type Bar = Record<string, string>;
declare const foo: Bar | string;
foo.toString();
      `,
        errors: [
          { message: messages.baseToString({ certainty: "may", name: "foo" }) },
        ],
      },
      {
        code: `
        type Bar = Record<string, string>;
        function foo<T extends string | Bar>(array: T[]) {
          return array;
        }
        foo([{ foo: 'foo' }]).join();
      `,
        errors: [
          {
            message: messages.baseArrayJoin({
              certainty: "will",
              name: "foo([{ foo: 'foo' }])",
            }),
          },
        ],
      },
      {
        code: `
        type Bar = Record<string, string>;
        function foo<T extends string | Bar>(array: T[]) {
          return array;
        }
        foo([{ foo: 'foo' }, 'bar']).join();
      `,
        errors: [
          {
            message: messages.baseArrayJoin({
              certainty: "may",
              name: "foo([{ foo: 'foo' }, 'bar'])",
            }),
          },
        ],
      },
      {
        code: `
type Value = { foo: string } | Value[];
declare const v: Value;

String(v);
      `,
        errors: [
          { message: messages.baseToString({ certainty: "may", name: "v" }) },
        ],
      },
      {
        code: `
type Value = ({ foo: string } | Value)[];
declare const v: Value;

String(v);
      `,
        errors: [
          { message: messages.baseToString({ certainty: "may", name: "v" }) },
        ],
      },
      {
        code: `
type Value = [{ foo: string }, Value];
declare const v: Value;

String(v);
      `,
        errors: [
          { message: messages.baseToString({ certainty: "will", name: "v" }) },
        ],
      },
      {
        code: `
declare const v: { foo: string }[][];
v.join();
      `,
        errors: [
          { message: messages.baseArrayJoin({ certainty: "will", name: "v" }) },
        ],
      },
      {
        code: `
function foo<T>(x: T) {
  String(x);
}
      `,
        options: { checkUnknown: true },
        errors: [
          { message: messages.baseToString({ certainty: "may", name: "x" }) },
        ],
      },
      {
        code: `
declare const x: unknown;
x.toString();
      `,
        errors: [
          { message: messages.baseToString({ certainty: "may", name: "x" }) },
        ],
        options: { checkUnknown: true },
      },
    ],
  });
