import { type Node, SyntaxKind } from "typescript";
import { defineRule } from "../_utils/index.ts";
import type { AST, Context } from "../../types.ts";

export const messages = {
  unusedExport: "This export is never used.",
};

export const unusedExport = defineRule(() => ({
  name: "core/unusedExport",
  visitor: {
    SourceFile(context) {
      for (const el of context.sourceFile.statements) {
        switch (el.kind) {
          case SyntaxKind.ExportDeclaration:
            if (el.exportClause?.kind === SyntaxKind.NamedExports) {
              for (const e of el.exportClause.elements) {
                checkExportedNode(
                  context,
                  e.name,
                  el.exportClause.elements.length > 1 ? e.name : el,
                );
              }
            }
            break;
          case SyntaxKind.ExportAssignment:
            // export default foo;
            checkExportedNode(context, el, el);
            break;
          case SyntaxKind.VariableStatement: {
            const exportKeyword = el.modifiers?.find(
              (m) => m.kind === SyntaxKind.ExportKeyword,
            );
            if (!exportKeyword) continue;
            for (const v of el.declarationList.declarations) {
              if (v.name.kind !== SyntaxKind.Identifier) continue; // Should not be possible
              checkExportedNode(
                context,
                v.name,
                el.declarationList.declarations.length > 1
                  ? v.name
                  : exportKeyword,
              );
            }
            break;
          }
          case SyntaxKind.ClassDeclaration:
          case SyntaxKind.FunctionDeclaration: {
            const exportKeyword = el.modifiers?.find(
              (m) => m.kind === SyntaxKind.ExportKeyword,
            );
            if (!exportKeyword) continue;
            checkExportedNode(context, el, exportKeyword);
            break;
          }
          default:
            break;
        }
      }
    },
  },
}));

function checkExportedNode(
  context: Context,
  node: AST.AnyNode,
  reportNode: Node,
) {
  const references = context.languageService.findReferences(
    context.sourceFile.fileName,
    node.getStart(),
  );
  if (!references) return; // possible?
  const hasOutsideReferences = references.some((ref) =>
    ref.references.some((r) => r.fileName !== context.sourceFile.fileName),
  );
  if (!hasOutsideReferences) {
    context.report({ node: reportNode, message: messages.unusedExport });
  }
}
