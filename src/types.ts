import type {
  CompilerOptions,
  Node,
  Program,
  Signature,
  TupleTypeReference,
  Type,
  TypeChecker,
  TypeReference,
} from "typescript";
import type * as AST from "./ast.ts";
export type { AST };

export type Config = {
  /**
   * List of base rules. You can use core.all() as an initial list and then update it based on your needs:
   *
   * @example
   * ```ts
   * import { core, defineConfig } from "@arnaud-barre/type-lint";
   *
   * defineConfig({
   *   rules: [
   *     ...core.all(),
   *     core.noUnnecessaryBooleanLiteralCompare("off"),
   *     {
   *       name: "org/my-custom-rule",
   *       visitor: {
   *         // ...
   *       },
   *     },
   *   ],
   * });
   * ```
   */
  rules: Rule<unknown>[];
  /**
   * List of path parts to ignore (using string.includes)
   *
   * @example
   * ```ts
   * defineConfig({
   *   ignore: ["src/generated/"],
   * });
   * ```
   */
  ignore?: string[];
  /**
   * To differentiate type-lint reports from TS errors, type-lint diagnostics are reported by default as warnings.
   * If you prefer having only red squiggles, you can set this option to `"error"`.
   * @default "warning"
   */
  diagnosticCategory?: "warning" | "error";
  overrides?: {
    /**
     * List of path parts to override (using string.includes)
     */
    files: string[];
    /**
     * Additional rules to add for these files.
     * Redeclared rules (identical name) completely replace the base rules, there is no merging of options.
     */
    rules: Rule<unknown>[];
  }[];
};

export type Rule<Data = undefined> = {
  name: string;
  createData?: (context: Omit<Context, "data">) => Data;
  visitor: AST.Visitor<Data>;
};

export type Checker = Omit<
  TypeChecker,
  | "getContextualType"
  | "getTypeFromTypeNode"
  | "getResolvedSignature"
  | "isArrayType"
  | "isTupleType"
> & {
  /** Fix Expression _Brand check */
  getContextualType(node: AST.Expression): Type | undefined;
  getTypeFromTypeNode(node: AST.TypeNode): Type;
  getResolvedSignature(
    node:
      | AST.CallExpression
      | AST.NewExpression
      | AST.TaggedTemplateExpression
      | AST.Decorator
      | AST.JsxSelfClosingElement
      | AST.JsxOpeningElement,
  ): Signature | undefined;
  /** Improve narrowing, borrow from TS-ESLint */
  isArrayType(type: Type): type is TypeReference;
  isTupleType(type: Type): type is TupleTypeReference;
  /**
   * TS internal api
   * Return the type of the given property in the given type, or undefined if no such property exists
   */
  getTypeOfPropertyOfType(type: Type, propertyName: string): Type | undefined;
  /**
   * TS internal api
   */
  getContextualTypeForArgumentAtIndex(node: Node, argIndex: number): Type;
};

type Change =
  | { start: number; length: number; newText: string }
  | { start: number; end: number; newText: string }
  | { node: Node; newText: string };

export type Suggestion = { message: string; changes: Change[] };

export type ReportDescriptor = (
  | { node: Node }
  | { start: number; end: number }
) & {
  message: string;
  suggestions?: Suggestion[] | (() => Suggestion[]);
};
export type Context<Data = unknown> = {
  sourceFile: AST.SourceFile;
  program: Program;
  checker: Checker;
  rawChecker: TypeChecker;
  compilerOptions: CompilerOptions;
  utils: {
    isThenableType(node: Node, type: Type): boolean;
    getConstrainedTypeAtLocation(node: Node): Type;
  };
  report(descriptor: ReportDescriptor): void;
  data: Data;
};
