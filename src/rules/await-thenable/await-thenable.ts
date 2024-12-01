import {
  getWellKnownSymbolPropertyOfType,
  isIntrinsicAnyType,
  unionTypeParts,
} from "ts-api-utils";
import { NodeFlags } from "typescript";
import { needsToBeAwaited } from "../_utils/needsToBeAwaited.ts";
import { createRule } from "../../public-utils.ts";

export const messages = {
  await: 'Unexpected `await` of a non-Promise (non-"Thenable") value.',
  awaitUsingOfNonAsyncDisposable:
    "Unexpected `await using` of a value that is not async disposable.",
  convertToOrdinaryFor: "Convert to an ordinary `for...of` loop.",
  forAwaitOfNonAsyncIterable:
    "Unexpected `for await...of` of a value that is not async iterable.",
  removeAwait: "Remove unnecessary `await`.",
};

export const awaitThenable = createRule(() => ({
  name: "core/awaitThenable",
  visitor: {
    AwaitExpression(node, context) {
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
    ForOfStatement(node, context) {
      if (node.awaitModifier) {
        const type = context.checker.getTypeAtLocation(node.expression);
        if (isIntrinsicAnyType(type)) return;

        const asyncIteratorSymbol = unionTypeParts(type).some((t) =>
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
    VariableDeclarationList(node, context) {
      if ((node.flags & NodeFlags.BlockScoped) === NodeFlags.AwaitUsing) {
        for (const declarator of node.declarations) {
          if (!declarator.initializer) continue;
          const type = context.checker.getTypeAtLocation(
            declarator.initializer,
          );
          if (isIntrinsicAnyType(type)) continue;

          const hasAsyncDisposeSymbol = unionTypeParts(type).some(
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
