import {
  isBigIntLiteralType,
  isBooleanLiteralType,
  isNumberLiteralType,
  isStringLiteralType,
  unionTypeParts,
} from "ts-api-utils";
import { SyntaxKind, TypeFlags } from "typescript";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";
import { typeHasFlag } from "../types-utils.ts";
import type { AST, Context, ReportDescriptor } from "../types.ts";
import { isLogicalExpression, isReferenceToGlobalFunction, run } from "./utils";
import { compareNodes } from "./utils/compareNodes.ts";
import {
  getOperatorPrecedence,
  getOperatorPrecedenceForNode,
  OperatorPrecedence,
} from "./utils/getOperatorPrecedence.ts";

const messages = {
  optionalChainSuggest: "Change to an optional chain.",
  preferOptionalChain:
    "Prefer using an optional chain expression instead, as it's more concise and easier to read.",
};

type OptionsInput = {
  checkAny?: boolean;
  checkBigInt?: boolean;
  checkBoolean?: boolean;
  checkNumber?: boolean;
  checkString?: boolean;
  checkUnknown?: boolean;
  requireNullish?: boolean;
};
type ParsedOptions = {
  checkAny: boolean;
  checkBigInt: boolean;
  checkBoolean: boolean;
  checkNumber: boolean;
  checkString: boolean;
  checkUnknown: boolean;
  requireNullish: boolean;
};

export const preferOptionalChain = createRule((_options?: OptionsInput) => {
  const options = {
    checkAny: true,
    checkBigInt: true,
    checkBoolean: true,
    checkNumber: true,
    checkString: true,
    checkUnknown: true,
    requireNullish: false,
    ..._options,
  };

  return {
    name: "core/preferOptionalChain",
    createData: () => ({ seenLogicals: new Set<AST.BinaryExpression>() }),
    visitor: {
      BinaryExpression(node, context) {
        if (context.data.seenLogicals.has(node)) {
          return;
        }

        const operator = node.operatorToken.kind;
        if (
          operator !== SyntaxKind.QuestionQuestionToken &&
          operator !== SyntaxKind.BarBarToken &&
          operator !== SyntaxKind.AmpersandAmpersandToken
        ) {
          return;
        }
        if (operator !== SyntaxKind.QuestionQuestionToken) {
          const { operands, newlySeenLogicals } = gatherLogicalOperands(
            node,
            context,
            options,
          );
          for (const logical of newlySeenLogicals) {
            context.data.seenLogicals.add(logical);
          }

          let currentChain: ValidOperand[] = [];
          for (const operand of operands) {
            if (operand.type === "Invalid") {
              analyzeChain(context, options, node, operator, currentChain);
              currentChain = [];
            } else {
              currentChain.push(operand);
            }
          }

          // make sure to check whatever's left
          if (currentChain.length > 0) {
            analyzeChain(context, options, node, operator, currentChain);
          }
        }
        if (
          operator === SyntaxKind.BarBarToken ||
          operator === SyntaxKind.QuestionQuestionToken
        ) {
          const leftNode = node.left;
          let rightNode = node.right;
          while (rightNode.kind === SyntaxKind.ParenthesizedExpression) {
            rightNode = rightNode.expression;
          }
          let parentNode: AST.LeftHandSideExpressionParent = node.parent;
          while (parentNode.kind === SyntaxKind.ParenthesizedExpression) {
            parentNode = parentNode.parent;
          }
          const isRightNodeAnEmptyObjectLiteral =
            rightNode.kind === SyntaxKind.ObjectLiteralExpression &&
            rightNode.properties.length === 0;
          if (
            !isRightNodeAnEmptyObjectLiteral ||
            (parentNode.kind !== SyntaxKind.ElementAccessExpression &&
              parentNode.kind !== SyntaxKind.PropertyAccessExpression) ||
            parentNode.questionDotToken
          ) {
            return;
          }

          checkNullishAndReport(context, options, [leftNode], {
            node: parentNode,
            message: messages.preferOptionalChain,
            suggestions: () => {
              const maybeWrappedLeftNode =
                getOperatorPrecedence(leftNode.kind, node.operatorToken.kind) <
                OperatorPrecedence.LeftHandSide
                  ? `(${leftNode.getText()})`
                  : leftNode.getText();
              return [
                {
                  message: messages.optionalChainSuggest,
                  changes: [
                    {
                      node: parentNode,
                      newText:
                        parentNode.kind === SyntaxKind.ElementAccessExpression
                          ? `${maybeWrappedLeftNode}?.[${parentNode.argumentExpression.getText()}]`
                          : `${maybeWrappedLeftNode}?.${parentNode.name.getText()}`,
                    },
                  ],
                },
              ];
            },
          });
        }
      },
    },
  };
});

type ValidOperand = {
  type: "Valid";
  comparedName: AST.Expression;
  comparisonType:
    | "NotEqualNullOrUndefined" /** `x != null`, `x != undefined` */
    | "EqualNullOrUndefined" /** `x == null`, `x == undefined` */
    | "NotStrictEqualNull" /** `x !== null` */
    | "StrictEqualNull" /** `x === null` */
    | "NotStrictEqualUndefined" /** `x !== undefined`, `typeof x !== 'undefined'` */
    | "StrictEqualUndefined" /** `x === undefined`, `typeof x === 'undefined'` */
    | "NotBoolean" /** `!x` */
    | "Boolean" /** `x` */;
  isYoda: boolean;
  node: AST.Expression;
};
type Operand = ValidOperand | { type: "Invalid" };
function gatherLogicalOperands(
  node: AST.BinaryExpression,
  context: Context,
  options: ParsedOptions,
) {
  const result: Operand[] = [];
  const { operands, newlySeenLogicals } = flattenLogicalOperands(node);

  for (const operand of operands) {
    const areMoreOperands = operand !== operands.at(-1);
    switch (operand.kind) {
      case SyntaxKind.BinaryExpression: {
        if (isLogicalExpression(operand.operatorToken)) {
          // explicitly ignore the mixed logical expression cases
          result.push({ type: "Invalid" });
          continue;
        }

        // check for "yoda" style logical: null != x

        const { comparedExpression, comparedValue, isYoda } = (() => {
          // non-yoda checks are by far the most common, so check for them first
          const comparedValueRight = getComparisonValueType(operand.right);
          if (comparedValueRight) {
            return {
              comparedExpression: operand.left,
              comparedValue: comparedValueRight,
              isYoda: false,
            };
          }
          return {
            comparedExpression: operand.right,
            comparedValue: getComparisonValueType(operand.left),
            isYoda: true,
          };
        })();

        if (comparedValue === "UndefinedStringLiteral") {
          if (comparedExpression.kind === SyntaxKind.TypeOfExpression) {
            const argument = comparedExpression.expression;
            if (
              argument.kind === SyntaxKind.Identifier &&
              // typeof window === 'undefined'
              isReferenceToGlobalFunction(argument, context)
            ) {
              result.push({ type: "Invalid" });
              continue;
            }

            // typeof x.y === 'undefined'
            result.push({
              comparedName: argument,
              comparisonType:
                operand.operatorToken.kind ===
                  SyntaxKind.ExclamationEqualsEqualsToken ||
                operand.operatorToken.kind === SyntaxKind.ExclamationEqualsToken
                  ? "NotStrictEqualUndefined"
                  : "StrictEqualUndefined",
              isYoda,
              node: operand,
              type: "Valid",
            });
            continue;
          }

          // y === 'undefined'
          result.push({ type: "Invalid" });
          continue;
        }

        switch (operand.operatorToken.kind) {
          case SyntaxKind.ExclamationEqualsToken:
          case SyntaxKind.EqualsEqualsToken:
            if (comparedValue === "Null" || comparedValue === "Undefined") {
              // x == null, x == undefined
              result.push({
                comparedName: comparedExpression,
                comparisonType:
                  operand.operatorToken.kind ===
                  SyntaxKind.ExclamationEqualsToken
                    ? "NotEqualNullOrUndefined"
                    : "EqualNullOrUndefined",
                isYoda,
                node: operand,
                type: "Valid",
              });
              continue;
            }
            // x == something :(
            result.push({ type: "Invalid" });
            continue;

          case SyntaxKind.ExclamationEqualsEqualsToken:
          case SyntaxKind.EqualsEqualsEqualsToken: {
            const comparedName = comparedExpression;
            switch (comparedValue) {
              case "Null":
                result.push({
                  comparedName,
                  comparisonType:
                    operand.operatorToken.kind ===
                    SyntaxKind.ExclamationEqualsEqualsToken
                      ? "NotStrictEqualNull"
                      : "StrictEqualNull",
                  isYoda,
                  node: operand,
                  type: "Valid",
                });
                continue;

              case "Undefined":
                result.push({
                  comparedName,
                  comparisonType:
                    operand.operatorToken.kind ===
                    SyntaxKind.ExclamationEqualsEqualsToken
                      ? "NotStrictEqualUndefined"
                      : "StrictEqualUndefined",
                  isYoda,
                  node: operand,
                  type: "Valid",
                });
                continue;

              default:
                // x === something :(
                result.push({ type: "Invalid" });
                continue;
            }
          }
        }

        result.push({ type: "Invalid" });
        continue;
      }

      case SyntaxKind.PrefixUnaryExpression:
        if (
          operand.operator === SyntaxKind.ExclamationToken &&
          isValidFalseBooleanCheckType(
            operand.operand,
            areMoreOperands &&
              node.operatorToken.kind === SyntaxKind.BarBarToken,
            context,
            options,
          )
        ) {
          result.push({
            comparedName: operand.operand,
            comparisonType: "NotBoolean",
            isYoda: false,
            node: operand,
            type: "Valid",
          });
          continue;
        }
        result.push({ type: "Invalid" });
        continue;

      default:
        if (
          isValidFalseBooleanCheckType(
            operand,
            areMoreOperands &&
              node.operatorToken.kind === SyntaxKind.AmpersandAmpersandToken,
            context,
            options,
          )
        ) {
          result.push({
            comparedName: operand,
            comparisonType: "Boolean",
            isYoda: false,
            node: operand,
            type: "Valid",
          });
        } else {
          result.push({ type: "Invalid" });
        }
        continue;
    }
  }

  return { operands: result, newlySeenLogicals };

  /*
  The AST is always constructed such the first element is always the deepest element.
  I.e. for this code: `foo && foo.bar && foo.bar.baz && foo.bar.baz.buzz`
  The AST will look like this:
  {
    left: {
      left: {
        left: foo
        right: foo.bar
      }
      right: foo.bar.baz
    }
    right: foo.bar.baz.buzz
  }

  So given any logical expression, we can perform a depth-first traversal to get
  the operands in order.

  Note that this function purposely does not inspect mixed logical expressions
  like `foo || foo.bar && foo.bar.baz` - separate selector
  */
  function flattenLogicalOperands(node: AST.BinaryExpression) {
    const operands: AST.Expression[] = [];
    const newlySeenLogicals = new Set<AST.BinaryExpression>();

    const stack: AST.Expression[] = [node.right, node.left];
    let current: AST.Expression | undefined;
    while ((current = stack.pop())) {
      if (
        current.kind === SyntaxKind.BinaryExpression &&
        isLogicalExpression(current.operatorToken) &&
        current.operatorToken.kind === node.operatorToken.kind
      ) {
        newlySeenLogicals.add(current);
        stack.push(current.right);
        stack.push(current.left);
      } else if (current.kind === SyntaxKind.ParenthesizedExpression) {
        stack.push(current.expression);
      } else {
        operands.push(current);
      }
    }

    return { operands, newlySeenLogicals };
  }

  type ComparisonValueType = "Null" | "Undefined" | "UndefinedStringLiteral";

  function getComparisonValueType(
    node: AST.AnyNode,
  ): ComparisonValueType | null {
    if (node.kind === SyntaxKind.NullKeyword) {
      return "Null";
    }
    if (node.kind === SyntaxKind.Identifier && node.text === "undefined") {
      return "Undefined";
    }
    if (node.kind === SyntaxKind.StringLiteral && node.text === "undefined") {
      return "UndefinedStringLiteral";
    }
    return null;
  }
}

function isValidFalseBooleanCheckType(
  node: AST.AnyNode,
  disallowFalseyLiteral: boolean,
  context: Context,
  options: ParsedOptions,
): boolean {
  const type = context.checker.getTypeAtLocation(node);
  const types = unionTypeParts(type);

  if (
    disallowFalseyLiteral &&
    /*
    ```
    declare const x: false | {a: string};
    x && x.a;
    !x || x.a;
    ```

    We don't want to consider these two cases because the boolean expression
    narrows out the non-nullish falsy cases - so converting the chain to `x?.a`
    would introduce a build error
    */ (types.some(
      (t) => isBooleanLiteralType(t) && t.intrinsicName === "false",
    ) ||
      types.some((t) => isStringLiteralType(t) && t.value === "") ||
      types.some((t) => isNumberLiteralType(t) && t.value === 0) ||
      types.some((t) => isBigIntLiteralType(t) && t.value.base10Value === "0"))
  ) {
    return false;
  }

  let allowedFlags = TypeFlags.Null | TypeFlags.Undefined | TypeFlags.Object;
  if (options.checkAny) allowedFlags |= TypeFlags.Any;
  if (options.checkUnknown) allowedFlags |= TypeFlags.Unknown;
  if (options.checkString) allowedFlags |= TypeFlags.StringLike;
  if (options.checkNumber) allowedFlags |= TypeFlags.NumberLike;
  if (options.checkBoolean) allowedFlags |= TypeFlags.BooleanLike;
  if (options.checkBigInt) allowedFlags |= TypeFlags.BigIntLike;
  return types.every((t) => typeHasFlag(t, allowedFlags));
}

function checkNullishAndReport(
  context: Context,
  options: ParsedOptions,
  maybeNullishNodes: AST.Expression[],
  descriptor: ReportDescriptor,
): void {
  if (
    !options.requireNullish ||
    maybeNullishNodes.some((node) =>
      unionTypeParts(context.checker.getTypeAtLocation(node)).some((t) =>
        typeHasFlag(t, TypeFlags.Null | TypeFlags.Undefined),
      ),
    )
  ) {
    context.report(descriptor);
  }
}

function analyzeChain(
  context: Context,
  options: ParsedOptions,
  node: AST.BinaryExpression,
  operator: SyntaxKind.AmpersandAmpersandToken | SyntaxKind.BarBarToken,
  chain: ValidOperand[],
): void {
  // need at least 2 operands in a chain for it to be a chain
  if (chain.length <= 1) return;

  const analyzeOperand = run(() => {
    switch (operator) {
      case SyntaxKind.AmpersandAmpersandToken:
        return analyzeAndChainOperand;
      case SyntaxKind.BarBarToken:
        return analyzeOrChainOperand;
    }
  });

  // Things like x !== null && x !== undefined have two nodes, but they are
  // one logical unit here, so we'll allow them to be grouped.
  let subChain: (readonly ValidOperand[] | ValidOperand)[] = [];
  const maybeReportThenReset = (
    newChainSeed?: readonly [ValidOperand, ...ValidOperand[]],
  ): void => {
    if (subChain.length > 1) {
      const subChainFlat = subChain.flat();
      checkNullishAndReport(
        context,
        options,
        subChainFlat.slice(0, -1).map(({ node }) => node),
        getReportDescriptor(node, subChainFlat),
      );
    }

    // we've reached the end of a chain of logical expressions
    // i.e. the current operand doesn't belong to the previous chain.
    //
    // we don't want to throw away the current operand otherwise we will skip it
    // and that can cause us to miss chains. So instead we seed the new chain
    // with the current operand
    //
    // eg this means we can catch cases like:
    //     unrelated != null && foo != null && foo.bar != null;
    //     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ first "chain"
    //                          ^^^^^^^^^^^ newChainSeed
    //                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ second chain
    subChain = newChainSeed ? [newChainSeed] : [];
  };

  for (let i = 0; i < chain.length; i += 1) {
    const lastOperand = subChain.flat().at(-1);
    const operand = chain[i];

    const validatedOperands = analyzeOperand(context, operand, i, chain);
    if (!validatedOperands) {
      // TODO - #7170
      // check if the name is a superset/equal - if it is, then it likely
      // intended to be part of the chain and something we should include in the
      // report, eg
      //     foo == null || foo.bar;
      //     ^^^^^^^^^^^ valid OR chain
      //                    ^^^^^^^ invalid OR chain logical, but still part of
      //                            the chain for combination purposes

      maybeReportThenReset();
      continue;
    }
    // in case multiple operands were consumed - make sure to correctly increment the index
    i += validatedOperands.length - 1;

    const currentOperand = validatedOperands[0];
    if (lastOperand) {
      const comparisonResult = compareNodes(
        lastOperand.comparedName,
        // purposely inspect and push the last operand because the prior operands don't matter
        // this also means we won't false-positive in cases like
        // foo !== null && foo !== undefined
        validatedOperands[validatedOperands.length - 1].comparedName,
      );
      if (comparisonResult === "Subset") {
        // the operands are comparable, so we can continue searching
        subChain.push(currentOperand);
      } else if (comparisonResult === "Invalid") {
        maybeReportThenReset(validatedOperands);
      } else {
        // purposely don't push this case because the node is a no-op and if
        // we consider it then we might report on things like
        // foo && foo
      }
    } else {
      subChain.push(currentOperand);
    }
  }

  // check the leftovers
  maybeReportThenReset();
}

// I hate that these functions are identical aside from the enum values used
// I can't think of a good way to reuse the code here in a way that will preserve
// the type safety and simplicity.

type OperandAnalyzer = (
  context: Context,
  operand: ValidOperand,
  index: number,
  chain: readonly ValidOperand[],
) => readonly [ValidOperand, ValidOperand] | readonly [ValidOperand] | null;
const analyzeAndChainOperand: OperandAnalyzer = (
  context,
  operand,
  index,
  chain,
) => {
  switch (operand.comparisonType) {
    case "Boolean": {
      const nextOperand = chain.at(index + 1);
      if (
        nextOperand?.comparisonType === "NotStrictEqualNull" &&
        operand.comparedName.kind === SyntaxKind.Identifier
      ) {
        return null;
      }
      return [operand];
    }

    case "NotEqualNullOrUndefined":
      return [operand];

    case "NotStrictEqualNull": {
      // handle `x !== null && x !== undefined`
      const nextOperand = chain.at(index + 1);
      if (
        nextOperand?.comparisonType === "NotStrictEqualUndefined" &&
        compareNodes(operand.comparedName, nextOperand.comparedName) === "Equal"
      ) {
        return [operand, nextOperand];
      }
      if (includesType(context, operand.comparedName, TypeFlags.Undefined)) {
        // we know the next operand is not an `undefined` check and that this
        // operand includes `undefined` - which means that making this an
        // optional chain would change the runtime behavior of the expression
        return null;
      }

      return [operand];
    }

    case "NotStrictEqualUndefined": {
      // handle `x !== undefined && x !== null`
      const nextOperand = chain.at(index + 1);
      if (
        nextOperand?.comparisonType === "NotStrictEqualNull" &&
        compareNodes(operand.comparedName, nextOperand.comparedName) === "Equal"
      ) {
        return [operand, nextOperand];
      }
      if (includesType(context, operand.comparedName, TypeFlags.Null)) {
        // we know the next operand is not a `null` check and that this
        // operand includes `null` - which means that making this an
        // optional chain would change the runtime behavior of the expression
        return null;
      }

      return [operand];
    }

    default:
      return null;
  }
};
const analyzeOrChainOperand: OperandAnalyzer = (
  context,
  operand,
  index,
  chain,
) => {
  switch (operand.comparisonType) {
    case "NotBoolean":
    case "EqualNullOrUndefined":
      return [operand];

    case "StrictEqualNull": {
      // handle `x === null || x === undefined`
      const nextOperand = chain.at(index + 1);
      if (
        nextOperand?.comparisonType === "StrictEqualUndefined" &&
        compareNodes(operand.comparedName, nextOperand.comparedName) === "Equal"
      ) {
        return [operand, nextOperand];
      }
      if (includesType(context, operand.comparedName, TypeFlags.Undefined)) {
        // we know the next operand is not an `undefined` check and that this
        // operand includes `undefined` - which means that making this an
        // optional chain would change the runtime behavior of the expression
        return null;
      }

      return [operand];
    }

    case "StrictEqualUndefined": {
      // handle `x === undefined || x === null`
      const nextOperand = chain.at(index + 1);
      if (
        nextOperand?.comparisonType === "StrictEqualNull" &&
        compareNodes(operand.comparedName, nextOperand.comparedName) === "Equal"
      ) {
        return [operand, nextOperand];
      }
      if (includesType(context, operand.comparedName, TypeFlags.Null)) {
        // we know the next operand is not a `null` check and that this
        // operand includes `null` - which means that making this an
        // optional chain would change the runtime behavior of the expression
        return null;
      }

      return [operand];
    }

    default:
      return null;
  }
};

function includesType(
  context: Context,
  node: AST.Expression,
  typeFlagIn: TypeFlags,
): boolean {
  const typeFlag = typeFlagIn | TypeFlags.Any | TypeFlags.Unknown;
  const types = unionTypeParts(context.checker.getTypeAtLocation(node));
  return types.some((t) => typeHasFlag(t, typeFlag));
}

function getReportDescriptor(
  node: AST.BinaryExpression,
  chain: ValidOperand[],
): ReportDescriptor {
  const lastOperand = chain[chain.length - 1];

  // In its most naive form we could just slap `?.` for every single part of the
  // chain. However this would be undesirable because it'd create unnecessary
  // conditions in the user's code where there were none before - and it would
  // cause errors with rules like our `no-unnecessary-condition`.
  //
  // Instead we want to include the minimum number of `?.` required to correctly
  // unify the code into a single chain. Naively you might think that we can
  // just take the final operand add `?.` after the locations from the previous
  // operands - however this won't be correct either because earlier operands
  // can include a necessary `?.` that's not needed or included in a later
  // operand.
  //
  // So instead what we need to do is to start at the first operand and
  // iteratively diff it against the next operand, and add the difference to the
  // first operand.
  //
  // eg
  // `foo && foo.bar && foo.bar.baz?.bam && foo.bar.baz.bam()`
  // 1) `foo`
  // 2) diff(`foo`, `foo.bar`) = `.bar`
  // 3) result = `foo?.bar`
  // 4) diff(`foo.bar`, `foo.bar.baz?.bam`) = `.baz?.bam`
  // 5) result = `foo?.bar?.baz?.bam`
  // 6) diff(`foo.bar.baz?.bam`, `foo.bar.baz.bam()`) = `()`
  // 7) result = `foo?.bar?.baz?.bam?.()`

  const parts = [];
  for (const current of chain) {
    const nextOperand = flattenChainExpression(current.comparedName);
    const diff = nextOperand.slice(parts.length);
    if (diff.length > 0) {
      if (parts.length > 0) {
        // we need to make the first operand of the diff optional so it matches the
        // logic before merging
        // foo.bar && foo.bar.baz
        // diff = .baz
        // result = foo.bar?.baz
        diff[0].optional = true;
      }
      parts.push(...diff);
    }
  }

  let newCode = parts
    .map((part) => {
      let str = "";
      if (part.optional) {
        str += "?.";
      } else {
        if (part.nonNull) {
          str += "!";
        }
        if (part.requiresDot) {
          str += ".";
        }
      }
      if (
        part.precedence !== OperatorPrecedence.Invalid &&
        part.precedence < OperatorPrecedence.Member
      ) {
        str += `(${part.text})`;
      } else {
        str += part.text;
      }
      return str;
    })
    .join("");

  if (lastOperand.node.kind === SyntaxKind.BinaryExpression) {
    // retain the ending comparison for cases like
    // x && x.a != null
    // x && typeof x.a !== 'undefined'
    const getUnaryOperator = (node: AST.Expression) => {
      switch (node.kind) {
        case SyntaxKind.TypeOfExpression:
          return "typeof ";
        case SyntaxKind.VoidExpression:
          return "void ";
        case SyntaxKind.PrefixUnaryExpression:
          switch (node.operator) {
            case SyntaxKind.PlusPlusToken:
              return "++";
            case SyntaxKind.MinusMinusToken:
              return "--";
            case SyntaxKind.PlusToken:
              return "+";
            case SyntaxKind.MinusToken:
              return "-";
            case SyntaxKind.TildeToken:
              return "~";
            case SyntaxKind.ExclamationToken:
              return "!";
          }
        default:
          return "";
      }
    };
    const { left, right } = (() => {
      if (lastOperand.isYoda) {
        const unaryOperator = getUnaryOperator(lastOperand.node.right);
        return {
          left: lastOperand.node.left.getText(),
          right: unaryOperator + newCode,
        };
      }
      const unaryOperator = getUnaryOperator(lastOperand.node.left);
      return {
        left: unaryOperator + newCode,
        right: lastOperand.node.right.getText(),
      };
    })();

    newCode = `${left} ${lastOperand.node.operatorToken.getText()} ${right}`;
  } else if (lastOperand.comparisonType === "NotBoolean") {
    newCode = `!${newCode}`;
  }

  const getToken = (index: number) => node.getText()[index - node.getStart()];
  let start = chain[0].node.getStart();
  while (getToken(start - 1) === "(") start--;
  let end = lastOperand.node.getEnd();
  while (getToken(end) === ")") end++;

  return {
    start,
    end,
    message: messages.preferOptionalChain,
    suggestions: [
      {
        message: messages.optionalChainSuggest,
        changes: [{ start, end, newText: newCode }],
      },
    ],
  };

  type FlattenedChain = {
    nonNull: boolean;
    optional: boolean;
    precedence: OperatorPrecedence;
    requiresDot: boolean;
    text: string;
  };
  function flattenChainExpression(node: AST.Expression): FlattenedChain[] {
    switch (node.kind) {
      case SyntaxKind.CallExpression: {
        const argsStart =
          node.questionDotToken?.getEnd() ?? node.expression.getEnd();
        return [
          ...flattenChainExpression(node.expression),
          {
            nonNull: false,
            optional: node.questionDotToken !== undefined,
            // no precedence for this
            precedence: OperatorPrecedence.Invalid,
            requiresDot: false,
            text: node
              .getText()
              .slice(argsStart - node.getStart())
              .trim(),
          },
        ];
      }

      case SyntaxKind.PropertyAccessExpression: {
        return [
          ...flattenChainExpression(node.expression),
          {
            nonNull: node.expression.kind === SyntaxKind.NonNullExpression,
            optional: node.questionDotToken !== undefined,
            precedence: getOperatorPrecedenceForNode(node.name),
            requiresDot: true,
            text: node.name.getText(),
          },
        ];
      }
      case SyntaxKind.ElementAccessExpression: {
        return [
          ...flattenChainExpression(node.expression),
          {
            nonNull: node.expression.kind === SyntaxKind.NonNullExpression,
            optional: node.questionDotToken !== undefined,
            // computed is already wrapped in [] so no need to wrap in () as well
            precedence: OperatorPrecedence.Invalid,
            requiresDot: false,
            text: `[${node.argumentExpression.getText()}]`,
          },
        ];
      }

      case SyntaxKind.NonNullExpression:
        return flattenChainExpression(node.expression);

      default:
        return [
          {
            nonNull: false,
            optional: false,
            precedence: getOperatorPrecedenceForNode(node),
            requiresDot: false,
            text: node.getText(),
          },
        ];
    }
  }
}

/** Tests */
const getBaseCases = ({
  operator,
  mutateCode = (c) => c,
  mutateDeclaration = (c) => c,
  mutateOutput = mutateCode,
}: {
  operator: "&&" | "||";
  mutateCode?: (c: string) => string;
  mutateDeclaration?: (c: string) => string;
  mutateOutput?: (c: string) => string;
}) =>
  [
    // chained members
    {
      chain: `foo ${operator} foo.bar;`,
      declaration: "declare const foo: {bar: number} | null | undefined;",
      outputChain: "foo?.bar;",
    },
    {
      chain: `foo.bar ${operator} foo.bar.baz;`,
      declaration:
        "declare const foo: {bar: {baz: number} | null | undefined};",
      outputChain: "foo.bar?.baz;",
    },
    {
      chain: `foo ${operator} foo();`,
      declaration: "declare const foo: (() => number) | null | undefined;",
      outputChain: "foo?.();",
    },
    {
      chain: `foo.bar ${operator} foo.bar();`,
      declaration:
        "declare const foo: {bar: (() => number) | null | undefined};",
      outputChain: "foo.bar?.();",
    },
    {
      chain: `foo ${operator} foo.bar ${operator} foo.bar.baz ${operator} foo.bar.baz.buzz;`,
      declaration:
        "declare const foo: {bar: {baz: {buzz: number} | null | undefined} | null | undefined} | null | undefined;",
      outputChain: "foo?.bar?.baz?.buzz;",
    },
    {
      chain: `foo.bar ${operator} foo.bar.baz ${operator} foo.bar.baz.buzz;`,
      declaration:
        "declare const foo: {bar: {baz: {buzz: number} | null | undefined} | null | undefined};",
      outputChain: "foo.bar?.baz?.buzz;",
    },
    // case with a jump (i.e. a non-nullish prop)
    {
      chain: `foo ${operator} foo.bar ${operator} foo.bar.baz.buzz;`,
      declaration:
        "declare const foo: {bar: {baz: {buzz: number}} | null | undefined} | null | undefined;",
      outputChain: "foo?.bar?.baz.buzz;",
    },
    {
      chain: `foo.bar ${operator} foo.bar.baz.buzz;`,
      declaration:
        "declare const foo: {bar: {baz: {buzz: number}} | null | undefined};",
      outputChain: "foo.bar?.baz.buzz;",
    },
    // case where for some reason there is a doubled up expression
    {
      chain: `foo ${operator} foo.bar ${operator} foo.bar.baz ${operator} foo.bar.baz ${operator} foo.bar.baz.buzz;`,
      declaration:
        "declare const foo: {bar: {baz: {buzz: number} | null | undefined} | null | undefined} | null | undefined;",
      outputChain: "foo?.bar?.baz?.buzz;",
    },
    {
      chain: `foo.bar ${operator} foo.bar.baz ${operator} foo.bar.baz ${operator} foo.bar.baz.buzz;`,
      declaration:
        "declare const foo: {bar: {baz: {buzz: number} | null | undefined} | null | undefined} | null | undefined;",
      outputChain: "foo.bar?.baz?.buzz;",
    },
    // chained members with element access
    {
      chain: `foo ${operator} foo[bar] ${operator} foo[bar].baz ${operator} foo[bar].baz.buzz;`,
      declaration: [
        "declare const bar: string;",
        "declare const foo: {[k: string]: {baz: {buzz: number} | null | undefined} | null | undefined} | null | undefined;",
      ].join("\n"),
      outputChain: "foo?.[bar]?.baz?.buzz;",
    },
    {
      // case with a jump (i.e. a non-nullish prop)
      chain: `foo ${operator} foo[bar].baz ${operator} foo[bar].baz.buzz;`,
      declaration: [
        "declare const bar: string;",
        "declare const foo: {[k: string]: {baz: {buzz: number} | null | undefined} | null | undefined} | null | undefined;",
      ].join("\n"),
      outputChain: "foo?.[bar].baz?.buzz;",
    },
    // case with a property access in computed property
    {
      chain: `foo ${operator} foo[bar.baz] ${operator} foo[bar.baz].buzz;`,
      declaration: [
        "declare const bar: {baz: string};",
        "declare const foo: {[k: string]: {buzz: number} | null | undefined} | null | undefined;",
      ].join("\n"),
      outputChain: "foo?.[bar.baz]?.buzz;",
    },
    // chained calls
    {
      chain: `foo ${operator} foo.bar ${operator} foo.bar.baz ${operator} foo.bar.baz.buzz();`,
      declaration:
        "declare const foo: {bar: {baz: {buzz: () => number} | null | undefined} | null | undefined} | null | undefined;",
      outputChain: "foo?.bar?.baz?.buzz();",
    },
    {
      chain: `foo ${operator} foo.bar ${operator} foo.bar.baz ${operator} foo.bar.baz.buzz ${operator} foo.bar.baz.buzz();`,
      declaration:
        "declare const foo: {bar: {baz: {buzz: (() => number) | null | undefined} | null | undefined} | null | undefined} | null | undefined;",
      outputChain: "foo?.bar?.baz?.buzz?.();",
    },
    {
      chain: `foo.bar ${operator} foo.bar.baz ${operator} foo.bar.baz.buzz ${operator} foo.bar.baz.buzz();`,
      declaration:
        "declare const foo: {bar: {baz: {buzz: (() => number) | null | undefined} | null | undefined} | null | undefined};",
      outputChain: "foo.bar?.baz?.buzz?.();",
    },
    // case with a jump (i.e. a non-nullish prop)
    {
      chain: `foo ${operator} foo.bar ${operator} foo.bar.baz.buzz();`,
      declaration:
        "declare const foo: {bar: {baz: {buzz: () => number}} | null | undefined} | null | undefined;",
      outputChain: "foo?.bar?.baz.buzz();",
    },
    {
      chain: `foo.bar ${operator} foo.bar.baz.buzz();`,
      declaration:
        "declare const foo: {bar: {baz: {buzz: () => number}} | null | undefined};",
      outputChain: "foo.bar?.baz.buzz();",
    },
    {
      // case with a jump (i.e. a non-nullish prop)
      chain: `foo ${operator} foo.bar ${operator} foo.bar.baz.buzz ${operator} foo.bar.baz.buzz();`,
      declaration:
        "declare const foo: {bar: {baz: {buzz: (() => number) | null | undefined}} | null | undefined} | null | undefined;",
      outputChain: "foo?.bar?.baz.buzz?.();",
    },
    {
      // case with a call expr inside the chain for some inefficient reason
      chain: `foo.bar ${operator} foo.bar() ${operator} foo.bar().baz ${operator} foo.bar().baz.buzz ${operator} foo.bar().baz.buzz();`,
      declaration:
        "declare const foo: {bar: () => ({baz: {buzz: (() => number) | null | undefined} | null | undefined}) | null | undefined};",
      outputChain: "foo.bar?.()?.baz?.buzz?.();",
    },
    // chained calls with element access
    {
      chain: `foo ${operator} foo.bar ${operator} foo.bar.baz ${operator} foo.bar.baz[buzz]();`,
      declaration: [
        "declare const buzz: string;",
        "declare const foo: {bar: {baz: {[k: string]: () => number} | null | undefined} | null | undefined} | null | undefined;",
      ].join("\n"),
      outputChain: "foo?.bar?.baz?.[buzz]();",
    },
    {
      chain: `foo ${operator} foo.bar ${operator} foo.bar.baz ${operator} foo.bar.baz[buzz] ${operator} foo.bar.baz[buzz]();`,
      declaration: [
        "declare const buzz: string;",
        "declare const foo: {bar: {baz: {[k: string]: (() => number) | null | undefined} | null | undefined} | null | undefined} | null | undefined;",
      ].join("\n"),
      outputChain: "foo?.bar?.baz?.[buzz]?.();",
    },
    // (partially) pre-optional chained
    {
      chain: `foo ${operator} foo?.bar ${operator} foo?.bar.baz ${operator} foo?.bar.baz[buzz] ${operator} foo?.bar.baz[buzz]();`,
      declaration: [
        "declare const buzz: string;",
        "declare const foo: {bar: {baz: {[k: string]: (() => number) | null | undefined} | null | undefined} | null | undefined} | null | undefined;",
      ].join("\n"),
      outputChain: "foo?.bar?.baz?.[buzz]?.();",
    },
    {
      chain: `foo ${operator} foo?.bar.baz ${operator} foo?.bar.baz[buzz];`,
      declaration: [
        "declare const buzz: string;",
        "declare const foo: {bar: {baz: {[k: string]: number} | null | undefined}} | null | undefined;",
      ].join("\n"),
      outputChain: "foo?.bar.baz?.[buzz];",
    },
    {
      chain: `foo ${operator} foo?.() ${operator} foo?.().bar;`,
      declaration:
        "declare const foo: (() => ({bar: number} | null | undefined)) | null | undefined;",
      outputChain: "foo?.()?.bar;",
    },
    {
      chain: `foo.bar ${operator} foo.bar?.() ${operator} foo.bar?.().baz;`,
      declaration:
        "declare const foo: {bar: () => ({baz: number} | null | undefined)};",
      outputChain: "foo.bar?.()?.baz;",
    },
  ].map(({ chain, declaration: originalDeclaration, outputChain }) => {
    const declaration = mutateDeclaration(originalDeclaration);
    const code = `${declaration}\n${mutateCode(chain)}`;
    const output = `${declaration}\n${mutateOutput(outputChain)}`;
    return {
      code,
      errors: [
        {
          message: messages.preferOptionalChain,
          suggestions: [{ message: messages.optionalChainSuggest, output }],
        },
      ],
    };
  });

export const test = () =>
  ruleTester({
    ruleFn: preferOptionalChain,
    valid: [
      "foo || {};",
      "foo || ({} as any);",
      "(foo || {})?.bar;",
      "(foo || { bar: 1 }).bar;",
      "(undefined && (foo || {})).bar;",
      "foo ||= bar || {};",
      "foo ||= bar?.baz || {};",
      "(foo1 ? foo2 : foo3 || {}).foo4;",
      "(foo = 2 || {}).bar;",
      "func(foo || {}).bar;",
      "foo ?? {};",
      "(foo ?? {})?.bar;",
      "foo ||= bar ?? {};",
      // https://github.com/typescript-eslint/typescript-eslint/issues/8380
      `
      const a = null;
      const b = 0;
      a === undefined || b === null || b === undefined;
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/8380
      `
      const a = 0;
      const b = 0;
      a === undefined || b === undefined || b === null;
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/8380
      `
      const a = 0;
      const b = 0;
      b === null || a === undefined || b === undefined;
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/8380
      `
      const b = 0;
      b === null || b === undefined;
    `,
      // https://github.com/typescript-eslint/typescript-eslint/issues/8380
      `
      const a = 0;
      const b = 0;
      b != null && a !== null && a !== undefined;
    `,
      "!a || !b;",
      "!a || a.b;",
      "!a && a.b;",
      "!a && !a.b;",
      "!a.b || a.b?.();",
      "!a.b || a.b();",
      "foo ||= bar;",
      "foo ||= bar?.baz;",
      "foo ||= bar?.baz?.buzz;",
      "foo && bar;",
      "foo && foo;",
      "foo || bar;",
      "foo ?? bar;",
      "foo || foo.bar;",
      "foo ?? foo.bar;",
      "file !== 'index.ts' && file.endsWith('.ts');",
      "nextToken && sourceCode.isSpaceBetweenTokens(prevToken, nextToken);",
      "result && this.options.shouldPreserveNodeMaps;",
      "foo && fooBar.baz;",
      "match && match$1 !== undefined;",
      "typeof foo === 'number' && foo.toFixed();",
      "foo === 'undefined' && foo.length;",
      "foo == bar && foo.bar == null;",
      "foo === 1 && foo.toFixed();", // call arguments are considered
      "foo.bar(a) && foo.bar(a, b).baz;", // type parameters are considered
      "foo.bar<a>() && foo.bar<a, b>().baz;", // array elements are considered
      "[1, 2].length && [1, 2, 3].length.toFixed();",
      `[1,].length && [1, 2].length.toFixed();`, // short-circuiting chains are considered
      "(foo?.a).b && foo.a.b.c;",
      "(foo?.a)() && foo.a().b;",
      "(foo?.a)() && foo.a()();", // looks like a chain, but isn't actually a chain - just a pair of strict nullish checks
      "foo !== null && foo !== undefined;",
      "x['y'] !== undefined && x['y'] !== null;", // private properties
      "this.#a && this.#b;",
      "!this.#a || !this.#b;",
      "a.#foo?.bar;",
      "!a.#foo?.bar;",
      "!foo().#a || a;",
      "!a.b.#a || a;",
      "!new A().#b || a;",
      "!(await a).#b || a;",
      "!(foo as any).bar || 'anything';", // computed properties should be interrogated and correctly ignored
      "!foo[1 + 1] || !foo[1 + 2];",
      "!foo[1 + 1] || !foo[1 + 2].foo;", // currently do not handle 'this' as the first part of a chain
      "this && this.foo;",
      "!this || !this.foo;",
      "!entity.__helper!.__initialized || options.refresh;",
      "import.meta || true;",
      "import.meta || import.meta.foo;",
      "!import.meta && false;",
      "!import.meta && !import.meta.foo;",
      "new.target || new.target.length;",
      "!new.target || true;", // Do not handle direct optional chaining on private properties because this TS limitation (https://github.com/microsoft/TypeScript/issues/42734)
      "foo && foo.#bar;",
      "!foo || !foo.#bar;", // weird non-constant cases are ignored
      "({}) && {}.toString();",
      "[] && [].length;",
      "(() => {}) && (() => {}).name;",
      "(function () {}) && function () {}.name;",
      "(class Foo {}) && class Foo {}.constructor;",
      "new Map().get('a') && new Map().get('a').what;", // https://github.com/typescript-eslint/typescript-eslint/issues/7654
      "data && data.value !== null;",
      { tsx: true, code: "<div /> && (<div />).wtf;" },
      { tsx: true, code: "<></> && (<></>).wtf;" },
      "foo[x++] && foo[x++].bar;",
      "foo[yield x] && foo[yield x].bar;",
      "a = b && (a = b).wtf;", // TODO - should we handle this?
      "(x || y) != null && (x || y).foo;", // TODO - should we handle this?
      "(await foo) && (await foo).bar;",
      {
        options: { requireNullish: true },
        code: `
        declare const x: string;
        x && x.length;
      `,
      },
      {
        options: { requireNullish: true },
        code: `
        declare const foo: string;
        foo && foo.toString();
      `,
      },
      {
        options: { requireNullish: true },
        code: `
        declare const x: string | number | boolean | object;
        x && x.toString();
      `,
      },
      {
        options: { requireNullish: true },
        code: `
        declare const foo: { bar: string };
        foo && foo.bar && foo.bar.toString();
      `,
      },
      {
        options: { requireNullish: true },
        code: `
        declare const foo: string;
        foo && foo.toString() && foo.toString();
      `,
      },
      {
        options: { requireNullish: true },
        code: `
        declare const foo: { bar: string };
        foo && foo.bar && foo.bar.toString() && foo.bar.toString();
      `,
      },
      {
        options: { requireNullish: true },
        code: `
        declare const foo1: { bar: string | null };
        foo1 && foo1.bar;
      `,
      },
      {
        options: { requireNullish: true },
        code: `
        declare const foo: string;
        (foo || {}).toString();
      `,
      },
      {
        options: { requireNullish: true },
        code: `
        declare const foo: string | null;
        (foo || 'a' || {}).toString();
      `,
      },
      {
        options: { checkAny: false },
        code: `
        declare const x: any;
        x && x.length;
      `,
      },
      {
        options: { checkBigInt: false },
        code: `
        declare const x: bigint;
        x && x.length;
      `,
      },
      {
        options: { checkBoolean: false },
        code: `
        declare const x: boolean;
        x && x.length;
      `,
      },
      {
        options: { checkNumber: false },
        code: `
        declare const x: number;
        x && x.length;
      `,
      },
      {
        options: { checkString: false },
        code: `
        declare const x: string;
        x && x.length;
      `,
      },
      {
        options: { checkUnknown: false },
        code: `
        declare const x: unknown;
        x && x.length;
      `,
      },
      "(x = {}) && (x.y = true) != null && x.y.toString();",
      "('x' as `${'x'}`) && ('x' as `${'x'}`).length;",
      "`x` && `x`.length;",
      "`x${a}` && `x${a}`.length;", // falsy unions should be ignored
      `
      declare const x: false | { a: string };
      x && x.a;
    `,
      `
      declare const x: false | { a: string };
      !x || x.a;
    `,
      `
      declare const x: '' | { a: string };
      x && x.a;
    `,
      `
      declare const x: '' | { a: string };
      !x || x.a;
    `,
      `
      declare const x: 0 | { a: string };
      x && x.a;
    `,
      `
      declare const x: 0 | { a: string };
      !x || x.a;
    `,
      `
      declare const x: 0n | { a: string };
      x && x.a;
    `,
      `
      declare const x: 0n | { a: string };
      !x || x.a;
    `,
      "typeof globalThis !== 'undefined' && globalThis.Array();",
      // with the `| null | undefined` type - `!== null` doesn't cover the
      // `undefined` case - so optional chaining is not a valid conversion
      ...getBaseCases({
        mutateCode: (c) => c.replaceAll("&&", "!== null &&"),
        operator: "&&",
        mutateOutput: (c) => c,
      }),
      // with the `| null | undefined` type - `!== undefined` doesn't cover the
      // `null` case - so optional chaining is not a valid conversion
      ...getBaseCases({
        mutateCode: (c) => c.replaceAll("&&", "!== undefined &&"),
        mutateOutput: (c) => c,
        operator: "&&",
      }),
      // with the `| null | undefined` type - `=== null` doesn't cover the
      // `undefined` case - so optional chaining is not a valid conversion
      ...getBaseCases({
        mutateCode: (c) => c.replaceAll("||", "=== null ||"),
        mutateOutput: (c) => c,
        operator: "||",
      }),
      // with the `| null | undefined` type - `=== undefined` doesn't cover the
      // `null` case - so optional chaining is not a valid conversion
      ...getBaseCases({
        mutateCode: (c) => c.replaceAll("||", "=== undefined ||"),
        mutateOutput: (c) => c,
        operator: "||",
      }),
    ],
    invalid: [
      {
        code: "(foo || {}).bar;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              { message: messages.optionalChainSuggest, output: "foo?.bar;" },
            ],
            endColumn: 16,
          },
        ],
      },
      {
        code: `(foo || ({})).bar;`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              { message: messages.optionalChainSuggest, output: "foo?.bar;" },
            ],
            endColumn: 18,
          },
        ],
      },
      {
        code: `(await foo || {}).bar;`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(await foo)?.bar;",
              },
            ],
            endColumn: 22,
          },
        ],
      },
      {
        code: "(foo1?.foo2 || {}).foo3;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo1?.foo2?.foo3;",
              },
            ],
            endColumn: 24,
          },
        ],
      },
      {
        code: `(foo1?.foo2 || ({})).foo3;`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo1?.foo2?.foo3;",
              },
            ],
            endColumn: 26,
          },
        ],
      },
      {
        code: "((() => foo())() || {}).bar;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(() => foo())()?.bar;",
              },
            ],
            endColumn: 28,
          },
        ],
      },
      {
        code: "const foo = (bar || {}).baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 13,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "const foo = bar?.baz;",
              },
            ],
            endColumn: 28,
          },
        ],
      },
      {
        code: "(foo.bar || {})[baz];",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo.bar?.[baz];",
              },
            ],
            endColumn: 21,
          },
        ],
      },
      {
        code: "((foo1 || {}).foo2 || {}).foo3;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(foo1 || {}).foo2?.foo3;",
              },
            ],
            endColumn: 31,
          },
          {
            message: messages.preferOptionalChain,
            column: 2,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(foo1?.foo2 || {}).foo3;",
              },
            ],
            endColumn: 19,
          },
        ],
      },
      {
        code: "(foo || undefined || {}).bar;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(foo || undefined)?.bar;",
              },
            ],
          },
        ],
      },
      {
        code: "(foo() || bar || {}).baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(foo() || bar)?.baz;",
              },
            ],
            endColumn: 25,
          },
        ],
      },
      {
        code: "((foo1 ? foo2 : foo3) || {}).foo4;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(foo1 ? foo2 : foo3)?.foo4;",
              },
            ],
            endColumn: 34,
          },
        ],
      },
      {
        code: `
        if (foo) {
          (foo || {}).bar;
        }
      `,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 11,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
        if (foo) {
          foo?.bar;
        }
      `,
              },
            ],
            endColumn: 26,
          },
        ],
      },
      {
        code: `
        if ((foo || {}).bar) {
          foo.bar;
        }
      `,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 13,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
        if (foo?.bar) {
          foo.bar;
        }
      `,
              },
            ],
            endColumn: 28,
          },
        ],
      },
      {
        code: `(undefined && foo || {}).bar;`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(undefined && foo)?.bar;",
              },
            ],
            endColumn: 29,
          },
        ],
      },
      {
        code: "(foo ?? {}).bar;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              { message: messages.optionalChainSuggest, output: "foo?.bar;" },
            ],
            endColumn: 16,
          },
        ],
      },
      {
        code: `(foo ?? ({})).bar;`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              { message: messages.optionalChainSuggest, output: "foo?.bar;" },
            ],
            endColumn: 18,
          },
        ],
      },
      {
        code: `(await foo ?? {}).bar;`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(await foo)?.bar;",
              },
            ],
            endColumn: 22,
          },
        ],
      },
      {
        code: "(foo1?.foo2 ?? {}).foo3;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo1?.foo2?.foo3;",
              },
            ],
            endColumn: 24,
          },
        ],
      },
      {
        code: "((() => foo())() ?? {}).bar;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(() => foo())()?.bar;",
              },
            ],
            endColumn: 28,
          },
        ],
      },
      {
        code: "const foo = (bar ?? {}).baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 13,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "const foo = bar?.baz;",
              },
            ],
            endColumn: 28,
          },
        ],
      },
      {
        code: "(foo.bar ?? {})[baz];",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo.bar?.[baz];",
              },
            ],
            endColumn: 21,
          },
        ],
      },
      {
        code: "((foo1 ?? {}).foo2 ?? {}).foo3;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(foo1 ?? {}).foo2?.foo3;",
              },
            ],
            endColumn: 31,
          },
          {
            message: messages.preferOptionalChain,
            column: 2,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(foo1?.foo2 ?? {}).foo3;",
              },
            ],
            endColumn: 19,
          },
        ],
      },
      {
        code: "(foo ?? undefined ?? {}).bar;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(foo ?? undefined)?.bar;",
              },
            ],
          },
        ],
      },
      {
        code: "(foo() ?? bar ?? {}).baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(foo() ?? bar)?.baz;",
              },
            ],
            endColumn: 25,
          },
        ],
      },
      {
        code: "((foo1 ? foo2 : foo3) ?? {}).foo4;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(foo1 ? foo2 : foo3)?.foo4;",
              },
            ],
            endColumn: 34,
          },
        ],
      },
      {
        code: `if (foo) { (foo ?? {}).bar; }`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 12,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "if (foo) { foo?.bar; }",
              },
            ],
            endColumn: 27,
          },
        ],
      },
      {
        code: `if ((foo ?? {}).bar) { foo.bar; }`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 5,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "if (foo?.bar) { foo.bar; }",
              },
            ],
            endColumn: 20,
          },
        ],
      },
      {
        code: `(undefined && foo ?? {}).bar;`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(undefined && foo)?.bar;",
              },
            ],
            endColumn: 29,
          },
        ],
      },
      {
        code: "(a > b || {}).bar;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(a > b)?.bar;",
              },
            ],
            endColumn: 18,
          },
        ],
      },
      {
        code: `(((typeof x) as string) || {}).bar;`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "((typeof x) as string)?.bar;",
              },
            ],
            endColumn: 35,
          },
        ],
      },
      {
        code: "(void foo() || {}).bar;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(void foo())?.bar;",
              },
            ],
            endColumn: 23,
          },
        ],
      },
      {
        code: "((a ? b : c) || {}).bar;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(a ? b : c)?.bar;",
              },
            ],
            endColumn: 24,
          },
        ],
      },
      {
        code: `((a instanceof Error) || {}).bar;`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(a instanceof Error)?.bar;",
              },
            ],
            endColumn: 33,
          },
        ],
      },
      {
        code: `((a << b) || {}).bar;`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(a << b)?.bar;",
              },
            ],
            endColumn: 21,
          },
        ],
      },
      {
        code: `((foo ** 2) || {}).bar;`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(foo ** 2)?.bar;",
              },
            ],
            endColumn: 23,
          },
        ],
      },
      {
        code: "(foo ** 2 || {}).bar;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(foo ** 2)?.bar;",
              },
            ],
            endColumn: 21,
          },
        ],
      },
      {
        code: "(foo++ || {}).bar;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(foo++)?.bar;",
              },
            ],
            endColumn: 18,
          },
        ],
      },
      {
        code: "(+foo || {}).bar;",
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(+foo)?.bar;",
              },
            ],
            endColumn: 17,
          },
        ],
      },
      {
        code: "(this || {}).foo;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "this?.foo;",
              },
            ],
          },
        ],
      },
      // two  errors
      {
        code: `foo && foo.bar && foo.bar.baz || baz && baz.bar && baz.bar.foo`,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.bar?.baz || baz && baz.bar && baz.bar.foo",
              },
            ],
          },
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo && foo.bar && foo.bar.baz || baz?.bar?.foo",
              },
            ],
          },
        ],
      },
      // case with inconsistent checks should "break" the chain
      {
        code: "foo && foo.bar != null && foo.bar.baz !== undefined && foo.bar.baz.buzz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output:
                  "foo?.bar != null && foo.bar.baz !== undefined && foo.bar.baz.buzz;",
              },
            ],
          },
        ],
      },
      {
        code: `
                foo.bar &&
                  foo.bar.baz != null &&
                  foo.bar.baz.qux !== undefined &&
                  foo.bar.baz.qux.buzz;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                foo.bar?.baz != null &&
                  foo.bar.baz.qux !== undefined &&
                  foo.bar.baz.qux.buzz;
              `,
              },
            ],
          },
        ],
      },
      // ensure essential whitespace isn't removed
      {
        tsx: true,
        code: "foo && foo.bar(baz => <This Requires Spaces />);",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.bar(baz => <This Requires Spaces />);",
              },
            ],
          },
        ],
      },
      {
        code: "foo && foo.bar(baz => typeof baz);",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.bar(baz => typeof baz);",
              },
            ],
          },
        ],
      },
      {
        code: "foo && foo['some long string'] && foo['some long string'].baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.['some long string']?.baz;",
              },
            ],
          },
        ],
      },
      {
        code: "foo && foo[`some long string`] && foo[`some long string`].baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.[`some long string`]?.baz;",
              },
            ],
          },
        ],
      },
      {
        code: "foo && foo[`some ${long} string`] && foo[`some ${long} string`].baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.[`some ${long} string`]?.baz;",
              },
            ],
          },
        ],
      },
      // complex computed properties should be handled correctly
      {
        code: "foo && foo[bar as string] && foo[bar as string].baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.[bar as string]?.baz;",
              },
            ],
          },
        ],
      },
      {
        code: "foo && foo[1 + 2] && foo[1 + 2].baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.[1 + 2]?.baz;",
              },
            ],
          },
        ],
      },
      {
        code: "foo && foo[typeof bar] && foo[typeof bar].baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.[typeof bar]?.baz;",
              },
            ],
          },
        ],
      },
      {
        code: "foo && foo.bar(a) && foo.bar(a, b).baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.bar(a) && foo.bar(a, b).baz;",
              },
            ],
          },
        ],
      },
      {
        code: "foo() && foo()(bar);",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo()?.(bar);",
              },
            ],
          },
        ],
      },
      // type parameters are considered
      {
        code: "foo && foo<string>() && foo<string>().bar;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.<string>()?.bar;",
              },
            ],
          },
        ],
      },
      {
        code: "foo && foo<string>() && foo<string, number>().bar;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.<string>() && foo<string, number>().bar;",
              },
            ],
          },
        ],
      },
      // should preserve comments in a call expression
      {
        code: `
                foo && foo.bar(/* comment */a,
                  // comment2
                  b, );
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                foo?.bar(/* comment */a,
                  // comment2
                  b, );
              `,
              },
            ],
          },
        ],
      },
      // ensure binary expressions that are the last expression do not get removed
      // these get autofixers because the trailing binary means the type doesn't matter
      {
        code: "foo && foo.bar != null;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.bar != null;",
              },
            ],
          },
        ],
      },
      {
        code: "foo && foo.bar != undefined;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.bar != undefined;",
              },
            ],
          },
        ],
      },
      {
        code: "foo && foo.bar != null && baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.bar != null && baz;",
              },
            ],
          },
        ],
      },
      // case with this keyword at the start of expression
      {
        code: "this.bar && this.bar.baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "this.bar?.baz;",
              },
            ],
          },
        ],
      },
      // other weird cases
      {
        code: "foo && foo?.();",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              { message: messages.optionalChainSuggest, output: "foo?.();" },
            ],
          },
        ],
      },
      {
        code: "foo.bar && foo.bar?.();",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo.bar?.();",
              },
            ],
          },
        ],
      },
      {
        tsx: true,
        code: "foo && foo.bar(baz => <This Requires Spaces />);",
        errors: [
          {
            message: messages.preferOptionalChain,
            line: 1,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.bar(baz => <This Requires Spaces />);",
              },
            ],
          },
        ],
      },
      // case with this keyword at the start of expression
      {
        code: "!this.bar || !this.bar.baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "!this.bar?.baz;",
              },
            ],
          },
        ],
      },
      {
        code: "!a.b || !a.b();",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              { message: messages.optionalChainSuggest, output: "!a.b?.();" },
            ],
          },
        ],
      },
      {
        code: "!foo.bar || !foo.bar.baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "!foo.bar?.baz;",
              },
            ],
          },
        ],
      },
      {
        code: "!foo[bar] || !foo[bar]?.[baz];",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "!foo[bar]?.[baz];",
              },
            ],
          },
        ],
      },
      {
        code: "!foo || !foo?.bar.baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "!foo?.bar.baz;",
              },
            ],
          },
        ],
      },
      // two  errors
      {
        code: "(!foo || !foo.bar || !foo.bar.baz) && (!baz || !baz.bar || !baz.bar.foo);",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output:
                  "(!foo?.bar?.baz) && (!baz || !baz.bar || !baz.bar.foo);",
              },
            ],
          },
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output:
                  "(!foo || !foo.bar || !foo.bar.baz) && (!baz?.bar?.foo);",
              },
            ],
          },
        ],
      },
      {
        code: `
                class Foo {
                  constructor() {
                    new.target && new.target.length;
                  }
                }
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                class Foo {
                  constructor() {
                    new.target?.length;
                  }
                }
              `,
              },
            ],
          },
        ],
      },
      {
        code: "import.meta && import.meta?.baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "import.meta?.baz;",
              },
            ],
          },
        ],
      },
      {
        code: "!import.meta || !import.meta?.baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "!import.meta?.baz;",
              },
            ],
          },
        ],
      },
      {
        code: "import.meta && import.meta?.() && import.meta?.().baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "import.meta?.()?.baz;",
              },
            ],
          },
        ],
      },
      // non-null expressions
      {
        code: "!foo() || !foo().bar;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "!foo()?.bar;",
              },
            ],
          },
        ],
      },
      {
        code: "!foo!.bar || !foo!.bar.baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "!foo!.bar?.baz;",
              },
            ],
          },
        ],
      },
      {
        code: "!foo!.bar!.baz || !foo!.bar!.baz!.paz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "!foo!.bar!.baz?.paz;",
              },
            ],
          },
        ],
      },
      {
        code: "!foo.bar!.baz || !foo.bar!.baz!.paz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "!foo.bar!.baz?.paz;",
              },
            ],
          },
        ],
      },
      {
        code: `
                declare const foo: { bar: string } | null;
                foo !== null && foo.bar !== null;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                declare const foo: { bar: string } | null;
                foo?.bar !== null;
              `,
              },
            ],
          },
        ],
      },
      {
        code: "foo != null && foo.bar != null;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.bar != null;",
              },
            ],
          },
        ],
      },
      {
        code: `
                declare const foo: { bar: string | null } | null;
                foo != null && foo.bar !== null;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                declare const foo: { bar: string | null } | null;
                foo?.bar !== null;
              `,
              },
            ],
          },
        ],
      },
      {
        code: `
                declare const foo: { bar: string | null } | null;
                foo !== null && foo.bar != null;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                declare const foo: { bar: string | null } | null;
                foo?.bar != null;
              `,
              },
            ],
          },
        ],
      },
      // https://github.com/typescript-eslint/typescript-eslint/issues/6332
      {
        code: "unrelated != null && foo != null && foo.bar != null;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "unrelated != null && foo?.bar != null;",
              },
            ],
          },
        ],
      },
      {
        code: "unrelated1 != null && unrelated2 != null && foo != null && foo.bar != null;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output:
                  "unrelated1 != null && unrelated2 != null && foo?.bar != null;",
              },
            ],
          },
        ],
      },
      // https://github.com/typescript-eslint/typescript-eslint/issues/1461
      {
        code: "foo1 != null && foo1.bar != null && foo2 != null && foo2.bar != null;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output:
                  "foo1?.bar != null && foo2 != null && foo2.bar != null;",
              },
            ],
          },
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output:
                  "foo1 != null && foo1.bar != null && foo2?.bar != null;",
              },
            ],
          },
        ],
      },
      {
        code: "foo && foo.a && bar && bar.a;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.a && bar && bar.a;",
              },
            ],
          },
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo && foo.a && bar?.a;",
              },
            ],
          },
        ],
      },
      // randomly placed optional chain tokens are ignored
      {
        code: "foo.bar.baz != null && foo?.bar?.baz.bam != null;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo.bar.baz?.bam != null;",
              },
            ],
          },
        ],
      },
      {
        code: "foo?.bar.baz != null && foo.bar?.baz.bam != null;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.bar.baz?.bam != null;",
              },
            ],
          },
        ],
      },
      {
        code: "foo?.bar?.baz != null && foo.bar.baz.bam != null;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.bar?.baz?.bam != null;",
              },
            ],
          },
        ],
      },
      // randomly placed non-null assertions are retained as long as they're in an earlier operand
      {
        code: "foo.bar.baz != null && foo!.bar!.baz.bam != null;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo.bar.baz?.bam != null;",
              },
            ],
          },
        ],
      },
      {
        code: "foo!.bar.baz != null && foo.bar!.baz.bam != null;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo!.bar.baz?.bam != null;",
              },
            ],
          },
        ],
      },
      {
        code: "foo!.bar!.baz != null && foo.bar.baz.bam != null;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo!.bar!.baz?.bam != null;",
              },
            ],
          },
        ],
      },
      // mixed binary checks are followed and flagged
      {
        code: `
                a &&
                  a.b != null &&
                  a.b.c !== undefined &&
                  a.b.c !== null &&
                  a.b.c.d != null &&
                  a.b.c.d.e !== null &&
                  a.b.c.d.e !== undefined &&
                  a.b.c.d.e.f != undefined &&
                  typeof a.b.c.d.e.f.g !== 'undefined' &&
                  a.b.c.d.e.f.g !== null &&
                  a.b.c.d.e.f.g.h;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                a?.b?.c?.d?.e?.f?.g?.h;
              `,
              },
            ],
          },
        ],
      },
      {
        code: `
                !a ||
                  a.b == null ||
                  a.b.c === undefined ||
                  a.b.c === null ||
                  a.b.c.d == null ||
                  a.b.c.d.e === null ||
                  a.b.c.d.e === undefined ||
                  a.b.c.d.e.f == undefined ||
                  typeof a.b.c.d.e.f.g === 'undefined' ||
                  a.b.c.d.e.f.g === null ||
                  !a.b.c.d.e.f.g.h;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                !a?.b?.c?.d?.e?.f?.g?.h;
              `,
              },
            ],
          },
        ],
      },
      {
        code: `
                !a ||
                  a.b == null ||
                  a.b.c === null ||
                  a.b.c === undefined ||
                  a.b.c.d == null ||
                  a.b.c.d.e === null ||
                  a.b.c.d.e === undefined ||
                  a.b.c.d.e.f == undefined ||
                  typeof a.b.c.d.e.f.g === 'undefined' ||
                  a.b.c.d.e.f.g === null ||
                  !a.b.c.d.e.f.g.h;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                !a?.b?.c?.d?.e?.f?.g?.h;
              `,
              },
            ],
          },
        ],
      },
      // yoda checks are flagged
      {
        code: "undefined !== foo && null !== foo && null != foo.bar && foo.bar.baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo?.bar?.baz;",
              },
            ],
          },
        ],
      },
      {
        code: `
                null != foo &&
                  'undefined' !== typeof foo.bar &&
                  null !== foo.bar &&
                  foo.bar.baz;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                foo?.bar?.baz;
              `,
              },
            ],
          },
        ],
      },
      {
        code: `
                null != foo &&
                  'undefined' !== typeof foo.bar &&
                  null !== foo.bar &&
                  null != foo.bar.baz;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                null != foo?.bar?.baz;
              `,
              },
            ],
          },
        ],
      },
      // We should retain the split strict equals check if it's the last operand
      {
        code: `
                null != foo &&
                  'undefined' !== typeof foo.bar &&
                  null !== foo.bar &&
                  null !== foo.bar.baz &&
                  'undefined' !== typeof foo.bar.baz;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                null !== foo?.bar?.baz &&
                  'undefined' !== typeof foo.bar.baz;
              `,
              },
            ],
          },
        ],
      },
      {
        code: `
                foo != null &&
                  typeof foo.bar !== 'undefined' &&
                  foo.bar !== null &&
                  foo.bar.baz !== null &&
                  typeof foo.bar.baz !== 'undefined';
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                foo?.bar?.baz !== null &&
                  typeof foo.bar.baz !== 'undefined';
              `,
              },
            ],
          },
        ],
      },
      {
        code: `
                null != foo &&
                  'undefined' !== typeof foo.bar &&
                  null !== foo.bar &&
                  null !== foo.bar.baz &&
                  undefined !== foo.bar.baz;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                null !== foo?.bar?.baz &&
                  undefined !== foo.bar.baz;
              `,
              },
            ],
          },
        ],
      },
      {
        code: `
                foo != null &&
                  typeof foo.bar !== 'undefined' &&
                  foo.bar !== null &&
                  foo.bar.baz !== null &&
                  foo.bar.baz !== undefined;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                foo?.bar?.baz !== null &&
                  foo.bar.baz !== undefined;
              `,
              },
            ],
          },
        ],
      },
      {
        code: `
                null != foo &&
                  'undefined' !== typeof foo.bar &&
                  null !== foo.bar &&
                  undefined !== foo.bar.baz &&
                  null !== foo.bar.baz;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                undefined !== foo?.bar?.baz &&
                  null !== foo.bar.baz;
              `,
              },
            ],
          },
        ],
      },
      {
        code: `
                foo != null &&
                  typeof foo.bar !== 'undefined' &&
                  foo.bar !== null &&
                  foo.bar.baz !== undefined &&
                  foo.bar.baz !== null;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                foo?.bar?.baz !== undefined &&
                  foo.bar.baz !== null;
              `,
              },
            ],
          },
        ],
      },
      // await
      {
        code: "(await foo).bar && (await foo).bar.baz;",
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "(await foo).bar?.baz;",
              },
            ],
          },
        ],
      },
      // TODO - should we handle this case and expand the range, or should we leave this as is?
      {
        code: `
                !a ||
                  a.b == null ||
                  a.b.c === undefined ||
                  a.b.c === null ||
                  a.b.c.d == null ||
                  a.b.c.d.e === null ||
                  a.b.c.d.e === undefined ||
                  a.b.c.d.e.f == undefined ||
                  a.b.c.d.e.f.g == null ||
                  a.b.c.d.e.f.g.h;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                a?.b?.c?.d?.e?.f?.g == null ||
                  a.b.c.d.e.f.g.h;
              `,
              },
            ],
          },
        ],
      },
      {
        code: `
                declare const foo: { bar: number } | null | undefined;
                foo && foo.bar != null;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                declare const foo: { bar: number } | null | undefined;
                foo?.bar != null;
              `,
              },
            ],
          },
        ],
      },
      {
        code: `
                declare const foo: { bar: number } | undefined;
                foo && typeof foo.bar !== 'undefined';
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                declare const foo: { bar: number } | undefined;
                typeof foo?.bar !== 'undefined';
              `,
              },
            ],
          },
        ],
      },
      {
        code: `
                declare const foo: { bar: number } | undefined;
                foo && 'undefined' !== typeof foo.bar;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                declare const foo: { bar: number } | undefined;
                'undefined' !== typeof foo?.bar;
              `,
              },
            ],
          },
        ],
      },
      // requireNullish
      {
        options: { requireNullish: true },
        code: `
                declare const thing1: string | null;
                thing1 && thing1.toString();
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                declare const thing1: string | null;
                thing1?.toString();
              `,
              },
            ],
          },
        ],
      },
      {
        options: { requireNullish: true },
        code: `
                declare const thing1: string | null;
                thing1 && thing1.toString() && true;
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                declare const thing1: string | null;
                thing1?.toString() && true;
              `,
              },
            ],
          },
        ],
      },
      {
        options: { requireNullish: true },
        code: `
                declare const foo: string | null;
                foo && foo.toString() && foo.toString();
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                declare const foo: string | null;
                foo?.toString() && foo.toString();
              `,
              },
            ],
          },
        ],
      },
      {
        options: { requireNullish: true },
        code: `
                declare const foo: { bar: string | null | undefined } | null | undefined;
                foo && foo.bar && foo.bar.toString();
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                declare const foo: { bar: string | null | undefined } | null | undefined;
                foo?.bar?.toString();
              `,
              },
            ],
          },
        ],
      },
      {
        options: { requireNullish: true },
        code: `
                declare const foo: { bar: string | null | undefined } | null | undefined;
                foo && foo.bar && foo.bar.toString() && foo.bar.toString();
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                declare const foo: { bar: string | null | undefined } | null | undefined;
                foo?.bar?.toString() && foo.bar.toString();
              `,
              },
            ],
          },
        ],
      },
      {
        options: { requireNullish: true },
        code: `
                declare const foo: string | null;
                (foo || {}).toString();
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                declare const foo: string | null;
                foo?.toString();
              `,
              },
            ],
          },
        ],
      },
      {
        options: { requireNullish: true },
        code: `
                declare const foo: string;
                (foo || undefined || {}).toString();
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                declare const foo: string;
                (foo || undefined)?.toString();
              `,
              },
            ],
          },
        ],
      },
      {
        options: { requireNullish: true },
        code: `
                declare const foo: string | null;
                (foo || undefined || {}).toString();
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                declare const foo: string | null;
                (foo || undefined)?.toString();
              `,
              },
            ],
          },
        ],
      },
      {
        code: `
                function foo(globalThis?: { Array: Function }) {
                  typeof globalThis !== 'undefined' && globalThis.Array();
                }
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                function foo(globalThis?: { Array: Function }) {
                  globalThis?.Array();
                }
              `,
              },
            ],
          },
        ],
      },
      {
        code: `
                typeof globalThis !== 'undefined' && globalThis.Array && globalThis.Array();
              `,
        errors: [
          {
            message: messages.preferOptionalChain,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: `
                typeof globalThis !== 'undefined' && globalThis.Array?.();
              `,
              },
            ],
          },
        ],
      },
      // parenthesis
      {
        code: `a && (a.b && a.b.c)`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              { message: messages.optionalChainSuggest, output: "a?.b?.c" },
            ],
            endColumn: 20,
          },
        ],
      },
      {
        code: `(a && a.b) && a.b.c`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              { message: messages.optionalChainSuggest, output: "a?.b?.c" },
            ],
            endColumn: 20,
          },
        ],
      },
      {
        code: `((a && a.b)) && a.b.c`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              { message: messages.optionalChainSuggest, output: "a?.b?.c" },
            ],
            endColumn: 22,
          },
        ],
      },
      {
        code: `foo(a && (a.b && a.b.c))`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 5,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo(a?.b?.c)",
              },
            ],
            endColumn: 24,
          },
        ],
      },
      {
        code: `foo(a && a.b && a.b.c)`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 5,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "foo(a?.b?.c)",
              },
            ],
            endColumn: 22,
          },
        ],
      },
      {
        code: `!foo || !foo.bar || ((((!foo.bar.baz || !foo.bar.baz()))));`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              {
                message: messages.optionalChainSuggest,
                output: "!foo?.bar?.baz?.();",
              },
            ],
            endColumn: 59,
          },
        ],
      },
      {
        code: `a !== undefined && ((a !== null && a.prop));`,
        errors: [
          {
            message: messages.preferOptionalChain,
            column: 1,
            suggestions: [
              { message: messages.optionalChainSuggest, output: "a?.prop;" },
            ],
            endColumn: 44,
          },
        ],
      },
      ...getBaseCases({ operator: "&&" }),
      // it should ignore parts of the expression that aren't part of the expression chain
      ...getBaseCases({
        operator: "&&",
        mutateCode: (c) => c.replace(/;$/, " && bing;"),
      }),
      ...getBaseCases({
        operator: "&&",
        mutateCode: (c) => c.replace(/;$/, " && bing.bong;"),
      }),
      // but if the type is just `| null` - then it covers the cases and is
      // a valid conversion
      ...getBaseCases({
        mutateCode: (c) => c.replaceAll("&&", "!== null &&"),
        mutateDeclaration: (c) => c.replaceAll("| undefined", ""),
        operator: "&&",
        mutateOutput: (c) => c,
      }),
      ...getBaseCases({
        mutateCode: (c) => c.replaceAll("&&", "!= null &&"),
        mutateOutput: (c) => c,
        operator: "&&",
      }),
      // but if the type is just `| undefined` - then it covers the cases and is
      // a valid conversion
      ...getBaseCases({
        mutateCode: (c) => c.replaceAll("&&", "!== undefined &&"),
        mutateDeclaration: (c) => c.replaceAll("| null", ""),
        mutateOutput: (c) => c,
        operator: "&&",
      }),
      ...getBaseCases({
        mutateCode: (c) => c.replaceAll("&&", "!= undefined &&"),
        mutateOutput: (c) => c,
        operator: "&&",
      }),
      ...getBaseCases({
        mutateCode: (c) => `!${c.replaceAll("||", "|| !")}`,
        mutateOutput: (c) => `!${c}`,
        operator: "||",
      }),
      // but if the type is just `| null` - then it covers the cases and is
      // a valid conversion
      ...getBaseCases({
        mutateCode: (c) =>
          c
            .replaceAll("||", "=== null ||")
            // SEE TODO AT THE BOTTOM OF THE RULE
            // We need to ensure the final operand is also a "valid" `||` check
            .replace(/;$/, " === null;"),
        mutateDeclaration: (c) => c.replaceAll("| undefined", ""),
        mutateOutput: (c) => c.replace(/;$/, " === null;"),
        operator: "||",
      }),
      ...getBaseCases({
        mutateCode: (c) =>
          c
            .replaceAll("||", "== null ||")
            // SEE TODO AT THE BOTTOM OF THE RULE
            // We need to ensure the final operand is also a "valid" `||` check
            .replace(/;$/, " == null;"),
        mutateOutput: (c) => c.replace(/;$/, " == null;"),
        operator: "||",
      }),
      // but if the type is just `| undefined` - then it covers the cases and is
      // a valid conversion
      ...getBaseCases({
        mutateCode: (c) =>
          c
            .replaceAll("||", "=== undefined ||")
            // SEE TODO AT THE BOTTOM OF THE RULE
            // We need to ensure the final operand is also a "valid" `||` check
            .replace(/;$/, " === undefined;"),
        mutateDeclaration: (c) => c.replaceAll("| null", ""),
        mutateOutput: (c) => c.replace(/;$/, " === undefined;"),
        operator: "||",
      }),
      ...getBaseCases({
        mutateCode: (c) =>
          c
            .replaceAll("||", "== undefined ||")
            // SEE TODO AT THE BOTTOM OF THE RULE
            // We need to ensure the final operand is also a "valid" `||` check
            .replace(/;$/, " == undefined;"),
        mutateOutput: (c) => c.replace(/;$/, " == undefined;"),
        operator: "||",
      }),
      // it should ignore whitespace in the expressions
      ...getBaseCases({
        mutateCode: (c) => c.replaceAll(".", ".      "),
        operator: "&&",
        // note - the rule will use raw text for computed expressions - so we
        //        need to ensure that the spacing for the computed member
        //        expressions is retained for correct fixer matching
        mutateOutput: (c) =>
          c.replaceAll(/(\[.+])/g, (m) => m.replaceAll(".", ".      ")),
      }),
      ...getBaseCases({
        mutateCode: (c) => c.replaceAll(".", ".\n"),
        mutateOutput: (c) =>
          c.replaceAll(/(\[.+])/g, (m) => m.replaceAll(".", ".\n")),
        operator: "&&",
      }),
    ],
  });
