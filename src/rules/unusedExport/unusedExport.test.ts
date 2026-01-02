import { expect, test } from "bun:test";
import { ruleTester, type ValidTestCase } from "../../ruleTester.ts";
import { messages, unusedExport } from "./unusedExport.ts";

test("unusedExport", () => {
  const hasError = ruleTester({
    ruleFn: unusedExport,
    valid: [
      ...[
        "export const foo = 1;",
        "export const foo = () => 1;",
        "const foo = 1; export { foo };",
        "export function foo() { return 1; }",
        "export class foo { }",
      ].map(
        (code): ValidTestCase<typeof unusedExport> => ({
          files: [
            { fileName: "file.ts", code },
            { fileName: "file2.ts", code: `import { foo } from "./file.ts";` },
          ],
        }),
      ),
      ...[
        "const foo = 1; export default foo;",
        "export default function foo() { return 1; }",
        "export default class foo { }",
      ].map(
        (code): ValidTestCase<typeof unusedExport> => ({
          files: [
            { fileName: "file.ts", code },
            { fileName: "file2.ts", code: `import bar from "./file.ts";` },
          ],
        }),
      ),
      {
        files: [
          {
            fileName: "file.ts",
            code: "export const foo = 1; export const bar = 2;",
          },
          { fileName: "file2.ts", code: `import * as utils from "./file.ts";` },
        ],
      },
    ],
    invalid: [
      {
        files: [
          {
            fileName: "file.ts",
            code: `export const foo = 1;\nexport const bar = 2;`,
          },
          { fileName: "file2.ts", code: `import { foo } from "./file.ts";` },
        ],
        errors: [
          {
            fileName: "file.ts",
            message: messages.unusedNamedExport,
            line: 2,
          },
        ],
      },
      {
        files: [
          {
            fileName: "file.ts",
            code: `export const foo = 1;\nconst bar = 2; export default bar;`,
          },
          { fileName: "file2.ts", code: `import { foo } from "./file.ts";` },
        ],
        errors: [
          {
            fileName: "file.ts",
            message: messages.unusedDefaultExport,
            line: 2,
          },
        ],
      },
      {
        files: [
          {
            fileName: "file.ts",
            code: `export const foo = 1;\nconst bar = 2; export { bar };`,
          },
          { fileName: "file2.ts", code: `import { foo } from "./file.ts";` },
        ],
        errors: [
          {
            fileName: "file.ts",
            message: messages.unusedNamedExport,
            line: 2,
          },
        ],
      },
      {
        files: [
          {
            fileName: "file.ts",
            code: `export const foo = 1;\nexport function bar() { return 2; };`,
          },
          { fileName: "file2.ts", code: `import { foo } from "./file.ts";` },
        ],
        errors: [
          {
            fileName: "file.ts",
            message: messages.unusedNamedExport,
            line: 2,
          },
        ],
      },
    ],
  });
  expect(hasError).toEqual(false);
});
