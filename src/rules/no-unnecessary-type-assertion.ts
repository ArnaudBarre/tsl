import { isObjectFlagSet, isObjectType, isTypeFlagSet } from "ts-api-utils";
import ts, { SyntaxKind, TypeFlags } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import { typeHasFlag } from "../types-utils.ts";
import type { AST, Checker, Infer } from "../types.ts";

const messages = {
  unnecessaryAssertion:
    "This assertion is unnecessary since it does not change the type of the expression.",
  contextuallyUnnecessary:
    "This assertion is unnecessary since the receiver accepts the original type of the expression.",
};

type Context = Infer<typeof noUnnecessaryTypeAssertion>["Context"];
export const noUnnecessaryTypeAssertion = createRule({
  name: "no-unnecessary-type-assertion",
  parseOptions: (options?: { typesToIgnore?: string[] }) => ({ ...options }),
  visitor: {
    NonNullExpression(node, context) {
      if (
        node.parent.kind === SyntaxKind.BinaryExpression &&
        node.parent.operatorToken.kind === SyntaxKind.EqualsToken
      ) {
        if (node.parent.left === node) {
          context.report({
            node,
            message: messages.contextuallyUnnecessary,
          });
        }
        // for all other = assignments we ignore non-null checks
        // this is because non-null assertions can change the type-flow of the code
        // so whilst they might be unnecessary for the assignment - they are necessary
        // for following code
        return;
      }

      const type = context.utils.getConstrainedTypeAtLocation(node.expression);
      if (!typeHasFlag(type, TypeFlags.Null | TypeFlags.Undefined)) {
        if (isPossiblyUsedBeforeAssigned(node.expression, context)) {
          return;
        }

        context.report({ node, message: messages.unnecessaryAssertion });
      } else {
        // we know it's a nullable type
        // so figure out if the variable is used in a place that accepts nullable types

        const contextualType = getContextualType(context.checker, node);
        if (contextualType) {
          // in strict mode you can't assign null to undefined, so we have to make sure that
          // the two types share a nullable type
          const typeIncludesUndefined = typeHasFlag(type, TypeFlags.Undefined);
          const typeIncludesNull = typeHasFlag(type, TypeFlags.Null);

          const contextualTypeIncludesUndefined = typeHasFlag(
            contextualType,
            TypeFlags.Undefined,
          );
          const contextualTypeIncludesNull = typeHasFlag(
            contextualType,
            TypeFlags.Null,
          );

          // make sure that the parent accepts the same types
          // i.e. assigning `string | null | undefined` to `string | undefined` is invalid
          const isValidUndefined = typeIncludesUndefined
            ? contextualTypeIncludesUndefined
            : true;
          const isValidNull = typeIncludesNull
            ? contextualTypeIncludesNull
            : true;

          if (isValidUndefined && isValidNull) {
            context.report({
              node,
              message: messages.contextuallyUnnecessary,
            });
          }
        }
      }
    },
    AsExpression(node, context) {
      checkAssertion(node, context);
    },
    TypeAssertionExpression(node, context) {
      checkAssertion(node, context);
    },
  },
});

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
    if (declarationType === type) {
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

const checkAssertion = (
  node: AST.AsExpression | AST.TypeAssertion,
  context: Context,
) => {
  if (
    context.options.typesToIgnore?.includes(node.type.getText()) ||
    isConstAssertion(node.type)
  ) {
    return;
  }

  const castType = context.checker.getTypeAtLocation(node);

  if (
    isTypeFlagSet(castType, TypeFlags.Literal) ||
    (isObjectType(castType) &&
      (isObjectFlagSet(castType, ts.ObjectFlags.Tuple) ||
        couldBeTupleType(castType)))
  ) {
    // It's not always safe to remove a cast to a literal type or tuple
    // type, as those types are sometimes widened without the cast.
    return;
  }

  const uncastType = context.checker.getTypeAtLocation(node.expression);

  if (uncastType === castType) {
    context.report({
      node,
      message: messages.unnecessaryAssertion,
    });
  }

  // TODO - add contextually unnecessary check for this
};

/**
 * Sometimes tuple types don't have ObjectFlags.Tuple set, like when they're being matched against an inferred type.
 * So, in addition, check if there are integer properties 0..n and no other numeric keys
 */
function couldBeTupleType(type: ts.ObjectType): boolean {
  const properties = type.getProperties();

  if (properties.length === 0) {
    return false;
  }
  let i = 0;

  for (; i < properties.length; ++i) {
    const name = properties[i].name;

    if (String(i) !== name) {
      if (i === 0) {
        // if there are no integer properties, this is not a tuple
        return false;
      }
      break;
    }
  }
  for (; i < properties.length; ++i) {
    if (String(+properties[i].name) === properties[i].name) {
      return false; // if there are any other numeric properties, this is not a tuple
    }
  }
  return true;
}

function isConstAssertion(node: AST.TypeNode): boolean {
  return (
    node.kind === SyntaxKind.TypeReference &&
    node.typeName.kind === SyntaxKind.Identifier &&
    node.typeName.text === "const"
  );
}

/**
 * Returns the contextual type of a given node.
 * Contextual type is the type of the target the node is going into.
 * i.e. the type of a called function's parameter, or the defined type of a variable declaration
 */
export function getContextualType(
  checker: Checker,
  node: AST.Expression,
): ts.Type | undefined {
  const parent = node.parent;

  if (
    parent.kind === SyntaxKind.CallExpression ||
    parent.kind === SyntaxKind.NewExpression
  ) {
    if (node === parent.expression) {
      // is the callee, so has no contextual type
      return;
    }
  } else if (
    parent.kind === SyntaxKind.VariableDeclaration ||
    parent.kind === SyntaxKind.PropertyDeclaration ||
    parent.kind === SyntaxKind.Parameter
  ) {
    return parent.type ? checker.getTypeFromTypeNode(parent.type) : undefined;
  } else if (parent.kind === SyntaxKind.JsxExpression) {
    return checker.getContextualType(parent);
  } else if (
    parent.kind === SyntaxKind.PropertyAssignment &&
    node.kind === SyntaxKind.Identifier
  ) {
    return checker.getContextualType(node);
  } else if (
    parent.kind === SyntaxKind.BinaryExpression &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    parent.right === node
  ) {
    // is RHS of assignment
    return checker.getTypeAtLocation(parent.left);
  } else if (
    ![ts.SyntaxKind.TemplateSpan, ts.SyntaxKind.JsxExpression].includes(
      parent.kind,
    )
  ) {
    // parent is not something we know we can get the contextual type of
    return;
  }
  // TODO - support return statement checking

  return checker.getContextualType(node);
}

export const test = () =>
  ruleTester({
    rule: noUnnecessaryTypeAssertion,
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
      "const foo = 3 as number;",
      "const foo = <number>3;",
      "const foo = <3>3;",
      "const foo = 3 as 3;",
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
      {
        code: `
type Foo = number;
const foo = (3 + 5) as Foo;
      `,
        options: {
          typesToIgnore: ["Foo"],
        },
      },
      {
        code: "const foo = (3 + 5) as any;",
        options: {
          typesToIgnore: ["any"],
        },
      },
      {
        code: "(Syntax as any).ArrayExpression = 'foo';",
        options: {
          typesToIgnore: ["any"],
        },
      },
      {
        code: "const foo = (3 + 5) as string;",
        options: {
          typesToIgnore: ["string"],
        },
      },
      {
        code: `
type Foo = number;
const foo = <Foo>(3 + 5);
      `,
        options: {
          typesToIgnore: ["Foo"],
        },
      },
      // https://github.com/typescript-eslint/typescript-eslint/issues/453
      // the ol' use-before-assign-is-okay-trust-me assertion
      `
let bar: number;
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
      // https://github.com/typescript-eslint/typescript-eslint/issues/529
      `
declare function foo(str?: string): void;
declare const str: string | null;

foo(str!);
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/532
      `
declare function a(a: string): any;
declare const b: string | null;
class Mx {
  @a(b!)
  private prop = 1;
}
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/1199
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
      // https://github.com/typescript-eslint/typescript-eslint/issues/982
      {
        tsx: true,
        code: `
function Test(props: { id?: null | string }) {
  return <div id={props.id!} />;
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
      {
        code: "const a = [1, 2] as const;",
      },
      {
        code: "const a = 'a' as const;",
      },
      {
        code: "const a = { foo: 'foo' } as const;",
      },
      {
        code: `
const a = [1, 2];
const b = [3, 4];
const c = <const>[...a, ...b];
      `,
      },
      {
        code: "const a = <const>[1, 2];",
      },
      {
        code: "const a = <const>'a';",
      },
      {
        code: "const a = <const>{ foo: 'foo' };",
      },
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
    ],
    invalid: [
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
          },
        ],
      },
      // https://github.com/typescript-eslint/typescript-eslint/issues/453
      {
        code: `
let bar: number = 1;
bar! + 1;
      `,
        errors: [
          {
            message: messages.unnecessaryAssertion,
            line: 3,
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
          },
        ],
      },
      // https://github.com/typescript-eslint/typescript-eslint/issues/532
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
          },
        ],
      },
      // https://github.com/typescript-eslint/typescript-eslint/issues/982
      {
        tsx: true,
        code: `
function Test(props: { id?: string | number }) {
  return <div key={props.id!} />;
}
      `,
        errors: [
          {
            message: messages.contextuallyUnnecessary,
            line: 9,
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
          },
        ],
      },
    ],
  });
