import { ruleTester } from "../../ruleTester.ts";
import { dotNotation } from "./dot-notation.ts";

export const test = () =>
  ruleTester({
    ruleFn: dotNotation,
    valid: [
      "a['12'];",
      "a[b];",
      "a[0];",
      "a[`time${range}`];",
      "a[`time range`];",
      "a[undefined];",
      "a[void 0];",
      "a[b()];",
      "a[/(?<zero>0)/];",
      {
        compilerOptions: { noPropertyAccessFromIndexSignature: true },
        code: `
interface Nested {
  property: string;
  [key: string]: number | string;
}

class Dingus {
  nested: Nested;
}

let dingus: Dingus | undefined;

dingus?.nested.property;
dingus?.nested['hello'];
      `,
      },
    ],

    invalid: [
      {
        code: "a['true'];",
        error: "['true'] is better written in dot notation.",
      },
      {
        code: "a['time'];",
        error: "['time'] is better written in dot notation.",
      },
      {
        code: "a.b['c'];",
        error: "['c'] is better written in dot notation.",
      },
      {
        code: `
getResource()
  .then(function(){})
  ["catch"](function(){})
  .then(function(){})
  ["catch"](function(){});`,
        errors: [
          {
            message: "['catch'] is better written in dot notation.",
            line: 6,
            column: 4,
          },
          {
            message: "['catch'] is better written in dot notation.",
            line: 4,
            column: 4,
          },
        ],
      },
      {
        compilerOptions: { noPropertyAccessFromIndexSignature: true },
        code: `
interface Nested {
  property: string;
  [key: string]: number | string;
}

class Dingus {
  nested: Nested;
}

let dingus: Dingus | undefined;

dingus?.nested['property'];
      `,
        errors: [
          {
            message: "['property'] is better written in dot notation.",
            line: 13,
            column: 16,
          },
        ],
      },
    ],
  });
