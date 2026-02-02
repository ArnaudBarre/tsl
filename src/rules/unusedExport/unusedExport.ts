import { dirname, join } from "node:path";
import ts, { SyntaxKind } from "typescript";
import { defineRule, hasModifier } from "../_utils/index.ts";

export const messages = {
  unusedDefaultExport:
    "This default export is never used. 'export default' can be removed.",
  unusedNamedExport:
    "This named export is never used. The export keyword can be removed.",
};

type ImportUsage = { named: string[]; default: boolean; star: boolean };
type Data = {
  path: string;
  imports: Record<string, ImportUsage>;
  exports: {
    named: { name: string; node: ts.Node }[];
    default: { node: ts.Node } | { start: number; end: number } | undefined;
  };
  usages: ImportUsage[];
};

export const unusedExport = defineRule(() => ({
  name: "core/unusedExport",
  createData: (context): Data => ({
    path: context.sourceFile.fileName,
    imports: {},
    exports: { named: [], default: undefined },
    usages: [],
  }),
  visitor: {
    SourceFile(context) {
      for (const el of context.sourceFile.statements) {
        switch (el.kind) {
          case SyntaxKind.ExportDeclaration:
            if (el.exportClause?.kind === SyntaxKind.NamedExports) {
              for (const e of el.exportClause.elements) {
                context.data.exports.named.push({
                  name: e.name.text,
                  node: e.name,
                });
              }
            }
            break;
          case SyntaxKind.ExportAssignment:
            context.data.exports.default = {
              start: el.getStart(),
              end: el.expression.getStart() - 1,
            };
            break;
          case SyntaxKind.VariableStatement:
            if (hasModifier(el, SyntaxKind.ExportKeyword)) {
              for (const v of el.declarationList.declarations) {
                if (v.name.kind !== SyntaxKind.Identifier) continue; // Should not be possible
                context.data.exports.named.push({
                  name: v.name.text,
                  node: v.name,
                });
              }
            }
            break;
          case SyntaxKind.FunctionDeclaration:
          case SyntaxKind.ClassDeclaration:
            if (hasModifier(el, SyntaxKind.ExportKeyword)) {
              const defaultModifier = el.modifiers?.find(
                (m) => m.kind === SyntaxKind.DefaultKeyword,
              );
              if (defaultModifier) {
                context.data.exports.default = { node: defaultModifier };
              } else {
                if (el.name) {
                  context.data.exports.named.push({
                    name: el.name.text,
                    node: el.name,
                  });
                }
              }
            }
            break;
          default:
            break;
        }
      }
    },
    ImportDeclaration(context, node) {
      if (node.moduleSpecifier.kind !== SyntaxKind.StringLiteral) return;
      const path = node.moduleSpecifier.text;
      if (!path.startsWith(".")) return;
      if (!path.endsWith(".ts") && !path.endsWith(".tsx")) return;
      if (!node.importClause) return;
      const fullPath = join(dirname(context.sourceFile.fileName), path);
      context.data.imports[fullPath] ??= {
        named: [],
        default: false,
        star: false,
      };
      if (node.importClause.name) {
        context.data.imports[fullPath].default = true;
      }
      if (node.importClause.namedBindings?.kind === SyntaxKind.NamedImports) {
        for (const el of node.importClause.namedBindings.elements) {
          context.data.imports[fullPath].named.push(el.name.text);
        }
      }
      if (
        node.importClause.namedBindings?.kind === SyntaxKind.NamespaceImport
      ) {
        context.data.imports[fullPath].star = true;
      }
    },
  },
  aggregate(context, files) {
    const map: Record<string, (typeof files)[number]["data"] | undefined> =
      Object.fromEntries(files.map((file) => [file.data.path, file.data]));
    for (const file of files) {
      for (const path in file.data.imports) {
        const data = map[path];
        if (data) data.usages.push(file.data.imports[path]);
      }
    }
    for (const file of files) {
      if (file.data.exports.default) {
        if (file.sourceFile.fileName.includes(".config.")) continue;
        if (!file.data.usages.some((u) => u.default)) {
          context.report({
            message: messages.unusedDefaultExport,
            sourceFile: file.sourceFile,
            ...file.data.exports.default,
          });
        }
      }
      for (const named of file.data.exports.named) {
        const used = file.data.usages.find(
          (u) => u.star || u.named.includes(named.name),
        );
        if (!used) {
          context.report({
            message: messages.unusedNamedExport,
            sourceFile: file.sourceFile,
            node: named.node,
          });
        }
      }
    }
  },
}));
