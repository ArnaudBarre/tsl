import {
  isBigIntLiteralType,
  isBooleanLiteralType,
  isNumberLiteralType,
  isStringLiteralType,
  unionTypeParts,
} from "ts-api-utils";
import { SyntaxKind, TypeFlags } from "typescript";
import { compareNodes } from "../_utils/compareNodes.ts";
import {
  getOperatorPrecedence,
  getOperatorPrecedenceForNode,
  OperatorPrecedence,
} from "../_utils/getOperatorPrecedence.ts";
import {
  isLogicalExpression,
  isReferenceToGlobalFunction,
  run,
  typeHasFlag,
} from "../_utils/index.ts";
import { createRule } from "../../index.ts";
import type { AST, Context, ReportDescriptor } from "../../types.ts";

export const messages = {
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

          default:
            break;
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
  */
    (types.some(
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
