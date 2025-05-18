import {
  getWellKnownSymbolPropertyOfType,
  isObjectFlagSet,
  isObjectType,
  isTypeFlagSet,
  typeParts,
} from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import { isTypeRecurser } from "../_utils/index.ts";
import { isBuiltinSymbolLike } from "../_utils/isBuiltinSymbolLike.ts";
import { createRule } from "../../index.ts";
import type { AST, Context } from "../../types.ts";

export const messages = {
  noArraySpreadInObject:
    "Using the spread operator on an array in an object will result in a list of indices.",
  noClassDeclarationSpreadInObject:
    "Using the spread operator on class declarations will spread only their static properties, and will lose their class prototype.",
  noClassInstanceSpreadInObject:
    "Using the spread operator on class instances will lose their class prototype.",
  noFunctionSpreadInObject:
    "Using the spread operator on a function without additional properties can cause unexpected behavior. Did you forget to call the function?",
  noIterableSpreadInObject:
    "Using the spread operator on an Iterable in an object can cause unexpected behavior.",
  noMapSpreadInObject:
    "Using the spread operator on a Map in an object will result in an empty object. Did you mean to use `Object.fromEntries(map)` instead?",
  noPromiseSpreadInObject:
    "Using the spread operator on Promise in an object can cause unexpected behavior. Did you forget to await the promise?",
  noStringSpread: [
    'Using the spread operator on a string can mishandle special characters, as can `.split("")`.',
    "- `...` produces Unicode code points, which will decompose complex emojis into individual emojis",
    '- .split("") produces UTF-16 code units, which breaks rich characters in many languages',
    "Consider using `Intl.Segmenter` for locale-aware string decomposition.",
    "Otherwise, if you don't need to preserve emojis or other non-Ascii characters, disable this lint rule on this line or configure the 'allow' rule option.",
  ].join("\n"),
};

export const noMisusedSpread = createRule(() => ({
  name: "core/noMisusedSpread",
  visitor: {
    SpreadAssignment(node, context) {
      checkObjectSpread(node, context);
    },
    JsxSpreadAttribute(node, context) {
      checkObjectSpread(node, context);
    },
    SpreadElement(node, context) {
      if (
        node.parent.kind === SyntaxKind.CallExpression
        || node.parent.kind === SyntaxKind.ArrayLiteralExpression
      ) {
        const type = context.utils.getConstrainedTypeAtLocation(
          node.expression,
        );
        if (isString(type)) {
          context.report({ node, message: messages.noStringSpread });
        }
      }
    },
  },
}));

function checkObjectSpread(
  node: AST.JsxSpreadAttribute | AST.SpreadAssignment,
  context: Context,
): void {
  const type = context.utils.getConstrainedTypeAtLocation(node.expression);

  if (isPromise(context.program, type)) {
    context.report({ node, message: messages.noPromiseSpreadInObject });
    return;
  }

  if (isFunctionWithoutProps(type)) {
    context.report({ node, message: messages.noFunctionSpreadInObject });
    return;
  }

  if (isMap(context.program, type)) {
    context.report({ node, message: messages.noMapSpreadInObject });
    return;
  }

  if (isArray(context, type)) {
    context.report({ node, message: messages.noArraySpreadInObject });
    return;
  }

  if (
    isIterable(type, context)
    // Don't report when the type is string, since TS will flag it already
    && !isString(type)
  ) {
    context.report({ node, message: messages.noIterableSpreadInObject });
    return;
  }

  if (isClassInstance(context, type)) {
    context.report({
      node,
      message: messages.noClassInstanceSpreadInObject,
    });
    return;
  }

  if (isClassDeclaration(type)) {
    context.report({
      node,
      message: messages.noClassDeclarationSpreadInObject,
    });
  }
}

function isIterable(type: ts.Type, context: Context): boolean {
  return typeParts(type).some((t) =>
    getWellKnownSymbolPropertyOfType(t, "iterator", context.rawChecker),
  );
}

function isArray(context: Context, type: ts.Type): boolean {
  return isTypeRecurser(
    type,
    (t) => context.checker.isArrayType(t) || context.checker.isTupleType(t),
  );
}

function isString(type: ts.Type): boolean {
  return isTypeRecurser(type, (t) => isTypeFlagSet(t, ts.TypeFlags.StringLike));
}

function isFunctionWithoutProps(type: ts.Type): boolean {
  return isTypeRecurser(
    type,
    (t) => t.getCallSignatures().length > 0 && t.getProperties().length === 0,
  );
}

function isPromise(program: ts.Program, type: ts.Type): boolean {
  return isTypeRecurser(type, (t) =>
    isBuiltinSymbolLike(program, t, "Promise"),
  );
}

function isClassInstance(context: Context, type: ts.Type): boolean {
  return isTypeRecurser(type, (t) => {
    // If the type itself has a construct signature, it's a class(-like)
    if (t.getConstructSignatures().length) {
      return false;
    }

    const symbol = t.getSymbol();

    // If the type's symbol has a construct signature, the type is an instance
    return !!symbol
      ?.getDeclarations()
      ?.some(
        (declaration) =>
          context.checker
            .getTypeOfSymbolAtLocation(symbol, declaration)
            .getConstructSignatures().length,
      );
  });
}

function isClassDeclaration(type: ts.Type): boolean {
  return isTypeRecurser(type, (t) => {
    if (
      isObjectType(t)
      && isObjectFlagSet(t, ts.ObjectFlags.InstantiationExpressionType)
    ) {
      return true;
    }

    const kind = t.getSymbol()?.valueDeclaration?.kind;

    return (
      kind === ts.SyntaxKind.ClassDeclaration
      || kind === ts.SyntaxKind.ClassExpression
    );
  });
}

function isMap(program: ts.Program, type: ts.Type): boolean {
  return isTypeRecurser(type, (t) =>
    isBuiltinSymbolLike(program, t, ["Map", "ReadonlyMap", "WeakMap"]),
  );
}
