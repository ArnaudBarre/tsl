import { ruleTester } from "../../ruleTester.ts";
import {
  messages,
  noRedundantTypeConstituents,
} from "./noRedundantTypeConstituents.ts";

export const test = () =>
  ruleTester({
    ruleFn: noRedundantTypeConstituents,
    valid: [
      `
      type T = 1 | 2;
      type U = T | 3;
      `,
      "type T = 1n | 2n;",
      `
      type B = 1n;
      type T = B | 2n;
      `,
      `
      type T1 = false | true;
      
      type B2 = false;
      type T2 = B2 | true;
      
      type B3 = true;
      type T3 = B3 | false;
      `,
      "type T = null | undefined;",
      "type T = { a: string } | { b: string };",
      "type T = { a: string | number };",
      "type T = Set<string> | Set<number>;",
      "type Class<T> = { a: T }; type T = Class<string> | Class<number>;",
      "type T = string[] | number[];",
      "type T = string[][] | string[];",
      "type T = [1, 2, 3] | [1, 2, 4];",
      "type T = [1, 2, 3] | [1, 2, 3, 4];",
      "type T = 'A' | string[];",
      "type T = () => string | void;",
      "type T = () => null | undefined;",
      'type Metadata = { language: "EN" | "FR" } & Record<string, string>;',
      "type Enum = 'A' | 'B' | 'C'; type StringWithAutocomplete = Enum | ({} & string);",
      "type T = 'middlewareMarker' & { __brand: 'middlewareMarker' };",
      "type T = false & [];",
      `
      type Mutations = { Foo: { output: 0 }, Bar: { output: null } };
      type Output<Name extends keyof Mutations> = Mutations[Name]["output"];
      type GetOutput<Name extends keyof Mutations> = Output<Name> | null`,
      `
      type Shape = { foo: Record<string, string> };
      type Merge<A extends Shape, B extends Shape> = {
        [K in keyof A["foo"] | keyof B["foo"]]: number
      };
      `,
    ],
    invalid: [
      // intersections: never > any > number > unknown
      {
        code: "type I1 = unknown & number;",
        error: messages.intersection({ type: "unknown", overrideBy: "number" }),
      },
      {
        code: "type I1 = number & unknown;",
        error: messages.intersection({ type: "unknown", overrideBy: "number" }),
      },
      {
        code: "type I2 = any & unknown;",
        error: messages.intersection({ type: "unknown", overrideBy: "any" }),
      },
      {
        code: "type I2 = unknown & any;",
        error: messages.intersection({ type: "unknown", overrideBy: "any" }),
      },
      {
        code: "type I3 = any & number;",
        error: messages.intersection({ type: "number", overrideBy: "any" }),
      },
      {
        code: "type I3 = number & any;",
        error: messages.intersection({ type: "number", overrideBy: "any" }),
      },
      {
        code: "type I4 = any & never;",
        error: messages.intersection({ type: "any", overrideBy: "never" }),
      },
      {
        code: "type I4 = never & any;",
        error: messages.intersection({ type: "any", overrideBy: "never" }),
      },
      {
        code: "type I5 = unknown & never;",
        error: messages.intersection({ type: "unknown", overrideBy: "never" }),
      },
      {
        code: "type I5 = never & unknown;",
        error: messages.intersection({ type: "unknown", overrideBy: "never" }),
      },
      {
        code: "type I6 = number & never;",
        error: messages.intersection({ type: "number", overrideBy: "never" }),
      },
      {
        code: "type I6 = never & number;",
        error: messages.intersection({ type: "number", overrideBy: "never" }),
      },

      // unions: any > unknown > number > never
      {
        code: "type U1 = unknown | number;",
        error: messages.union({ type: "number", assignableTo: "unknown" }),
      },
      {
        code: "type U1 = number | unknown;",
        error: messages.union({ type: "number", assignableTo: "unknown" }),
      },
      {
        code: "type U2 = any | unknown;",
        error: messages.union({ type: "unknown", assignableTo: "any" }),
      },
      {
        code: "type U2 = unknown | any;",
        error: messages.union({ type: "unknown", assignableTo: "any" }),
      },
      {
        code: "type U3 = any | number;",
        error: messages.union({ type: "number", assignableTo: "any" }),
      },
      {
        code: "type U3 = number | any;",
        error: messages.union({ type: "number", assignableTo: "any" }),
      },
      {
        code: "type U4 = any | never;",
        error: messages.union({ type: "never", assignableTo: "any" }),
      },
      {
        code: "type U4 = never | any;",
        error: messages.union({ type: "never", assignableTo: "any" }),
      },
      {
        code: "type U5 = unknown | never;",
        error: messages.union({ type: "never", assignableTo: "unknown" }),
      },
      {
        code: "type U5 = never | unknown;",
        error: messages.union({ type: "never", assignableTo: "unknown" }),
      },
      {
        code: "type U6 = number | never;",
        error: messages.union({ type: "never", assignableTo: "number" }),
      },
      {
        code: "type U6 = never | number;",
        error: messages.union({ type: "never", assignableTo: "number" }),
      },

      {
        code: "type T = true & boolean;",
        error: messages.intersection({ type: "boolean", overrideBy: "true" }),
      },
      {
        code: "type T = 1 | 1;",
        error: messages.union({ type: "1", assignableTo: "1" }),
      },
      {
        code: "type T = { a: string } | { a: string };",
        error: messages.union({
          type: "{ a: string }",
          assignableTo: "{ a: string }",
        }),
      },
      {
        code: "type T = { a: string; b: number } | { b: number; a: string };",
        error: messages.union({
          type: "{ b: number; a: string }",
          assignableTo: "{ a: string; b: number }",
        }),
      },
      {
        code: `
          type IsArray<T> = T extends any[] ? true : false;
          type ActuallyDuplicated = IsArray<number> | IsArray<string>;
        `,
        error: messages.union({
          type: "IsArray<string>",
          assignableTo: "IsArray<number>",
        }),
      },
      {
        code: `
          type A1 = 'A';
          type A2 = 'A';
          type A3 = 'A';
          type T = A1 | A2 | A3;
        `,
        errors: [
          { message: messages.union({ type: "A2", assignableTo: "A1" }) },
          { message: messages.union({ type: "A3", assignableTo: "A1" }) },
        ],
      },
      {
        code: `
          type A = 'A';
          type B = 'B';
          type T = (A | B) | (A | B);
        `,
        errors: [
          { message: messages.union({ type: "A", assignableTo: "A" }) },
          { message: messages.union({ type: "B", assignableTo: "B" }) },
        ],
      },
      {
        code: `
          type A = 'A';
          type T = A | (A | A);
        `,
        errors: [
          { message: messages.union({ type: "A", assignableTo: "A" }) },
          { message: messages.union({ type: "A", assignableTo: "A" }) },
        ],
      },
      {
        code: "type T = number | 0;",
        error: messages.union({ type: "0", assignableTo: "number" }),
      },
      {
        code: "type T = number | (0 | 1);",
        errors: [
          { message: messages.union({ type: "0", assignableTo: "number" }) },
          { message: messages.union({ type: "1", assignableTo: "number" }) },
        ],
      },
      {
        code: "type T = (2 | 'other' | 3) | number;",
        errors: [
          { message: messages.union({ type: "2", assignableTo: "number" }) },
          { message: messages.union({ type: "3", assignableTo: "number" }) },
        ],
      },
      // TODO: make it work without flagging type variables
      // {
      //   code: "type T = `a${number}c` | string;",
      //   error: messages.union({
      //     type: "`a${number}c`",
      //     assignableTo: "string",
      //   }),
      // },
      {
        code: "type T = false & boolean;",
        error: messages.intersection({ type: "boolean", overrideBy: "false" }),
      },
      {
        code: "type T = number & null;",
        error: messages.intersection({ type: "number", overrideBy: "null" }),
      },
      {
        code: "type T = `${string}` & null;",
        error: messages.intersection({
          type: "`${string}`",
          overrideBy: "null",
        }),
      },
    ],
  });
