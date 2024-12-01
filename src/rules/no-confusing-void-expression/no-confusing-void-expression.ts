import {
  getCallSignaturesOfType,
  isIntrinsicVoidType,
  isTypeFlagSet,
  unionTypeParts,
} from "ts-api-utils";
import ts, { SyntaxKind } from "typescript";
import { getParentFunctionNode, isLogicalExpression } from "../_utils";
import type { AnyNode } from "../../ast.ts";
import { createRule } from "../../index.ts";
import type { AST, Context, Suggestion } from "../../types.ts";

export const messages = {
  invalidVoidExpr:
    "Placing a void expression inside another expression is forbidden. " +
    "Move it to its own statement instead.",
  invalidVoidExprArrow:
    "Returning a void expression from an arrow function shorthand is forbidden. " +
    "Please add braces to the arrow function.",
  invalidVoidExprArrowWrapVoid:
    "Void expressions returned from an arrow function shorthand " +
    "must be marked explicitly with the `void` operator.",
  invalidVoidExprReturn:
    "Returning a void expression from a function is forbidden. " +
    "Please move it before the `return` statement.",
  invalidVoidExprReturnLast:
    "Returning a void expression from a function is forbidden. " +
    "Please remove the `return` statement.",
  invalidVoidExprReturnWrapVoid:
    "Void expressions returned from a function " +
    "must be marked explicitly with the `void` operator.",
  invalidVoidExprWrapVoid:
    "Void expressions used inside another expression " +
    "must be moved to its own statement " +
    "or marked explicitly with the `void` operator.",
  voidExprWrapVoid: "Mark with an explicit `void` operator.",
  addBraces: "Add braces.",
  removeReturn: "Remove the `return` keyword.",
  moveBeforeReturn: "Move before the `return` keyword.",
};

export type NoConfusingVoidExpressionOptions = {
  /**
   * Whether to ignore "shorthand" `() =>` arrow functions: those without `{ ... }` braces.
   * @default false
   */
  ignoreArrowShorthand?: boolean;
  /**
   * Whether to ignore returns that start with the `void` operator.
   * @default false
   */
  ignoreVoidOperator?: boolean;
  /**
   * Whether to ignore returns from functions with explicit `void` return types and functions with contextual `void` return types.
   * @default false
   */
  ignoreVoidReturningFunctions?: boolean;
};

export const noConfusingVoidExpression = createRule(
  (_options?: NoConfusingVoidExpressionOptions) => {
    const options = {
      ignoreArrowShorthand: false,
      ignoreVoidOperator: false,
      ignoreVoidReturningFunctions: false,
      ..._options,
    };

    function checkVoidExpression(
      node:
        | AST.AwaitExpression
        | AST.CallExpression
        | AST.TaggedTemplateExpression,
      context: Context,
    ): void {
      const type = context.utils.getConstrainedTypeAtLocation(node);
      if (!isTypeFlagSet(type, ts.TypeFlags.VoidLike)) {
        // not a void expression
        return;
      }

      const invalidAncestor = findInvalidAncestor(node, context);
      if (invalidAncestor === null) {
        // void expression is in valid position
        return;
      }

      const wrapVoidFix = (node: AST.Expression): Suggestion["changes"] => [
        { start: node.getStart(), length: 0, newText: "void " },
      ];

      if (invalidAncestor.kind === SyntaxKind.ArrowFunction) {
        // handle arrow function shorthand
        if (options.ignoreVoidReturningFunctions) {
          const returnsVoid = isVoidReturningFunctionNode(
            invalidAncestor,
            context,
          );

          if (returnsVoid) {
            return;
          }
        }

        if (options.ignoreVoidOperator) {
          // handle wrapping with `void`
          context.report({
            node,
            message: messages.invalidVoidExprArrowWrapVoid,
            suggestions: [
              {
                message: messages.voidExprWrapVoid,
                changes: wrapVoidFix(node),
              },
            ],
          });
          return;
        }

        // handle wrapping with braces
        const arrowFunction = invalidAncestor;
        context.report({
          node,
          message: messages.invalidVoidExprArrow,
          suggestions: canFix(arrowFunction, context)
            ? [
                {
                  message: messages.addBraces,
                  changes: [
                    {
                      start: arrowFunction.body.getStart(),
                      length: 0,
                      newText: "{ ",
                    },
                    {
                      start: arrowFunction.body.getEnd() + 1,
                      length: 0,
                      newText: " }",
                    },
                  ],
                },
              ]
            : undefined,
        });
        return;
      }

      if (invalidAncestor.kind === SyntaxKind.ReturnStatement) {
        // handle return statement
        if (options.ignoreVoidReturningFunctions) {
          const functionNode = getParentFunctionNode(invalidAncestor);

          if (functionNode) {
            const returnsVoid = isVoidReturningFunctionNode(
              functionNode,
              context,
            );

            if (returnsVoid) {
              return;
            }
          }
        }

        if (options.ignoreVoidOperator) {
          // handle wrapping with `void`
          context.report({
            node,
            message: messages.invalidVoidExprReturnWrapVoid,
            suggestions: [
              {
                message: messages.voidExprWrapVoid,
                changes: wrapVoidFix(node),
              },
            ],
          });
          return;
        }

        if (isFinalReturn(invalidAncestor)) {
          // remove the `return` keyword
          context.report({
            node,
            message: messages.invalidVoidExprReturnLast,
            suggestions: canFix(invalidAncestor, context)
              ? () => {
                  const returnValue = invalidAncestor.expression!;
                  const returnValueText = returnValue.getFullText().trimStart();
                  let newReturnStmtText = `${returnValueText};`;
                  if (isPreventingASI(returnValueText)) {
                    // put a semicolon at the beginning of the line
                    newReturnStmtText = `;${newReturnStmtText}`;
                  }
                  return [
                    {
                      message: messages.removeReturn,
                      changes: [
                        {
                          node: invalidAncestor,
                          newText: newReturnStmtText,
                        },
                      ],
                    },
                  ];
                }
              : undefined,
          });
          return;
        }

        // move before the `return` keyword
        context.report({
          node,
          message: messages.invalidVoidExprReturn,
          suggestions: () => {
            const returnValue = invalidAncestor.expression!;
            const returnValueText = returnValue.getFullText().trimStart();
            let newReturnStmtText = `${returnValueText}; return;`;
            if (isPreventingASI(returnValueText)) {
              // put a semicolon at the beginning of the line
              newReturnStmtText = `;${newReturnStmtText}`;
            }
            if (invalidAncestor.parent.kind !== SyntaxKind.Block) {
              // e.g. `if (cond) return console.error();`
              // add braces if not inside a block
              newReturnStmtText = `{ ${newReturnStmtText} }`;
            }
            return [
              {
                message: messages.moveBeforeReturn,
                changes: [
                  { node: invalidAncestor, newText: newReturnStmtText },
                ],
              },
            ];
          },
        });
        return;
      }

      // handle generic case
      if (options.ignoreVoidOperator) {
        context.report({
          node,
          message: messages.invalidVoidExprWrapVoid,
          suggestions: [
            {
              message: messages.voidExprWrapVoid,
              changes: wrapVoidFix(node),
            },
          ],
        });
        return;
      }

      context.report({
        node,
        message: messages.invalidVoidExpr,
      });
    }

    /**
     * Inspects the void expression's ancestors and finds closest invalid one.
     * By default anything other than an ExpressionStatement is invalid.
     * Parent expressions which can be used for their short-circuiting behavior
     * are ignored and their parents are checked instead.
     * @param node The void expression node to check.
     * @returns Invalid ancestor node if it was found. `null` otherwise.
     */
    function findInvalidAncestor(
      node: AST.AnyNode,
      context: Context,
    ): AST.AnyNode | null {
      const parent = node.parent as AnyNode;
      if (
        parent.kind === SyntaxKind.BinaryExpression &&
        parent.operatorToken.kind === SyntaxKind.CommaToken
      ) {
        if (node === parent.left) {
          return null;
        }
        if (node === parent.right) {
          return findInvalidAncestor(parent, context);
        }
      }

      if (parent.kind === SyntaxKind.ExpressionStatement) {
        // e.g. `{ console.log("foo"); }`
        // this is always valid
        return null;
      }

      if (
        parent.kind === SyntaxKind.BinaryExpression &&
        isLogicalExpression(parent.operatorToken)
      ) {
        if (parent.right === node) {
          // e.g. `x && console.log(x)`
          // this is valid only if the next ancestor is valid
          return findInvalidAncestor(parent, context);
        }
      }

      if (
        parent.kind === SyntaxKind.ConditionalExpression &&
        (parent.whenTrue === node || parent.whenFalse === node)
      ) {
        // e.g. `cond ? console.log(true) : console.log(false)`
        // this is valid only if the next ancestor is valid
        return findInvalidAncestor(parent, context);
      }

      if (
        parent.kind === SyntaxKind.ArrowFunction &&
        // e.g. `() => console.log("foo")`
        // this is valid with an appropriate option
        options.ignoreArrowShorthand
      ) {
        return null;
      }

      if (
        parent.kind === SyntaxKind.VoidExpression &&
        // e.g. `void console.log("foo")`
        // this is valid with an appropriate option
        options.ignoreVoidOperator
      ) {
        return null;
      }

      if (
        (parent.kind === SyntaxKind.PropertyAccessExpression &&
          parent.questionDotToken) ||
        parent.kind === SyntaxKind.ParenthesizedExpression
      ) {
        // e.g. console?.log('foo'), (foo ? a() : b())
        return findInvalidAncestor(parent, context);
      }

      // Any other parent is invalid.
      return parent;
    }

    /** Checks whether the return statement is the last statement in a function body. */
    function isFinalReturn(node: AST.ReturnStatement): boolean {
      // the parent must be a block
      const block = node.parent;
      if (block.kind !== SyntaxKind.Block) {
        // e.g. `if (cond) return;` (not in a block)
        return false;
      }

      // the block's parent must be a function
      const blockParent = block.parent;

      if (
        ![
          SyntaxKind.ArrowFunction,
          SyntaxKind.FunctionDeclaration,
          SyntaxKind.FunctionExpression,
        ].includes(blockParent.kind)
      ) {
        // e.g. `if (cond) { return; }`
        // not in a top-level function block
        return false;
      }

      // must be the last child of the block
      return block.statements.indexOf(node) === block.statements.length - 1;
    }

    /**
     * Checks whether the given text, if placed on its own line,
     * would prevent automatic semicolon insertion on the line before.
     *
     * This happens if the line begins with `(`, `[` or `` ` ``
     */
    function isPreventingASI(text: string): boolean {
      return ["(", "[", "`"].includes(text[0]);
    }

    function canFix(
      node: AST.ReturnStatement | AST.ArrowFunction,
      context: Context,
    ): boolean {
      const targetNode =
        node.kind === SyntaxKind.ReturnStatement ? node.expression! : node;

      const type = context.utils.getConstrainedTypeAtLocation(targetNode);
      return isTypeFlagSet(type, ts.TypeFlags.VoidLike);
    }

    function isFunctionReturnTypeIncludesVoid(functionType: ts.Type): boolean {
      const callSignatures = getCallSignaturesOfType(functionType);

      return callSignatures.some((signature) => {
        const returnType = signature.getReturnType();

        return unionTypeParts(returnType).some(isIntrinsicVoidType);
      });
    }

    function isVoidReturningFunctionNode(
      functionNode:
        | AST.ArrowFunction
        | AST.FunctionDeclaration
        | AST.MethodDeclaration
        | AST.FunctionExpression,
      context: Context,
    ): boolean {
      // Game plan:
      //   - If the function node has a type annotation, check if it includes `void`.
      //     - If it does then the function is safe to return `void` expressions in.
      //   - Otherwise, check if the function is a function-expression or an arrow-function.
      //   -   If it is, get its contextual type and bail if we cannot.
      //   - Return based on whether the contextual type includes `void` or not
      if (functionNode.type) {
        const returnType = context.checker.getTypeFromTypeNode(
          functionNode.type,
        );

        return unionTypeParts(returnType).some(isIntrinsicVoidType);
      }

      if (
        functionNode.kind === SyntaxKind.FunctionExpression ||
        functionNode.kind === SyntaxKind.ArrowFunction
      ) {
        const functionType = context.checker.getContextualType(functionNode);

        if (functionType) {
          return unionTypeParts(functionType).some(
            isFunctionReturnTypeIncludesVoid,
          );
        }
      }

      return false;
    }

    return {
      name: "core/noConfusingVoidExpression",
      visitor: {
        AwaitExpression: (node, context) => checkVoidExpression(node, context),
        CallExpression: (node, context) => checkVoidExpression(node, context),
        TaggedTemplateExpression: (node, context) =>
          checkVoidExpression(node, context),
      },
    };
  },
);
