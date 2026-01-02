import { expect, test } from "bun:test";
import { ruleTester } from "../../ruleTester.ts";
import {
  messages,
  noUnnecessaryTypeArguments,
} from "./noUnnecessaryTypeArguments.ts";

test("noUnnecessaryTypeArguments", () => {
  const hasError = ruleTester({
    ruleFn: noUnnecessaryTypeArguments,
    valid: [
      "f<>();",
      "f<string>();",
      "expect().toBe<>();",
      "class Foo extends Bar<> {}",
      "class Foo extends Bar<string> {}",
      "class Foo implements Bar<> {}",
      "class Foo implements Bar<string> {}",
      `
function f<T = number>() {}
f();
    `,
      `
function f<T = number>() {}
f<string>();
    `,
      `
declare const f: (<T = number>() => void) | null;
f?.();
    `,
      `
declare const f: (<T = number>() => void) | null;
f?.<string>();
    `,
      `
declare const f: any;
f();
    `,
      `
declare const f: any;
f<string>();
    `,
      `
declare const f: unknown;
f();
    `,
      `
declare const f: unknown;
f<string>();
    `,
      `
function g<T = number, U = string>() {}
g<number, number>();
    `,
      `
declare const g: any;
g<string, string>();
    `,
      `
declare const g: unknown;
g<string, string>();
    `,
      `
declare const f: unknown;
f<string>\`\`;
    `,
      `
function f<T = number>(template: TemplateStringsArray) {}
f<string>\`\`;
    `,
      `
class C<T = number> {}
new C<string>();
    `,
      `
declare const C: any;
new C<string>();
    `,
      `
declare const C: unknown;
new C<string>();
    `,
      `
class C<T = number> {}
class D extends C<string> {}
    `,
      `
declare const C: any;
class D extends C<string> {}
    `,
      `
declare const C: unknown;
class D extends C<string> {}
    `,
      `
interface I<T = number> {}
class Impl implements I<string> {}
    `,
      `
class C<TC = number> {}
class D<TD = number> extends C {}
    `,
      `
declare const C: any;
class D<TD = number> extends C {}
    `,
      `
declare const C: unknown;
class D<TD = number> extends C {}
    `,
      "let a: A<number>;",
      `
class Foo<T> {}
const foo = new Foo<number>();
    `,
      "type Foo<T> = import('foo').Foo<T>;",
      `
class Bar<T = number> {}
class Foo<T = number> extends Bar<T> {}
    `,
      `
interface Bar<T = number> {}
class Foo<T = number> implements Bar<T> {}
    `,
      `
class Bar<T = number> {}
class Foo<T = number> extends Bar<string> {}
    `,
      `
interface Bar<T = number> {}
class Foo<T = number> implements Bar<string> {}
    `,
      `
type A<T = Element> = T;
type B = A<HTMLInputElement>;
    `,
      `
type A<T = Map<string, string>> = T;
type B = A<Map<string, number>>;
    `,
      `
type A = Map<string, string>;
type B<T = A> = T;
type C2 = B<Map<string, number>>;
    `,
      `
type A<T = string> = T;
type B<T extends { prop: string }> = A<T["prop"]>;
    `,
      `
function forwardRef<P = {}>() {}
forwardRef<{ foo?: string }>();
      `,
      {
        tsx: true,
        code: `
function Button<T>() {
  return <div></div>;
}
const button = <Button<string>></Button>;
      `,
      },
      {
        tsx: true,
        code: `
function Button<T>() {
  return <div></div>;
}
const button = <Button<string> />;
      `,
      },
    ],
    invalid: [
      {
        code: `
function f<T = number>() {}
f<number>();
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            column: 3,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
function f<T = number>() {}
f();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
function g<T = number, U = string>() {}
g<string, string>();
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            column: 11,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
function g<T = number, U = string>() {}
g<string>();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
function f<T = number>(templates: TemplateStringsArray, arg: T) {}
f<number>\`\${1}\`;
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            column: 3,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
function f<T = number>(templates: TemplateStringsArray, arg: T) {}
f\`\${1}\`;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class C<T = number> {}
function h(c: C<number>) {}
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
class C<T = number> {}
function h(c: C) {}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class C<T = number> {}
new C<number>();
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
class C<T = number> {}
new C();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class C<T = number> {}
class D extends C<number> {}
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
class C<T = number> {}
class D extends C {}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
interface I<T = number> {}
class Impl implements I<number> {}
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
interface I<T = number> {}
class Impl implements I {}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class Foo<T = number> {}
const foo = new Foo<number>();
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
class Foo<T = number> {}
const foo = new Foo();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
interface Bar<T = string> {}
class Foo<T = number> implements Bar<string> {}
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
interface Bar<T = string> {}
class Foo<T = number> implements Bar {}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class Bar<T = string> {}
class Foo<T = number> extends Bar<string> {}
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
class Bar<T = string> {}
class Foo<T = number> extends Bar {}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
import { F } from './missing';
function bar<T = F<string>>() {}
bar<F<string>>();
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 4,
            column: 5,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
import { F } from './missing';
function bar<T = F<string>>() {}
bar();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type DefaultE = { foo: string };
type T<E = DefaultE> = { box: E };
type G = T<DefaultE>;
declare module 'bar' {
  type DefaultE = { somethingElse: true };
  type G = T<DefaultE>;
}
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 4,
            column: 12,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
type DefaultE = { foo: string };
type T<E = DefaultE> = { box: E };
type G = T;
declare module 'bar' {
  type DefaultE = { somethingElse: true };
  type G = T<DefaultE>;
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type A<T = Map<string, string>> = T;
type B = A<Map<string, string>>;
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 3,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
type A<T = Map<string, string>> = T;
type B = A;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type A = Map<string, string>;
type B<T = A> = T;
type C = B<A>;
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 4,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
type A = Map<string, string>;
type B<T = A> = T;
type C = B;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type A = Map<string, string>;
type B<T = A> = T;
type C = B<Map<string, string>>;
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 4,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
type A = Map<string, string>;
type B<T = A> = T;
type C = B;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type A = Map<string, string>;
type B = Map<string, string>;
type C<T = A> = T;
type D = C<B>;
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 5,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
type A = Map<string, string>;
type B = Map<string, string>;
type C<T = A> = T;
type D = C;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type A = Map<string, string>;
type B = A;
type C = Map<string, string>;
type D = C;
type E<T = B> = T;
type F = E<D>;
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 7,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
type A = Map<string, string>;
type B = A;
type C = Map<string, string>;
type D = C;
type E<T = B> = T;
type F = E;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
interface Foo {}
declare var Foo: {
  new <T = string>(type: T): any;
};
class Bar extends Foo<string> {}
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 6,
            suggestions: [
              {
                message: messages.removeTypeArgument,
                output: `
interface Foo {}
declare var Foo: {
  new <T = string>(type: T): any;
};
class Bar extends Foo {}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare var Foo: {
  new <T = string>(type: T): any;
};
interface Foo {}
class Bar extends Foo<string> {}
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 6,
            suggestions: [
              {
                message: messages.removeTypeArgument,
                output: `
declare var Foo: {
  new <T = string>(type: T): any;
};
interface Foo {}
class Bar extends Foo {}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class Foo<T> {}
interface Foo<T = string> {}
class Bar implements Foo<string> {}
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 4,
            suggestions: [
              {
                message: messages.removeTypeArgument,
                output: `
class Foo<T> {}
interface Foo<T = string> {}
class Bar implements Foo {}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class Foo<T = string> {}
namespace Foo {
  export class Bar {}
}
class Bar extends Foo<string> {}
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 6,
            suggestions: [
              {
                message: messages.removeTypeArgument,
                output: `
class Foo<T = string> {}
namespace Foo {
  export class Bar {}
}
class Bar extends Foo {}
      `,
              },
            ],
          },
        ],
      },
      {
        tsx: true,
        code: `
function Button<T = string>() {
  return <div></div>;
}
const button = <Button<string>></Button>;
        `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 5,
            suggestions: [
              {
                message: messages.removeTypeArgument,
                output: `
function Button<T = string>() {
  return <div></div>;
}
const button = <Button></Button>;
        `,
              },
            ],
          },
        ],
      },
      {
        tsx: true,
        code: `
function Button<T = string>() {
  return <div></div>;
}
const button = <Button<string> />;
        `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 5,
            suggestions: [
              {
                message: messages.removeTypeArgument,
                output: `
function Button<T = string>() {
  return <div></div>;
}
const button = <Button />;
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
