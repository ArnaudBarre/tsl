import { isTypeParameter } from "ts-api-utils";
import ts from "typescript";

export function isBuiltinSymbolLike(
  program: ts.Program,
  type: ts.Type,
  symbolName: string | string[],
): boolean {
  return isBuiltinSymbolLikeRecurser(program, type, (subType) => {
    const symbol = subType.getSymbol();
    if (!symbol) {
      return false;
    }

    const actualSymbolName = symbol.getName();

    if (
      (Array.isArray(symbolName)
        ? symbolName.some((name) => actualSymbolName === name)
        : actualSymbolName === symbolName)
      && isSymbolFromDefaultLibrary(program, symbol)
    ) {
      return true;
    }

    return null;
  });
}

function isBuiltinSymbolLikeRecurser(
  program: ts.Program,
  type: ts.Type,
  predicate: (subType: ts.Type) => boolean | null,
): boolean {
  if (type.isIntersection()) {
    return type.types.some((t) =>
      isBuiltinSymbolLikeRecurser(program, t, predicate),
    );
  }
  if (type.isUnion()) {
    return type.types.every((t) =>
      isBuiltinSymbolLikeRecurser(program, t, predicate),
    );
  }
  if (isTypeParameter(type)) {
    const t = type.getConstraint();

    if (t) {
      return isBuiltinSymbolLikeRecurser(program, t, predicate);
    }

    return false;
  }

  const predicateResult = predicate(type);
  if (typeof predicateResult === "boolean") {
    return predicateResult;
  }

  const symbol = type.getSymbol();
  if (
    symbol
    && symbol.flags & (ts.SymbolFlags.Class | ts.SymbolFlags.Interface)
  ) {
    const checker = program.getTypeChecker();
    for (const baseType of checker.getBaseTypes(type as ts.InterfaceType)) {
      if (isBuiltinSymbolLikeRecurser(program, baseType, predicate)) {
        return true;
      }
    }
  }
  return false;
}

function isSymbolFromDefaultLibrary(
  program: ts.Program,
  symbol: ts.Symbol | undefined,
): boolean {
  if (!symbol) {
    return false;
  }

  const declarations = symbol.getDeclarations() ?? [];
  for (const declaration of declarations) {
    const sourceFile = declaration.getSourceFile();
    if (program.isSourceFileDefaultLibrary(sourceFile)) {
      return true;
    }
  }

  return false;
}
