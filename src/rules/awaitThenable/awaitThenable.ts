import {
  getWellKnownSymbolPropertyOfType,
  isIntrinsicAnyType,
  isTypeReference,
} from "ts-api-utils";
import { NodeFlags, SyntaxKind, type Type } from "typescript";
import { defineRule } from "../_utils/index.ts";
import { needsToBeAwaited } from "../_utils/needsToBeAwaited.ts";
import type { AST, Context } from "../../types.ts";

export const messages = {
  await: 'Unexpected `await` of a non-Promise (non-"Thenable") value.',
  awaitUsingOfNonAsyncDisposable:
    "Unexpected `await using` of a value that is not async disposable.",
  convertToOrdinaryFor: "Convert to an ordinary `for...of` loop.",
  forAwaitOfNonAsyncIterable:
    "Unexpected `for await...of` of a value that is not async iterable.",
  invalidPromiseAggregatorInput:
    'Unexpected iterable of non-Promise (non-"Thenable") values passed to promise aggregator.',
  removeAwait: "Remove unnecessary `await`.",
};

const PROMISE_METHODS = ["all", "allSettled", "race", "any"];

// https://typescript-eslint.io/rules/await-thenable
export const awaitThenable = defineRule(() => ({
  name: "core/awaitThenable",
  visitor: {
    AwaitExpression(context, node) {
      const type = context.checker.getTypeAtLocation(node.expression);
      const certainty = needsToBeAwaited(context, node, type);

      if (certainty === "Never") {
        context.report({
          node,
          message: messages.await,
          suggestions: [
            {
              message: messages.removeAwait,
              changes: [
                {
                  start: node.getStart(),
                  end: node.expression.getStart(),
                  newText: "",
                },
              ],
            },
          ],
        });
      }
    },
    CallExpression(context, node) {
      if (node.expression.kind !== SyntaxKind.PropertyAccessExpression) return;
      if (node.expression.expression.kind !== SyntaxKind.Identifier) return;
      if (node.expression.expression.text !== "Promise") return;
      if (!PROMISE_METHODS.includes(node.expression.name.text)) return;
      const argument = node.arguments.at(0);
      if (!argument) return;

      if (argument.kind === SyntaxKind.ArrayLiteralExpression) {
        for (const element of argument.elements) {
          const type = context.utils.getConstrainedTypeAtLocation(element);
          if (isNonAwaitableType(context, element, type)) {
            context.report({
              node: element,
              message: messages.invalidPromiseAggregatorInput,
            });
          }
        }
      } else {
        const type = context.utils.getConstrainedTypeAtLocation(argument);
        if (isInvalidPromiseAggregatorInput(context, argument, type)) {
          context.report({
            node: argument,
            message: messages.invalidPromiseAggregatorInput,
          });
        }
      }
    },
    ForOfStatement(context, node) {
      if (node.awaitModifier) {
        const type = context.checker.getTypeAtLocation(node.expression);
        if (isIntrinsicAnyType(type)) return;

        const asyncIteratorSymbol = context.utils
          .unionConstituents(type)
          .some((t) =>
            getWellKnownSymbolPropertyOfType(
              t,
              "asyncIterator",
              context.rawChecker,
            ),
          );

        if (!asyncIteratorSymbol) {
          context.report({
            message: messages.forAwaitOfNonAsyncIterable,
            node: node.awaitModifier,
            suggestions: [
              {
                message: messages.convertToOrdinaryFor,
                changes: [{ node: node.awaitModifier, newText: "" }],
              },
            ],
          });
        }
      }
    },
    VariableDeclarationList(context, node) {
      if ((node.flags & NodeFlags.BlockScoped) === NodeFlags.AwaitUsing) {
        for (const declarator of node.declarations) {
          if (!declarator.initializer) continue;
          const type = context.checker.getTypeAtLocation(
            declarator.initializer,
          );
          if (isIntrinsicAnyType(type)) continue;

          const hasAsyncDisposeSymbol = context.utils
            .unionConstituents(type)
            .some(
              (typePart) =>
                getWellKnownSymbolPropertyOfType(
                  typePart,
                  "asyncDispose",
                  context.rawChecker,
                ) != null,
            );

          if (!hasAsyncDisposeSymbol) {
            context.report({
              node: declarator.initializer,
              message: messages.awaitUsingOfNonAsyncDisposable,
              suggestions:
                // let the user figure out what to do if there's
                // await using a = b, c = d, e = f;
                // it's rare and not worth the complexity to handle.
                node.declarations.length === 1
                  ? [
                      {
                        message: messages.removeAwait,
                        changes: [
                          { start: node.getStart(), length: 6, newText: "" },
                        ],
                      },
                    ]
                  : [],
            });
          }
        }
      }
    },
  },
}));

function isInvalidPromiseAggregatorInput(
  context: Context,
  node: AST.AnyNode,
  type: Type,
): boolean {
  for (const part of context.utils.unionConstituents(type)) {
    const valueTypes = getValueTypesOfArrayLike(context, part);

    if (valueTypes != null) {
      for (const typeArgument of valueTypes) {
        if (isNonAwaitableType(context, node, typeArgument)) {
          return true;
        }
      }
    }
  }

  return false;
}

function getValueTypesOfArrayLike(
  context: Context,
  type: Type,
): readonly Type[] | null {
  if (context.checker.isTupleType(type)) {
    return context.checker.getTypeArguments(type);
  }

  // `Iterable<...>`
  if (isTypeReference(type)) {
    return context.checker.getTypeArguments(type).slice(0, 1);
  }

  return null;
}

function isNonAwaitableType(
  context: Context,
  node: AST.AnyNode,
  type: Type,
): boolean {
  return context.utils
    .unionConstituents(type)
    .every(
      (typeArgumentPart) =>
        needsToBeAwaited(context, node, typeArgumentPart) === "Never",
    );
}
