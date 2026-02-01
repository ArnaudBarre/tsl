import {
  isIntersectionType,
  isObjectFlagSet,
  isObjectType,
  isTypeParameter,
  isTypeReference,
  isUnionType,
} from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import { defineRule, getTypeName } from "../_utils/index.ts";
import { isIdentifierFromDefaultLibrary } from "../_utils/isBuiltinSymbolLike.ts";
import type { AST, Context } from "../../types.ts";

export const messages = {
  baseArrayJoin: (params: { name: string; certainty: Certainty }) =>
    `Using \`join()\` for ${params.name} ${params.certainty} use Object's default stringification format ('[object Object]') when stringified.`,
  baseToString: (params: { name: string; certainty: Certainty }) =>
    `'${params.name}' ${params.certainty} use Object's default stringification format ('[object Object]') when stringified.`,
};

type Certainty = "always" | "will" | "may";

export type NoBaseToStringOptions = {
  /**
   * Whether to also check values of type `unknown`
   * @default false
   */
  checkUnknown?: boolean;
  /**
   * List of type names to ignore.
   * @default ["Error", "RegExp", "URL", "URLSearchParams"]
   */
  ignoredTypeNames?: string[];
};
type ParsedOptions = {
  checkUnknown: boolean;
  ignoredTypeNames: string[];
};

// https://typescript-eslint.io/rules/no-base-to-string
export const noBaseToString = defineRule((_options?: NoBaseToStringOptions) => {
  const options: ParsedOptions = {
    checkUnknown: false,
    ignoredTypeNames: ["Error", "RegExp", "URL", "URLSearchParams"],
    ..._options,
  };
  return {
    name: "core/noBaseToString",
    visitor: {
      CallExpression(context, node) {
        if (
          isBuiltInStringCall(context, node)
          && node.arguments.length === 1
          && node.arguments[0].kind !== SyntaxKind.SpreadElement
        ) {
          checkExpression(context, options, node.arguments[0]);
        }
        if (
          node.expression.kind === SyntaxKind.PropertyAccessExpression
          && node.expression.name.kind === SyntaxKind.Identifier
        ) {
          if (node.expression.name.text === "join") {
            const type = context.utils.getConstrainedTypeAtLocation(
              node.expression.expression,
            );
            checkExpressionForArrayJoin(
              context,
              options,
              node.expression.expression,
              type,
            );
          }
          if (
            node.expression.name.text === "toString"
            || node.expression.name.text === "toLocaleString"
          ) {
            checkExpression(context, options, node.expression.expression);
          }
        }
      },
    },
  };
});

function checkExpression(
  context: Context,
  options: ParsedOptions,
  node: AST.Expression,
  type?: ts.Type,
): void {
  if (node.kind === SyntaxKind.StringLiteral) {
    return;
  }
  const certainty = collectToStringCertainty(
    context,
    options,
    type ?? context.checker.getTypeAtLocation(node),
    new Set(),
  );
  if (certainty === "always") {
    return;
  }

  context.report({
    node,
    message: messages.baseToString({
      name:
        node.kind === SyntaxKind.ParenthesizedExpression
          ? node.expression.getText()
          : node.getText(),
      certainty,
    }),
  });
}

function checkExpressionForArrayJoin(
  context: Context,
  options: ParsedOptions,
  node: ts.Node,
  type: ts.Type,
): void {
  const certainty = collectJoinCertainty(context, options, type, new Set());
  if (certainty === "always") return;
  context.report({
    node,
    message: messages.baseArrayJoin({ name: node.getText(), certainty }),
  });
}

function collectUnionTypeCertainty(
  type: ts.UnionType,
  collectSubTypeCertainty: (type: ts.Type) => Certainty,
): Certainty {
  const certainties = type.types.map((t) => collectSubTypeCertainty(t));
  if (certainties.every((certainty) => certainty === "will")) {
    return "will";
  }

  if (certainties.every((certainty) => certainty === "always")) {
    return "always";
  }

  return "may";
}

function collectIntersectionTypeCertainty(
  type: ts.IntersectionType,
  collectSubTypeCertainty: (type: ts.Type) => Certainty,
): Certainty {
  for (const subType of type.types) {
    const subtypeUsefulness = collectSubTypeCertainty(subType);

    if (subtypeUsefulness === "always") {
      return "always";
    }
  }

  return "will";
}

function collectTupleCertainty(
  context: Context,
  options: ParsedOptions,
  type: ts.TypeReference,
  visited: Set<ts.Type>,
): Certainty {
  const typeArgs = context.checker.getTypeArguments(type);
  const certainties = typeArgs.map((t) =>
    collectToStringCertainty(context, options, t, visited),
  );
  if (certainties.some((certainty) => certainty === "will")) {
    return "will";
  }

  if (certainties.some((certainty) => certainty === "may")) {
    return "may";
  }

  return "always";
}

function collectArrayCertainty(
  context: Context,
  options: ParsedOptions,
  type: ts.Type,
  visited: Set<ts.Type>,
): Certainty {
  return collectToStringCertainty(
    context,
    options,
    type.getNumberIndexType()!,
    visited,
  );
}

function collectJoinCertainty(
  context: Context,
  options: ParsedOptions,
  type: ts.Type,
  visited: Set<ts.Type>,
): Certainty {
  if (isUnionType(type)) {
    return collectUnionTypeCertainty(type, (t) =>
      collectJoinCertainty(context, options, t, visited),
    );
  }

  if (isIntersectionType(type)) {
    return collectIntersectionTypeCertainty(type, (t) =>
      collectJoinCertainty(context, options, t, visited),
    );
  }

  if (context.checker.isTupleType(type)) {
    return collectTupleCertainty(context, options, type, visited);
  }

  if (context.checker.isArrayType(type)) {
    return collectArrayCertainty(context, options, type, visited);
  }

  return "always";
}

function getBaseTypesForType(
  context: Context,
  type: ts.Type,
): readonly ts.Type[] {
  if (!isObjectType(type)) return [];

  const interfaceTarget = isTypeReference(type) ? type.target : type;

  const interfaceType =
    isObjectFlagSet(
      interfaceTarget,
      ts.ObjectFlags.Interface | ts.ObjectFlags.Class,
    ) && (interfaceTarget as ts.InterfaceType);

  if (interfaceType === false) return [];

  return context.checker.getBaseTypes(interfaceType);
}

function isIgnoredTypeOrBase(
  context: Context,
  options: ParsedOptions,
  type: ts.Type,
  seen = new Set<ts.Type>(),
): boolean {
  if (seen.has(type)) return false; // Prevent infinite recursion on circular references
  seen.add(type);

  let typeName = getTypeName(context.checker, type);
  const genericIndex = typeName.indexOf("<");
  if (genericIndex !== -1) typeName = typeName.slice(0, genericIndex);
  return (
    options.ignoredTypeNames.includes(typeName)
    || getBaseTypesForType(context, type).some((base) =>
      isIgnoredTypeOrBase(context, options, base, seen),
    )
  );
}

function collectToStringCertainty(
  context: Context,
  options: ParsedOptions,
  type: ts.Type,
  visited: Set<ts.Type>,
): Certainty {
  if (visited.has(type)) {
    // don't report if this is a self referencing array or tuple type
    return "always";
  }

  if (isTypeParameter(type)) {
    const constraint = type.getConstraint();
    if (constraint) {
      return collectToStringCertainty(context, options, constraint, visited);
    }
    // unconstrained generic means `unknown`
    return options.checkUnknown ? "may" : "always";
  }

  // the Boolean type definition missing toString()
  if (
    type.flags & ts.TypeFlags.Boolean
    || type.flags & ts.TypeFlags.BooleanLiteral
  ) {
    return "always";
  }

  if (isIgnoredTypeOrBase(context, options, type)) {
    return "always";
  }

  if (type.isIntersection()) {
    return collectIntersectionTypeCertainty(type, (t) =>
      collectToStringCertainty(context, options, t, visited),
    );
  }

  if (type.isUnion()) {
    return collectUnionTypeCertainty(type, (t) =>
      collectToStringCertainty(context, options, t, visited),
    );
  }

  if (context.checker.isTupleType(type)) {
    return collectTupleCertainty(
      context,
      options,
      type,
      new Set([...visited, type]),
    );
  }

  if (context.checker.isArrayType(type)) {
    return collectArrayCertainty(
      context,
      options,
      type,
      new Set([...visited, type]),
    );
  }

  switch (isToStringLikeFromObject(context, type)) {
    case undefined:
      // unknown
      if (options.checkUnknown && type.flags === ts.TypeFlags.Unknown) {
        return "may";
      }
      // e.g. any
      return "always";

    case true:
      return "will";

    case false:
      return "always";
  }
}

function isToStringLikeFromObject(context: Context, type: ts.Type) {
  // An explicit [Symbol.toPrimitive] declaration is always user-defined
  if (
    type
      .getProperties()
      .some(
        (property) =>
          property.valueDeclaration
          && isSymbolToPrimitiveMethod(context, property.valueDeclaration),
      )
  ) {
    return false;
  }

  // Otherwise, we check for known methods used in type coercion.
  // We'll try to find one that's not declared on Object itself.
  // Failing that, we'll fall back to one that is.
  let foundFallbackOnObject = false;

  for (const propertyName of ["toLocaleString", "toString", "valueOf"]) {
    const candidate = context.checker.getPropertyOfType(type, propertyName);
    if (!candidate) {
      continue;
    }

    const declarations = candidate.getDeclarations();

    // If there are multiple declarations, at least one of them must not be
    // the default object toString.
    //
    // This may only matter for older versions of TS
    // see https://github.com/typescript-eslint/typescript-eslint/issues/8585
    if (declarations?.length !== 1) {
      continue;
    }

    // Not being the Object interface means this is user-defined.
    if (
      !ts.isInterfaceDeclaration(declarations[0].parent)
      || declarations[0].parent.name.text !== "Object"
    ) {
      return false;
    }

    foundFallbackOnObject = true;
  }

  return foundFallbackOnObject ? true : undefined;
}

function isSymbolToPrimitiveMethod(context: Context, node: ts.Declaration) {
  return (
    ts.isMethodSignature(node)
    && ts.isComputedPropertyName(node.name)
    && ts.isPropertyAccessExpression(node.name.expression)
    && ts.isIdentifier(node.name.expression.expression)
    && node.name.expression.expression.text === "Symbol"
    && ts.isIdentifier(node.name.expression.name)
    && node.name.expression.name.text === "toPrimitive"
    && context.checker
      .getSymbolAtLocation(node.name.expression.expression)
      ?.valueDeclaration?.getSourceFile().hasNoDefaultLib
  );
}

function isBuiltInStringCall(
  context: Context,
  node: AST.CallExpression,
): boolean {
  return (
    node.expression.kind === SyntaxKind.Identifier
    && node.expression.text === "String"
    && isIdentifierFromDefaultLibrary(context, node.expression)
  );
}
