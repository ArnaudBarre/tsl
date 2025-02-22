import { unionTypeParts } from "ts-api-utils";
import ts, { SyntaxKind, TypeFlags } from "typescript";
import {
  getContextualType,
  hasModifier,
  isConstAssertion,
  typeHasFlag,
} from "../_utils/index.ts";
import { createRule } from "../../index.ts";
import type { AST, Context, Suggestion } from "../../types.ts";

export const messages = {
  contextuallyUnnecessary:
    "This assertion is unnecessary since the receiver accepts the original type of the expression.",
  unnecessaryAssertion:
    "This assertion is unnecessary since it does not change the type of the expression.",
  removeAssertion: "Remove the type assertion",
};

export type NoUnnecessaryTypeAssertionOptions = {
  /**
   * A list of type names to ignore.
   * @default []
   */
  typesToIgnore?: string[];
};

export const noUnnecessaryTypeAssertion = createRule(
  (options: NoUnnecessaryTypeAssertionOptions = {}) => ({
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
  options: NoUnnecessaryTypeAssertionOptions,
) {
  if (options.typesToIgnore?.includes(node.type.getText())) {
    return;
  }

  const castType = context.checker.getTypeAtLocation(node);
  const uncastType = context.checker.getTypeAtLocation(node.expression);
  const typeIsUnchanged = isTypeUnchanged(uncastType, castType, context);

  const wouldSameTypeBeInferred = castType.isLiteral()
    ? isImplicitlyNarrowedLiteralDeclaration(node)
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
        hasModifier(declaration.parent.parent, SyntaxKind.DeclareKeyword)
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

function isImplicitlyNarrowedLiteralDeclaration(
  node: AST.AsExpression | AST.TypeAssertion,
): boolean {
  if (node.expression.kind === SyntaxKind.TemplateExpression) {
    // Even on `const` variable declarations, template literals with expressions can sometimes be widened without a type assertion.
    // https://github.com/typescript-eslint/typescript-eslint/issues/8737
    return false;
  }
  return (
    (node.parent.parent.kind === SyntaxKind.VariableDeclarationList &&
      node.parent.parent.getText().startsWith("const ")) ||
    (node.parent.kind === SyntaxKind.PropertyDeclaration &&
      hasModifier(node.parent, SyntaxKind.ReadonlyKeyword))
  );
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
