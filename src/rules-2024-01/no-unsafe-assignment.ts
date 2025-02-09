import ts, { SyntaxKind, TypeFlags } from "typescript";
import { createRule } from "../index.ts";
import {
  getContextualType,
  isTypeAnyArrayType,
  typeHasFlag,
} from "../rules/_utils/index.ts";
import { ruleTester } from "../ruleTester.ts";
import type { AST, Context } from "../types.ts";
import { isUnsafeAssignment } from "./no-unsafe-argument.ts";

const messages = {
  anyAssignment: "Unsafe assignment of an `any` value.",
  unsafeArrayPattern: "Unsafe array destructuring of an `any` array value.",
  unsafeArrayPatternFromTuple:
    "Unsafe array destructuring of a tuple element with an `any` value.",
  unsafeAssignment: (params: { sender: string; receiver: string }) =>
    `Unsafe assignment of type ${params.sender} to a variable of type ${params.receiver}.`,
  unsafeArraySpread: "Unsafe spread of an `any` value in an array.",
};

type ComparisonType =
  /** Do no assignment comparison */
  | "None"
  /** Use the receiver's type for comparison */
  | "Basic"
  /** Use the sender's contextual type for comparison */
  | "Contextual";

export const noUnsafeAssignment = createRule(() => ({
  name: "core/noUnsafeAssignment",
  visitor: {
    VariableDeclaration(node, context) {
      if (!node.initializer) return;
      let didReport = checkAssignment(
        node.name,
        node.initializer,
        node,
        getComparisonType(node.type),
        context,
      );
      if (!didReport) {
        didReport = checkArrayDestructureHelper(
          node.name,
          node.initializer,
          context,
        );
      }
      if (!didReport) {
        checkObjectDestructureHelper(node.name, node.initializer, context);
      }
    },
    PropertyDeclaration(node, context) {
      if (!node.initializer) return;
      checkAssignment(
        node.name,
        node.initializer,
        node,
        getComparisonType(node.type),
        context,
      );
    },
    BinaryExpression(node, context) {
      if (node.operatorToken.kind !== SyntaxKind.EqualsToken) return;
      let didReport = checkAssignment(
        node.left,
        node.right,
        node,
        // the variable already has some form of a type to compare against
        "Basic",
        context,
      );

      if (!didReport) {
        didReport = checkArrayDestructureHelper(node.left, node.right, context);
      }
      if (!didReport) {
        checkObjectDestructureHelper(node.left, node.right, context);
      }
    },
    Parameter(node, context) {
      if (!node.initializer) return;
      let didReport = checkAssignment(
        node.name,
        node.initializer,
        node,
        // the variable already has some form of a type to compare against
        "Basic",
        context,
      );

      if (!didReport) {
        didReport = checkArrayDestructureHelper(
          node.name,
          node.initializer,
          context,
        );
      }
      if (!didReport) {
        checkObjectDestructureHelper(node.name, node.initializer, context);
      }
    },
    PropertyAssignment(node, context) {
      checkAssignment(node.name, node.initializer, node, "Contextual", context);
    },
    SpreadElement(node, context) {
      if (node.parent.kind !== SyntaxKind.ArrayLiteralExpression) return;
      const restType = context.checker.getTypeAtLocation(node.expression);
      if (
        typeHasFlag(restType, TypeFlags.Any) ||
        isTypeAnyArrayType(restType, context.checker)
      ) {
        context.report({
          node: node,
          message: messages.unsafeArraySpread,
        });
      }
    },
    JsxAttribute(node, context) {
      if (!node.initializer) return;
      if (
        node.initializer.kind !== SyntaxKind.JsxExpression ||
        !node.initializer.expression ||
        node.initializer.expression.kind === SyntaxKind.JsxExpression
      ) {
        return;
      }

      checkAssignment(
        node.name,
        node.initializer.expression,
        node.initializer.expression,
        "Contextual",
        context,
      );
    },
  },
}));

// returns true if the assignment reported
function checkArrayDestructureHelper(
  receiverNode: AST.AnyNode,
  senderNode: AST.AnyNode,
  context: Context,
): boolean {
  if (
    receiverNode.kind !== SyntaxKind.ArrayBindingPattern &&
    receiverNode.kind !== SyntaxKind.ArrayLiteralExpression
  ) {
    return false;
  }

  const senderType = context.checker.getTypeAtLocation(senderNode);

  return checkArrayDestructure(receiverNode, senderType, senderNode, context);
}

// returns true if the assignment reported
function checkArrayDestructure(
  receiverNode: AST.ArrayBindingPattern | AST.ArrayLiteralExpression,
  senderType: ts.Type,
  senderNode: AST.AnyNode,
  context: Context,
): boolean {
  // any array
  // const [x] = ([] as any[]);
  if (isTypeAnyArrayType(senderType, context.checker)) {
    context.report({
      node: receiverNode,
      message: messages.unsafeArrayPattern,
    });
    return false;
  }

  if (!context.checker.isTupleType(senderType)) {
    return true;
  }

  const tupleElements = context.checker.getTypeArguments(senderType);

  // tuple with any
  // const [x] = [1 as any];
  let didReport = false;
  for (
    let receiverIndex = 0;
    receiverIndex < receiverNode.elements.length;
    receiverIndex += 1
  ) {
    const receiverElement = receiverNode.elements[receiverIndex];
    if (receiverElement.kind === SyntaxKind.OmittedExpression) {
      continue;
    }

    if (
      receiverElement.kind === SyntaxKind.SpreadElement ||
      (receiverElement.kind === SyntaxKind.BindingElement &&
        receiverElement.dotDotDotToken)
    ) {
      // don't handle rests as they're not a 1:1 assignment
      continue;
    }

    const senderType = tupleElements[receiverIndex] as ts.Type | undefined;
    if (!senderType) {
      continue;
    }

    // check for the any type first so we can handle [[[x]]] = [any]
    if (typeHasFlag(senderType, TypeFlags.Any)) {
      context.report({
        node: receiverElement,
        message: messages.unsafeArrayPatternFromTuple,
      });
      // we want to report on every invalid element in the tuple
      didReport = true;
    } else if (
      receiverElement.kind === SyntaxKind.BindingElement &&
      receiverElement.name.kind === SyntaxKind.ArrayBindingPattern
    ) {
      didReport = checkArrayDestructure(
        receiverElement.name,
        senderType,
        senderNode,
        context,
      );
    } else if (receiverElement.kind === SyntaxKind.ArrayLiteralExpression) {
      didReport = checkArrayDestructure(
        receiverElement,
        senderType,
        senderNode,
        context,
      );
    } else if (
      receiverElement.kind === SyntaxKind.BindingElement &&
      receiverElement.name.kind === SyntaxKind.ObjectBindingPattern
    ) {
      didReport = checkObjectDestructure(
        receiverElement.name,
        senderType,
        senderNode,
        context,
      );
    } else if (receiverElement.kind === SyntaxKind.ObjectLiteralExpression) {
      didReport = checkObjectDestructure(
        receiverElement,
        senderType,
        senderNode,
        context,
      );
    }
  }

  return didReport;
}

// returns true if the assignment reported
function checkObjectDestructureHelper(
  receiverNode: AST.AnyNode,
  senderNode: AST.AnyNode,
  context: Context,
): boolean {
  if (receiverNode.kind !== SyntaxKind.ObjectBindingPattern) {
    return false;
  }

  const senderType = context.checker.getTypeAtLocation(senderNode);
  return checkObjectDestructure(receiverNode, senderType, senderNode, context);
}

// returns true if the assignment reported
function checkObjectDestructure(
  receiverNode: AST.ObjectBindingPattern | AST.ObjectLiteralExpression,
  senderType: ts.Type,
  senderNode: AST.AnyNode,
  context: Context,
): boolean {
  const properties = new Map(
    senderType
      .getProperties()
      .map((property) => [
        property.getName(),
        context.checker.getTypeOfSymbolAtLocation(property, senderNode),
      ]),
  );

  const elements =
    receiverNode.kind === SyntaxKind.ObjectBindingPattern
      ? receiverNode.elements
      : receiverNode.properties;
  let didReport = false;
  for (const receiverProperty of elements) {
    const key = ((): string | undefined => {
      if (receiverProperty.kind === SyntaxKind.BindingElement) {
        // don't bother checking rest
        if (receiverProperty.dotDotDotToken) return;
        const name = receiverProperty.propertyName ?? receiverProperty.name;
        if (name.kind === SyntaxKind.ComputedPropertyName) {
          return "text" in name.expression ? name.expression.text : undefined;
        }
        return "text" in name ? name.text : undefined;
      }
      if (!receiverProperty.name) return;
      return "text" in receiverProperty.name
        ? receiverProperty.name.text
        : undefined;
    })();

    if (!key) continue;

    const senderType = properties.get(key);
    if (!senderType) continue;

    // check for the any type first so we can handle {x: {y: z}} = {x: any}
    if (typeHasFlag(senderType, TypeFlags.Any)) {
      context.report({
        node:
          receiverProperty.kind === SyntaxKind.BindingElement
            ? receiverProperty.name
            : receiverProperty,
        message: messages.unsafeArrayPatternFromTuple,
      });
      didReport = true;
    } else if (
      receiverProperty.kind === SyntaxKind.BindingElement &&
      receiverProperty.name.kind === SyntaxKind.ArrayBindingPattern
    ) {
      didReport = checkArrayDestructure(
        receiverProperty.name,
        senderType,
        senderNode,
        context,
      );
    } else if (
      receiverProperty.kind === SyntaxKind.BindingElement &&
      receiverProperty.name.kind === SyntaxKind.ObjectBindingPattern
    ) {
      didReport = checkObjectDestructure(
        receiverProperty.name,
        senderType,
        senderNode,
        context,
      );
    }
  }

  return didReport;
}

// returns true if the assignment reported
function checkAssignment(
  receiverNode: AST.AnyNode,
  senderNode: AST.Expression,
  reportingNode: ts.Node,
  comparisonType: ComparisonType,
  context: Context,
): boolean {
  const receiverType =
    comparisonType === "Contextual"
      ? getContextualType(context.checker, receiverNode as AST.Expression) ??
        context.checker.getTypeAtLocation(receiverNode)
      : context.checker.getTypeAtLocation(receiverNode);
  const senderType = context.checker.getTypeAtLocation(senderNode);

  if (typeHasFlag(senderType, TypeFlags.Any)) {
    // handle cases when we assign any ==> unknown.
    if (typeHasFlag(receiverType, TypeFlags.Unknown)) {
      return false;
    }

    context.report({ node: reportingNode, message: messages.anyAssignment });
    return true;
  }

  if (comparisonType === "None") {
    return false;
  }

  const result = isUnsafeAssignment(
    senderType,
    receiverType,
    context.checker,
    senderNode,
  );
  if (!result) {
    return false;
  }

  const { sender, receiver } = result;
  context.report({
    node: reportingNode,
    message: messages.unsafeAssignment({
      sender: context.checker.typeToString(sender),
      receiver: context.checker.typeToString(receiver),
    }),
  });
  return true;
}

function getComparisonType(
  typeAnnotation: AST.TypeNode | undefined,
): ComparisonType {
  return typeAnnotation
    ? // if there's a type annotation, we can do a comparison
      "Basic"
    : // no type annotation means the variable's type will just be inferred, thus equal
      "None";
}

/** Tests */
function assignmentTest(tests: [string, number, number, boolean?][]) {
  return tests.reduce<
    {
      code: string;
      errors: { message: string; line: number; column: number }[];
    }[]
  >((acc, [assignment, column, _endColumn, skipAssignmentExpression]) => {
    // VariableDeclaration
    acc.push({
      code: `const ${assignment}`,
      errors: [
        {
          message: messages.unsafeArrayPatternFromTuple,
          line: 1,
          column: column + 6,
        },
      ],
    });
    // AssignmentPattern
    acc.push({
      code: `function foo(${assignment}) {}`,
      errors: [
        {
          message: messages.unsafeArrayPatternFromTuple,
          line: 1,
          column: column + 13,
        },
      ],
    });
    // AssignmentExpression
    if (skipAssignmentExpression !== true) {
      acc.push({
        code: `(${assignment})`,
        errors: [
          {
            message: messages.unsafeArrayPatternFromTuple,
            line: 1,
            column: column + 1,
          },
        ],
      });
    }
    return acc;
  }, []);
}
export const test = () =>
  ruleTester({
    ruleFn: noUnsafeAssignment,
    valid: [
      "const x = 1;",
      "const x: number = 1;",
      `
const x = 1,
  y = 1;
    `,
      "let x;",
      `
let x = 1,
  y;
    `,
      "function foo(a = 1) {}",
      `
class Foo {
  constructor(private a = 1) {}
}
    `,
      `
class Foo {
  private a = 1;
}
    `,
      "const x: Set<string> = new Set();",
      "const x: Set<string> = new Set<string>();",
      "const [x] = [1];",
      "const [x, y] = [1, 2] as number[];",
      "const [x, ...y] = [1, 2, 3, 4, 5];",
      "const [x, ...y] = [1];",
      "const [{ ...x }] = [{ x: 1 }] as [{ x: any }];",
      "function foo(x = 1) {}",
      "function foo([x] = [1]) {}",
      "function foo([x, ...y] = [1, 2, 3, 4, 5]) {}",
      "function foo([x, ...y] = [1]) {}",
      // this is not checked, because there's no annotation to compare it with
      "const x = new Set<any>();",
      "const x = { y: 1 };",
      "const x = { y = 1 };",
      "const x = { y(){} };",
      "const x: { y: number } = { y: 1 };",
      "const x = [...[1, 2, 3]];",
      "const [{ [`x${1}`]: x }] = [{ [`x`]: 1 }] as [{ [`x`]: any }];",
      {
        code: `
type Props = { a: string };
declare function Foo(props: Props): never;
<Foo a={'foo'} />;
      `,
      },
      {
        code: `
declare function Foo(props: { a: string }): never;
<Foo a="foo" />;
      `,
      },
      {
        code: `
declare function Foo(props: { a: string }): never;
<Foo a={} />;
      `,
      },
      "const x: unknown = y as any;",
      "const x: unknown[] = y as any[];",
      "const x: Set<unknown> = y as Set<any>;",
      // https://github.com/typescript-eslint/typescript-eslint/issues/2109
      "const x: Map<string, string> = new Map();",
    ],
    invalid: [
      {
        code: "const x = 1 as any;",
        errors: [
          {
            message: messages.anyAssignment,
          },
        ],
      },
      {
        code: `
const x = 1 as any,
  y = 1;
      `,
        errors: [
          {
            message: messages.anyAssignment,
          },
        ],
      },
      {
        code: "function foo(a = 1 as any) {}",
        errors: [
          {
            message: messages.anyAssignment,
          },
        ],
      },
      {
        code: `
class Foo {
  constructor(private a = 1 as any) {}
}
      `,
        errors: [
          {
            message: messages.anyAssignment,
          },
        ],
      },
      {
        code: `
class Foo {
  private a = 1 as any;
}
      `,
        errors: [
          {
            message: messages.anyAssignment,
          },
        ],
      },
      {
        code: `
const [x] = 1 as any;
      `,
        errors: [
          {
            message: messages.anyAssignment,
          },
        ],
      },
      {
        code: `
const [x] = [] as any[];
      `,
        errors: [
          {
            message: messages.unsafeArrayPattern,
          },
        ],
      },
      {
        code: "const x: Set<string> = new Set<any>();",
        errors: [
          {
            message: messages.unsafeAssignment({
              sender: "Set<any>",
              receiver: "Set<string>",
            }),
          },
        ],
      },
      {
        code: "const x: Map<string, string> = new Map<string, any>();",
        errors: [
          {
            message: messages.unsafeAssignment({
              sender: "Map<string, any>",
              receiver: "Map<string, string>",
            }),
          },
        ],
      },
      {
        code: "const x: Set<string[]> = new Set<any[]>();",
        errors: [
          {
            message: messages.unsafeAssignment({
              sender: "Set<any[]>",
              receiver: "Set<string[]>",
            }),
          },
        ],
      },
      {
        code: "const x: Set<Set<Set<string>>> = new Set<Set<Set<any>>>();",
        errors: [
          {
            message: messages.unsafeAssignment({
              sender: "Set<Set<Set<any>>>",
              receiver: "Set<Set<Set<string>>>",
            }),
          },
        ],
      },
      ...assignmentTest([
        ["[x] = [1] as [any]", 2, 3],
        ["[[[[x]]]] = [[[[1 as any]]]]", 5, 6],
        ["[[[[x]]]] = [1 as any]", 2, 9, true],
        ["[{x}] = [{x: 1}] as [{x: any}]", 3, 4],
        ['[{["x"]: x}] = [{["x"]: 1}] as [{["x"]: any}]', 10, 11, true],
        ["[{[`x`]: x}] = [{[`x`]: 1}] as [{[`x`]: any}]", 10, 11, true],
      ]),
      {
        // TS treats the assignment pattern weirdly in this case
        code: "[[[[x]]]] = [1 as any];",
        errors: [
          {
            message: messages.unsafeAssignment({
              sender: "[any]",
              receiver: "[[[[any]]]]",
            }),
            line: 1,
            column: 1,
          },
        ],
      },
      {
        code: `
const x = [...(1 as any)];
      `,
        errors: [
          {
            message: messages.unsafeArraySpread,
          },
        ],
      },
      {
        code: `
const x = [...([] as any[])];
      `,
        errors: [
          {
            message: messages.unsafeArraySpread,
          },
        ],
      },
      ...assignmentTest([
        ["{x} = {x: 1} as {x: any}", 2, 3, true],
        ["{x: y} = {x: 1} as {x: any}", 5, 6, true],
        ["{x: {y}} = {x: {y: 1}} as {x: {y: any}}", 6, 7, true],
        ["{x: [y]} = {x: {y: 1}} as {x: [any]}", 6, 7, true],
      ]),
      {
        code: "const x = { y: 1 as any };",
        errors: [
          {
            message: messages.anyAssignment,
            column: 13,
          },
        ],
      },
      {
        code: "const x = { y: { z: 1 as any } };",
        errors: [
          {
            message: messages.anyAssignment,
            column: 18,
          },
        ],
      },
      {
        code: "const x: { y: Set<Set<Set<string>>> } = { y: new Set<Set<Set<any>>>() };",
        errors: [
          {
            message: messages.unsafeAssignment({
              sender: "Set<Set<Set<any>>>",
              receiver: "Set<Set<Set<string>>>",
            }),
            column: 43,
          },
        ],
      },
      {
        code: "const x = { ...(1 as any) };",
        errors: [
          {
            // spreading an any widens the object type to any
            message: messages.anyAssignment,
            column: 7,
          },
        ],
      },
      {
        tsx: true,
        code: `
type Props = { a: string };
declare function Foo(props: Props): never;
<Foo a={1 as any} />;
      `,
        errors: [
          {
            message: messages.anyAssignment,
            line: 4,
            column: 9,
          },
        ],
      },
    ],
  });
