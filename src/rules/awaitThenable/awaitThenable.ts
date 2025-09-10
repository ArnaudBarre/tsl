import {
  getWellKnownSymbolPropertyOfType,
  isIntrinsicAnyType,
} from "ts-api-utils";
import { NodeFlags } from "typescript";
import { defineRule } from "../_utils/index.ts";
import { needsToBeAwaited } from "../_utils/needsToBeAwaited.ts";

export const messages = {
  await: 'Unexpected `await` of a non-Promise (non-"Thenable") value.',
  awaitUsingOfNonAsyncDisposable:
    "Unexpected `await using` of a value that is not async disposable.",
  convertToOrdinaryFor: "Convert to an ordinary `for...of` loop.",
  forAwaitOfNonAsyncIterable:
    "Unexpected `for await...of` of a value that is not async iterable.",
  removeAwait: "Remove unnecessary `await`.",
};

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
