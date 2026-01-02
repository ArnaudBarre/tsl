import { expect, test } from "bun:test";
import { ruleTester } from "../../ruleTester.ts";
import {
  messages,
  noUnnecessaryBooleanLiteralCompare,
} from "./noUnnecessaryBooleanLiteralCompare.ts";

test("noUnnecessaryBooleanLiteralCompare", () => {
  const hasError = ruleTester({
    ruleFn: noUnnecessaryBooleanLiteralCompare,
    valid: [
      `
      declare const varAny: any;
      varAny === true;
    `,
      `
      declare const varAny: any;
      varAny == false;
    `,
      `
      declare const varString: string;
      varString === false;
    `,
      `
      declare const varString: string;
      varString === true;
    `,
      `
      declare const varObject: {};
      varObject === true;
    `,
      `
      declare const varObject: {};
      varObject == false;
    `,
      `
      declare const varNullOrUndefined: null | undefined;
      varNullOrUndefined === false;
    `,
      `
      declare const varBooleanOrString: boolean | string;
      varBooleanOrString === false;
    `,
      `
      declare const varBooleanOrString: boolean | string;
      varBooleanOrString == true;
    `,
      `
      declare const varTrueOrStringOrUndefined: true | string | undefined;
      varTrueOrStringOrUndefined == true;
    `,
      `
      const test: <T>(someCondition: T) => void = someCondition => {
        if (someCondition === true) {
        }
      };
    `,
      `
      const test: <T>(someCondition: boolean | string) => void = someCondition => {
        if (someCondition === true) {
        }
      };
    `,
      `
      declare const varBooleanOrUndefined: boolean | undefined;
      varBooleanOrUndefined === true;
    `,
      {
        options: { allowComparingNullableBooleansToFalse: false },
        code: `
        declare const varBooleanOrUndefined: boolean | undefined;
        varBooleanOrUndefined === true;
      `,
      },
      {
        options: { allowComparingNullableBooleansToTrue: false },
        code: `
        declare const varBooleanOrUndefined: boolean | undefined;
        varBooleanOrUndefined === false;
      `,
      },
      {
        options: { allowComparingNullableBooleansToFalse: false },
        code: `
        const test: <T extends boolean | undefined>(
          someCondition: T,
        ) => void = someCondition => {
          if (someCondition === true) {
          }
        };
      `,
      },
      {
        options: { allowComparingNullableBooleansToTrue: false },
        code: `
        const test: <T extends boolean | undefined>(
          someCondition: T,
        ) => void = someCondition => {
          if (someCondition === false) {
          }
        };
      `,
      },
      "'false' === true;",
      "'true' === false;",
      `
const unconstrained: <T>(someCondition: T) => void = someCondition => {
  if (someCondition === true) {
  }
};
    `,
      `
const extendsUnknown: <T extends unknown>(
  someCondition: T,
) => void = someCondition => {
  if (someCondition === true) {
  }
};
    `,
    ],
    invalid: [
      {
        code: "true === true;",
        errors: [
          {
            message: messages.direct,
            suggestions: [{ message: messages.fix, output: "true;" }],
          },
        ],
      },
      {
        code: "false !== true;",
        errors: [
          {
            message: messages.negated,
            suggestions: [{ message: messages.fix, output: "!false;" }],
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (varBoolean !== false) {
        }
      `,
        errors: [
          {
            message: messages.negated,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const varBoolean: boolean;
        if (varBoolean) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const varTrue: true;
        if (varTrue !== true) {
        }
      `,
        errors: [
          {
            message: messages.negated,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const varTrue: true;
        if (!varTrue) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowComparingNullableBooleansToTrue: false },
        code: `
        declare const varTrueOrUndefined: true | undefined;
        if (varTrueOrUndefined === true) {
        }
      `,
        errors: [
          {
            message: messages.comparingNullableToTrueDirect,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const varTrueOrUndefined: true | undefined;
        if (varTrueOrUndefined) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowComparingNullableBooleansToTrue: false },
        code: `
        declare const varFalseOrNull: false | null;
        if (varFalseOrNull !== true) {
        }
      `,
        errors: [
          {
            message: messages.comparingNullableToTrueNegated,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const varFalseOrNull: false | null;
        if (!varFalseOrNull) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowComparingNullableBooleansToFalse: false },
        code: `
        declare const varBooleanOrNull: boolean | null;
        declare const otherBoolean: boolean;
        if (varBooleanOrNull === false && otherBoolean) {
        }
      `,
        errors: [
          {
            message: messages.comparingNullableToFalse,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const varBooleanOrNull: boolean | null;
        declare const otherBoolean: boolean;
        if (!(varBooleanOrNull ?? true) && otherBoolean) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowComparingNullableBooleansToFalse: false },
        code: `
        declare const varBooleanOrNull: boolean | null;
        declare const otherBoolean: boolean;
        if (!(varBooleanOrNull === false) || otherBoolean) {
        }
      `,
        errors: [
          {
            message: messages.comparingNullableToFalse,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const varBooleanOrNull: boolean | null;
        declare const otherBoolean: boolean;
        if ((varBooleanOrNull ?? true) || otherBoolean) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        options: { allowComparingNullableBooleansToFalse: false },
        code: `
        declare const varTrueOrFalseOrUndefined: true | false | undefined;
        declare const otherBoolean: boolean;
        if (varTrueOrFalseOrUndefined !== false && !otherBoolean) {
        }
      `,
        errors: [
          {
            message: messages.comparingNullableToFalse,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const varTrueOrFalseOrUndefined: true | false | undefined;
        declare const otherBoolean: boolean;
        if ((varTrueOrFalseOrUndefined ?? true) && !otherBoolean) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (false !== varBoolean) {
        }
      `,
        errors: [
          {
            message: messages.negated,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const varBoolean: boolean;
        if (varBoolean) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (true !== varBoolean) {
        }
      `,
        errors: [
          {
            message: messages.negated,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const varBoolean: boolean;
        if (!varBoolean) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const x;
        if ((x instanceof Error) === false) {
        }
      `,
        errors: [
          {
            message: messages.direct,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const x;
        if (!(x instanceof Error)) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const x;
        if (false === (x instanceof Error)) {
        }
      `,
        errors: [
          {
            message: messages.direct,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const x;
        if (!(x instanceof Error)) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const x;
        if (x instanceof Error === false) {
        }
      `,
        errors: [
          {
            message: messages.direct,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const x;
        if (!(x instanceof Error)) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const x;
        if (typeof x === 'string' === false) {
        }
      `,
        errors: [
          {
            message: messages.direct,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const x;
        if (!(typeof x === 'string')) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (!(varBoolean !== false)) {
        }
      `,
        errors: [
          {
            message: messages.negated,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const varBoolean: boolean;
        if (!varBoolean) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (!(varBoolean === false)) {
        }
      `,
        errors: [
          {
            message: messages.direct,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const varBoolean: boolean;
        if (varBoolean) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (!(varBoolean instanceof Event == false)) {
        }
      `,
        errors: [
          {
            message: messages.direct,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const varBoolean: boolean;
        if (varBoolean instanceof Event) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (varBoolean instanceof Event == false) {
        }
      `,
        errors: [
          {
            message: messages.direct,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const varBoolean: boolean;
        if (!(varBoolean instanceof Event)) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (!((varBoolean ?? false) !== false)) {
        }
      `,
        errors: [
          {
            message: messages.negated,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const varBoolean: boolean;
        if (!(varBoolean ?? false)) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (!((varBoolean ?? false) === false)) {
        }
      `,
        errors: [
          {
            message: messages.direct,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const varBoolean: boolean;
        if ((varBoolean ?? false)) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const varBoolean: boolean;
        if (!((varBoolean ?? true) !== false)) {
        }
      `,
        errors: [
          {
            message: messages.negated,
            suggestions: [
              {
                message: messages.fix,
                output: `
        declare const varBoolean: boolean;
        if (!(varBoolean ?? true)) {
        }
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        const test: <T extends boolean>(someCondition: T) => void = someCondition => {
          if (someCondition === true) {
          }
        };
      `,
        errors: [
          {
            message: messages.direct,
            suggestions: [
              {
                message: messages.fix,
                output: `
        const test: <T extends boolean>(someCondition: T) => void = someCondition => {
          if (someCondition) {
          }
        };
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        const test: <T extends boolean>(someCondition: T) => void = someCondition => {
          if (!(someCondition !== false)) {
          }
        };
      `,
        errors: [
          {
            message: messages.negated,
            suggestions: [
              {
                message: messages.fix,
                output: `
        const test: <T extends boolean>(someCondition: T) => void = someCondition => {
          if (!someCondition) {
          }
        };
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        const test: <T extends boolean>(someCondition: T) => void = someCondition => {
          if (!((someCondition ?? true) !== false)) {
          }
        };
      `,
        errors: [
          {
            message: messages.negated,
            suggestions: [
              {
                message: messages.fix,
                output: `
        const test: <T extends boolean>(someCondition: T) => void = someCondition => {
          if (!(someCondition ?? true)) {
          }
        };
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
