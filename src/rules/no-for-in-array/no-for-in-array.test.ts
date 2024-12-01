import { ruleTester } from "../../ruleTester.ts";
import { messages, noForInArray } from "./no-for-in-array.ts";

export const test = () =>
  ruleTester({
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
    ],
  });
