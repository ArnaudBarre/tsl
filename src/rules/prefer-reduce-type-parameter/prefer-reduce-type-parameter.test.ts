import { ruleTester } from "../../ruleTester.ts";
import {
  messages,
  preferReduceTypeParameter,
} from "./prefer-reduce-type-parameter.ts";

export const test = () =>
  ruleTester({
    ruleFn: preferReduceTypeParameter,
    valid: [
      `
      new (class Mine {
        reduce() {}
      })().reduce(() => {}, 1 as any);
    `,
      `
      class Mine {
        reduce() {}
      }

      new Mine().reduce(() => {}, 1 as any);
    `,
      `
      import { Reducable } from './class';

      new Reducable().reduce(() => {}, 1 as any);
    `,
      "[1, 2, 3]['reduce']((sum, num) => sum + num, 0);",
      "[1, 2, 3][null]((sum, num) => sum + num, 0);",
      "[1, 2, 3]?.[null]((sum, num) => sum + num, 0);",
      "[1, 2, 3].reduce((sum, num) => sum + num, 0);",
      "[1, 2, 3].reduce<number[]>((a, s) => a.concat(s * 2), []);",
      "[1, 2, 3]?.reduce<number[]>((a, s) => a.concat(s * 2), []);",
      `
      declare const tuple: [number, number, number];
      tuple.reduce<number[]>((a, s) => a.concat(s * 2), []);
    `,
      `
      type Reducer = { reduce: (callback: (arg: any) => any, arg: any) => any };
      declare const tuple: [number, number, number] | Reducer;
      tuple.reduce(a => {
        return a.concat(1);
      }, [] as number[]);
    `,
      `
      type Reducer = { reduce: (callback: (arg: any) => any, arg: any) => any };
      declare const arrayOrReducer: number[] & Reducer;
      arrayOrReducer.reduce(a => {
        return a.concat(1);
      }, [] as number[]);
    `,
    ],

    invalid: [
      {
        code: `
declare const arr: string[];
arr.reduce<string>(acc => acc, arr.shift() as string);
      `,
        errors: [
          {
            message: messages.preferTypeParameter,
            line: 3,
            column: 32,
            suggestions: [
              {
                message: messages.fix,
                output: `
declare const arr: string[];
arr.reduce<string>(acc => acc, arr.shift());
      `,
              },
            ],
          },
        ],
      },
      {
        code: "[1, 2, 3].reduce((a, s) => a.concat(s * 2), [] as number[]);",
        errors: [
          {
            message: messages.preferTypeParameter,
            line: 1,
            column: 45,
            suggestions: [
              {
                message: messages.fix,
                output:
                  "[1, 2, 3].reduce<number[]>((a, s) => a.concat(s * 2), []);",
              },
            ],
          },
        ],
      },
      {
        code: "[1, 2, 3].reduce((a, s) => a.concat(s * 2), <number[]>[]);",
        errors: [
          {
            message: messages.preferTypeParameter,
            line: 1,
            column: 45,
            suggestions: [
              {
                message: messages.fix,
                output:
                  "[1, 2, 3].reduce<number[]>((a, s) => a.concat(s * 2), []);",
              },
            ],
          },
        ],
      },
      {
        code: "[1, 2, 3]?.reduce((a, s) => a.concat(s * 2), [] as number[]);",
        errors: [
          {
            message: messages.preferTypeParameter,
            line: 1,
            column: 46,
            suggestions: [
              {
                message: messages.fix,
                output:
                  "[1, 2, 3]?.reduce<number[]>((a, s) => a.concat(s * 2), []);",
              },
            ],
          },
        ],
      },
      {
        code: "[1, 2, 3]?.reduce((a, s) => a.concat(s * 2), <number[]>[]);",
        errors: [
          {
            message: messages.preferTypeParameter,
            line: 1,
            column: 46,
            suggestions: [
              {
                message: messages.fix,
                output:
                  "[1, 2, 3]?.reduce<number[]>((a, s) => a.concat(s * 2), []);",
              },
            ],
          },
        ],
      },
      {
        code: `
const names = ['a', 'b', 'c'];

names.reduce(
  (accum, name) => ({
    ...accum,
    [name]: true,
  }),
  {} as Record<string, boolean>,
);
      `,
        errors: [
          {
            message: messages.preferTypeParameter,
            line: 9,
            column: 3,
            suggestions: [
              {
                message: messages.fix,
                output: `
const names = ['a', 'b', 'c'];

names.reduce<Record<string, boolean>>(
  (accum, name) => ({
    ...accum,
    [name]: true,
  }),
  {},
);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
['a', 'b'].reduce(
  (accum, name) => ({
    ...accum,
    [name]: true,
  }),
  <Record<string, boolean>>{},
);
      `,
        errors: [
          {
            message: messages.preferTypeParameter,
            line: 7,
            column: 3,
            suggestions: [
              {
                message: messages.fix,
                output: `
['a', 'b'].reduce<Record<string, boolean>>(
  (accum, name) => ({
    ...accum,
    [name]: true,
  }),
  {},
);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
function f<T, U extends T[]>(a: U) {
  return a.reduce(() => {}, {} as Record<string, boolean>);
}
      `,
        errors: [
          {
            message: messages.preferTypeParameter,
            line: 3,
            column: 29,
            suggestions: [
              {
                message: messages.fix,
                output: `
function f<T, U extends T[]>(a: U) {
  return a.reduce<Record<string, boolean>>(() => {}, {});
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const tuple: [number, number, number];
tuple.reduce((a, s) => a.concat(s * 2), [] as number[]);
      `,
        errors: [
          {
            message: messages.preferTypeParameter,
            line: 3,
            column: 41,
            suggestions: [
              {
                message: messages.fix,
                output: `
declare const tuple: [number, number, number];
tuple.reduce<number[]>((a, s) => a.concat(s * 2), []);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const tupleOrArray: [number, number, number] | number[];
tupleOrArray.reduce((a, s) => a.concat(s * 2), [] as number[]);
      `,
        errors: [
          {
            message: messages.preferTypeParameter,
            line: 3,
            column: 48,
            suggestions: [
              {
                message: messages.fix,
                output: `
declare const tupleOrArray: [number, number, number] | number[];
tupleOrArray.reduce<number[]>((a, s) => a.concat(s * 2), []);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const tuple: [number, number, number] & number[];
tuple.reduce((a, s) => a.concat(s * 2), [] as number[]);
      `,
        errors: [
          {
            message: messages.preferTypeParameter,
            line: 3,
            column: 41,
            suggestions: [
              {
                message: messages.fix,
                output: `
declare const tuple: [number, number, number] & number[];
tuple.reduce<number[]>((a, s) => a.concat(s * 2), []);
      `,
              },
            ],
          },
        ],
      },
    ],
  });
