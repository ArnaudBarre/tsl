import ts, { SyntaxKind } from "typescript";
import { createRule } from "../index.ts";
import { ruleTester } from "../ruleTester.ts";
import type { Context } from "../types.ts";

const messages = {
  baseToString: (params: { name: string; certainty: string }) =>
    `'${params.name}' ${params.certainty} evaluate to '[object Object]' when stringified.`,
};

export const noBaseToString = createRule(() => ({
  name: "core/noBaseToString",
  visitor: {
    CallExpression(node, context) {
      if (
        node.expression.kind === SyntaxKind.PropertyAccessExpression
        && node.expression.name.kind === SyntaxKind.Identifier
        && node.expression.name.text === "toString"
      ) {
        const exp = node.expression.expression;
        const certainty = collectToStringCertainty(
          context.checker.getTypeAtLocation(exp),
          context,
        );
        if (certainty === "Always") {
          return;
        }
        context.report({
          message: messages.baseToString({ certainty, name: exp.getText() }),
          node,
        });
      }
    },
  },
}));

function collectToStringCertainty(type: ts.Type, context: Context) {
  const toString = context.checker.getPropertyOfType(type, "toString");
  const declarations = toString?.getDeclarations();
  if (!toString || !declarations || declarations.length === 0) {
    return "Always";
  }

  if (
    type.flags & ts.TypeFlags.Literal
    || context.checker.typeToString(type) === "RegExp"
  ) {
    return "Always";
  }

  if (
    declarations.every(
      ({ parent }) =>
        !ts.isInterfaceDeclaration(parent) || parent.name.text !== "Object",
    )
  ) {
    return "Always";
  }

  if (type.isIntersection()) {
    for (const subType of type.types) {
      const subtypeUsefulness = collectToStringCertainty(subType, context);

      if (subtypeUsefulness === "Always") {
        return "Always";
      }
    }

    return "Never";
  }

  if (!type.isUnion()) {
    return "Never";
  }

  let allSubtypesUseful = true;
  let someSubtypeUseful = false;

  for (const subType of type.types) {
    const subtypeUsefulness = collectToStringCertainty(subType, context);

    if (subtypeUsefulness !== "Always" && allSubtypesUseful) {
      allSubtypesUseful = false;
    }

    if (subtypeUsefulness !== "Never" && !someSubtypeUseful) {
      someSubtypeUseful = true;
    }
  }

  if (allSubtypesUseful && someSubtypeUseful) {
    return "Always";
  }

  if (someSubtypeUseful) {
    return "Sometimes";
  }

  return "Never";
}

/** Tests */

const literalListBasic: string[] = [
  "''",
  "'text'",
  "true",
  "false",
  "1",
  "1n",
  "[]",
  "/regex/",
];

const literalListNeedParen: string[] = [
  "__dirname === 'foobar'",
  "{}.constructor()",
  "() => {}",
  "function() {}",
];

const literalList = [...literalListBasic, ...literalListNeedParen];

const literalListWrapped = [
  ...literalListBasic,
  ...literalListNeedParen.map((i) => `(${i})`),
];

export const test = () =>
  ruleTester({
    ruleFn: noBaseToString,
    valid: [
      // template
      ...literalList.map((i) => `\`\${${i}}\`;`),

      // operator + +=
      ...literalListWrapped
        .map((l) => literalListWrapped.map((r) => `${l} + ${r};`))
        .reduce((pre, cur) => [...pre, ...cur]),

      // toString()
      ...literalListWrapped.map(
        (i) => `${i === "1" ? `(${i})` : i}.toString();`,
      ),

      // variable toString() and template
      ...literalList.map(
        (i) => `
        let value = ${i};
        value.toString();
        let text = \`\${value}\`;
      `,
      ),

      `
function someFunction() {}
someFunction.toString();
let text = \`\${someFunction}\`;
    `,
      "unknownObject.toString();",
      "unknownObject.someOtherMethod();",
      `
class CustomToString {
  toString() {
    return 'Hello, world!';
  }
}
'' + new CustomToString();
    `,
      `
const literalWithToString = {
  toString: () => 'Hello, world!',
};
'' + literalToString;
    `,
      `
const printer = (inVar: string | number | boolean) => {
  inVar.toString();
};
printer('');
printer(1);
printer(true);
    `,
      "let _ = {} * {};",
      "let _ = {} / {};",
      "let _ = ({} *= {});",
      "let _ = ({} /= {});",
      "let _ = ({} = {});",
      "let _ = {} == {};",
      "let _ = {} === {};",
      "let _ = {} in {};",
      "let _ = {} & {};",
      "let _ = {} ^ {};",
      "let _ = {} << {};",
      "let _ = {} >> {};",
      `
function tag() {}
tag\`\${{}}\`;
    `,
      `
      function tag() {}
      tag\`\${{}}\`;
    `,
      `
      interface Brand {}
      function test(v: string & Brand): string {
        return \`\${v}\`;
      }
    `,
      "'' += new Error();",
      "'' += new URL();",
      "'' += new URLSearchParams();",
    ],
    invalid: [
      {
        code: "({}).toString();",
        errors: [
          {
            message: messages.baseToString({ certainty: "will", name: "({})" }),
          },
        ],
      },
      {
        code: `
        let someObjectOrString = Math.random() ? { a: true } : 'text';
        someObjectOrString.toString();
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "may",
              name: "someObjectOrString",
            }),
          },
        ],
      },
      {
        code: `
        let someObjectOrObject = Math.random() ? { a: true, b: true } : { a: true };
        someObjectOrObject.toString();
      `,
        errors: [
          {
            message: messages.baseToString({
              certainty: "will",
              name: "someObjectOrObject",
            }),
          },
        ],
      },
    ],
  });
