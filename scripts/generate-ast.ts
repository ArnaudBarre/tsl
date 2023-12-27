import assert from "node:assert";
import { writeFileSync } from "node:fs";
import { format } from "prettier";
import ts from "typescript";

const path = "node_modules/typescript/lib/typescript.d.ts";
const program = ts.createProgram([path], {});
program.emit();
const typeChecker = program.getTypeChecker();
const printer = ts.createPrinter();
const sourceFile = program.getSourceFile(path)!;
const body = (sourceFile.statements[0] as ts.ModuleDeclaration)
  .body as ts.ModuleBlock;
const interfaces = body.statements.filter(ts.isInterfaceDeclaration);
const types = body.statements.filter(ts.isTypeAliasDeclaration);

const baseNodeProps = typeChecker
  .getTypeAtLocation(interfaces.find((i) => i.name.text === "Node")!)
  .getApparentProperties();
const baseKind = baseNodeProps.find((p) => p.name === "kind")!;
const baseProps = baseNodeProps
  .map((p) => p.name)
  .filter((p) => p !== "kind" && p !== "parent");

const importedTypes = [
  "__String",
  "AmdDependency",
  "FileReference",
  "LanguageVariant",
  "LineAndCharacter",
  "NodeFlags",
  "ReadonlyTextRange",
  "ResolutionMode",
  "ScriptTarget",
  "SyntaxKind",
  "TextChangeRange",
  "Type",
];
const outputParts: (
  | string
  | { name: string; kind: string; members?: ts.TypeElement[] }
)[] = [`import type { ${importedTypes.join(", ")} } from "typescript";\n\n`];

const visitedTypes = new Set<string>(importedTypes);
const allLinks: [string, string][] = [];
const nodes: string[] = [];
let enums: { name: string; values: string[] }[] = [];

const visitType = (name: string): void => {
  if (name.startsWith("SyntaxKind.")) return;
  if (visitedTypes.has(name)) return;
  visitedTypes.add(name);
  const int = interfaces.find((i) => i.name.text === name);
  if (!int) {
    const type = types.find((t) => t.name.text === name);
    assert(type);
    if (ts.isUnionTypeNode(type.type)) {
      visitEnumWithValues(
        name,
        type.type.types.map((el) => {
          assert(ts.isTypeReferenceNode(el));
          return el.getText();
        }),
      );
    } else if (ts.isTypeReferenceNode(type.type)) {
      const typeName = type.type.typeName.getText();
      if (
        ["ModifierToken", "PunctuationToken", "KeywordToken", "Token"].includes(
          typeName,
        )
      ) {
        assert(type.type.typeArguments?.length === 1);
        const arg = type.type.typeArguments[0];
        assert(ts.isTypeReferenceNode(arg));
        const argName = arg.typeName.getText();
        outputParts.push({ name, kind: argName });
        visitType(argName);
        allLinks.push([name, argName]);
      } else {
        outputParts.push(`export type ${name} = ${typeName};`);
        visitType(typeName);
        allLinks.push([name, typeName]);
      }
    } else {
      throw new Error(`Unexpected type ${type.type.kind} for ${name}`);
    }
    return;
  }

  const props = typeChecker.getTypeAtLocation(int).getApparentProperties();
  const kind = props.find((p) => p.name === "kind" && p !== baseKind);
  if (!kind) return visitEnum(name);
  assert(kind.valueDeclaration);
  assert(ts.isPropertySignature(kind.valueDeclaration));
  assert(kind.valueDeclaration.type);
  if (ts.isUnionTypeNode(kind.valueDeclaration.type)) return visitEnum(name);
  assert(ts.isTypeReferenceNode(kind.valueDeclaration.type));

  const allMembers: ts.TypeElement[] = [];
  const links: string[] = [];
  for (const p of props) {
    if (p === kind) continue;
    if (baseProps.includes(p.name)) continue;
    if (/_\w+Brand/.test(p.name)) continue;
    if (p.name === "parent") continue;
    assert(p.valueDeclaration);
    if (p.valueDeclaration.getFullText().includes("/** @deprecated */")) {
      continue;
    }
    if (ts.isPropertySignature(p.valueDeclaration)) {
      let m = p.valueDeclaration;
      if (!ts.isIdentifier(m.name)) {
        throw new Error(
          `Unexpected name kind ${m.name.kind} for ${p.name} in ${name}`,
        );
      }
      assert(m.type);
      if (
        ts.isTypeReferenceNode(m.type) &&
        ts.isIdentifier(m.type.typeName) &&
        m.type.typeName.escapedText === "Token"
      ) {
        assert(m.type.typeArguments?.length === 1);
        const arg = m.type.typeArguments[0];
        assert(ts.isTypeReferenceNode(arg));
        allMembers.push(
          ts.factory.createPropertySignature(
            m.modifiers,
            m.name,
            m.questionToken,
            ts.factory.createTypeReferenceNode("Node", [
              arg,
              ts.factory.createTypeReferenceNode(name),
            ]),
          ),
        );
        const argName = arg.typeName.getText();
        visitType(argName);
        allLinks.push([name, argName]);
      } else {
        if (
          ts.isTypeReferenceNode(m.type) &&
          m.type.typeArguments?.length === 1 &&
          m.type.typeArguments[0].getText() === "T"
        ) {
          // ObjectLiteralExpressionBase.properties
          const resolvedType = typeChecker.getTypeOfSymbolAtLocation(p, int);
          const typeNode = typeChecker.typeToTypeNode(
            resolvedType,
            undefined,
            undefined,
          )!;
          m = ts.factory.createPropertySignature(
            m.modifiers,
            m.name,
            m.questionToken,
            typeNode,
          );
        }
        allMembers.push(m);
        const handleRef = (typeRef: ts.TypeReferenceNode) => {
          if (ts.isQualifiedName(typeRef.typeName)) {
            assert(ts.isIdentifier(typeRef.typeName.left));
            assert(typeRef.typeName.left.text === "SyntaxKind");
            return;
          }
          assert(ts.isIdentifier(typeRef.typeName));
          let typeName = typeRef.typeName.text;
          if (typeName === "NodeArray") {
            assert(typeRef.typeArguments?.length === 1);
            handleType(typeRef.typeArguments[0]);
            return;
          } else {
            assert(!typeRef.typeArguments);
          }
          if (!importedTypes.includes(typeName)) links.push(typeName);
        };
        const handleType = (typeNode: ts.TypeNode) => {
          if (ts.isTypeReferenceNode(typeNode)) {
            handleRef(typeNode);
          } else if (ts.isUnionTypeNode(typeNode)) {
            for (const type of typeNode.types) handleType(type);
          } else if (ts.isIntersectionTypeNode(typeNode)) {
            for (const type of typeNode.types) handleType(type);
          } else if (ts.isTypeLiteralNode(typeNode)) {
            for (const member of typeNode.members) {
              if (ts.isPropertySignature(member) && member.type) {
                handleType(member.type);
              } else {
                throw new Error(
                  `Unexpected member kind ${
                    member.kind
                  } in ${member.getText()} for ${name}`,
                );
              }
            }
          } else if (ts.isTypeOperatorNode(typeNode)) {
            if (ts.isTypeReferenceNode(typeNode.type)) {
              handleRef(typeNode.type);
            } else if (
              ts.isArrayTypeNode(typeNode.type) &&
              ts.isTypeReferenceNode(typeNode.type.elementType)
            ) {
              handleRef(typeNode.type.elementType);
            } else {
              throw new Error(
                `Unexpected type ${
                  typeNode.type.kind
                } for ${name}.${m.name?.getText()}`,
              );
            }
          } else if (
            typeNode.kind === ts.SyntaxKind.UndefinedKeyword ||
            typeNode.kind === ts.SyntaxKind.NeverKeyword ||
            typeNode.kind === ts.SyntaxKind.StringKeyword ||
            typeNode.kind === ts.SyntaxKind.BooleanKeyword
          ) {
            // no-op
          } else {
            throw new Error(
              `Unexpected member kind ${
                typeNode.kind
              } in ${m.getText()} for ${name}`,
            );
          }
        };
        handleType(m.type!);
      }
    } else if (ts.isMethodSignature(p.valueDeclaration)) {
      allMembers.push(p.valueDeclaration);
    } else {
      throw new Error(
        `Unexpected declaration kind ${p.valueDeclaration.kind} for ${p.name} in ${name}`,
      );
    }
  }

  outputParts.push({
    name,
    kind: kind.valueDeclaration.type.getText(),
    members: allMembers,
  });
  nodes.push(name);

  for (const link of links) {
    visitType(link);
    allLinks.push([name, link]);
  }
};

const visitEnum = (name: string) => {
  const values = interfaces
    .filter(
      (i) =>
        i.heritageClauses?.some((h) =>
          h.types.some((t) => t.expression.getText() === name),
        ),
    )
    .map((i) => i.name.text)
    .filter((n) => n !== "KeywordTypeNode");
  assert(values.length >= 2 || name === "ObjectLiteralExpressionBase");
  visitEnumWithValues(name, values);
};

const visitEnumWithValues = (name: string, values: string[]): void => {
  addEnum(name, values);
  for (const valueName of values) {
    visitType(valueName);
    allLinks.push([name, valueName]);
  }
};
const addEnum = (name: string, values: string[]): void => {
  outputParts.push(`export type ${name} = ${values.join(" | ")};`);
  enums.push({ name, values });
};

visitType("SourceFile");

outputParts.push(`
interface NodeArray<T> extends ReadonlyArray<T>, ReadonlyTextRange {
  readonly hasTrailingComma: boolean;
}
interface Node<Kind extends SyntaxKind, Parent> extends ReadonlyTextRange {
  readonly kind: Kind;
  readonly parent: Parent;
  readonly flags: NodeFlags;
  getSourceFile(): SourceFile;
  getStart(sourceFile?: SourceFile, includeJsDocComment?: boolean): number;
  getFullStart(): number;
  getEnd(): number;
  getWidth(): number;
  getFullWidth(): number;
  getLeadingTriviaWidth(sourceFile?: SourceFile): number;
  getFullText(sourceFile?: SourceFile): string;
  getText(sourceFile?: SourceFile): string;
  /* getChildren, getChildAt, ... are removed until better typed  */
}
`);

const getParents = (name: string): Set<string> => {
  const parents = new Set<string>();
  for (const link of allLinks) {
    if (link[1] === name) {
      if (nodes.includes(link[0])) {
        parents.add(link[0]);
      } else {
        getParents(link[0]).forEach((p) => parents.add(p));
      }
    }
  }
  return parents;
};

const replaceWithEnums = (parents: Set<string>): Set<string> => {
  for (const { name, values } of enums) {
    if (values.every((v) => parents.has(v))) {
      return replaceWithEnums(
        new Set([name, ...[...parents].filter((p) => !values.includes(p))]),
      );
    }
  }
  return parents;
};

const getParentsWithEnums = (name: string) => [
  ...replaceWithEnums(getParents(name)),
];

for (const enumWithLotOfParents of [
  "Expression",
  "TypeNode",
  "Modifier",
  "Statement",
  "LeftHandSideExpression",
]) {
  addEnum(
    `${enumWithLotOfParents}Parent`,
    getParentsWithEnums(enumWithLotOfParents),
  );
}

let output = "";
for (const part of outputParts) {
  if (typeof part === "string") {
    output += `${part}\n`;
  } else {
    const parents =
      part.name === "SourceFile"
        ? "undefined"
        : getParentsWithEnums(part.name).join(" | ");
    output += `export type ${part.name} = Node<${part.kind}, ${parents}>`;
    if (part.members?.length) {
      const value = printer.printNode(
        ts.EmitHint.Unspecified,
        ts.factory.createTypeLiteralNode(part.members),
        sourceFile,
      );
      output += ` & ${value}\n`;
    } else {
      output += ";\n";
    }
  }
}

writeFileSync(
  "src/ast.ts",
  await format(output, { filepath: "src/ast.ts", printWidth: 120 }),
);
