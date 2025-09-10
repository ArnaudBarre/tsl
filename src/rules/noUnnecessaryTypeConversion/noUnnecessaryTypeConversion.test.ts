import { ruleTester } from "../../ruleTester.ts";
import {
  messages,
  noUnnecessaryTypeConversion,
} from "./noUnnecessaryTypeConversion.ts";

export const test = () =>
  ruleTester({
    ruleFn: noUnnecessaryTypeConversion,
    valid: [
      // standard type conversions are valid
      "String(1);",
      "(1).toString();",
      "`${1}`;",
      "'' + 1;",
      "1 + '';",
      `
      let str = 1;
      str += '';
      `,
      "Number('2');",
      "+'2';",
      "~~'2';",
      "Boolean(0);",
      "!!0;",
      "BigInt(3);",
      "~~1.1;",
      "~~-1.1;",
      "~~(1.5 + 2.3);",
      "~~(1 / 3);",
      // things that are not type conversion idioms (but look similar) are valid
      "new String('asdf');",
      "new Number(2);",
      "new Boolean(true);",
      "!false;",
      "~2;",
      `
      function String(value: unknown) {
        return value;
      }
      String('asdf');
      export {};
      `,
      `
      function Number(value: unknown) {
        return value;
      }
      Number(2);
      export {};
      `,
      `
      function Boolean(value: unknown) {
        return value;
      }
      Boolean(true);
      export {};
      `,
      `
      function BigInt(value: unknown) {
        return value;
      }
      BigInt(3n);
      export {};
      `,
      `
      function toString(value: unknown) {
        return value;
      }
      toString('asdf');
      `,
      `
      export {};
      declare const toString: string;
      toString.toUpperCase();
      `,
      // using type conversion idioms to unbox boxed primitives is valid
      "String(new String());",
      "new String().toString();",
      "'' + new String();",
      "new String() + '';",
      `
      let str = new String();
      str += '';
      `,
      "Number(new Number());",
      "+new Number();",
      "~~new Number();",
      "Boolean(new Boolean());",
      "!!new Boolean();",
    ],
    invalid: [
      {
        code: "String('asdf');",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Passing a string to String()",
              type: "string",
            }),
            column: 1,
            endColumn: 7,
            suggestions: [
              { message: messages.suggestRemove, output: "'asdf';" },
            ],
          },
        ],
      },
      {
        code: "'asdf'.toString();",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Calling a string's .toString() method",
              type: "string",
            }),
            column: 8,
            endColumn: 18,
            suggestions: [
              { message: messages.suggestRemove, output: "'asdf';" },
            ],
          },
        ],
      },
      {
        code: "'' + 'asdf';",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Concatenating '' with a string",
              type: "string",
            }),
            column: 1,
            endColumn: 5,
            suggestions: [
              { message: messages.suggestRemove, output: "'asdf';" },
            ],
          },
        ],
      },
      {
        code: "'asdf' + '';",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Concatenating a string with ''",
              type: "string",
            }),
            column: 8,
            endColumn: 12,
            suggestions: [
              { message: messages.suggestRemove, output: "'asdf';" },
            ],
          },
        ],
      },
      {
        code: `
let str = 'asdf';
str += '';
      `,
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Concatenating a string with ''",
              type: "string",
            }),
            line: 3,
            column: 1,
            endLine: 3,
            endColumn: 10,
            suggestions: [
              {
                message: messages.suggestRemove,
                output: `
let str = 'asdf';

      `,
              },
            ],
          },
        ],
      },
      {
        code: `
let str = 'asdf';
'asdf' + (str += '');
      `,
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Concatenating a string with ''",
              type: "string",
            }),
            line: 3,
            column: 11,
            endLine: 3,
            endColumn: 20,
            suggestions: [
              {
                message: messages.suggestRemove,
                output: `
let str = 'asdf';
'asdf' + (str);
      `,
              },
            ],
          },
        ],
      },
      {
        code: "Number(123);",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Passing a number to Number()",
              type: "number",
            }),
            column: 1,
            endColumn: 7,
            suggestions: [{ message: messages.suggestRemove, output: "123;" }],
          },
        ],
      },
      {
        code: "+123;",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Using the unary + operator on a number",
              type: "number",
            }),
            column: 1,
            endColumn: 2,
            suggestions: [{ message: messages.suggestRemove, output: "123;" }],
          },
        ],
      },
      {
        code: "~~123;",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Using ~~ on a number",
              type: "number",
            }),
            column: 1,
            endColumn: 3,
            suggestions: [{ message: messages.suggestRemove, output: "123;" }],
          },
        ],
      },
      {
        code: "Boolean(true);",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Passing a boolean to Boolean()",
              type: "boolean",
            }),
            column: 1,
            endColumn: 8,
            suggestions: [{ message: messages.suggestRemove, output: "true;" }],
          },
        ],
      },
      {
        code: "!!true;",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Using !! on a boolean",
              type: "boolean",
            }),
            column: 1,
            endColumn: 3,
            suggestions: [{ message: messages.suggestRemove, output: "true;" }],
          },
        ],
      },
      {
        code: "BigInt(3n);",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Passing a bigint to BigInt()",
              type: "bigint",
            }),
            column: 1,
            endColumn: 7,
            suggestions: [{ message: messages.suggestRemove, output: "3n;" }],
          },
        ],
      }, // using type conversion idioms on generics that extend primitives is invalid
      {
        code: `
        function f<T extends string>(x: T) {
          return String(x);
        }
        `,
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Passing a string to String()",
              type: "string",
            }),
            line: 3,
            column: 18,
            endLine: 3,
            endColumn: 24,
            suggestions: [
              {
                message: messages.suggestRemove,
                output: `
        function f<T extends string>(x: T) {
          return x;
        }
        `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f<T extends number>(x: T) {
          return Number(x);
        }
        `,
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Passing a number to Number()",
              type: "number",
            }),
            line: 3,
            column: 18,
            endLine: 3,
            endColumn: 24,
            suggestions: [
              {
                message: messages.suggestRemove,
                output: `
        function f<T extends number>(x: T) {
          return x;
        }
        `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f<T extends boolean>(x: T) {
          return Boolean(x);
        }
        `,
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Passing a boolean to Boolean()",
              type: "boolean",
            }),
            line: 3,
            column: 18,
            endLine: 3,
            endColumn: 25,
            suggestions: [
              {
                message: messages.suggestRemove,
                output: `
        function f<T extends boolean>(x: T) {
          return x;
        }
        `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f<T extends bigint>(x: T) {
          return BigInt(x);
        }
        `,
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Passing a bigint to BigInt()",
              type: "bigint",
            }),
            line: 3,
            column: 18,
            endLine: 3,
            endColumn: 24,
            suggestions: [
              {
                message: messages.suggestRemove,
                output: `
        function f<T extends bigint>(x: T) {
          return x;
        }
        `,
              },
            ],
          },
        ],
      }, // make sure fixes preserve parentheses in cases where logic would otherwise break
      {
        code: "String('a' + 'b').length;",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Passing a string to String()",
              type: "string",
            }),
            column: 1,
            endColumn: 7,
            suggestions: [
              {
                message: messages.suggestRemove,
                output: "('a' + 'b').length;",
              },
            ],
          },
        ],
      },
      {
        code: "('a' + 'b').toString().length;",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Calling a string's .toString() method",
              type: "string",
            }),
            column: 13,
            endColumn: 23,
            suggestions: [
              {
                message: messages.suggestRemove,
                output: "('a' + 'b').length;",
              },
            ],
          },
        ],
      },
      {
        code: "2 * +(2 + 2);",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Using the unary + operator on a number",
              type: "number",
            }),
            column: 5,
            endColumn: 6,
            suggestions: [
              { message: messages.suggestRemove, output: "2 * (2 + 2);" },
            ],
          },
        ],
      },
      {
        code: "2 * Number(2 + 2);",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Passing a number to Number()",
              type: "number",
            }),
            column: 5,
            endColumn: 11,
            suggestions: [
              { message: messages.suggestRemove, output: "2 * (2 + 2);" },
            ],
          },
        ],
      },
      {
        code: "false && !!(false || true);",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Using !! on a boolean",
              type: "boolean",
            }),
            column: 10,
            endColumn: 12,
            suggestions: [
              {
                message: messages.suggestRemove,
                output: "false && (false || true);",
              },
            ],
          },
        ],
      },
      {
        code: "false && Boolean(false || true);",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Passing a boolean to Boolean()",
              type: "boolean",
            }),
            column: 10,
            endColumn: 17,
            suggestions: [
              {
                message: messages.suggestRemove,
                output: "false && (false || true);",
              },
            ],
          },
        ],
      },
      {
        code: "2n * BigInt(2n + 2n);",
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Passing a bigint to BigInt()",
              type: "bigint",
            }),
            column: 6,
            endColumn: 12,
            suggestions: [
              { message: messages.suggestRemove, output: "2n * (2n + 2n);" },
            ],
          },
        ],
      }, // make sure suggestions add parentheses in cases where syntax would otherwise break
      {
        code: `
        let str = 'asdf';
        String(str).length;
        `,
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Passing a string to String()",
              type: "string",
            }),
            line: 3,
            column: 9,
            endLine: 3,
            endColumn: 15,
            suggestions: [
              {
                message: messages.suggestRemove,
                output: `
        let str = 'asdf';
        str.length;
        `,
              },
            ],
          },
        ],
      },
      {
        code: `
        let str = 'asdf';
        str.toString().length;
        `,
        errors: [
          {
            message: messages.unnecessaryTypeConversion({
              violation: "Calling a string's .toString() method",
              type: "string",
            }),
            column: 13,
            endColumn: 23,
            suggestions: [
              {
                message: messages.suggestRemove,
                output: `
        let str = 'asdf';
        str.length;
        `,
              },
            ],
          },
        ],
      },
      {
        code: "~~1;",
        errors: [
          {
            column: 1,
            endColumn: 3,
            message: messages.unnecessaryTypeConversion({
              violation: "Using ~~ on a number",
              type: "number",
            }),
            suggestions: [{ message: messages.suggestRemove, output: "1;" }],
          },
        ],
      },
      {
        code: "~~-1;",
        errors: [
          {
            column: 1,
            endColumn: 3,
            message: messages.unnecessaryTypeConversion({
              violation: "Using ~~ on a number",
              type: "number",
            }),
            suggestions: [{ message: messages.suggestRemove, output: "-1;" }],
          },
        ],
      },
      {
        code: `
          declare const threeOrFour: 3 | 4;
          ~~threeOrFour;
        `,
        errors: [
          {
            line: 3,
            column: 11,
            endColumn: 13,
            message: messages.unnecessaryTypeConversion({
              violation: "Using ~~ on a number",
              type: "number",
            }),
            suggestions: [
              {
                message: messages.suggestRemove,
                output: `
          declare const threeOrFour: 3 | 4;
          threeOrFour;
        `,
              },
            ],
          },
        ],
      },
    ],
  });
