import { isTypeReference } from "ts-api-utils";
import ts, { SyntaxKind, TypeFlags } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import { isTypeAnyArrayType, typeHasFlag } from "../types-utils.ts";
import type { AST, Checker, Context } from "../types.ts";

const messages = {
  unsafeArgument: (params: { sender: string; receiver: string }) =>
    `Unsafe argument of type \`${params.sender}\` assigned to a parameter of type \`${params.receiver}\`.`,
  unsafeTupleSpread: (params: { sender: string; receiver: string }) =>
    `Unsafe spread of a tuple type. The argument is of type \`${params.sender}\` and is assigned to a parameter of type \`${params.receiver}\`.`,
  unsafeArraySpread: "Unsafe spread of an `any` array type.",
  unsafeSpread: "Unsafe spread of an `any` type.",
};

export const noUnsafeArgument = createRule({
  name: "no-unsafe-argument",
  visitor: {
    CallExpression(node, context) {
      checkNode(node, context);
    },
    NewExpression(node, context) {
      checkNode(node, context);
    },
  },
});

const checkNode = (
  node: AST.CallExpression | AST.NewExpression,
  context: Context,
) => {
  if (!node.arguments?.length) return;

  // ignore any-typed calls as these are caught by no-unsafe-call
  if (
    typeHasFlag(
      context.checker.getTypeAtLocation(node.expression),
      TypeFlags.Any,
    )
  ) {
    return;
  }

  const tsNode = node;
  const signature = FunctionSignature.create(context.checker, tsNode);
  if (!signature) {
    return;
  }

  for (const argument of node.arguments) {
    switch (argument.kind) {
      // spreads consume
      case SyntaxKind.SpreadElement: {
        const spreadArgType = context.checker.getTypeAtLocation(
          argument.expression,
        );

        if (typeHasFlag(spreadArgType, TypeFlags.Any)) {
          // foo(...any)
          context.report({
            node: argument,
            message: messages.unsafeSpread,
          });
        } else if (isTypeAnyArrayType(spreadArgType, context.checker)) {
          // foo(...any[])

          // TODO - we could break down the spread and compare the array type against each argument
          context.report({
            node: argument,
            message: messages.unsafeArraySpread,
          });
        } else if (context.checker.isTupleType(spreadArgType)) {
          // foo(...[tuple1, tuple2])
          const spreadTypeArguments =
            context.checker.getTypeArguments(spreadArgType);
          for (const tupleType of spreadTypeArguments) {
            const parameterType = signature.getNextParameterType();
            if (parameterType == null) {
              continue;
            }
            const result = isUnsafeAssignment(
              tupleType,
              parameterType,
              context.checker,
              // we can't pass the individual tuple members in here as this will most likely be a spread variable
              // not a spread array
              null,
            );
            if (result) {
              context.report({
                node: argument,
                message: messages.unsafeTupleSpread({
                  sender: context.checker.typeToString(tupleType),
                  receiver: context.checker.typeToString(parameterType),
                }),
              });
            }
          }
          if (spreadArgType.target.hasRestElement) {
            // the last element was a rest - so all remaining defined arguments can be considered "consumed"
            // all remaining arguments should be compared against the rest type (if one exists)
            signature.consumeRemainingArguments();
          }
        } else {
          // something that's iterable
          // handling this will be pretty complex - so we ignore it for now
          // TODO - handle generic iterable case
        }
        break;
      }
      default: {
        const parameterType = signature.getNextParameterType();
        if (parameterType == null) {
          continue;
        }

        const argumentType = context.checker.getTypeAtLocation(argument);
        const result = isUnsafeAssignment(
          argumentType,
          parameterType,
          context.checker,
          argument,
        );
        if (result) {
          context.report({
            node: argument,
            message: messages.unsafeArgument({
              sender: context.checker.typeToString(argumentType),
              receiver: context.checker.typeToString(parameterType),
            }),
          });
        }
      }
    }
  }
};

type RestType =
  | { kind: "Array"; index: number; type: ts.Type }
  | { kind: "Other"; index: number; type: ts.Type }
  | { kind: "Tuple"; index: number; typeArguments: readonly ts.Type[] };

class FunctionSignature {
  private parameterTypeIndex = 0;

  public static create(
    checker: Checker,
    node: AST.CallExpression | AST.NewExpression,
  ): FunctionSignature | null {
    const signature = checker.getResolvedSignature(node);
    if (!signature) {
      return null;
    }

    const paramTypes: ts.Type[] = [];
    let restType: RestType | null = null;

    const parameters = signature.getParameters();
    for (let i = 0; i < parameters.length; i += 1) {
      const param = parameters[i];
      const type = checker.getTypeOfSymbolAtLocation(param, node);

      const decl = param.getDeclarations()?.[0];
      if (decl && ts.isParameter(decl) && decl.dotDotDotToken) {
        // is a rest param
        if (checker.isArrayType(type)) {
          restType = {
            kind: "Array",
            index: i,
            type: checker.getTypeArguments(type)[0],
          };
        } else if (checker.isTupleType(type)) {
          restType = {
            kind: "Tuple",
            index: i,
            typeArguments: checker.getTypeArguments(type),
          };
        } else {
          restType = { kind: "Other", index: i, type };
        }
        break;
      }

      paramTypes.push(type);
    }

    return new this(paramTypes, restType);
  }

  private hasConsumedArguments = false;

  private constructor(
    private paramTypes: ts.Type[],
    private restType: RestType | null,
  ) {}

  public getNextParameterType(): ts.Type | null {
    const index = this.parameterTypeIndex;
    this.parameterTypeIndex += 1;

    if (index >= this.paramTypes.length || this.hasConsumedArguments) {
      if (this.restType == null) {
        return null;
      }

      switch (this.restType.kind) {
        case "Tuple": {
          const typeArguments = this.restType.typeArguments;
          if (this.hasConsumedArguments) {
            // all types consumed by a rest - just assume it's the last type
            // there is one edge case where this is wrong, but we ignore it because
            // it's rare and really complicated to handle
            // eg: function foo(...a: [number, ...string[], number])
            return typeArguments[typeArguments.length - 1];
          }

          const typeIndex = index - this.restType.index;
          if (typeIndex >= typeArguments.length) {
            return typeArguments[typeArguments.length - 1];
          }

          return typeArguments[typeIndex];
        }

        case "Array":
        case "Other":
          return this.restType.type;
      }
    }
    return this.paramTypes[index];
  }

  public consumeRemainingArguments(): void {
    this.hasConsumedArguments = true;
  }
}

/**
 * TODO: Import TSESLint test suite if modified
 * Does a simple check to see if there is an any being assigned to a non-any type.
 *
 * This also checks generic positions to ensure there's no unsafe sub-assignments.
 * Note: in the case of generic positions, it makes the assumption that the two types are the same.
 *
 * @example See tests for examples
 *
 * @returns false if it's safe, or an object with the two types if it's unsafe
 */
export function isUnsafeAssignment(
  type: ts.Type,
  receiver: ts.Type,
  checker: Checker,
  senderNode: AST.Expression | null,
): false | { sender: ts.Type; receiver: ts.Type } {
  if (typeHasFlag(type, TypeFlags.Any)) {
    // Allow assignment of any ==> unknown.
    if (typeHasFlag(receiver, TypeFlags.Unknown)) {
      return false;
    }

    if (!typeHasFlag(receiver, TypeFlags.Any)) {
      return { sender: type, receiver };
    }
  }

  if (isTypeReference(type) && isTypeReference(receiver)) {
    // TODO - figure out how to handle cases like this,
    // where the types are assignable, but not the same type
    /*
    function foo(): ReadonlySet<number> { return new Set<any>(); }

    // and

    type Test<T> = { prop: T }
    type Test2 = { prop: string }
    declare const a: Test<any>;
    const b: Test2 = a;
    */

    if (type.target !== receiver.target) {
      // if the type references are different, assume safe, as we won't know how to compare the two types
      // the generic positions might not be equivalent for both types
      return false;
    }

    if (
      senderNode?.kind === SyntaxKind.NewExpression &&
      senderNode.expression.kind === SyntaxKind.Identifier &&
      senderNode.expression.text === "Map" &&
      (senderNode.arguments ?? []).length === 0 &&
      senderNode.typeArguments == null
    ) {
      // special case to handle `new Map()`
      // unfortunately Map's default empty constructor is typed to return `Map<any, any>` :(
      // https://github.com/typescript-eslint/typescript-eslint/issues/2109#issuecomment-634144396
      return false;
    }

    const typeArguments = type.typeArguments ?? [];
    const receiverTypeArguments = receiver.typeArguments ?? [];

    for (let i = 0; i < typeArguments.length; i += 1) {
      const arg = typeArguments[i];
      const receiverArg = receiverTypeArguments[i];

      const unsafe = isUnsafeAssignment(arg, receiverArg, checker, senderNode);
      if (unsafe) {
        return { sender: type, receiver };
      }
    }

    return false;
  }

  return false;
}

export const test = () =>
  ruleTester({
    rule: noUnsafeArgument,
    valid: [
      // unknown function should be ignored
      `
doesNotExist(1 as any);
    `,
      // non-function call should be ignored
      `
const foo = 1;
foo(1 as any);
    `,
      // too many arguments should be ignored as this is a TS error
      `
declare function foo(arg: number): void;
foo(1, 1 as any, 2 as any);
    `,
      `
declare function foo(arg: number, arg2: string): void;
foo(1, 'a');
    `,
      `
declare function foo(arg: any): void;
foo(1 as any);
    `,
      `
declare function foo(arg: unknown): void;
foo(1 as any);
    `,
      `
declare function foo(...arg: number[]): void;
foo(1, 2, 3);
    `,
      `
declare function foo(...arg: any[]): void;
foo(1, 2, 3, 4 as any);
    `,
      `
declare function foo(arg: number, arg2: number): void;
const x = [1, 2] as const;
foo(...x);
    `,
      `
declare function foo(arg: any, arg2: number): void;
const x = [1 as any, 2] as const;
foo(...x);
    `,
      `
declare function foo(arg1: string, arg2: string): void;
const x: string[] = [];
foo(...x);
    `,
      `
declare function foo(arg1: Set<string>, arg2: Map<string, string>): void;

const x = [new Map<string, string>()] as const;
foo(new Set<string>(), ...x);
    `,
      `
declare function foo(arg1: unknown, arg2: Set<unkown>, arg3: unknown[]): void;
foo(1 as any, new Set<any>(), [] as any[]);
    `,
      `
declare function foo(...params: [number, string, any]): void;
foo(1, 'a', 1 as any);
    `,
      // Unfortunately - we cannot handle this case because TS infers `params` to be a tuple type
      // that tuple type is the same as the type of
      `
declare function foo<E extends string[]>(...params: E): void;

foo('a', 'b', 1 as any);
    `,
      `
declare function toHaveBeenCalledWith<E extends any[]>(...params: E): void;
toHaveBeenCalledWith(1 as any);
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/2109
      `
declare function acceptsMap(arg: Map<string, string>): void;
acceptsMap(new Map());
    `,
    ],
    invalid: [
      {
        code: `
declare function foo(arg: number): void;
foo(1 as any);
      `,
        errors: [
          {
            message: messages.unsafeArgument({
              sender: "any",
              receiver: "number",
            }),
            line: 3,
            column: 5,
          },
        ],
      },
      {
        code: `
declare function foo(arg1: number, arg2: string): void;
foo(1, 1 as any);
      `,
        errors: [
          {
            message: messages.unsafeArgument({
              sender: "any",
              receiver: "string",
            }),
            line: 3,
            column: 8,
          },
        ],
      },
      {
        code: `
declare function foo(...arg: number[]): void;
foo(1, 2, 3, 1 as any);
      `,
        errors: [
          {
            message: messages.unsafeArgument({
              sender: "any",
              receiver: "number",
            }),
            line: 3,
            column: 14,
          },
        ],
      },
      {
        code: `
declare function foo(arg: string, ...arg: number[]): void;
foo(1 as any, 1 as any);
      `,
        errors: [
          {
            message: messages.unsafeArgument({
              sender: "any",
              receiver: "string",
            }),
            line: 3,
            column: 5,
          },
          {
            message: messages.unsafeArgument({
              sender: "any",
              receiver: "number",
            }),
            line: 3,
            column: 15,
          },
        ],
      },
      {
        code: `
declare function foo(arg1: string, arg2: number): void;

foo(...(x as any));
      `,
        errors: [
          {
            message: messages.unsafeSpread,
            line: 4,
            column: 5,
          },
        ],
      },
      {
        code: `
declare function foo(arg1: string, arg2: number): void;

foo(...(x as any[]));
      `,
        errors: [
          {
            message: messages.unsafeArraySpread,
            line: 4,
            column: 5,
          },
        ],
      },
      {
        code: `
declare function foo(arg1: string, arg2: number): void;

const x = ['a', 1 as any] as const;
foo(...x);
      `,
        errors: [
          {
            message: messages.unsafeTupleSpread({
              sender: "any",
              receiver: "number",
            }),
            line: 5,
            column: 5,
          },
        ],
      },
      {
        code: `
declare function foo(arg1: string, arg2: number, arg2: string): void;

const x = [1] as const;
foo('a', ...x, 1 as any);
      `,
        errors: [
          {
            message: messages.unsafeArgument({
              sender: "any",
              receiver: "string",
            }),
            line: 5,
            column: 16,
          },
        ],
      },
      {
        code: `
declare function foo(arg1: string, arg2: number, ...rest: string[]): void;

const x = [1, 2] as [number, ...number[]];
foo('a', ...x, 1 as any);
      `,
        errors: [
          {
            message: messages.unsafeArgument({
              sender: "any",
              receiver: "string",
            }),
            line: 5,
            column: 16,
          },
        ],
      },
      {
        code: `
declare function foo(arg1: Set<string>, arg2: Map<string, string>): void;

const x = [new Map<any, string>()] as const;
foo(new Set<any>(), ...x);
      `,
        errors: [
          {
            message: messages.unsafeArgument({
              sender: "Set<any>",
              receiver: "Set<string>",
            }),
            line: 5,
            column: 5,
          },
          {
            message: messages.unsafeTupleSpread({
              sender: "Map<any, string>",
              receiver: "Map<string, string>",
            }),
            line: 5,
            column: 21,
          },
        ],
      },
      {
        code: `
declare function foo(...params: [number, string, any]): void;
foo(1 as any, 'a' as any, 1 as any);
      `,
        errors: [
          {
            message: messages.unsafeArgument({
              sender: "any",
              receiver: "number",
            }),
            line: 3,
            column: 5,
          },
          {
            message: messages.unsafeArgument({
              sender: "any",
              receiver: "string",
            }),
            line: 3,
            column: 15,
          },
        ],
      },
      {
        code: `
declare function foo(param1: string, ...params: [number, string, any]): void;
foo('a', 1 as any, 'a' as any, 1 as any);
      `,
        errors: [
          {
            message: messages.unsafeArgument({
              sender: "any",
              receiver: "number",
            }),
            line: 3,
            column: 10,
          },
          {
            message: messages.unsafeArgument({
              sender: "any",
              receiver: "string",
            }),
            line: 3,
            column: 20,
          },
        ],
      },
    ],
  });
