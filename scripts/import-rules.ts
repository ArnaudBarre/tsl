import assert from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import generate from "@babel/generator";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import type {
  BlockStatement,
  Expression,
  MemberExpression,
  ObjectExpression,
  ObjectMethod,
  ObjectProperty,
  PatternLike,
  SpreadElement,
  Statement,
  TSType,
} from "@babel/types";
import { format } from "prettier";
import { kindToNodeTypeMap } from "./kindToNodeTypeMap.ts";

// prettier-ignore
const allTypedRules = {
  "await-thenable": true,
  "consistent-return": "use noImplicitReturns compilerOption",
  "consistent-type-exports": "use verbatimModuleSyntax compilerOption",
  "dot-notation": true, // without options
  "naming-convention": "styling is out of core",
  "no-array-delete": true,
  "no-base-to-string": true, // only String(), .to(Locale)String() and .join() are checked, see `restrict-plus-operands` and `restrict-template-expressions` for other checks
  "no-confusing-void-expression": true,
  "no-deprecated": true,
  "no-duplicate-type-constituents": "merged with no-redundant-type-constituents",
  "no-floating-promises": true, // allowList is named based only 
  "no-for-in-array": true,
  "no-implied-eval": true, // do not check for global shadowing
  "no-meaningless-void-operator": true,
  "no-misused-promises": true,
  "no-misused-spread": true, // no allow option
  "no-mixed-enums": "type rule only to handle cases not supported in isolatedModules",
  "no-redundant-type-constituents": true, // smarter thanks to `isTypeAssignableTo`
  "no-unnecessary-boolean-literal-compare": true,
  "no-unnecessary-condition": true,
  "no-unnecessary-qualifier": "please move out of TS only concept",
  "no-unnecessary-template-expression": true,
  "no-unnecessary-type-arguments": true,
  "no-unnecessary-type-assertion": true,
  "no-unnecessary-type-conversion": true,
  "no-unnecessary-type-parameters": true,
  "no-unsafe-argument": true,
  "no-unsafe-assignment": true, // strict mode only
  "no-unsafe-call": true, // strict mode only
  "no-unsafe-enum-comparison": "please move out of TS only concept",
  "no-unsafe-member-access": true, // strict mode only
  "no-unsafe-return": true, // strict mode only
  "no-unsafe-type-assertion": "type assertion are necessary",
  "no-unsafe-unary-minus": true,
  "non-nullable-type-assertion-style": true,
  "only-throw-error": true, // allow options is named based only
  "prefer-destructuring": "styling is out of core",
  "prefer-find": true,
  "prefer-includes": true, // without /baz/.test(a), requires regex parsing and can be achieved without type information
  "prefer-nullish-coalescing": true, // strict mode only
  "prefer-optional-chain": true,
  "prefer-promise-reject-errors": "use global types instead", 
  "prefer-readonly": true,
  "prefer-readonly-parameter-types": true,
  "prefer-reduce-type-parameter": true,
  "prefer-regexp-exec": "small regex optimization are out of core",
  "prefer-return-this-type": true,
  "prefer-string-starts-ends-with": true,
  "promise-function-async": true,
  "related-getter-setter-pairs": "OOP edge cases are out of core",
  "require-array-sort-compare": true,
  "require-await": "type information to handle async generators, which is a niche case",
  "restrict-plus-operands": true, // stricter defaults, always lint assignment
  "restrict-template-expressions": true,
  "return-await": true, // only support always, remove unneeded await handled by await-thenable
  "strict-boolean-expressions": true,
  "switch-exhaustiveness-check": true, // missing no default comment #10218
  "unbound-method": "OOP edge cases are out of core",
  "use-unknown-in-catch-callback-variable": "use global types instead",
} satisfies Record<string, true | string>;

const extensionsRules = [
  "consistent-return",
  "dot-notation",
  "no-implied-eval",
  "only-throw-error",
  "prefer-destructuring",
  "prefer-promise-reject-errors",
  "require-await",
  "return-await",
];

const kebabCaseToCamelCase = (str: string) =>
  str.replace(/-([a-z])/gu, (_, c) => c.toUpperCase());

const firstIterationRules = readdirSync("src/rules-2024-01");
const alreadyImportedRules = readdirSync("src/rules").filter(
  (it) => !it.startsWith("_") && !it.startsWith("."),
);

const arg = process.argv[2];
if (!arg) throw new Error("No rule provided");

const stillToImport = Object.entries(allTypedRules)
  .filter(
    ([key, value]) =>
      value === true
      && !alreadyImportedRules.includes(kebabCaseToCamelCase(key)),
  )
  .map(([key]) => key);
const rulesToImport = arg === "next" ? stillToImport.slice(0, 1) : [arg];

const getObjectValue = (node: ObjectExpression, name: string) =>
  node.properties.find(
    (p): p is ObjectProperty =>
      p.type === "ObjectProperty"
      && p.key.type === "Identifier"
      && p.key.name === name,
  );

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
  JSXSpreadAttribute: "JsxSpreadAttribute",
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

for (const rule of rulesToImport) {
  const filename = `${rule}.ts`;
  const camelCaseRule = kebabCaseToCamelCase(rule);
  const srcPath = `../typescript-eslint/packages/eslint-plugin/src/rules/${filename}`;
  const testPath =
    rule === "prefer-optional-chain"
      ? `../typescript-eslint/packages/eslint-plugin/tests/rules/${rule}/${rule}.test.ts`
      : `../typescript-eslint/packages/eslint-plugin/tests/rules/${rule}.test.ts`;
  console.log(rule, {
    new: `./src/rules/${rule}/${filename}`,
    previousIteration: firstIterationRules.includes(filename)
      ? `./src/rules-2024-01/${filename}`
      : undefined,
    doc: `https://typescript-eslint.io/rules/${rule}`,
    src: srcPath,
    test: testPath,
    gitHistorySrc: `https://github.com/typescript-eslint/typescript-eslint/commits/main/packages/eslint-plugin/src/rules/${rule}.ts`,
    gitHistoryTest: `https://github.com/typescript-eslint/typescript-eslint/commits/main/packages/eslint-plugin/tests/rules/${rule}.test.ts`,
  });
  const srcContent = readFileSync(srcPath, "utf-8");
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
  let hasAutofix = false as boolean;
  traverse(srcAST, {
    ImportDeclaration(path) {
      path.remove();
    },
    VariableDeclaration(path) {
      const init = path.node.declarations[0].init;
      if (
        init?.type === "CallExpression"
        && init.callee.type === "Identifier"
        && ["getESLintCoreRule", "getParserServices"].includes(init.callee.name)
      ) {
        if (init.callee.name) {
          const id = path.node.declarations[0].id;
          assert(id.type === "Identifier");
          parserServicesName = id.name;
        }
        path.remove();
      }
      if (
        init?.type === "CallExpression"
        && init.callee.type === "MemberExpression"
        && init.callee.property.type === "Identifier"
        && init.callee.property.name === "getTypeChecker"
      ) {
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
      nameProp.value.value = `core/${exportName}`;
      const createProp = params.properties.find(
        (p): p is ObjectMethod =>
          p.type === "ObjectMethod"
          && p.key.type === "Identifier"
          && p.key.name === "create",
      )!;
      const returnStatements: ObjectExpression[] = [];
      for (const s of createProp.body.body) {
        if (s.type === "ReturnStatement") {
          assert(s.argument!.type === "ObjectExpression");
          returnStatements.push(s.argument);
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
                p.key.type === "StringLiteral"
                && p.key.value.endsWith(":exit")
              ) {
                const nodeName = p.key.value.slice(0, -5);
                if (nodeName in estreeToTSTree)
                  p.key.value = `${estreeToTSTree[nodeName]!}:exit`;
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
        value:
          returnStatements.length === 1
            ? returnStatements[0]
            : {
                type: "ArrowFunctionExpression",
                params: [],
                body: createProp.body,
                async: false,
                expression: false,
              },
      };

      const body: Statement[] = [];
      if (options) {
        const defaults = getObjectValue(params, "defaultOptions")!.value;
        assert(defaults.type === "ArrayExpression");
        assert(defaults.elements.length === 1, "Default is array");
        const defaultsObject = defaults.elements[0]!;
        assert(defaultsObject.type === "ObjectExpression");

        body.push({
          type: "VariableDeclaration",
          kind: "const",
          declarations: [
            {
              type: "VariableDeclarator",
              id: { type: "Identifier", name: "options" },
              init: {
                type: "ObjectExpression",
                properties: [
                  ...defaultsObject.properties,
                  {
                    type: "SpreadElement",
                    argument: { type: "Identifier", name: "_options" },
                  },
                ],
              },
            },
          ],
        });
      }
      if (returnStatements.length === 1) {
        body.push(
          ...createProp.body.body.filter((s) => s.type !== "ReturnStatement"),
        );
      }
      body.push({
        type: "ReturnStatement",
        argument: {
          type: "ObjectExpression",
          properties: [nameProp, visitorProp],
        },
      });

      path.replaceWith({
        type: "ExportNamedDeclaration",
        declaration: {
          type: "VariableDeclaration",
          kind: "const",
          declarations: [
            {
              type: "VariableDeclarator",
              id: { type: "Identifier", name: exportName },
              init: {
                type: "CallExpression",
                callee: { type: "Identifier", name: "createRule" },
                arguments: [
                  {
                    type: "ArrowFunctionExpression",
                    params: options
                      ? [
                          {
                            type: "Identifier",
                            name: "_options",
                            optional: true,
                            typeAnnotation: {
                              type: "TSTypeAnnotation",
                              typeAnnotation: options,
                            },
                          },
                        ]
                      : [],
                    body: { type: "BlockStatement", body, directives: [] },
                    async: false,
                    expression: false,
                  },
                ],
              },
            },
          ],
        },
        specifiers: [],
      });
    },
    CallExpression(path) {
      // services.program.getTypeChecker() -> context.checker
      if (
        path.node.callee.type === "MemberExpression"
        && path.node.callee.object.type === "MemberExpression"
        && path.node.callee.object.object.type === "Identifier"
        && path.node.callee.object.object.name === parserServicesName
        && path.node.callee.object.property.type === "Identifier"
        && path.node.callee.object.property.name === "program"
        && path.node.callee.property.type === "Identifier"
        && path.node.callee.property.name === "getTypeChecker"
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
        path.node.callee.type === "MemberExpression"
        && path.node.callee.object.type === "Identifier"
        && path.node.callee.object.name === parserServicesName
        && path.node.callee.property.type === "Identifier"
        && ["getTypeAtLocation", "getSymbolAtLocation"].includes(
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
        path.node.callee.type === "MemberExpression"
        && path.node.callee.object.type === "MemberExpression"
        && path.node.callee.object.object.type === "Identifier"
        && path.node.callee.object.object.name === parserServicesName
        && path.node.callee.object.property.type === "Identifier"
        && path.node.callee.object.property.name === "esTreeNodeToTSNodeMap"
        && path.node.callee.property.type === "Identifier"
        && path.node.callee.property.name === "get"
      ) {
        path.replaceWith(path.node.arguments[0]);
        return;
      }
      // tsutils.x() -> x() / context.utils.x()
      if (
        path.node.callee.type === "MemberExpression"
        && path.node.callee.object.type === "Identifier"
        && path.node.callee.object.name === "tsutils"
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
        path.node.callee.type === "Identifier"
        && path.node.callee.name === "getConstrainedTypeAtLocation"
        && path.node.arguments[0].type === "Identifier"
        && path.node.arguments[0].name === parserServicesName
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
      // context.sourceCode.getText(returnValue) -> returnValue.getText()
      if (
        path.node.callee.type === "MemberExpression"
        && path.node.callee.object.type === "MemberExpression"
        && path.node.callee.object.object.type === "Identifier"
        && path.node.callee.object.object.name === "context"
        && path.node.callee.object.property.type === "Identifier"
        && path.node.callee.object.property.name === "sourceCode"
        && path.node.callee.property.type === "Identifier"
        && path.node.callee.property.name === "getText"
        && path.node.arguments.length === 1
        && path.node.arguments[0].type === "Identifier"
      ) {
        path.replaceWith({
          type: "CallExpression",
          callee: {
            type: "MemberExpression",
            object: {
              type: "Identifier",
              name: path.node.arguments[0].name,
            },
            property: { type: "Identifier", name: "getText" },
            computed: false,
          },
          arguments: [],
        });
        return;
      }
    },
    TSTypeAliasDeclaration(path) {
      // get Options type
      if (
        path.node.id.name === "Options"
        && path.node.typeAnnotation.type === "TSTupleType"
      ) {
        if (extensionsRules.includes(rule)) return;
        if (path.node.typeAnnotation.elementTypes.length === 0) {
          return;
        }
        assert(path.node.typeAnnotation.elementTypes.length === 1);
        assert(
          path.node.typeAnnotation.elementTypes[0].type
            !== "TSNamedTupleMember",
        );
        options = path.node.typeAnnotation.elementTypes[0];
        path.remove();
        return;
      }
      if (
        path.node.id.name === "MessageIds"
        || path.node.id.name === "MessageId"
      ) {
        path.remove();
        return;
      }
    },
    TSQualifiedName(path) {
      // TSESTree.x -> AST.x
      if (
        path.node.left.type === "Identifier"
        && path.node.left.name === "TSESTree"
      ) {
        path.node.left.name = path.node.right.name === "Node" ? "ts" : "AST";
        path.node.right.name = estreeToTSTree[path.node.right.name]
          ? (kindToNodeTypeMap[estreeToTSTree[path.node.right.name]!]
            ?? estreeToTSTree[path.node.right.name]!)
          : path.node.right.name;
        return;
      }
      // ts.TypeChecker -> Checker
      if (
        path.node.left.type === "Identifier"
        && path.node.left.name === "ts"
        && path.node.right.name === "TypeChecker"
      ) {
        path.replaceWith({ type: "Identifier", name: "Checker" });
        return;
      }
      // ts.<ASTNode> -> AST.<ASTNode>
      if (
        path.node.left.type === "Identifier"
        && path.node.left.name === "ts"
        && astNodes.includes(path.node.right.name)
      ) {
        path.node.left.name = "AST";
        return;
      }
    },
    MemberExpression(path) {
      // AST_NODE_TYPES.Program -> SyntaxKind.SourceFile
      if (
        path.node.object.type === "Identifier"
        && path.node.object.name === "AST_NODE_TYPES"
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
        path.node.object.type === "MemberExpression"
        && path.node.object.object.type === "Identifier"
        && path.node.object.object.name === "TSESTree"
        && path.node.object.property.type === "Identifier"
        && path.node.object.property.name === "AST_NODE_TYPES"
      ) {
        path.node.object = { type: "Identifier", name: "SyntaxKind" };
        if (path.node.property.type === "Identifier") {
          path.node.property.name =
            estreeToTSTree[path.node.property.name] ?? path.node.property.name;
        }
        return;
      }
      // checker -> context.checker
      if (
        path.node.object.type === "Identifier"
        && path.node.object.name === "checker"
      ) {
        path.node.object = {
          type: "MemberExpression",
          object: { type: "Identifier", name: "context" },
          property: { type: "Identifier", name: "checker" },
          computed: false,
        };
        return;
      }
    },
    ObjectExpression(path) {
      let messageProp: ObjectProperty | undefined;
      let dataProp: ObjectProperty | undefined;
      let dataPropValue: ObjectExpression | undefined;
      let fixProp: ObjectProperty | ObjectMethod | undefined;
      let fixBody: BlockStatement | undefined;
      for (const p of path.node.properties) {
        if (p.type === "ObjectProperty" && p.key.type === "Identifier") {
          if (p.key.name === "data") {
            assert(
              p.value.type === "ObjectExpression",
              "data is not an object",
            );
            dataProp = p;
            dataPropValue = p.value;
          }
          if (p.key.name === "messageId") {
            messageProp = p;
            p.key.name = "message";
          }
          if (p.key.name === "suggest") {
            p.key.name = "suggestions";
          }
          if (
            p.key.name === "fix"
            && p.value.type === "ArrowFunctionExpression"
          ) {
            fixProp = p;
            fixBody =
              p.value.body.type === "BlockStatement"
                ? p.value.body
                : {
                    type: "BlockStatement",
                    body: [
                      { type: "ExpressionStatement", expression: p.value.body },
                    ],
                    directives: [],
                  };
            hasAutofix = true;
          }
        }
        if (
          p.type === "ObjectMethod"
          && p.key.type === "Identifier"
          && p.key.name === "fix"
        ) {
          fixProp = p;
          fixBody = p.body;
          hasAutofix = true;
        }
      }
      if (messageProp) {
        const getMessageExpression = (value: string): Expression => {
          const memberExpr: MemberExpression = {
            type: "MemberExpression",
            object: { type: "Identifier", name: "messages" },
            property: { type: "Identifier", name: value },
            computed: false,
          };
          return dataPropValue
            ? {
                type: "CallExpression",
                callee: memberExpr,
                arguments: [dataPropValue],
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
          } else {
            throw new Error(`Unexpected expr type: ${expr.type}`);
          }
        };
        messageProp.value = replaceMessageId(messageProp.value);
        path.node.properties = path.node.properties.filter(
          (p) => p !== dataProp && p !== fixProp,
        );
        if (fixBody) {
          const lastStatement = fixBody.body.at(-1);
          if (lastStatement?.type === "ReturnStatement") {
            fixBody.body[fixBody.body.length - 1] = {
              type: "ExpressionStatement",
              expression: lastStatement.argument!,
            };
          }
          fixBody.body.push({
            type: "ReturnStatement",
            argument: {
              type: "ArrayExpression",
              elements: [
                {
                  type: "ObjectExpression",
                  properties: [
                    {
                      type: "ObjectProperty",
                      key: { type: "Identifier", name: "message" },
                      value: {
                        type: "MemberExpression",
                        object: { type: "Identifier", name: "messages" },
                        property: { type: "Identifier", name: "fix" },
                        computed: false,
                      },
                      computed: false,
                      shorthand: false,
                    },
                    {
                      type: "ObjectProperty",
                      key: { type: "Identifier", name: "changes" },
                      value: { type: "ArrayExpression", elements: [] },
                      computed: false,
                      shorthand: false,
                    },
                  ],
                },
              ],
            },
          });
          path.node.properties.push({
            type: "ObjectProperty",
            key: { type: "Identifier", name: "suggestions" },
            computed: false,
            shorthand: false,
            value: {
              type: "ArrowFunctionExpression",
              params: [],
              body: fixBody,
              async: false,
              expression: true,
            },
          });
        }
      }
    },
    FunctionDeclaration(path) {
      // Inject context arg
      if (
        path.node.params.some(
          (p) =>
            p.type === "Identifier"
            && (p.name === "node"
              || (p.typeAnnotation?.type === "TSTypeAnnotation"
                && p.typeAnnotation.typeAnnotation.type === "TSTypeReference"
                && p.typeAnnotation.typeAnnotation.typeName.type
                  === "TSQualifiedName"
                && p.typeAnnotation.typeAnnotation.typeName.left.type
                  === "Identifier"
                && p.typeAnnotation.typeAnnotation.typeName.left.name
                  === "TSESTree")),
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
        path.node.callee.type === "Identifier"
        && fnWithInjectedContext.includes(path.node.callee.name)
      ) {
        path.node.arguments.push({ type: "Identifier", name: "context" });
      }
    },
  });

  const testContent = readFileSync(testPath, "utf-8");
  const testAST = parser.parse(testContent, {
    sourceFilename: `${rule}.test.ts`,
    plugins: ["typescript"],
    sourceType: "module",
  });
  traverse(testAST, {
    ImportDeclaration(path) {
      path.remove();
    },
    VariableDeclaration(path) {
      const firstDeclaration = path.node.declarations.at(0);
      if (
        firstDeclaration?.id.type === "Identifier"
        && (firstDeclaration.id.name === "ruleTester"
          || firstDeclaration.id.name === "rootPath"
          || firstDeclaration.id.name === "rootDir")
      ) {
        path.remove();
      }
    },
    CallExpression(path) {
      if (
        path.node.callee.type === "MemberExpression"
        && path.node.callee.object.type === "Identifier"
        && path.node.callee.object.name === "ruleTester"
      ) {
        path.node.callee = path.node.callee.object;
        assert(path.node.arguments[2].type === "ObjectExpression");
        path.node.arguments = [
          {
            type: "ObjectExpression",
            properties: [
              {
                type: "ObjectProperty",
                key: { type: "Identifier", name: "ruleFn" },
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
        const outputProp = getObjectValue(path.node, "output");
        const languageOptionsProp = getObjectValue(
          path.node,
          "languageOptions",
        );
        let languageOptionsHandled = false;
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
          const firstElement = optionsProp.value.elements[0];
          assert(
            firstElement && firstElement.type !== "SpreadElement",
            "options[0] is not an expression",
          );
          optionsProp.value = firstElement;
        }
        const prevProperties = path.node.properties;
        path.node.properties = [];
        if (
          languageOptionsProp
          && languageOptionsProp.value.type === "ObjectExpression"
          && languageOptionsProp.value.properties.length === 1
          && languageOptionsProp.value.properties[0].type === "ObjectProperty"
          && languageOptionsProp.value.properties[0].key.type === "Identifier"
          && languageOptionsProp.value.properties[0].key.name
            === "parserOptions"
          && languageOptionsProp.value.properties[0].value.type
            === "ObjectExpression"
        ) {
          const parserOptions = languageOptionsProp.value.properties[0].value;
          if (
            parserOptions.properties.length === 1
            && parserOptions.properties[0].type === "ObjectProperty"
            && parserOptions.properties[0].key.type === "Identifier"
            && parserOptions.properties[0].key.name === "ecmaFeatures"
            && parserOptions.properties[0].value.type === "ObjectExpression"
          ) {
            const ecmaFeatures = parserOptions.properties[0].value;
            if (
              ecmaFeatures.properties.length === 1
              && ecmaFeatures.properties[0].type === "ObjectProperty"
              && ecmaFeatures.properties[0].key.type === "Identifier"
              && ecmaFeatures.properties[0].key.name === "jsx"
              && ecmaFeatures.properties[0].value.type === "BooleanLiteral"
              && ecmaFeatures.properties[0].value.value
            ) {
              // tsx: true
              path.node.properties.push({
                type: "ObjectProperty",
                key: { type: "Identifier", name: "tsx" },
                value: { type: "BooleanLiteral", value: true },
                computed: false,
                shorthand: false,
              });
              languageOptionsHandled = true;
            }
          }
        }
        if (optionsProp) path.node.properties.push(optionsProp);
        if (codeProp.value.type === "TaggedTemplateExpression") {
          codeProp.value = codeProp.value.quasi; // Drop noFormat
        }
        path.node.properties.push(codeProp);
        if (outputProp && outputProp.value.type !== "NullLiteral") {
          if (!errorsProp) throw new Error("Output without errors");
          assert(errorsProp.value.type === "ArrayExpression");
          for (const error of errorsProp.value.elements) {
            assert(error?.type === "ObjectExpression");
            error.properties.push({
              type: "ObjectProperty",
              key: { type: "Identifier", name: "suggestions" },
              computed: false,
              shorthand: false,
              value: {
                type: "ArrayExpression",
                elements: [
                  {
                    type: "ObjectExpression",
                    properties: [
                      {
                        type: "ObjectProperty",
                        key: { type: "Identifier", name: "message" },
                        computed: false,
                        shorthand: false,
                        value: {
                          type: "MemberExpression",
                          object: { type: "Identifier", name: "messages" },
                          property: { type: "Identifier", name: "fix" },
                          computed: false,
                        },
                      },
                      outputProp,
                    ],
                  },
                ],
              },
            });
          }
        }
        if (errorsProp) path.node.properties.push(errorsProp);
        for (const p of prevProperties) {
          if (
            p !== optionsProp
            && p !== codeProp
            && p !== errorsProp
            && p !== outputProp
            && (languageOptionsHandled ? p !== languageOptionsProp : true)
          ) {
            path.node.properties.push(p);
          }
        }
      }

      const messageIdProp = getObjectValue(path.node, "messageId");
      if (messageIdProp) {
        assert(
          messageIdProp.key.type === "Identifier",
          "messageId is not a string",
        );
        messageIdProp.key.name = "message";
        let dataProp: ObjectProperty | undefined;
        let dataPropValue: ObjectExpression | undefined;
        for (const p of path.node.properties) {
          if (p.type === "ObjectProperty" && p.key.type === "Identifier") {
            if (p.key.name === "data") {
              assert(
                p.value.type === "ObjectExpression",
                "data is not an object",
              );
              dataProp = p;
              dataPropValue = p.value;
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
          return dataPropValue
            ? {
                type: "CallExpression",
                callee: memberExpr,
                arguments: [dataPropValue],
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

        const getOrder = (p: ObjectMethod | ObjectProperty | SpreadElement) => {
          if (p.type !== "ObjectProperty") return 100;
          if (p.key.type !== "Identifier") return 100;
          if (p.key.name === "message") return 0;
          if (p.key.name === "line") return 1;
          if (p.key.name === "column") return 2;
          if (p.key.name === "endLine") return 3;
          if (p.key.name === "endColumn") return 4;
          if (p.key.name === "suggestions") return 5;
          return 100;
        };
        path.node.properties = path.node.properties
          .filter((p) => p !== dataProp)
          .sort((a, b) => getOrder(a) - getOrder(b));
      }
    },
  });

  if (messages && hasAutofix) {
    messages.push(["fix", { type: "StringLiteral", value: "Fix" }]);
  }

  const toTemplateStrings = messages
    ?.map(([key, value]) => {
      const text =
        value.type === "StringLiteral"
          ? value.value
          : value.type === "TemplateLiteral"
            ? value.quasis[0].value.raw
            : null;
      if (!text) return [key, value] as const;
      if (!text.includes("{{")) {
        return [key, JSON.stringify(text)] as const;
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
      return [key, `(${params}) => \`${newValue}\``] as const;
    })
    .map(
      ([key, value]) =>
        `"${key}": ${
          typeof value === "string" ? value : generate(value, { filename }).code
        },`,
    )
    .join("\n");

  const tsApiUtilsImports = tsutils.length
    ? `\nimport { ${tsutils
        .filter((u, i) => tsutils.indexOf(u) === i)
        .sort()
        .join(", ")} } from "ts-api-utils";`
    : "";

  await Bun.write(
    `src/rules/${camelCaseRule}/${camelCaseRule}.ts`,
    await format(
      `import ts, { SyntaxKind, SymbolFlags } from "typescript";${tsApiUtilsImports}
      import { createRule } from "../../index.ts";
      import type { AST, Checker, Context } from "../../types.ts";
      
      export const messages = ${
        toTemplateStrings ? `{${toTemplateStrings}}` : '"extended"'
      }
      
      ` + generate(srcAST, { retainLines: true, filename }).code,
      { filepath: `${rule}.ts`, parser: "babel-ts", trailingComma: "all" },
    ),
  );
  await Bun.write(
    `src/rules/${camelCaseRule}/${camelCaseRule}.test.ts`,
    await format(
      `import { ruleTester } from "../../ruleTester.ts";
import { messages, ${camelCaseRule} } from "./${camelCaseRule}.ts";

`
        + generate(testAST, { filename, compact: true }).code.replace(
          "ruleTester(",
          "export const test = () => ruleTester(",
        ),
      { filepath: `${rule}.test.ts`, parser: "babel-ts", trailingComma: "all" },
    ),
  );
}
