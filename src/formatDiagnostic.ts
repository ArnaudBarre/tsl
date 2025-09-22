import { relative } from "node:path";
import ts, {
  flattenDiagnosticMessageText,
  getLineAndCharacterOfPosition,
  getPositionOfLineAndCharacter,
  type SourceFile,
} from "typescript";

export type TSLDiagnostic = {
  name: string;
  message: string;
  relatedInformation?: ts.DiagnosticRelatedInformation[];
} & ({ file: SourceFile; start: number; length: number } | { file: undefined });

// Adapted from: https://github.com/microsoft/TypeScript/blob/78c16795cdee70b9d9f0f248b6dbb6ba50994a59/src/compiler/program.ts#L680-L811

export function formatDiagnostics(diagnostics: TSLDiagnostic[]) {
  let output = "";

  for (const diagnostic of diagnostics) {
    if (diagnostic.file !== undefined) {
      output += formatLocation(diagnostic.file, diagnostic.start);
      output += " - ";
    }
    output += color(diagnostic.name, COLOR.Grey);
    output += ": ";
    output += diagnostic.message;
    if (diagnostic.file !== undefined) {
      output += "\n";
      output += formatCodeSpan(
        diagnostic.file,
        diagnostic.start,
        diagnostic.length,
        "",
        COLOR.Red,
      );
    }
    if (diagnostic.relatedInformation) {
      output += "\n";
      for (const {
        file,
        start,
        length,
        messageText,
      } of diagnostic.relatedInformation) {
        const indent = "  ";
        if (file) {
          output += "\n";
          output += " " + formatLocation(file, start!);
          output += formatCodeSpan(file, start!, length!, indent, COLOR.Cyan);
        }
        output += "\n";
        output += indent + flattenDiagnosticMessageText(messageText, "\n");
      }
    }
    output += "\n\n";
  }

  output += displaySummary(diagnostics);

  return output;
}

function displaySummary(diagnostics: TSLDiagnostic[]) {
  let output = "";
  const filesMap = new Map<
    ts.SourceFile,
    { count: number; firstLine: number }
  >();
  for (const d of diagnostics) {
    if (d.file !== undefined) {
      const file = filesMap.get(d.file);
      if (file === undefined) {
        const { line: firstLine } = d.file.getLineAndCharacterOfPosition(
          d.start,
        );
        filesMap.set(d.file, { count: 1, firstLine });
      } else {
        file.count++;
      }
    }
  }

  if (filesMap.size > 0) {
    const pluralize = (count: number, name: string) =>
      count === 1 ? `${count} ${name}` : `${count} ${name}s`;
    output += `\nFound ${pluralize(diagnostics.length, "error")} in ${pluralize(
      filesMap.size,
      "file",
    )}`;
  }
  if (filesMap.size > 1) {
    output += "\n\nErrors  Files";
    for (const [file, { count, firstLine }] of filesMap) {
      output += `\n${count.toString().padStart(6)}  ${displayFilename(file.fileName)}:${color(firstLine.toString(), COLOR.Grey)}`;
    }
  }
  return output;
}

function color(text: string, formatStyle: string) {
  return formatStyle + text + resetEscapeSequence;
}

const gutterStyleSequence = "\u001b[7m";
const ellipsis = "...";
const gutterSeparator = " ";
const resetEscapeSequence = "\u001b[0m";
const COLOR = {
  Grey: "\u001b[90m",
  Red: "\u001b[91m",
  Yellow: "\u001b[93m",
  Blue: "\u001b[94m",
  Cyan: "\u001b[96m",
};

function formatCodeSpan(
  file: SourceFile,
  start: number,
  length: number,
  indent: string,
  squiggleColor: string,
) {
  const { line: firstLine, character: firstLineChar } =
    getLineAndCharacterOfPosition(file, start);
  const { line: lastLine, character: lastLineChar } =
    getLineAndCharacterOfPosition(file, start + length);
  const lastLineInFile = getLineAndCharacterOfPosition(
    file,
    file.text.length,
  ).line;
  const hasMoreThanFiveLines = lastLine - firstLine >= 4;
  let gutterWidth = (lastLine + 1 + "").length;
  if (hasMoreThanFiveLines) {
    gutterWidth = Math.max(ellipsis.length, gutterWidth);
  }
  let context = "";
  for (let i = firstLine; i <= lastLine; i++) {
    context += "\n";
    if (hasMoreThanFiveLines && firstLine + 1 < i && i < lastLine - 1) {
      context +=
        indent
        + color(ellipsis.padStart(gutterWidth), gutterStyleSequence)
        + gutterSeparator
        + "\n";
      i = lastLine - 1;
    }
    const lineStart = getPositionOfLineAndCharacter(file, i, 0);
    const lineEnd =
      i < lastLineInFile
        ? getPositionOfLineAndCharacter(file, i + 1, 0)
        : file.text.length;
    let lineContent = file.text.slice(lineStart, lineEnd);
    lineContent = lineContent.trimEnd();
    lineContent = lineContent.replace(/\t/g, " ");
    context +=
      indent
      + color((i + 1 + "").padStart(gutterWidth), gutterStyleSequence)
      + gutterSeparator;
    context += lineContent + "\n";
    context +=
      indent
      + color("".padStart(gutterWidth), gutterStyleSequence)
      + gutterSeparator;
    context += squiggleColor;
    if (i === firstLine) {
      const lastCharForLine = i === lastLine ? lastLineChar : void 0;
      context += lineContent.slice(0, firstLineChar).replace(/\S/g, " ");
      context += lineContent
        .slice(firstLineChar, lastCharForLine)
        .replace(/./g, "~");
    } else if (i === lastLine) {
      context += lineContent.slice(0, lastLineChar).replace(/./g, "~");
    } else {
      context += lineContent.replace(/./g, "~");
    }
    context += resetEscapeSequence;
  }
  return context;
}

export function formatLocation(file: SourceFile, start: number): string {
  const { line, character } = getLineAndCharacterOfPosition(file, start);
  const relativeFileName = displayFilename(file.fileName);
  let output = "";
  output += color(relativeFileName, COLOR.Cyan);
  output += ":";
  output += color(`${line + 1}`, COLOR.Yellow);
  output += ":";
  output += color(`${character + 1}`, COLOR.Yellow);
  return output;
}

export function displayFilename(name: string) {
  if (name.startsWith("./")) return name.slice(2);
  return relative(process.cwd(), name);
}
