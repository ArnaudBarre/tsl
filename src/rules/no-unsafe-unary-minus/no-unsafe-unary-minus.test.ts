import { ruleTester } from "../../ruleTester.ts";
import { messages, noUnsafeUnaryMinus } from "./no-unsafe-unary-minus.ts";

export const test = () =>
  ruleTester({
    ruleFn: noUnsafeUnaryMinus,
    valid: [
      "+42;",
      "-42;",
      "-42n;",
      "(a: number) => -a;",
      "(a: bigint) => -a;",
      "(a: number | bigint) => -a;",
      "(a: any) => -a;",
      "(a: 1 | 2) => -a;",
      "(a: string) => +a;",
      "(a: number[]) => -a[0];",
      "<T,>(t: T & number) => -t;",
      "(a: { x: number }) => -a.x;",
      "(a: never) => -a;",
      "<T extends number>(t: T) => -t;",
    ],
    invalid: [
      {
        code: "(a: string) => -a;",
        errors: [{ message: messages.unaryMinus({ type: "string" }) }],
      },
      {
        code: "(a: {}) => -a;",
        errors: [{ message: messages.unaryMinus({ type: "{}" }) }],
      },
      {
        code: "(a: number[]) => -a;",
        errors: [{ message: messages.unaryMinus({ type: "number[]" }) }],
      },
      {
        code: "-'hello';",
        errors: [{ message: messages.unaryMinus({ type: '"hello"' }) }],
      },
      {
        code: "-`hello`;",
        errors: [{ message: messages.unaryMinus({ type: '"hello"' }) }],
      },
      {
        code: "(a: { x: number }) => -a;",
        errors: [{ message: messages.unaryMinus({ type: "{ x: number; }" }) }],
      },
      {
        code: "(a: unknown) => -a;",
        errors: [{ message: messages.unaryMinus({ type: "unknown" }) }],
      },
      {
        code: "(a: void) => -a;",
        errors: [{ message: messages.unaryMinus({ type: "void" }) }],
      },
      {
        code: "<T,>(t: T) => -t;",
        errors: [{ message: messages.unaryMinus({ type: "T" }) }],
      },
    ],
  });
