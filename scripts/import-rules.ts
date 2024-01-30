import assert from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import generate from "@babel/generator";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import type {
  Expression,
  Identifier,
  MemberExpression,
  ObjectExpression,
  ObjectMethod,
  ObjectProperty,
  PatternLike,
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
  TSAnyKeyword: "AnyKeyword",
  TSBigIntKeyword: "BigIntKeyword",
  TSBooleanKeyword: "BooleanKeyword",
  TSNeverKeyword: "NeverKeyword",
  TSUnknownKeyword: "UnknownKeyword",
  TSNumberKeyword: "NumberKeyword",
  TSStringKeyword: "StringKeyword",
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

const index = Number(process.argv[2]);

for (const rule of rules.slice(index, index + 1)) {
  const filename = `${rule}.ts`;
  console.log(rule);
  const srcContent = readFileSync(
    `../typescript-eslint/packages/eslint-plugin/src/rules/${filename}`,
    "utf-8",
  );
  const srcAST = parser.parse(srcContent, {
    sourceFilename: filename,
    plugins: ["typescript"],
    sourceType: "module",
  });
  let options: TSType | undefined;
  let messages: [string, ObjectProperty["value"]][] | undefined;
  let parserServicesName: string | undefined;
  let exportName = "";
  const fnWithInjectedContext: string[] = [];
  const tsutils: string[] = [];
  traverse(srcAST, {
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
      if (options) {
        const defaults = getObjectValue(params, "defaultOptions")!.value;
        assert(defaults.type === "ArrayExpression");
        assert(defaults.elements.length === 1, "Default is array");
        const defaultsObject = defaults.elements[0]!;
        assert(defaultsObject.type === "ObjectExpression");

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
                optional: true,
                typeAnnotation: {
                  type: "TSTypeAnnotation",
                  typeAnnotation: options,
                },
              },
            ],
            body: {
              type: "ObjectExpression",
              properties: [
                ...defaultsObject.properties,
                {
                  type: "SpreadElement",
                  argument: { type: "Identifier", name: "options" },
                },
              ],
            },
            async: false,
            expression: true,
          },
        };
        params.properties = [nameProp, optionsParam, visitorProp];
      } else {
        params.properties = [nameProp, visitorProp];
      }
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
      // tsutils.x() -> x() / context.utils.x()
      if (
        path.node.callee.type === "MemberExpression" &&
        path.node.callee.object.type === "Identifier" &&
        path.node.callee.object.name === "tsutils"
      ) {
        if (
          path.node.arguments.some(
            (arg) => arg.type === "Identifier" && arg.name === "checker",
          )
        ) {
          path.node.callee.object = {
            type: "MemberExpression",
            object: { type: "Identifier", name: "context" },
            property: { type: "Identifier", name: "utils" },
            computed: false,
          };
          // drop checker arg
          for (const arg of path.node.arguments) {
            if (arg.type === "Identifier" && arg.name === "checker") {
              path.node.arguments = path.node.arguments.filter(
                (a) => a !== arg,
              );
            }
          }
        } else {
          assert(path.node.callee.property.type === "Identifier");
          tsutils.push(path.node.callee.property.name);
          path.node.callee = path.node.callee.property;
        }
        return;
      }
      // getConstrainedTypeAtLocation(services, node) -> context.utils.getConstrainedTypeAtLocation(node)
      if (
        path.node.callee.type === "Identifier" &&
        path.node.callee.name === "getConstrainedTypeAtLocation" &&
        path.node.arguments[0].type === "Identifier" &&
        path.node.arguments[0].name === parserServicesName
      ) {
        path.node.callee = {
          type: "MemberExpression",
          object: {
            type: "MemberExpression",
            object: { type: "Identifier", name: "context" },
            property: { type: "Identifier", name: "utils" },
            computed: false,
          },
          property: {
            type: "Identifier",
            name: "getConstrainedTypeAtLocation",
          },
          computed: false,
        };
        path.node.arguments.shift();
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
      if (
        path.node.id.name === "MessageIds" ||
        path.node.id.name === "MessageId"
      ) {
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
          ? kindToNodeTypeMap[estreeToTSTree[path.node.right.name]!] ??
            estreeToTSTree[path.node.right.name]
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
      // TSESTree.AST_NODE_TYPES.Program -> SyntaxKind.SourceFile
      if (
        path.node.object.type === "MemberExpression" &&
        path.node.object.object.type === "Identifier" &&
        path.node.object.object.name === "TSESTree" &&
        path.node.object.property.type === "Identifier" &&
        path.node.object.property.name === "AST_NODE_TYPES"
      ) {
        path.node.object = { type: "Identifier", name: "SyntaxKind" };
        if (path.node.property.type === "Identifier") {
          path.node.property.name =
            estreeToTSTree[path.node.property.name] ?? path.node.property.name;
        }
        return;
      }
    },
    ObjectExpression(path) {
      let messageProp: ObjectProperty | undefined;
      let dataProp: ObjectExpression | undefined;
      for (const p of path.node.properties) {
        if (p.type === "ObjectProperty" && p.key.type === "Identifier") {
          if (p.key.name === "data") {
            assert(
              p.value.type === "ObjectExpression",
              "data is not an object",
            );
            dataProp = p.value;
          }
          if (p.key.name === "messageId") {
            messageProp = p;
            p.key.name = "message";
          }
        }
      }
      const getMessageExpression = (value: string): Expression => {
        const memberExpr: MemberExpression = {
          type: "MemberExpression",
          object: { type: "Identifier", name: "messages" },
          property: { type: "Identifier", name: value },
          computed: false,
        };
        return dataProp
          ? {
              type: "CallExpression",
              callee: memberExpr,
              arguments: [dataProp],
            }
          : memberExpr;
      };
      const replaceMessageId = (expr: Expression | PatternLike): Expression => {
        if (expr.type === "StringLiteral") {
          return getMessageExpression(expr.value);
        } else if (expr.type === "ConditionalExpression") {
          expr.consequent = replaceMessageId(expr.consequent);
          expr.alternate = replaceMessageId(expr.alternate);
          return expr;
        } else if (expr.type === "Identifier") {
          return getMessageExpression(expr.name);
        } else {
          throw new Error(`Unexpected expr type: ${expr.type}`);
        }
      };
      if (messageProp) {
        messageProp.value = replaceMessageId(messageProp.value);
        const nodeProp = getObjectValue(path.node, "node");
        path.node.properties = path.node.properties.filter(
          (prop) => prop === messageProp || prop === nodeProp,
        );
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

  // retraverse and inject context to fn calls
  traverse(srcAST, {
    CallExpression(path) {
      if (
        path.node.callee.type === "Identifier" &&
        fnWithInjectedContext.includes(path.node.callee.name)
      ) {
        path.node.arguments.push({ type: "Identifier", name: "context" });
      }
    },
  });

  const testContent = readFileSync(
    `../typescript-eslint/packages/eslint-plugin/tests/rules/${rule}.test.ts`,
    "utf-8",
  );
  const testAST = parser.parse(testContent, {
    sourceFilename: filename,
    plugins: ["typescript"],
    sourceType: "module",
  });
  traverse(testAST, {
    ImportDeclaration(path) {
      path.remove();
    },
    VariableDeclaration(path) {
      if (
        path.node.declarations[0]?.id.type === "Identifier" &&
        path.node.declarations[0]?.id.name === "ruleTester"
      ) {
        path.remove();
      }
    },
    CallExpression(path) {
      if (
        path.node.callee.type === "MemberExpression" &&
        path.node.callee.object.type === "Identifier" &&
        path.node.callee.object.name === "ruleTester"
      ) {
        path.node.callee = path.node.callee.object;
        assert(path.node.arguments[2].type === "ObjectExpression");
        path.node.arguments = [
          {
            type: "ObjectExpression",
            properties: [
              {
                type: "ObjectProperty",
                key: { type: "Identifier", name: "rule" },
                value: { type: "Identifier", name: exportName },
                computed: false,
                shorthand: false,
              },
              ...path.node.arguments[2].properties,
            ],
          },
        ];
      }
    },
    ObjectExpression(path) {
      const codeProp = getObjectValue(path.node, "code");
      if (codeProp) {
        const errorsProp = getObjectValue(path.node, "errors");
        let optionsProp = getObjectValue(path.node, "options");
        if (optionsProp) {
          if (optionsProp.value.type === "TSAsExpression") {
            optionsProp.value = optionsProp.value.expression;
          }
          assert(
            optionsProp.value.type === "ArrayExpression",
            "options is not an array",
          );
          assert(
            optionsProp.value.elements.length === 1,
            "options length is not 1",
          );
          assert(
            optionsProp.value.elements[0]?.type === "ObjectExpression",
            "options length is not 1",
          );
          optionsProp.value = optionsProp.value.elements[0];
        }
        path.node.properties = [];
        if (optionsProp) path.node.properties.push(optionsProp);
        path.node.properties.push(codeProp);
        if (errorsProp) path.node.properties.push(errorsProp);
      }

      const messageIdProp = getObjectValue(path.node, "messageId");
      if (messageIdProp) {
        assert(
          messageIdProp.key.type === "Identifier",
          "messageId is not a string",
        );
        messageIdProp.key.name = "message";
        let dataProp: ObjectExpression | undefined;
        for (const p of path.node.properties) {
          if (p.type === "ObjectProperty" && p.key.type === "Identifier") {
            if (p.key.name === "data") {
              assert(
                p.value.type === "ObjectExpression",
                "data is not an object",
              );
              dataProp = p.value;
            }
          }
        }
        const getMessageExpression = (value: string): Expression => {
          const memberExpr: MemberExpression = {
            type: "MemberExpression",
            object: { type: "Identifier", name: "messages" },
            property: { type: "Identifier", name: value },
            computed: false,
          };
          return dataProp
            ? {
                type: "CallExpression",
                callee: memberExpr,
                arguments: [dataProp],
              }
            : memberExpr;
        };
        const replaceMessageId = (
          expr: Expression | PatternLike,
        ): Expression => {
          if (expr.type === "StringLiteral") {
            return getMessageExpression(expr.value);
          } else if (expr.type === "ConditionalExpression") {
            expr.consequent = replaceMessageId(expr.consequent);
            expr.alternate = replaceMessageId(expr.alternate);
            return expr;
          } else if (expr.type === "Identifier") {
            return getMessageExpression(expr.name);
          } else if (expr.type === "TSAsExpression") {
            return replaceMessageId(expr.expression);
          } else {
            throw new Error(`Unexpected expr type: ${expr.type}`);
          }
        };
        messageIdProp.value = replaceMessageId(messageIdProp.value);
        const nodeProp = getObjectValue(path.node, "node");
        const lineProp = getObjectValue(path.node, "line");
        const columnProp = getObjectValue(path.node, "column");
        path.node.properties = path.node.properties.filter(
          (prop) =>
            prop === messageIdProp ||
            prop === nodeProp ||
            prop === lineProp ||
            prop === columnProp,
        );
      }
    },
  });

  const toTemplateStrings = messages
    ?.map(([key, value]) => {
      const text =
        value.type === "StringLiteral"
          ? value.value
          : value.type === "TemplateLiteral"
          ? value.quasis[0].value.raw
          : null;
      if (!text) return [key, value];
      if (!text.includes("{{")) {
        return [key, JSON.stringify(text)];
      }
      const paramContent = [...text.matchAll(/\{\{[^}]+}}/g)].map((m) =>
        m[0].slice(2, -2),
      );
      const params = `params: {${paramContent
        .map((p) => `${p.trim()}: string`)
        .join(",")}}`;
      const newValue = paramContent.reduce(
        (acc, p) => acc.replaceAll(`{{${p}}}`, `\${params.${p.trim()}}`),
        text.replaceAll("`", "\\`"),
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

  const tsApiUtilsImports = tsutils.length
    ? `\nimport { ${tsutils.join(", ")} } from "ts-api-utils";`
    : "";
  const content =
    `import ts, { SyntaxKind, SymbolFlags } from "typescript";${tsApiUtilsImports}
import type { AST, Checker${
      fnWithInjectedContext.length ? `, ${options ? "Infer" : "Context"}` : ""
    } } from "../types.ts";
import { createRule } from "../public-utils.ts";
import { ruleTester } from "../ruleTester.ts";

const messages = ${toTemplateStrings ? `{${toTemplateStrings}}` : '"extended"'}
${
  fnWithInjectedContext.length && options
    ? `\ntype Context = Infer<typeof ${exportName}>["Context"]`
    : ""
}
` +
    generate(srcAST, { retainLines: true, filename }).code +
    "\n\n/** Tests */\n" +
    generate(testAST, { filename }).code.replace(
      "ruleTester(",
      "export const test = () => ruleTester(",
    );
  writeFileSync(
    `src/rules/${rule}.ts`,
    await format(content, {
      filepath: filename,
      parser: "babel-ts",
      trailingComma: "all",
    }),
  );
}
