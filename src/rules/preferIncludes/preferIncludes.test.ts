import { ruleTester } from "../../ruleTester.ts";
import { messages, preferIncludes } from "./preferIncludes.ts";

export const test = () =>
  ruleTester({
    ruleFn: preferIncludes,
    valid: [
      `
      function f(a: string): void {
        a.indexOf(b);
      }
    `,
      `
      function f(a: string): void {
        a.indexOf(b) + 0;
      }
    `,
      `
      function f(a: string | { value: string }): void {
        a.indexOf(b) !== -1;
      }
    `,
      `
      type UserDefined = {
        indexOf(x: any): number; // don't have 'includes'
      };
      function f(a: UserDefined): void {
        a.indexOf(b) !== -1;
      }
    `,
      `
      type UserDefined = {
        indexOf(x: any, fromIndex?: number): number;
        includes(x: any): boolean; // different parameters
      };
      function f(a: UserDefined): void {
        a.indexOf(b) !== -1;
      }
    `,
      `
      type UserDefined = {
        indexOf(x: any, fromIndex?: number): number;
        includes(x: any, fromIndex: number): boolean; // different parameters
      };
      function f(a: UserDefined): void {
        a.indexOf(b) !== -1;
      }
    `,
      `
      type UserDefined = {
        indexOf(x: any, fromIndex?: number): number;
        includes: boolean; // different type
      };
      function f(a: UserDefined): void {
        a.indexOf(b) !== -1;
      }
    `,
    ],
    invalid: [
      // positive
      {
        code: `
        function f(a: string): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: string): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: string): void {
          a.indexOf(b) != -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: string): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: string): void {
          a.indexOf(b) > -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: string): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: string): void {
          a.indexOf(b) >= 0;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: string): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      }, // negative
      {
        code: `
        function f(a: string): void {
          a.indexOf(b) === -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: string): void {
          !a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: string): void {
          a.indexOf(b) == -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: string): void {
          !a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: string): void {
          a.indexOf(b) <= -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: string): void {
          !a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: string): void {
          a.indexOf(b) < 0;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: string): void {
          !a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a?: string): void {
          a?.indexOf(b) === -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
          },
        ],
      },
      {
        code: `
        function f(a?: string): void {
          a?.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
          },
        ],
      },
      // type variation
      {
        code: `
        function f(a: any[]): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: any[]): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: ReadonlyArray<any>): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: ReadonlyArray<any>): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Int8Array): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Int8Array): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Int16Array): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Int16Array): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Int32Array): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Int32Array): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Uint8Array): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Uint8Array): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Uint16Array): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Uint16Array): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Uint32Array): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Uint32Array): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Float32Array): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Float32Array): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Float64Array): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Float64Array): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f<T>(a: T[] | ReadonlyArray<T>): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f<T>(a: T[] | ReadonlyArray<T>): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f<
          T,
          U extends
            | T[]
            | ReadonlyArray<T>
            | Int8Array
            | Uint8Array
            | Int16Array
            | Uint16Array
            | Int32Array
            | Uint32Array
            | Float32Array
            | Float64Array,
        >(a: U): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f<
          T,
          U extends
            | T[]
            | ReadonlyArray<T>
            | Int8Array
            | Uint8Array
            | Int16Array
            | Uint16Array
            | Int32Array
            | Uint32Array
            | Float32Array
            | Float64Array,
        >(a: U): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        type UserDefined = {
          indexOf(x: any): number;
          includes(x: any): boolean;
        };
        function f(a: UserDefined): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        type UserDefined = {
          indexOf(x: any): number;
          includes(x: any): boolean;
        };
        function f(a: UserDefined): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        function f(a: Readonly<any[]>): void {
          a.indexOf(b) !== -1;
        }
      `,
        errors: [
          {
            message: messages.preferIncludes,
            suggestions: [
              {
                message: messages.fix,
                output: `
        function f(a: Readonly<any[]>): void {
          a.includes(b);
        }
      `,
              },
            ],
          },
        ],
      },
    ],
  });
