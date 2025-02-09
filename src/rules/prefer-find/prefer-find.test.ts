import { ruleTester } from "../../ruleTester.ts";
import { messages, preferFind } from "./prefer-find.ts";

export const test = () =>
  ruleTester({
    ruleFn: preferFind,
    valid: [
      `
      interface JerkCode<T> {
        filter(predicate: (item: T) => boolean): JerkCode<T>;
      }

      declare const jerkCode: JerkCode<string>;

      jerkCode.filter(item => item === 'aha')[0];
    `,
      `
      declare const arr: readonly string[];
      arr.filter(item => item === 'aha')[1];
    `,
      `
      declare const arr: string[];
      arr.filter(item => item === 'aha').at(1);
    `,
      `
      declare const notNecessarilyAnArray: unknown[] | undefined | null | string;
      notNecessarilyAnArray?.filter(item => true)[0];
    `,
      "[1, 2, 3].filter(x => x > 0).at(-Infinity);",
      `
      declare const arr: string[];
      declare const cond: Parameters<Array<string>['filter']>[0];
      const a = { arr };
      a?.arr.filter(cond).at(1);
    `,
      "['Just', 'a', 'filter'].filter(x => x.length > 4);",
      "['Just', 'a', 'find'].find(x => x.length > 4);",
      "undefined.filter(x => x)[0];",
      "null?.filter(x => x)[0];", // Should not throw. See https://github.com/typescript-eslint/typescript-eslint/issues/8386
      `
      declare function foo(param: any): any;
      foo(Symbol.for('foo'));
    `, // Specifically need to test Symbol.for(), not just Symbol(), since only
      // Symbol.for() creates a static value that the rule inspects.
      `
      declare const arr: string[];
      const s = Symbol.for("Don't throw!");
      arr.filter(item => item === 'aha').at(s);
    `,
      "[1, 2, 3].filter(x => x)[Symbol('0')];",
      "[1, 2, 3].filter(x => x)[Symbol.for('0')];",
      "(Math.random() < 0.5 ? [1, 2, 3].filter(x => true) : [1, 2, 3])[0];",
      `
      (Math.random() < 0.5
        ? [1, 2, 3].find(x => true)
        : [1, 2, 3].filter(x => true))[0];
    `,
    ],
    invalid: [
      {
        code: `
declare const arr: string[];
arr.filter(item => item === 'aha')[0];
      `,
        errors: [
          {
            message: messages.preferFind,
            line: 3,
            suggestions: [
              {
                message: messages.preferFindSuggestion,
                output: `
declare const arr: string[];
arr.find(item => item === 'aha');
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const arr: readonly string[];
arr.filter(item => item === 'aha').at(0);
      `,
        errors: [
          {
            message: messages.preferFind,
            line: 3,
            suggestions: [
              {
                message: messages.preferFindSuggestion,
                output: `
declare const arr: readonly string[];
arr.find(item => item === 'aha');
      `,
              },
            ],
          },
        ],
      },
      {
        code: "const two = [1, 2, 3].filter(item => item === 2)[0];",
        errors: [
          {
            message: messages.preferFind,
            line: 1,
            suggestions: [
              {
                message: messages.preferFindSuggestion,
                output: `const two = [1, 2, 3].find(item => item === 2);`,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const nullableArray: unknown[] | undefined | null;
nullableArray?.filter(item => true)[0];
      `,
        errors: [
          {
            message: messages.preferFind,
            line: 3,
            suggestions: [
              {
                message: messages.preferFindSuggestion,
                output: `
declare const nullableArray: unknown[] | undefined | null;
nullableArray?.find(item => true);
      `,
              },
            ],
          },
        ],
      },
      {
        code: "([]?.filter(f))[0];",
        errors: [
          {
            message: messages.preferFind,
            line: 1,
            suggestions: [
              {
                message: messages.preferFindSuggestion,
                output: "([]?.find(f));",
              },
            ],
          },
        ],
      },
      {
        code: `
declare const arr: string[];
declare const cond: Parameters<Array<string>['filter']>[0];
const a = { arr };
a?.arr
  .filter(cond) /* what a bad spot for a comment. Let's make sure
  there's some yucky symbols too. [ . ?. <>   ' ' \\'] */
  .at(0);
      `,
        errors: [
          {
            message: messages.preferFind,
            line: 5,
            suggestions: [
              {
                message: messages.preferFindSuggestion,
                output: `
declare const arr: string[];
declare const cond: Parameters<Array<string>['filter']>[0];
const a = { arr };
a?.arr
  .find(cond) /* what a bad spot for a comment. Let's make sure
  there's some yucky symbols too. [ . ?. <>   ' ' \\'] */
  ;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const imNotActuallyAnArray = [
  [1, 2, 3],
  [2, 3, 4],
] as const;
const butIAm = [4, 5, 6];
butIAm.push(
  // line comment!
  ...imNotActuallyAnArray.filter(
    x => x[1] > 0,
  ) /**/[0]!,
);
      `,
        errors: [
          {
            message: messages.preferFind,
            line: 9,
            suggestions: [
              {
                message: messages.preferFindSuggestion,
                output: `
const imNotActuallyAnArray = [
  [1, 2, 3],
  [2, 3, 4],
] as const;
const butIAm = [4, 5, 6];
butIAm.push(
  // line comment!
  ...imNotActuallyAnArray.find(
    x => x[1] > 0,
  ) /**/!,
);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
function actingOnArray<T extends string[]>(values: T) {
  return values.filter(filter => filter === 'filter')[
    /* filter */ 0 /* filter */
  ];
}
      `,
        errors: [
          {
            message: messages.preferFind,
            line: 3,
            suggestions: [
              {
                message: messages.preferFindSuggestion,
                output: `
function actingOnArray<T extends string[]>(values: T) {
  return values.find(filter => filter === 'filter');
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const arr: { a: 1 }[] & { b: 2 }[];
arr.filter(f, thisArg)[0];
      `,
        errors: [
          {
            message: messages.preferFind,
            line: 3,
            suggestions: [
              {
                message: messages.preferFindSuggestion,
                output: `
declare const arr: { a: 1 }[] & { b: 2 }[];
arr.find(f, thisArg);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const arr: { a: 1 }[] & ({ b: 2 }[] | { c: 3 }[]);
arr.filter(f, thisArg)[0];
      `,
        errors: [
          {
            message: messages.preferFind,
            line: 3,
            suggestions: [
              {
                message: messages.preferFindSuggestion,
                output: `
declare const arr: { a: 1 }[] & ({ b: 2 }[] | { c: 3 }[]);
arr.find(f, thisArg);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
(Math.random() < 0.5
  ? [1, 2, 3].filter(x => false)
  : [1, 2, 3].filter(x => true))[0];
      `,
        errors: [
          {
            message: messages.preferFind,
            line: 2,
            suggestions: [
              {
                message: messages.preferFindSuggestion,
                output: `
(Math.random() < 0.5
  ? [1, 2, 3].find(x => false)
  : [1, 2, 3].find(x => true));
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
Math.random() < 0.5
  ? [1, 2, 3].find(x => true)
  : [1, 2, 3].filter(x => true)[0];
      `,
        errors: [
          {
            message: messages.preferFind,
            line: 4,
            suggestions: [
              {
                message: messages.preferFindSuggestion,
                output: `
Math.random() < 0.5
  ? [1, 2, 3].find(x => true)
  : [1, 2, 3].find(x => true);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const f: (arg0: unknown, arg1: number, arg2: Array<unknown>) => boolean,
  g: (arg0: unknown) => boolean;
const nestedTernaries = (
  Math.random() < 0.5
    ? Math.random() < 0.5
      ? [1, 2, 3].filter(f)
      : []?.filter(x => 'shrug')
    : [2, 3, 4].filter(g)
).at(0);
      `,
        errors: [
          {
            message: messages.preferFind,
            line: 4,
            suggestions: [
              {
                message: messages.preferFindSuggestion,
                output: `
declare const f: (arg0: unknown, arg1: number, arg2: Array<unknown>) => boolean,
  g: (arg0: unknown) => boolean;
const nestedTernaries = (
  Math.random() < 0.5
    ? Math.random() < 0.5
      ? [1, 2, 3].find(f)
      : []?.find(x => 'shrug')
    : [2, 3, 4].find(g)
);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const spreadArgs: [(x: unknown) => boolean];
[1, 2, 3].filter(...spreadArgs).at(0);
      `,
        errors: [
          {
            message: messages.preferFind,
            line: 3,
            suggestions: [
              {
                message: messages.preferFindSuggestion,
                output: `
declare const spreadArgs: [(x: unknown) => boolean];
[1, 2, 3].find(...spreadArgs);
      `,
              },
            ],
          },
        ],
      },
    ],
  });
