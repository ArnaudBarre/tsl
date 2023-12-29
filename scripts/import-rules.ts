import assert from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import generate from "@babel/generator";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import type {
  Identifier,
  ObjectExpression,
  ObjectMethod,
  ObjectProperty,
  TSType,
} from "@babel/types";
import { format } from "prettier";
import { kindToNodeTypeMap } from "./kindToNodeTypeMap.ts";

const rules = [
  "await-thenable",
  "consistent-type-exports",
  "dot-notation",
  "naming-convention",
  "no-base-to-string",
  "no-confusing-void-expression",
  "no-duplicate-type-constituents",
  "no-floating-promises",
  "no-for-in-array",
  "no-implied-eval",
  "no-meaningless-void-operator",
  "no-misused-promises",
  "no-mixed-enums",
  "no-redundant-type-constituents",
  "no-throw-literal",
  "no-unnecessary-boolean-literal-compare",
  "no-unnecessary-condition",
  "no-unnecessary-qualifier",
  "no-unnecessary-type-arguments",
  "no-unnecessary-type-assertion",
  "no-unsafe-argument",
  "no-unsafe-assignment",
  "no-unsafe-call",
  "no-unsafe-enum-comparison",
  "no-unsafe-member-access",
  "no-unsafe-return",
  "no-unsafe-unary-minus",
  "no-useless-template-literals",
  "non-nullable-type-assertion-style",
  "prefer-destructuring",
  "prefer-includes",
  "prefer-nullish-coalescing",
  "prefer-optional-chain",
  "prefer-readonly",
  "prefer-readonly-parameter-types",
  "prefer-reduce-type-parameter",
  "prefer-regexp-exec",
  "prefer-return-this-type",
  "prefer-string-starts-ends-with",
  "promise-function-async",
  "require-array-sort-compare",
  "require-await",
  "restrict-plus-operands",
  "restrict-template-expressions",
  "return-await",
  "strict-boolean-expressions",
  "switch-exhaustiveness-check",
  "unbound-method",
];

const kebabCaseToCamelCase = (str: string) =>
  str.replace(/-([a-z])/gu, (_, c) => c.toUpperCase());

const getObjectValue = (node: ObjectExpression, name: string) => {
  const prop = node.properties.find(
    (p): p is ObjectProperty =>
      p.type === "ObjectProperty" &&
      p.key.type === "Identifier" &&
      p.key.name === name,
  );
  return prop;
};

const extensionsRules = ["dot-notation", "prefer-destructuring"];

const estreeToTSTree: Record<
  string,
  keyof typeof kindToNodeTypeMap | undefined
> = {
  AccessorProperty: "PropertyDeclaration",
  ArrayExpression: "ArrayLiteralExpression",
  ArrowFunctionExpression: "ArrowFunction",
  // @ts-ignore
  BinaryExpression: "BinaryExpressionBinary",
  BlockStatement: "Block",
  PropertyDefinition: "PropertyDeclaration",
  DoWhileStatement: "DoStatement",
  ExportAllDeclaration: "ExportDeclaration",
  ImportDefaultSpecifier: "ImportClause",
  ImportExpression: "CallExpression",
  ImportNamespaceSpecifier: "NamespaceImport",
  JSXEmptyExpression: "JsxExpression",
  JSXExpressionContainer: "JsxExpression",
  JSXSpreadChild: "JsxExpression",
  JSXMemberExpression: "PropertyAccessExpression",
  ObjectExpression: "ObjectLiteralExpression",
  Program: "SourceFile",
  StaticBlock: "ClassStaticBlockDeclaration",
  Super: "SuperKeyword",
  TSAbstractAccessorProperty: "PropertyDeclaration",
  TSAbstractPropertyDefinition: "PropertyDeclaration",
  TSArrayType: "ArrayType",
  TSAsExpression: "AsExpression",
  TSCallSignatureDeclaration: "CallSignature",
  TSClassImplements: "ExpressionWithTypeArguments",
  TSConditionalType: "ConditionalType",
  TSConstructorType: "ConstructorType",
  TSConstructSignatureDeclaration: "ConstructSignature",
  TSDeclareFunction: "FunctionDeclaration",
  TSEnumDeclaration: "EnumDeclaration",
  TSEnumMember: "EnumMember",
  TSExportAssignment: "ExportAssignment",
  TSExternalModuleReference: "ExternalModuleReference",
  TSFunctionType: "FunctionType",
  TSImportEqualsDeclaration: "ImportEqualsDeclaration",
  TSImportType: "ImportType",
  TSIndexedAccessType: "IndexedAccessType",
  TSIndexSignature: "IndexSignature",
  TSInferType: "InferType",
  TSInterfaceDeclaration: "InterfaceDeclaration",
  TSInterfaceBody: "InterfaceDeclaration",
  TSInterfaceHeritage: "ExpressionWithTypeArguments",
  TSIntersectionType: "IntersectionType",
  TSInstantiationExpression: "ExpressionWithTypeArguments",
  TSSatisfiesExpression: "SatisfiesExpression",
  TSLiteralType: "LiteralType",
  TSMappedType: "MappedType",
  TSModuleBlock: "ModuleBlock",
  TSModuleDeclaration: "ModuleDeclaration",
  TSNamedTupleMember: "NamedTupleMember",
  TSNamespaceExportDeclaration: "NamespaceExportDeclaration",
  TSNonNullExpression: "NonNullExpression",
  TSOptionalType: "OptionalType",
  TSParameterProperty: "Parameter",
  TSPropertySignature: "PropertySignature",
  TSThisType: "ThisType",
  TSTupleType: "TupleType",
  TSTemplateLiteralType: "TemplateLiteralType",
  TSTypeAliasDeclaration: "TypeAliasDeclaration",
  TSTypeAssertion: "TypeAssertionExpression",
  TSTypeLiteral: "TypeLiteral",
  TSTypeOperator: "TypeOperator",
  TSTypeParameter: "TypeParameter",
  TSTypePredicate: "TypePredicate",
  TSTypeReference: "TypeReference",
  TSUnionType: "UnionType",
  VariableDeclarator: "VariableDeclaration",
};
const astNodes = Object.values(kindToNodeTypeMap);

// const codeToAST = <Statement extends ExpressionStatement>(code: string) =>
//   parser.parse(code, {
//     sourceFilename: "tmp.ts",
//     plugins: ["typescript"],
//     sourceType: "module",
//   }).program.body[0] as Statement;

// const focus = "";
const focus = "consistent-type-exports.ts";

for (const rule of rules) {
  const filename = `${rule}.ts`;
  if (focus && !(focus === rule || focus === filename)) continue;
  if (!focus) console.log(rule);
  const current = readFileSync(
    `../typescript-eslint/packages/eslint-plugin/src/rules/${filename}`,
    "utf-8",
  );
  const ast = parser.parse(current, {
    sourceFilename: filename,
    plugins: ["typescript"],
    sourceType: "module",
  });
  let options: TSType;
  let messages: [string, ObjectProperty["value"]][] | undefined;
  let parserServicesName: string | undefined;
  let exportName = "";
  const fnWithInjectedContext: string[] = [];
  traverse(ast, {
    ImportDeclaration(path) {
      path.remove();
    },
    VariableDeclaration(path) {
      const init = path.node.declarations[0].init;
      if (
        init?.type === "CallExpression" &&
        init.callee.type === "Identifier" &&
        ["getESLintCoreRule", "getParserServices"].includes(init.callee.name)
      ) {
        if (init.callee.name) {
          const id = path.node.declarations[0].id;
          assert(id.type === "Identifier");
          parserServicesName = id.name;
        }
        path.remove();
      }
    },
    ExportDefaultDeclaration(path) {
      const decl = path.node.declaration;
      assert(decl.type === "CallExpression");
      assert(decl.callee.type === "Identifier");
      assert(decl.callee.name === "createRule");
      decl.typeParameters = null;
      const params = decl.arguments[0];
      assert(params.type === "ObjectExpression");
      const meta = getObjectValue(params, "meta")!.value;
      assert(meta.type === "ObjectExpression");
      if (!extensionsRules.includes(rule)) {
        const messagesProp = getObjectValue(meta, "messages")!.value;
        assert(messagesProp.type === "ObjectExpression");
        messages = messagesProp.properties.map((p) => {
          assert(p.type === "ObjectProperty");
          assert(p.key.type === "Identifier");
          return [p.key.name, p.value];
        });
      }
      const nameProp = getObjectValue(params, "name")!;
      assert(nameProp.value.type === "StringLiteral");
      exportName = kebabCaseToCamelCase(nameProp.value.value);
      const createProp = params.properties.find(
        (p): p is ObjectMethod =>
          p.type === "ObjectMethod" &&
          p.key.type === "Identifier" &&
          p.key.name === "create",
      )!;
      for (const s of createProp.body.body) {
        if (s.type === "ReturnStatement") {
          if (s.argument!.type === "ObjectExpression") {
            for (const p of s.argument.properties) {
              if (p.type === "ObjectMethod") {
                if (p.returnType) p.returnType = null;
                p.params = [
                  {
                    type: "Identifier",
                    name: p.params.length === 0 ? "_" : "node",
                  },
                  { type: "Identifier", name: "context" },
                ];
                if (
                  p.key.type === "StringLiteral" &&
                  p.key.value.endsWith(":exit")
                ) {
                  const nodeName = p.key.value.slice(0, -5);
                  if (nodeName in estreeToTSTree)
                    p.key.value = `${estreeToTSTree[nodeName]}:exit`;
                }
              }
            }
          }
        }
      }
      const visitorProp: ObjectProperty = {
        type: "ObjectProperty",
        shorthand: false,
        computed: false,
        key: { type: "Identifier", name: "visitor" },
        value: {
          type: "ArrowFunctionExpression",
          params: createProp.params[1]
            ? [
                createProp.params[1].type === "ArrayPattern"
                  ? (createProp.params[1].elements[0] as Identifier)
                  : createProp.params[1],
              ]
            : [],
          body: createProp.body,
          async: false,
          expression: false,
        },
      };
      if (!options) {
        params.properties = [nameProp, visitorProp];
        return;
      }
      const defaults = getObjectValue(params, "defaultOptions")!.value;
      assert(defaults.type === "ArrayExpression");
      assert(defaults.elements.length === 1, "Default is array");
      assert(defaults.elements[0]!.type === "ObjectExpression");
      const optionsParam: ObjectProperty = {
        type: "ObjectProperty",
        shorthand: false,
        computed: false,
        key: { type: "Identifier", name: "parseOptions" },
        value: {
          type: "ArrowFunctionExpression",
          params: [
            {
              type: "Identifier",
              name: "options",
              typeAnnotation: {
                type: "TSTypeAnnotation",
                typeAnnotation: options,
              },
            },
          ],
          body: {
            type: "BlockStatement",
            directives: [],
            body: [
              {
                type: "IfStatement",
                test: {
                  type: "UnaryExpression",
                  operator: "!",
                  prefix: true,
                  argument: { type: "Identifier", name: "options" },
                },
                consequent: {
                  type: "ReturnStatement",
                  argument: defaults.elements[0],
                },
              },
              {
                type: "ReturnStatement",
                argument: { type: "Identifier", name: "options" },
              },
            ],
          },
          async: false,
          expression: false,
        },
      };
      params.properties = [nameProp, optionsParam, visitorProp];
      path.replaceWith({
        type: "ExportNamedDeclaration",
        declaration: {
          type: "VariableDeclaration",
          kind: "const",
          declarations: [
            {
              type: "VariableDeclarator",
              id: { type: "Identifier", name: exportName },
              init: decl,
            },
          ],
        },
        specifiers: [],
      });
    },
    CallExpression(path) {
      // services.program.getTypeChecker() -> context.checker
      if (
        path.node.callee.type === "MemberExpression" &&
        path.node.callee.object.type === "MemberExpression" &&
        path.node.callee.object.object.type === "Identifier" &&
        path.node.callee.object.object.name === parserServicesName &&
        path.node.callee.object.property.type === "Identifier" &&
        path.node.callee.object.property.name === "program" &&
        path.node.callee.property.type === "Identifier" &&
        path.node.callee.property.name === "getTypeChecker"
      ) {
        path.replaceWith({
          type: "MemberExpression",
          object: { type: "Identifier", name: "context" },
          property: { type: "Identifier", name: "checker" },
          computed: false,
        });
        return;
      }
      // services.getTypeAtLocation(...) -> context.checker.getTypeAtLocation(...)
      if (
        path.node.callee.type === "MemberExpression" &&
        path.node.callee.object.type === "Identifier" &&
        path.node.callee.object.name === parserServicesName &&
        path.node.callee.property.type === "Identifier" &&
        ["getTypeAtLocation", "getSymbolAtLocation"].includes(
          path.node.callee.property.name,
        )
      ) {
        path.node.callee.object = {
          type: "MemberExpression",
          object: { type: "Identifier", name: "context" },
          property: { type: "Identifier", name: "checker" },
          computed: false,
        };
        return;
      }
      // services.esTreeNodeToTSNodeMap.get(node) -> node
      if (
        path.node.callee.type === "MemberExpression" &&
        path.node.callee.object.type === "MemberExpression" &&
        path.node.callee.object.object.type === "Identifier" &&
        path.node.callee.object.object.name === parserServicesName &&
        path.node.callee.object.property.type === "Identifier" &&
        path.node.callee.object.property.name === "esTreeNodeToTSNodeMap" &&
        path.node.callee.property.type === "Identifier" &&
        path.node.callee.property.name === "get"
      ) {
        path.replaceWith(path.node.arguments[0]);
        return;
      }
      // tsutils.x() -> context.checker.utils.x()
      if (
        path.node.callee.type === "MemberExpression" &&
        path.node.callee.object.type === "Identifier" &&
        path.node.callee.object.name === "tsutils"
      ) {
        path.node.callee.object = {
          type: "MemberExpression",
          object: {
            type: "MemberExpression",
            object: { type: "Identifier", name: "context" },
            property: { type: "Identifier", name: "checker" },
            computed: false,
          },
          property: { type: "Identifier", name: "utils" },
          computed: false,
        };
        // drop checker arg
        for (const arg of path.node.arguments) {
          if (arg.type === "Identifier" && arg.name === "checker") {
            path.node.arguments = path.node.arguments.filter((a) => a !== arg);
          }
        }
        return;
      }
    },
    TSTypeAliasDeclaration(path) {
      // get Options type
      if (
        path.node.id.name === "Options" &&
        path.node.typeAnnotation.type === "TSTupleType"
      ) {
        if (extensionsRules.includes(rule)) return;
        if (path.node.typeAnnotation.elementTypes.length === 0) {
          return;
        }
        assert(path.node.typeAnnotation.elementTypes.length === 1);
        assert(
          path.node.typeAnnotation.elementTypes[0].type !==
            "TSNamedTupleMember",
        );
        options = path.node.typeAnnotation.elementTypes[0];
        path.remove();
        return;
      }
      if (path.node.id.name === "MessageIds") {
        path.remove();
        return;
      }
    },
    TSQualifiedName(path) {
      // TSESTree.x -> AST.x
      if (
        path.node.left.type === "Identifier" &&
        path.node.left.name === "TSESTree"
      ) {
        path.node.left.name = path.node.right.name === "Node" ? "ts" : "AST";
        path.node.right.name = estreeToTSTree[path.node.right.name]
          ? kindToNodeTypeMap[estreeToTSTree[path.node.right.name]!]
          : path.node.right.name;
        return;
      }
      // ts.TypeChecker -> Checker
      if (
        path.node.left.type === "Identifier" &&
        path.node.left.name === "ts" &&
        path.node.right.name === "TypeChecker"
      ) {
        path.replaceWith({ type: "Identifier", name: "Checker" });
        return;
      }
      // ts.<ASTNode> -> AST.<ASTNode>
      if (
        path.node.left.type === "Identifier" &&
        path.node.left.name === "ts" &&
        astNodes.includes(path.node.right.name)
      ) {
        path.node.left.name = "AST";
        return;
      }
    },
    MemberExpression(path) {
      // AST_NODE_TYPES.Program -> SyntaxKind.SourceFile
      if (
        path.node.object.type === "Identifier" &&
        path.node.object.name === "AST_NODE_TYPES"
      ) {
        path.node.object.name = "SyntaxKind";
        if (path.node.property.type === "Identifier") {
          path.node.property.name =
            estreeToTSTree[path.node.property.name] ?? path.node.property.name;
        }
        return;
      }
    },
    ObjectProperty(path) {
      // TODO: use data
      // messageId: "x" -> message: message.x,
      if (
        path.node.key.type === "Identifier" &&
        path.node.key.name === "messageId" &&
        path.node.value.type === "StringLiteral"
      ) {
        path.node.key.name = "message";
        path.node.value = {
          type: "MemberExpression",
          object: { type: "Identifier", name: "messages" },
          property: { type: "Identifier", name: path.node.value.value },
          computed: false,
        };
      }
    },
    FunctionDeclaration(path) {
      // Inject context arg
      if (
        path.node.params.some(
          (p) =>
            p.type === "Identifier" &&
            (p.name === "node" ||
              (p.typeAnnotation?.type === "TSTypeAnnotation" &&
                p.typeAnnotation.typeAnnotation.type === "TSTypeReference" &&
                p.typeAnnotation.typeAnnotation.typeName.type ===
                  "TSQualifiedName" &&
                p.typeAnnotation.typeAnnotation.typeName.left.type ===
                  "Identifier" &&
                p.typeAnnotation.typeAnnotation.typeName.left.name ===
                  "TSESTree")),
        )
      ) {
        path.node.params.push({
          type: "Identifier",
          name: "context",
          typeAnnotation: {
            type: "TSTypeAnnotation",
            typeAnnotation: {
              type: "TSTypeReference",
              typeName: { type: "Identifier", name: "Context" },
            },
          },
        });
        fnWithInjectedContext.push(path.node.id!.name);
      }
    },
  });

  // TODO: retraverser and inject context to fnWithInjectedContext calls

  const toTemplateStrings = messages
    ?.map(([key, value]) => {
      if (value.type !== "StringLiteral") return [key, value];
      if (!value.value.includes("{{")) {
        return [key, JSON.stringify(value.value)];
      }
      const paramNames = [...value.value.matchAll(/\{\{\w+}}/g)].map((m) =>
        m[0].slice(2, -2),
      );
      const params =
        paramNames.length === 1
          ? `${paramNames[0]}: string`
          : `params: {${paramNames.map((p) => `${p}: string`).join(",")}}`;
      const newValue = paramNames.reduce(
        (acc, p) =>
          acc.replaceAll(
            `{{${p}}}`,
            paramNames.length === 1 ? `\${${p}}` : `\${params.${p}}`,
          ),
        value.value.replaceAll("`", "\\`"),
      );
      return [key, `(${params}) => \`${newValue}\``];
    })
    .map(
      ([key, value]) =>
        `"${key}": ${
          typeof value === "string" ? value : generate(value, { filename }).code
        },`,
    )
    .join("\n");

  const content =
    `import ts, { SyntaxKind, SymbolFlags } from "typescript";
import type { AST, Checker${
      fnWithInjectedContext.length ? ", Infer" : ""
    } } from "../types.ts";
import { createRule } from "../public-utils.ts";

const messages = ${toTemplateStrings ? `{${toTemplateStrings}}` : '"extended"'}
${
  fnWithInjectedContext.length
    ? `\ntype Context = Infer<typeof ${exportName}>["Context"]`
    : ""
}
` + generate(ast, { retainLines: true, filename }).code;
  writeFileSync(
    `src/rules/${rule}.ts`,
    await format(content, {
      filepath: filename,
      parser: "babel-ts",
      trailingComma: "all",
    }),
  );
}
