import { unionTypeParts } from "ts-api-utils";
import ts, { SyntaxKind, TypeFlags } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import { typeHasFlag } from "../types-utils.ts";
import type { AST, Context, Suggestion } from "../types.ts";
import { getContextualType, isConstAssertion } from "./_utils";

const messages = {
  contextuallyUnnecessary:
    "This assertion is unnecessary since the receiver accepts the original type of the expression.",
  unnecessaryAssertion:
    "This assertion is unnecessary since it does not change the type of the expression.",
  removeAssertion: "Remove the type assertion",
};

type Options = { typesToIgnore?: string[] };

export const noUnnecessaryTypeAssertion = createRule(
  (options: Options = {}) => ({
    name: "core/noUnnecessaryTypeAssertion",
    visitor: {
      NonNullExpression(node, context) {
        const suggestion: Suggestion = {
          message: messages.removeAssertion,
          changes: [
            {
              start: node.expression.getEnd(),
              end: node.getEnd(),
              newText: "",
            },
          ],
        };
        if (
          node.parent.kind === SyntaxKind.BinaryExpression &&
          node.parent.operatorToken.kind === SyntaxKind.EqualsToken
        ) {
          if (node.parent.left === node) {
            context.report({
              node,
              message: messages.contextuallyUnnecessary,
              suggestions: [suggestion],
            });
          }
          // for all other = assignments we ignore non-null checks
          // this is because non-null assertions can change the type-flow of the code
          // so whilst they might be unnecessary for the assignment - they are necessary
          // for following code
          return;
        }

        const type = context.utils.getConstrainedTypeAtLocation(
          node.expression,
        );

        if (
          !typeHasFlag(
            type,
            TypeFlags.Null |
              TypeFlags.Undefined |
              TypeFlags.Void |
              TypeFlags.Unknown,
          )
        ) {
          if (
            node.expression.kind === SyntaxKind.Identifier &&
            isPossiblyUsedBeforeAssigned(node.expression, context)
          ) {
            return;
          }

          context.report({
            node,
            message: messages.unnecessaryAssertion,
            suggestions: [suggestion],
          });
        } else {
          // we know it's a nullable type
          // so figure out if the variable is used in a place that accepts nullable types

          const contextualType = getContextualType(context.checker, node);
          if (contextualType) {
            // in strict mode you can't assign null to undefined, so we have to make sure that
            // the two types share a nullable type
            const typeIncludesUndefined = typeHasFlag(
              type,
              TypeFlags.Undefined,
            );
            const typeIncludesNull = typeHasFlag(type, TypeFlags.Null);
            const typeIncludesVoid = typeHasFlag(type, TypeFlags.Void);

            const contextualTypeIncludesUndefined = typeHasFlag(
              contextualType,
              TypeFlags.Undefined,
            );
            const contextualTypeIncludesNull = typeHasFlag(
              contextualType,
              TypeFlags.Null,
            );
            const contextualTypeIncludesVoid = typeHasFlag(
              contextualType,
              TypeFlags.Void,
            );

            // make sure that the parent accepts the same types
            // i.e. assigning `string | null | undefined` to `string | undefined` is invalid
            const isValidUndefined = typeIncludesUndefined
              ? contextualTypeIncludesUndefined
              : true;
            const isValidNull = typeIncludesNull
              ? contextualTypeIncludesNull
              : true;
            const isValidVoid = typeIncludesVoid
              ? contextualTypeIncludesVoid
              : true;

            if (isValidUndefined && isValidNull && isValidVoid) {
              context.report({
                node,
                message: messages.contextuallyUnnecessary,
                suggestions: [suggestion],
              });
            }
          }
        }
      },
      AsExpression(node, context) {
        checkAssertion(node, context, options);
      },
      TypeAssertionExpression(node, context) {
        checkAssertion(node, context, options);
      },
    },
  }),
);

function checkAssertion(
  node: AST.AsExpression | AST.TypeAssertion,
  context: Context,
  options: Options,
) {
  if (options.typesToIgnore?.includes(node.type.getText())) {
    return;
  }

  const castType = context.checker.getTypeAtLocation(node);
  const uncastType = context.checker.getTypeAtLocation(node.expression);
  const typeIsUnchanged = isTypeUnchanged(uncastType, castType, context);

  const wouldSameTypeBeInferred = castType.isLiteral()
    ? isImplicitlyNarrowedConstDeclaration(node)
    : !isConstAssertion(node.type);

  if (typeIsUnchanged && wouldSameTypeBeInferred) {
    context.report({
      node,
      message: messages.unnecessaryAssertion,
      suggestions: [
        {
          message: messages.removeAssertion,
          changes: [
            node.kind === SyntaxKind.AsExpression
              ? {
                  start: node.type.getFullStart() - 3, // " as"
                  end: node.getEnd(),
                  newText: "",
                }
              : {
                  start: node.getStart(),
                  end: node.expression.getFullStart(),
                  newText: "",
                },
          ],
        },
      ],
    });
  }

  // TODO - add contextually unnecessary check for this
}

/**
 * Returns true if there's a chance the variable has been used before a value has been assigned to it
 */
function isPossiblyUsedBeforeAssigned(
  node: AST.Expression,
  context: Context,
): boolean {
  const symbol = context.checker.getSymbolAtLocation(node);
  const tsDecl = symbol?.getDeclarations()?.at(0) ?? null;
  if (!tsDecl) {
    // don't know what the declaration is for some reason, so just assume the worst
    return true;
  }
  const declaration =
    tsDecl.kind === SyntaxKind.VariableDeclaration
      ? (tsDecl as unknown as AST.VariableDeclaration)
      : undefined;

  if (!declaration) return false;

  if (
    declaration.parent.kind === SyntaxKind.VariableDeclarationList &&
    declaration.parent.getText().startsWith("var ")
  ) {
    // var can be declared in a different scope to the assignment, just assume the worst
    // for default library files, we know it's always assigned
    return !context.program.isSourceFileDefaultLibrary(tsDecl.getSourceFile());
  }

  if (
    // is it `const x!: number`
    declaration.initializer === undefined &&
    declaration.exclamationToken === undefined &&
    declaration.type !== undefined
  ) {
    // check if the defined variable type has changed since assignment
    const declarationType = context.checker.getTypeFromTypeNode(
      declaration.type,
    );
    const type = context.utils.getConstrainedTypeAtLocation(node);
    if (
      declarationType === type &&
      // `declare`s are never narrowed, so never skip them
      !(
        declaration.parent.kind === SyntaxKind.VariableDeclarationList &&
        declaration.parent.parent.kind === SyntaxKind.VariableStatement &&
        declaration.parent.parent.modifiers?.some(
          (it) => it.kind === SyntaxKind.DeclareKeyword,
        )
      )
    ) {
      // possibly used before assigned, so just skip it
      // better to false negative and skip it, than false positive and fix to compile erroring code
      //
      // no better way to figure this out right now
      // https://github.com/Microsoft/TypeScript/issues/31124
      return true;
    }
  }
  return false;
}

function isImplicitlyNarrowedConstDeclaration(
  node: AST.AsExpression | AST.TypeAssertion,
): boolean {
  if (node.expression.kind === SyntaxKind.TemplateExpression) {
    // Even on `const` variable declarations, template literals with expressions can sometimes be widened without a type assertion.
    // https://github.com/typescript-eslint/typescript-eslint/issues/8737
    return false;
  }
  if (node.parent.parent.kind !== SyntaxKind.VariableDeclarationList) {
    return false;
  }
  return node.parent.parent.getText().startsWith("const ");
}

function isTypeUnchanged(
  uncast: ts.Type,
  cast: ts.Type,
  context: Context,
): boolean {
  if (uncast === cast) {
    return true;
  }

  if (
    typeHasFlag(uncast, TypeFlags.Undefined) &&
    typeHasFlag(cast, TypeFlags.Undefined) &&
    context.compilerOptions.exactOptionalPropertyTypes
  ) {
    const uncastParts = unionTypeParts(uncast).filter(
      (part) => !typeHasFlag(part, TypeFlags.Undefined),
    );

    const castParts = unionTypeParts(cast).filter(
      (part) => !typeHasFlag(part, TypeFlags.Undefined),
    );

    if (uncastParts.length !== castParts.length) {
      return false;
    }

    const uncastPartsSet = new Set(uncastParts);
    return castParts.every((part) => uncastPartsSet.has(part));
  }

  return false;
}

export const test = () =>
  ruleTester({
    ruleFn: noUnnecessaryTypeAssertion,
    valid: [
      `
import { TSESTree } from '@typescript-eslint/utils';
declare const member: TSESTree.TSEnumMember;
if (
  member.id.type === AST_NODE_TYPES.Literal &&
  typeof member.id.value === 'string'
) {
  const name = member.id as TSESTree.StringLiteral;
}
    `,
      `
      const c = 1;
      let z = c as number;
    `,
      `
      const c = 1;
      let z = c as const;
    `,
      `
      const c = 1;
      let z = c as 1;
    `,
      `
      type Bar = 'bar';
      const data = {
        x: 'foo' as 'foo',
        y: 'bar' as Bar,
      };
    `,
      "[1, 2, 3, 4, 5].map(x => [x, 'A' + x] as [number, string]);",
      `
      let x: Array<[number, string]> = [1, 2, 3, 4, 5].map(
        x => [x, 'A' + x] as [number, string],
      );
    `,
      "let y = 1 as 1;",
      "const foo = 3 as number;",
      "const foo = <number>3;",
      `
type Tuple = [3, 'hi', 'bye'];
const foo = [3, 'hi', 'bye'] as Tuple;
    `,
      `
type PossibleTuple = {};
const foo = {} as PossibleTuple;
    `,
      `
type PossibleTuple = { hello: 'hello' };
const foo = { hello: 'hello' } as PossibleTuple;
    `,
      `
type PossibleTuple = { 0: 'hello'; 5: 'hello' };
const foo = { 0: 'hello', 5: 'hello' } as PossibleTuple;
    `,
      `
let bar: number | undefined = x;
let foo: number = bar!;
    `,
      `
declare const a: { data?: unknown };

const x = a.data!;
    `,
      `
declare function foo(arg?: number): number | void;
const bar: number = foo()!;
    `,
      {
        options: { typesToIgnore: ["Foo"] },
        code: `
type Foo = number;
const foo = (3 + 5) as Foo;
      `,
      },
      {
        options: { typesToIgnore: ["any"] },
        code: "const foo = (3 + 5) as any;",
      },
      {
        options: { typesToIgnore: ["any"] },
        code: "(Syntax as any).ArrayExpression = 'foo';",
      },
      {
        options: { typesToIgnore: ["string"] },
        code: "const foo = (3 + 5) as string;",
      },
      {
        options: { typesToIgnore: ["Foo"] },
        code: `
type Foo = number;
const foo = <Foo>(3 + 5);
      `,
      }, // https://github.com/typescript-eslint/typescript-eslint/issues/453
      // the ol' use-before-assign-is-okay-trust-me assertion
      `
let bar: number;
bar! + 1;
    `,
      `
let bar: undefined | number;
bar! + 1;
    `,
      `
let bar: number, baz: number;
bar! + 1;
    `,
      `
function foo<T extends string | undefined>(bar: T) {
  return bar!;
}
    `,
      `
declare function nonNull(s: string);
let s: string | null = null;
nonNull(s!);
    `,
      `
const x: number | null = null;
const y: number = x!;
    `,
      `
const x: number | null = null;
class Foo {
  prop: number = x!;
}
    `,
      `
      declare const y: number | null;
      console.log(y!);
    `, // https://github.com/typescript-eslint/typescript-eslint/issues/529
      `
declare function foo(str?: string): void;
declare const str: string | null;

foo(str!);
    `, // https://github.com/typescript-eslint/typescript-eslint/issues/532
      `
declare function a(a: string): any;
declare const b: string | null;
class Mx {
  @a(b!)
  private prop = 1;
}
    `, // https://github.com/typescript-eslint/typescript-eslint/issues/1199
      `
function testFunction(_param: string | undefined): void {
  /* noop */
}
const value = 'test' as string | null | undefined;
testFunction(value!);
    `,
      `
function testFunction(_param: string | null): void {
  /* noop */
}
const value = 'test' as string | null | undefined;
testFunction(value!);
    `,
      {
        tsx: true,
        code: `
function Child(props: { id?: string | number }) {
  return id;
}

function Test(props: { id?: null | string | number }) {
  return <Child id={props.id!} />;
}
      `,
      },
      {
        code: `
const a = [1, 2];
const b = [3, 4];
const c = [...a, ...b] as const;
      `,
      },
      { code: "const a = [1, 2] as const;" },
      { code: "const a = { foo: 'foo' } as const;" },
      {
        code: `
const a = [1, 2];
const b = [3, 4];
const c = <const>[...a, ...b];
      `,
      },
      { code: "const a = <const>[1, 2];" },
      { code: "const a = <const>{ foo: 'foo' };" },
      {
        code: `
let a: number | undefined;
let b: number | undefined;
let c: number;
a = b;
c = b!;
a! -= 1;
      `,
      },
      {
        code: `
let a: { b?: string } | undefined;
a!.b = '';
      `,
      },
      `
let value: number | undefined;
let values: number[] = [];

value = values.pop()!;
    `,
      `
declare function foo(): number | undefined;
const a = foo()!;
    `,
      `
declare function foo(): number | undefined;
const a = foo() as number;
    `,
      `
declare function foo(): number | undefined;
const a = <number>foo();
    `,
      `
declare const arr: (object | undefined)[];
const item = arr[0]!;
    `,
      `
declare const arr: (object | undefined)[];
const item = arr[0] as object;
    `,
      `
declare const arr: (object | undefined)[];
const item = <object>arr[0];
    `,
      {
        compilerOptions: { noUncheckedIndexedAccess: true },
        code: `
function foo(item: string) {}
function bar(items: string[]) {
  for (let i = 0; i < items.length; i++) {
    foo(items[i]!);
  }
}
      `,
      },
      // https://github.com/typescript-eslint/typescript-eslint/issues/8737
      `
let myString = 'foo';
const templateLiteral = \`\${myString}-somethingElse\` as const;
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/8737
      `
let myString = 'foo';
const templateLiteral = <const>\`\${myString}-somethingElse\`;
    `,
      "let a = `a` as const;",
      {
        compilerOptions: { exactOptionalPropertyTypes: true },
        code: `
declare const foo: {
  a?: string;
};
const bar = foo.a as string;
      `,
      },
      {
        compilerOptions: { exactOptionalPropertyTypes: true },
        code: `
declare const foo: {
  a?: string | undefined;
};
const bar = foo.a as string;
      `,
      },
      {
        compilerOptions: { exactOptionalPropertyTypes: true },
        code: `
declare const foo: {
  a: string;
};
const bar = foo.a as string | undefined;
      `,
      },
      {
        compilerOptions: { exactOptionalPropertyTypes: true },
        code: `
declare const foo: {
  a?: string | null | number;
};
const bar = foo.a as string | undefined;
      `,
      },
      {
        compilerOptions: { exactOptionalPropertyTypes: true },
        code: `
declare const foo: {
  a?: string | number;
};
const bar = foo.a as string | undefined | bigint;
      `,
      },
      {
        code: `
if (Math.random()) {
  {
    var x = 1;
  }
}
x!;
      `,
      },
    ],
    invalid: [
      // https://github.com/typescript-eslint/typescript-eslint/issues/8737
      {
        code: "const a = `a` as const;",
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 1,
            suggestions: [
              { message: messages.removeAssertion, output: "const a = `a`;" },
            ],
          },
        ],
      },
      {
        code: "const a = 'a' as const;",
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 1,
            suggestions: [
              { message: messages.removeAssertion, output: "const a = 'a';" },
            ],
          },
        ],
      },
      {
        code: "const a = <const>'a';",
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 1,
            suggestions: [
              { message: messages.removeAssertion, output: "const a = 'a';" },
            ],
          },
        ],
      },
      {
        code: "const foo = <3>3;",
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 1,
            column: 13,
            suggestions: [
              { message: messages.removeAssertion, output: "const foo = 3;" },
            ],
          },
        ],
      },
      {
        code: "const foo = 3 as 3;",
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 1,
            column: 13,
            suggestions: [
              { message: messages.removeAssertion, output: "const foo = 3;" },
            ],
          },
        ],
      },
      {
        code: `
        type Foo = 3;
        const foo = <Foo>3;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 3,
            column: 21,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
        type Foo = 3;
        const foo = 3;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        type Foo = 3;
        const foo = 3 as Foo;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 3,
            column: 21,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
        type Foo = 3;
        const foo = 3;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const foo = 3;
const bar = foo!;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 3,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const foo = 3;
const bar = foo;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const foo = (3 + 5) as number;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 2,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const foo = (3 + 5);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const foo = <number>(3 + 5);
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 2,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const foo = (3 + 5);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Foo = number;
const foo = (3 + 5) as Foo;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 3,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
type Foo = number;
const foo = (3 + 5);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type Foo = number;
const foo = <Foo>(3 + 5);
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 3,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
type Foo = number;
const foo = (3 + 5);
      `,
              },
            ],
          },
        ],
      }, // https://github.com/typescript-eslint/typescript-eslint/issues/453
      {
        code: `
let bar: number = 1;
bar! + 1;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 3,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
let bar: number = 1;
bar + 1;
      `,
              },
            ],
          },
        ],
      },
      {
        // definite declaration operator
        code: `
let bar!: number;
bar! + 1;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 3,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
let bar!: number;
bar + 1;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
let bar: number | undefined;
bar = 1;
bar! + 1;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 4,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
let bar: number | undefined;
bar = 1;
bar + 1;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
        declare const y: number;
        console.log(y!);
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
        declare const y: number;
        console.log(y);
      `,
              },
            ],
          },
        ],
      },
      {
        code: "Proxy!;",
        errors: [
          {
            message: messages.unnecessaryAssertion,
            suggestions: [
              { message: messages.removeAssertion, output: "Proxy;" },
            ],
          },
        ],
      },
      {
        code: `
function foo<T extends string>(bar: T) {
  return bar!;
}
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 3,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
function foo<T extends string>(bar: T) {
  return bar;
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const foo: Foo;
const bar = <Foo>foo;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 3,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
declare const foo: Foo;
const bar = foo;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare function nonNull(s: string | null);
let s: string | null = null;
nonNull(s!);
      `,
        errors: [
          {
            message: messages.contextuallyUnnecessary,
            line: 4,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
declare function nonNull(s: string | null);
let s: string | null = null;
nonNull(s);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const x: number | null = null;
const y: number | null = x!;
      `,
        errors: [
          {
            message: messages.contextuallyUnnecessary,
            line: 3,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const x: number | null = null;
const y: number | null = x;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const x: number | null = null;
class Foo {
  prop: number | null = x!;
}
      `,
        errors: [
          {
            message: messages.contextuallyUnnecessary,
            line: 4,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const x: number | null = null;
class Foo {
  prop: number | null = x;
}
      `,
              },
            ],
          },
        ],
      }, // https://github.com/typescript-eslint/typescript-eslint/issues/532
      {
        code: `
declare function a(a: string): any;
const b = 'asdf';
class Mx {
  @a(b!)
  private prop = 1;
}
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 5,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
declare function a(a: string): any;
const b = 'asdf';
class Mx {
  @a(b)
  private prop = 1;
}
      `,
              },
            ],
          },
        ],
      }, // https://github.com/typescript-eslint/typescript-eslint/issues/982
      {
        tsx: true,
        code: `
declare namespace JSX {
  interface IntrinsicElements {
    div: { key?: string | number };
  }
}

function Test(props: { id?: string | number }) {
  return <div key={props.id!} />;
}
      `,
        errors: [
          {
            message: messages.contextuallyUnnecessary,
            line: 9,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
declare namespace JSX {
  interface IntrinsicElements {
    div: { key?: string | number };
  }
}

function Test(props: { id?: string | number }) {
  return <div key={props.id} />;
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
let x: number | undefined;
let y: number | undefined;
y = x!;
y! = 0;
      `,
        errors: [
          {
            message: messages.contextuallyUnnecessary,
            line: 5,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
let x: number | undefined;
let y: number | undefined;
y = x!;
y = 0;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare function foo(arg?: number): number | void;
const bar: number | void = foo()!;
      `,
        errors: [
          {
            message: messages.contextuallyUnnecessary,
            line: 3,
            column: 28,
            endColumn: 34,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
declare function foo(arg?: number): number | void;
const bar: number | void = foo();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare function foo(): number;
const a = foo()!;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 3,
            column: 11,
            endColumn: 17,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
declare function foo(): number;
const a = foo();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const b = new Date()!;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 2,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const b = new Date();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const b = (1 + 1)!;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 2,
            column: 11,
            endColumn: 19,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const b = (1 + 1);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare function foo(): number;
const a = foo() as number;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 3,
            column: 11,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
declare function foo(): number;
const a = foo();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare function foo(): number;
const a = <number>foo();
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 3,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
declare function foo(): number;
const a = foo();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type RT = { log: () => void };
declare function foo(): RT;
(foo() as RT).log;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
type RT = { log: () => void };
declare function foo(): RT;
(foo()).log;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const arr: object[];
const item = arr[0]!;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
declare const arr: object[];
const item = arr[0];
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const foo = (  3 + 5  ) as number;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 2,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const foo = (  3 + 5  );
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const foo = (  3 + 5  ) /*as*/ as number;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 2,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const foo = (  3 + 5  ) /*as*/;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const foo = (  3 + 5
  ) /*as*/ as //as
  (
    number
  );
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 2,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const foo = (  3 + 5
  ) /*as*/;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const foo = (3 + (5 as number) ) as number;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 2,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const foo = (3 + (5 as number) );
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const foo = 3 + 5/*as*/ as number;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 2,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const foo = 3 + 5/*as*/;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const foo = 3 + 5/*a*/ /*b*/ as number;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 2,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const foo = 3 + 5/*a*/ /*b*/;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const foo = <(number)>(3 + 5);
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 2,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const foo = (3 + 5);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const foo = < ( number ) >( 3 + 5 );
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 2,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const foo = ( 3 + 5 );
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const foo = <number> /* a */ (3 + 5);
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 2,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const foo =  /* a */ (3 + 5);
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const foo = <number /* a */>(3 + 5);
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 2,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const foo = (3 + 5);
      `,
              },
            ],
          },
        ],
      }, // onUncheckedIndexedAccess = false
      {
        code: `
function foo(item: string) {}
function bar(items: string[]) {
  for (let i = 0; i < items.length; i++) {
    foo(items[i]!);
  }
}
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 5,
            column: 9,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
function foo(item: string) {}
function bar(items: string[]) {
  for (let i = 0; i < items.length; i++) {
    foo(items[i]);
  }
}
      `,
              },
            ],
          },
        ],
      }, // exactOptionalPropertyTypes = true
      {
        code: `
declare const foo: {
  a?: string;
};
const bar = foo.a as string | undefined;
      `,
        compilerOptions: { exactOptionalPropertyTypes: true },
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 5,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
declare const foo: {
  a?: string;
};
const bar = foo.a;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
declare const foo: {
  a?: string | undefined;
};
const bar = foo.a as string | undefined;
      `,
        compilerOptions: { exactOptionalPropertyTypes: true },
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 5,
            column: 13,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
declare const foo: {
  a?: string | undefined;
};
const bar = foo.a;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
const a = '';
const b: string | undefined = (a ? undefined : a)!;
      `,
        errors: [
          {
            message: messages.contextuallyUnnecessary,
            suggestions: [
              {
                message: messages.removeAssertion,
                output: `
const a = '';
const b: string | undefined = (a ? undefined : a);
      `,
              },
            ],
          },
        ],
      },
    ],
  });
