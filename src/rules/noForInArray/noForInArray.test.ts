import { expect, test } from "bun:test";
import { ruleTester } from "../../ruleTester.ts";
import { messages, noForInArray } from "./noForInArray.ts";

test("noForInArray", () => {
  const hasError = ruleTester({
    ruleFn: noForInArray,
    valid: [
      `
for (const x of [3, 4, 5]) {
  console.log(x);
}
    `,
      `
for (const x in { a: 1, b: 2, c: 3 }) {
  console.log(x);
}
    `,
      // this is normally a type error, this test is here to make sure the rule
      // doesn't include an "extra" report for it
      `
declare const nullish: null | undefined;
// @ts-expect-error
for (const k in nullish) {
}
    `,
      `
declare const obj: {
  [key: number]: number;
};

for (const key in obj) {
  console.log(key);
}
    `,
    ],
    invalid: [
      {
        code: `
for (const x in [3, 4, 5]) {
  console.log(x);
}
      `,
        errors: [
          {
            column: 17,
            endColumn: 26,
            endLine: 2,
            line: 2,
            message: messages.forInViolation,
          },
        ],
      },
      {
        code: `
const z = [3, 4, 5];
for (const x in z) {
  console.log(x);
}
      `,
        errors: [
          {
            column: 17,
            endColumn: 18,
            endLine: 3,
            line: 3,
            message: messages.forInViolation,
          },
        ],
      },
      {
        code: `
const fn = (arr: number[]) => {
  for (const x in arr) {
    console.log(x);
  }
};
      `,
        errors: [
          {
            column: 19,
            endColumn: 22,
            endLine: 3,
            line: 3,
            message: messages.forInViolation,
          },
        ],
      },
      {
        code: `
const fn = (arr: number[] | string[]) => {
  for (const x in arr) {
    console.log(x);
  }
};
      `,
        errors: [
          {
            column: 19,
            endColumn: 22,
            endLine: 3,
            line: 3,
            message: messages.forInViolation,
          },
        ],
      },
      {
        code: `
const fn = <T extends any[]>(arr: T) => {
  for (const x in arr) {
    console.log(x);
  }
};
      `,
        errors: [
          {
            column: 19,
            endColumn: 22,
            endLine: 3,
            line: 3,
            message: messages.forInViolation,
          },
        ],
      },
      {
        code: `
for (const x
  in
    (
      (
        (
          [3, 4, 5]
        )
      )
    )
  )
  // weird
  /* spot for a */
  // comment
  /* ) */
  /* ( */
  {
  console.log(x);
}
      `,
        errors: [
          {
            column: 5,
            endColumn: 6,
            endLine: 10,
            line: 4,
            message: messages.forInViolation,
          },
        ],
      },
      {
        code: `
for (const x
  in
    (
      (
        (
          [3, 4, 5]
        )
      )
    )
  )
  // weird
  /* spot for a */
  // comment
  /* ) */
  /* ( */

  ((((console.log('body without braces ')))));

      `,
        errors: [
          {
            column: 5,
            endColumn: 6,
            endLine: 10,
            line: 4,
            message: messages.forInViolation,
          },
        ],
      },
      {
        code: `
declare const array: string[] | null;

for (const key in array) {
  console.log(key);
}
      `,
        errors: [{ message: messages.forInViolation }],
      },
      {
        code: `
declare const array: number[] | undefined;

for (const key in array) {
  console.log(key);
}
      `,
        errors: [{ message: messages.forInViolation }],
      },
      {
        code: `
declare const array: boolean[] | { a: 1; b: 2; c: 3 };

for (const key in array) {
  console.log(key);
}
      `,
        errors: [{ message: messages.forInViolation }],
      },
      {
        code: `
declare const array: [number, string];

for (const key in array) {
  console.log(key);
}
      `,
        errors: [{ message: messages.forInViolation }],
      },
      {
        code: `
declare const array: [number, string] | { a: 1; b: 2; c: 3 };

for (const key in array) {
  console.log(key);
}
      `,
        errors: [{ message: messages.forInViolation }],
      },
      {
        code: `
const arrayLike = /fe/.exec('foo');

for (const x in arrayLike) {
  console.log(x);
}
      `,
        errors: [{ message: messages.forInViolation }],
      },
      {
        compilerOptions: { lib: ["dom"] },
        code: `
declare const arrayLike: HTMLCollection;

for (const x in arrayLike) {
  console.log(x);
}
      `,
        errors: [{ message: messages.forInViolation }],
      },
      {
        compilerOptions: { lib: ["dom"] },
        code: `
declare const arrayLike: NodeList;

for (const x in arrayLike) {
  console.log(x);
}
      `,
        errors: [{ message: messages.forInViolation }],
      },
      {
        code: `
function foo() {
  for (const a in arguments) {
    console.log(a);
  }
}
      `,
        errors: [{ message: messages.forInViolation }],
      },
      {
        code: `
declare const array:
  | (({ a: string } & string[]) | Record<string, boolean>)
  | Record<number, string>;

for (const key in array) {
  console.log(key);
}
      `,
        errors: [{ message: messages.forInViolation }],
      },
      {
        code: `
declare const array:
  | (({ a: string } & RegExpExecArray) | Record<string, boolean>)
  | Record<number, string>;

for (const key in array) {
  console.log(k);
}
      `,
        errors: [{ message: messages.forInViolation }],
      },
      {
        code: `
declare const obj: {
  [key: number]: number;
  length: 1;
};

for (const key in obj) {
  console.log(key);
}
      `,
        errors: [{ message: messages.forInViolation }],
      },
    ],
  });
  expect(hasError).toEqual(false);
});
