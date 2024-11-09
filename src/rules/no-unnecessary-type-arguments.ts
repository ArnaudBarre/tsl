import { isIntrinsicAnyType, isSymbolFlagSet } from "ts-api-utils";
import ts, { type NodeArray, SyntaxKind } from "typescript";
import type { AnyNode, TypeNode } from "../ast.ts";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Context } from "../types.ts";

const messages = {
  unnecessaryTypeParameter:
    "This is the default value for this type parameter, so it can be omitted.",
  removeTypeArgument: "Remove the type argument",
};

type ParameterCapableNode =
  | AST.CallExpression
  | AST.ExpressionWithTypeArguments
  | AST.ImportTypeNode
  | AST.JsxOpeningElement
  | AST.JsxSelfClosingElement
  | AST.NewExpression
  | AST.TaggedTemplateExpression
  | AST.TypeQueryNode
  | AST.TypeReferenceNode;

export const noUnnecessaryTypeArguments = createRule({
  name: "no-unnecessary-type-arguments",
  visitor: {
    CallExpression: checkParameters,
    ExpressionWithTypeArguments: checkParameters,
    ImportType: checkParameters,
    JsxOpeningElement: checkParameters,
    JsxSelfClosingElement: checkParameters,
    NewExpression: checkParameters,
    TaggedTemplateExpression: checkParameters,
    TypeQuery: checkParameters,
    TypeReference: checkParameters,
  },
});

function checkParameters(node: ParameterCapableNode, context: Context) {
  const typeArguments = node.typeArguments;
  if (!typeArguments) return;
  const typeParameters = getTypeParametersFromNode(node, context);
  if (!typeParameters) return;
  checkTSArgsAndParameters(typeArguments, typeParameters, context);
}

function getTypeParametersFromNode(
  node: ParameterCapableNode,
  context: Context,
): readonly AST.TypeParameterDeclaration[] | undefined {
  if (node.kind === SyntaxKind.ExpressionWithTypeArguments) {
    return getTypeParametersFromType(node.expression, context);
  }

  if (node.kind === SyntaxKind.TypeReference) {
    return getTypeParametersFromType(node.typeName, context);
  }

  if (
    node.kind === SyntaxKind.CallExpression ||
    node.kind === SyntaxKind.NewExpression ||
    node.kind === SyntaxKind.TaggedTemplateExpression
  ) {
    return getTypeParametersFromCall(node, context);
  }

  return undefined;
}

function checkTSArgsAndParameters(
  typeArguments: NodeArray<TypeNode>,
  typeParameters: readonly AST.TypeParameterDeclaration[],
  context: Context,
): void {
  // Just check the last one. Must specify previous type parameters if the last one is specified.
  const i = typeArguments.length - 1;
  const arg = typeArguments[i];
  const param = typeParameters.at(i);
  if (!param?.default) return;

  const defaultType = context.checker.getTypeAtLocation(param.default);
  const argType = context.checker.getTypeAtLocation(arg);
  const isDefaultAny = isIntrinsicAnyType(defaultType);
  const isArgAny = isIntrinsicAnyType(argType);

  if ((isDefaultAny || isArgAny) && !(isDefaultAny && isArgAny)) {
    return;
  }
  if (
    context.checker.isTypeAssignableTo(argType, defaultType) &&
    context.checker.isTypeAssignableTo(defaultType, argType)
  ) {
    context.report({
      node: arg,
      message: messages.unnecessaryTypeParameter,
      suggestions: [
        {
          message: messages.removeTypeArgument,
          changes: [
            {
              // Remove the preceding comma or angle bracket
              start: arg.getFullStart() - 1,
              // If only one type argument, remove the closing angle bracket
              end: i === 0 ? arg.getEnd() + 1 : arg.getEnd(),
              newText: "",
            },
          ],
        },
      ],
    });
  }
}

function getTypeParametersFromType(
  type: AST.ClassDeclaration | AST.EntityName | AST.Expression,
  context: Context,
): readonly AST.TypeParameterDeclaration[] | undefined {
  const symAtLocation = context.checker.getSymbolAtLocation(type);
  if (!symAtLocation) return;

  const sym = getAliasedSymbol(symAtLocation, context);
  const declarations = sym.getDeclarations() as AnyNode[] | undefined;

  if (!declarations) return;

  for (const decl of declarations) {
    if (
      decl.kind === SyntaxKind.TypeAliasDeclaration ||
      decl.kind === SyntaxKind.InterfaceDeclaration ||
      decl.kind === SyntaxKind.ClassDeclaration ||
      decl.kind === SyntaxKind.ClassExpression
    ) {
      return decl.typeParameters;
    }
  }
}

function getTypeParametersFromCall(
  node: AST.CallExpression | AST.NewExpression | AST.TaggedTemplateExpression,
  context: Context,
): readonly AST.TypeParameterDeclaration[] | undefined {
  const sig = context.checker.getResolvedSignature(node);
  const sigDecl = sig?.getDeclaration();
  if (!sigDecl) {
    return ts.isNewExpression(node)
      ? getTypeParametersFromType(node.expression, context)
      : undefined;
  }

  return sigDecl.typeParameters as AST.TypeParameterDeclaration[] | undefined;
}

function getAliasedSymbol(symbol: ts.Symbol, context: Context): ts.Symbol {
  return isSymbolFlagSet(symbol, ts.SymbolFlags.Alias)
    ? context.checker.getAliasedSymbol(symbol)
    : symbol;
}

export const test = () =>
  ruleTester({
    rule: noUnnecessaryTypeArguments,
    valid: [
      "f<>();",
      "f<string>();",
      "expect().toBe<>();",
      "class Foo extends Bar<> {}",
      "class Foo extends Bar<string> {}",
      "class Foo implements Bar<> {}",
      "class Foo implements Bar<string> {}",
      `
function f<T = number>() {}
f();
    `,
      `
function f<T = number>() {}
f<string>();
    `,
      `
declare const f: (<T = number>() => void) | null;
f?.();
    `,
      `
declare const f: (<T = number>() => void) | null;
f?.<string>();
    `,
      `
declare const f: any;
f();
    `,
      `
declare const f: any;
f<string>();
    `,
      `
declare const f: unknown;
f();
    `,
      `
declare const f: unknown;
f<string>();
    `,
      `
function g<T = number, U = string>() {}
g<number, number>();
    `,
      `
declare const g: any;
g<string, string>();
    `,
      `
declare const g: unknown;
g<string, string>();
    `,
      `
declare const f: unknown;
f<string>\`\`;
    `,
      `
function f<T = number>(template: TemplateStringsArray) {}
f<string>\`\`;
    `,
      `
class C<T = number> {}
new C<string>();
    `,
      `
declare const C: any;
new C<string>();
    `,
      `
declare const C: unknown;
new C<string>();
    `,
      `
class C<T = number> {}
class D extends C<string> {}
    `,
      `
declare const C: any;
class D extends C<string> {}
    `,
      `
declare const C: unknown;
class D extends C<string> {}
    `,
      `
interface I<T = number> {}
class Impl implements I<string> {}
    `,
      `
class C<TC = number> {}
class D<TD = number> extends C {}
    `,
      `
declare const C: any;
class D<TD = number> extends C {}
    `,
      `
declare const C: unknown;
class D<TD = number> extends C {}
    `,
      "let a: A<number>;",
      `
class Foo<T> {}
const foo = new Foo<number>();
    `,
      "type Foo<T> = import('foo').Foo<T>;",
      `
class Bar<T = number> {}
class Foo<T = number> extends Bar<T> {}
    `,
      `
interface Bar<T = number> {}
class Foo<T = number> implements Bar<T> {}
    `,
      `
class Bar<T = number> {}
class Foo<T = number> extends Bar<string> {}
    `,
      `
interface Bar<T = number> {}
class Foo<T = number> implements Bar<string> {}
    `,
      `
type A<T = Element> = T;
type B = A<HTMLInputElement>;
    `,
      `
type A<T = Map<string, string>> = T;
type B = A<Map<string, number>>;
    `,
      `
type A = Map<string, string>;
type B<T = A> = T;
type C2 = B<Map<string, number>>;
    `,
    ],
    invalid: [
      {
        code: `
function f<T = number>() {}
f<number>();
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            column: 3,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
function f<T = number>() {}
f();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
function g<T = number, U = string>() {}
g<string, string>();
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            column: 11,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
function g<T = number, U = string>() {}
g<string>();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
function f<T = number>(templates: TemplateStringsArray, arg: T) {}
f<number>\`\${1}\`;
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            column: 3,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
function f<T = number>(templates: TemplateStringsArray, arg: T) {}
f\`\${1}\`;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class C<T = number> {}
function h(c: C<number>) {}
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
class C<T = number> {}
function h(c: C) {}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class C<T = number> {}
new C<number>();
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
class C<T = number> {}
new C();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class C<T = number> {}
class D extends C<number> {}
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
class C<T = number> {}
class D extends C {}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
interface I<T = number> {}
class Impl implements I<number> {}
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
interface I<T = number> {}
class Impl implements I {}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class Foo<T = number> {}
const foo = new Foo<number>();
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
class Foo<T = number> {}
const foo = new Foo();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
interface Bar<T = string> {}
class Foo<T = number> implements Bar<string> {}
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
interface Bar<T = string> {}
class Foo<T = number> implements Bar {}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
class Bar<T = string> {}
class Foo<T = number> extends Bar<string> {}
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
class Bar<T = string> {}
class Foo<T = number> extends Bar {}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
import { F } from './missing';
function bar<T = F<string>>() {}
bar<F<string>>();
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 4,
            column: 5,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
import { F } from './missing';
function bar<T = F<string>>() {}
bar();
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type DefaultE = { foo: string };
type T<E = DefaultE> = { box: E };
type G = T<DefaultE>;
declare module 'bar' {
  type DefaultE = { somethingElse: true };
  type G = T<DefaultE>;
}
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 4,
            column: 12,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
type DefaultE = { foo: string };
type T<E = DefaultE> = { box: E };
type G = T;
declare module 'bar' {
  type DefaultE = { somethingElse: true };
  type G = T<DefaultE>;
}
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type A<T = Map<string, string>> = T;
type B = A<Map<string, string>>;
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 3,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
type A<T = Map<string, string>> = T;
type B = A;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type A = Map<string, string>;
type B<T = A> = T;
type C = B<A>;
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 4,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
type A = Map<string, string>;
type B<T = A> = T;
type C = B;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type A = Map<string, string>;
type B<T = A> = T;
type C = B<Map<string, string>>;
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 4,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
type A = Map<string, string>;
type B<T = A> = T;
type C = B;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type A = Map<string, string>;
type B = Map<string, string>;
type C<T = A> = T;
type D = C<B>;
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 5,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
type A = Map<string, string>;
type B = Map<string, string>;
type C<T = A> = T;
type D = C;
      `,
              },
            ],
          },
        ],
      },
      {
        code: `
type A = Map<string, string>;
type B = A;
type C = Map<string, string>;
type D = C;
type E<T = B> = T;
type F = E<D>;
      `,
        errors: [
          {
            message: messages.unnecessaryTypeParameter,
            line: 7,
            suggestions: [
              {
                message: messages.removeTypeArgument,

                output: `
type A = Map<string, string>;
type B = A;
type C = Map<string, string>;
type D = C;
type E<T = B> = T;
type F = E;
      `,
              },
            ],
          },
        ],
      },
    ],
  });
