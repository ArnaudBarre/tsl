import { unionConstituents } from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import {
  addAwait,
  defineRule,
  isHigherPrecedenceThanUnary,
  isLogicalExpression,
} from "../_utils/index.ts";
import { isBuiltinSymbolLike } from "../_utils/isBuiltinSymbolLike.ts";
import type { AST, Checker, Context, Suggestion } from "../../types.ts";

const messageBase =
  "Promises must be awaited, end with a call to .catch, or end with a call to .then with a rejection handler.";
const messageBaseVoid =
  "Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler"
  + " or be explicitly marked as ignored with the `void` operator.";
const messageRejectionHandler =
  "A rejection handler that is not a function will be ignored.";
const messagePromiseArray =
  "An array of Promises may be unintentional. Consider handling the promises' fulfillment or rejection with Promise.all or similar.";
const messagePromiseArrayVoid =
  "An array of Promises may be unintentional. Consider handling the promises' fulfillment or rejection with Promise.all or similar,"
  + " or explicitly marking the expression as ignored with the `void` operator.";
export const messages = {
  floating: messageBase,
  floatingFixAwait: "Add await operator.",
  floatingFixVoid: "Add void operator to ignore.",
  floatingPromiseArray: messagePromiseArray,
  floatingPromiseArrayVoid: messagePromiseArrayVoid,
  floatingUselessRejectionHandler: `${messageBase} ${messageRejectionHandler}`,
  floatingUselessRejectionHandlerVoid: `${messageBaseVoid} ${messageRejectionHandler}`,
  floatingVoid: messageBaseVoid,
};

export type NoFloatingPromisesOptions = {
  /**
   * Functions whose calls are safe to float.
   * @default []
   */
  allowList?: string[];
  /**
   * Whether to ignore async IIFEs (Immediately Invoked Function Expressions).
   * @default false
   */
  ignoreIIFE?: boolean;
  /**
   * Whether to ignore `void` expressions.
   * @default true
   */
  ignoreVoid?: boolean;
};
type ParsedOptions = {
  allowList: string[];
  ignoreIIFE: boolean;
  ignoreVoid: boolean;
};

export const noFloatingPromises = defineRule(
  (_options?: NoFloatingPromisesOptions) => {
    const options: ParsedOptions = {
      allowList: [],
      ignoreIIFE: false,
      ignoreVoid: true,
      ..._options,
    };
    return {
      name: "core/noFloatingPromises",
      visitor: {
        ExpressionStatement(node, context) {
          if (options.ignoreIIFE && isAsyncIife(node)) {
            return;
          }

          if (
            node.expression.kind === SyntaxKind.CallExpression
            && node.expression.expression.kind === SyntaxKind.Identifier
            && options.allowList.includes(node.expression.expression.text)
          ) {
            return;
          }

          const { isUnhandled, nonFunctionHandler, promiseArray } =
            isUnhandledPromise(
              context.checker,
              node.expression,
              context,
              options,
            );

          if (isUnhandled) {
            if (promiseArray) {
              context.report({
                node,
                message: options.ignoreVoid
                  ? messages.floatingPromiseArrayVoid
                  : messages.floatingPromiseArray,
              });
            } else if (options.ignoreVoid) {
              context.report({
                node,
                message: nonFunctionHandler
                  ? messages.floatingUselessRejectionHandlerVoid
                  : messages.floatingVoid,
                suggestions: [
                  {
                    message: messages.floatingFixVoid,
                    changes: isHigherPrecedenceThanUnary(node.expression)
                      ? [
                          {
                            start: node.getStart(),
                            length: 0,
                            newText: "void ",
                          },
                        ]
                      : [
                          {
                            start: node.getStart(),
                            length: 0,
                            newText: "void (",
                          },
                          {
                            start: node.expression.getEnd(),
                            length: 0,
                            newText: ")",
                          },
                        ],
                  },
                  {
                    message: messages.floatingFixAwait,
                    changes: addAwaitOrReplaceVoid(node.expression, node),
                  },
                ],
              });
            } else {
              context.report({
                node,
                message: nonFunctionHandler
                  ? messages.floatingUselessRejectionHandler
                  : messages.floating,
                suggestions: [
                  {
                    message: messages.floatingFixAwait,
                    changes: addAwaitOrReplaceVoid(node.expression, node),
                  },
                ],
              });
            }
          }
        },
      },
    };
  },
);

function addAwaitOrReplaceVoid(
  expression: AST.Expression,
  node: AST.ExpressionStatement,
): Suggestion["changes"] {
  if (expression.kind === SyntaxKind.VoidExpression) {
    return [{ start: node.getStart(), length: 4, newText: "await" }];
  }
  return addAwait(node.expression);
}

function isAsyncIife(node: AST.ExpressionStatement): boolean {
  if (node.expression.kind !== SyntaxKind.CallExpression) {
    return false;
  }
  if (node.expression.expression.kind !== SyntaxKind.ParenthesizedExpression) {
    return false;
  }
  return (
    node.expression.expression.expression.kind === SyntaxKind.ArrowFunction
    || node.expression.expression.expression.kind
      === SyntaxKind.FunctionExpression
  );
}

function isValidRejectionHandler(
  rejectionHandler: ts.Node,
  context: Context,
): boolean {
  return (
    context.checker.getTypeAtLocation(rejectionHandler).getCallSignatures()
      .length > 0
  );
}

function isUnhandledPromise(
  checker: Checker,
  node: AST.Expression,
  context: Context,
  options: ParsedOptions,
): {
  isUnhandled: boolean;
  nonFunctionHandler?: boolean;
  promiseArray?: boolean;
} {
  if (
    node.kind === SyntaxKind.BinaryExpression
    && (node.operatorToken.kind === SyntaxKind.EqualsToken
      || node.operatorToken.kind === SyntaxKind.QuestionQuestionEqualsToken)
  ) {
    return { isUnhandled: false };
  }

  // First, check expressions whose resulting types may not be promise-like
  if (
    node.kind === SyntaxKind.BinaryExpression
    && node.operatorToken.kind === SyntaxKind.CommaToken
  ) {
    // Any child in a comma expression could return a potentially unhandled
    // promise, so we check them all regardless of whether the final returned
    // value is promise-like.
    const leftResult = isUnhandledPromise(checker, node.left, context, options);
    if (leftResult.isUnhandled) {
      return leftResult;
    }
    return isUnhandledPromise(checker, node.right, context, options);
  }

  if (!options.ignoreVoid && node.kind === SyntaxKind.VoidExpression) {
    // Similarly, a `void` expression always returns undefined, so we need to
    // see what's inside it without checking the type of the overall expression.
    return isUnhandledPromise(checker, node.expression, context, options);
  }

  // Check the type. At this point it can't be unhandled if it isn't a promise
  // or array thereof.

  if (isPromiseArray(node, context)) {
    return { isUnhandled: true, promiseArray: true };
  }

  // await expression addresses promises, but not promise arrays.
  if (node.kind === SyntaxKind.AwaitExpression) {
    // you would think this wouldn't be strictly necessary, since we're
    // anyway checking the type of the expression, but, unfortunately TS
    // reports the result of `await (promise as Promise<number> & number)`
    // as `Promise<number> & number` instead of `number`.
    return { isUnhandled: false };
  }

  if (!isPromiseLike(context, node)) {
    return { isUnhandled: false };
  }

  if (node.kind === SyntaxKind.CallExpression) {
    // If the outer expression is a call, a `.catch()` or `.then()` with
    // rejection handler handles the promise.

    if (
      node.expression.kind === SyntaxKind.PropertyAccessExpression
      && node.expression.name.kind === SyntaxKind.Identifier
    ) {
      const methodName = node.expression.name.text;
      const catchRejectionHandler =
        methodName === "catch" && node.arguments.length >= 1
          ? node.arguments[0]
          : undefined;
      if (catchRejectionHandler) {
        if (isValidRejectionHandler(catchRejectionHandler, context)) {
          return { isUnhandled: false };
        }
        return { isUnhandled: true, nonFunctionHandler: true };
      }

      const thenRejectionHandler =
        methodName === "then" && node.arguments.length >= 2
          ? node.arguments[1]
          : undefined;
      if (thenRejectionHandler) {
        if (isValidRejectionHandler(thenRejectionHandler, context)) {
          return { isUnhandled: false };
        }
        return { isUnhandled: true, nonFunctionHandler: true };
      }

      // `x.finally()` is transparent to resolution of the promise, so check `x`.
      // ("object" in this context is the `x` in `x.finally()`)
      const promiseFinallyObject =
        methodName === "finally" ? node.expression.expression : undefined;
      if (promiseFinallyObject) {
        return isUnhandledPromise(
          checker,
          promiseFinallyObject,
          context,
          options,
        );
      }
    }

    // All other cases are unhandled.
    return { isUnhandled: true };
  } else if (node.kind === SyntaxKind.ConditionalExpression) {
    // We must be getting the promise-like value from one of the branches of the
    // ternary. Check them directly.
    const alternateResult = isUnhandledPromise(
      checker,
      node.whenFalse,
      context,
      options,
    );
    if (alternateResult.isUnhandled) {
      return alternateResult;
    }
    return isUnhandledPromise(checker, node.whenTrue, context, options);
  } else if (
    node.kind === SyntaxKind.BinaryExpression
    && isLogicalExpression(node.operatorToken)
  ) {
    const leftResult = isUnhandledPromise(checker, node.left, context, options);
    if (leftResult.isUnhandled) {
      return leftResult;
    }
    return isUnhandledPromise(checker, node.right, context, options);
  }

  // Anything else is unhandled.
  return { isUnhandled: true };
}

function isPromiseArray(node: ts.Node, context: Context): boolean {
  const type = context.checker.getTypeAtLocation(node);
  for (const ty of unionConstituents(type).map((t) =>
    context.checker.getApparentType(t),
  )) {
    if (context.checker.isArrayType(ty)) {
      const arrayType = context.checker.getTypeArguments(ty)[0];
      if (isPromiseLike(context, node, arrayType)) {
        return true;
      }
    }

    if (context.checker.isTupleType(ty)) {
      for (const tupleElementType of context.checker.getTypeArguments(ty)) {
        if (isPromiseLike(context, node, tupleElementType)) {
          return true;
        }
      }
    }
  }
  return false;
}

function isPromiseLike(
  context: Context,
  node: ts.Node,
  type?: ts.Type,
): boolean {
  type ??= context.checker.getTypeAtLocation(node);

  return unionConstituents(context.checker.getApparentType(type)).some(
    (typePart) => isBuiltinSymbolLike(context.program, typePart, "Promise"),
  );
}
