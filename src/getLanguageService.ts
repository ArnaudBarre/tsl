import fs from "node:fs";
import ts from "typescript";

export const getLanguageService = (
  program: ts.Program,
  overridesForTesting?: {
    readFile: (path: string) => string | undefined;
    fileExists: (path: string) => boolean;
    directoryExists: (path: string) => boolean;
  },
) => {
  const languageServiceHost: ts.LanguageServiceHost = {
    getCompilationSettings: () => program.getCompilerOptions(),
    getScriptFileNames: () => program.getSourceFiles().map((f) => f.fileName),
    getScriptVersion: () => "",
    getScriptSnapshot: (fileName) => {
      const sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) return undefined;
      return ts.ScriptSnapshot.fromString(sourceFile.text);
    },
    getCurrentDirectory: () => process.cwd(),
    getDefaultLibFileName: ts.getDefaultLibFileName,
    readFile: (path, encoding) =>
      overridesForTesting?.readFile(path)
      ?? fs.readFileSync(path, encoding as BufferEncoding),
    fileExists: overridesForTesting?.fileExists ?? fs.existsSync,
    directoryExists: overridesForTesting?.directoryExists,
  };
  return ts.createLanguageService(languageServiceHost);
};
