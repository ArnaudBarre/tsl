import type {
  CompilerOptions,
  Node,
  Program,
  Signature,
  SymbolFlags,
  TupleTypeReference,
  Type,
  TypeChecker,
  TypeFlags,
  TypeReference,
} from "typescript";
import type ts from "typescript";
import type * as AST from "./ast.ts";
export type { AST };

export type Config = {
  /**
   * List of base rules. You can spread `core.all()` as an initial list and then update it based on your needs:
   *
   * @example
   * ```ts
   * import { core, defineConfig } from "tsl";
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
  rules: Rule<any>[];
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
   * To differentiate tsl reports from TS errors, tsl diagnostics are reported by default as warnings.
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
     * You can turn off a rule for these files by passing `"off"` as the rule option.
     */
    rules: Rule<any>[];
  }[];
};

export type Rule<Data = undefined> = {
  /**
   * Should be in the format of `{namespace}/{ruleName}`.
   * @example "myOrg/customRule"
   */
  name: `${string}/${string}`;
  /**
   * Create mutable data scoped to the sourceFile being linted.
   * Can be used to pass information between visited nodes.
   */
  createData?: (context: Omit<Context, "data">) => Data;
  /**
   * Object of visitor functions that will be called for each node in the sourceFile.
   * @example
   * ```ts
   * visitor: {
   *    BinaryExpression(context, node) {
   *      // ...
   *    },
   * }
   * ```
   */
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
  getContextualType(node: AST.Expression | ts.Expression): Type | undefined;
  getTypeFromTypeNode(node: AST.TypeNode | ts.TypeNode): Type;
  getResolvedSignature(
    node:
      | AST.CallExpression
      | AST.NewExpression
      | AST.TaggedTemplateExpression
      | AST.Decorator
      | AST.JsxSelfClosingElement
      | AST.JsxOpeningElement
      | ts.CallLikeExpression,
  ): Signature | undefined;
  /** Improve narrowing, borrow from typescript-eslint */
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
  /**
   * TypeScript checker, with some types overrides
   * Can be used to get the type of a node
   * @example
   * ```ts
   * const type = context.checker.getTypeAtLocation(node);
   * ```
   */
  checker: Checker;
  /**
   * @deprecated, use checker
   */
  rawChecker: TypeChecker;
  compilerOptions: CompilerOptions;
  utils: {
    /**
     * Check if the given type has the given flag.
     */
    typeHasFlag: (type: Type, flag: TypeFlags) => boolean;
    /**
     * Check if the given type or one of its union type parts has the given flag.
     */
    typeOrUnionHasFlag: (type: Type, flag: TypeFlags) => boolean;
    /**
     * Check if the given type has the given symbol flag.
     */
    typeHasSymbolFlag: (type: Type, flag: SymbolFlags) => boolean;
    /**
     * Resolves the given node's type. Will return the type's generic constraint, if it has one.
     *
     * Warning - if the type is generic and does _not_ have a constraint, the type will be
     * returned as-is, rather than returning an `unknown` type. This can be checked for by
     * checking for the type flag `TypeFlags.TypeParameter`.
     */
    getConstrainedTypeAtLocation(node: Node): Type;
    /**
     * Get the union type parts of the given type.
     * If the given type is not a union type, an array contain only that type will be returned.
     * @example
     * ```ts
     * declare const type: ts.Type;
     *
     * for (const constituent of unionConstituents(type)) {
     *   // ...
     * }
     * ```
     */
    unionConstituents: (type: Type) => Type[];
    /**
     * Get the intersection type parts of the given type.
     * If the given type is not a intersection type, an array contain only that type will be returned.
     * @example
     * ```ts
     * declare const type: ts.Type;
     *
     * for (const constituent of intersectionConstituents(type)) {
     *   // ...
     * }
     * ```
     */
    intersectionConstituents: (type: Type) => Type[];
  };
  /**
   * Report a diagnostic
   * @example
   * ```ts
   * context.report({ node: node.expression, message: "Don't do foo, do bar instead." });
   * ```
   */
  report(descriptor: ReportDescriptor): void;
  /**
   * Access mutable data initialized by the rule's createData function.
   * Scoped to the sourceFile being linted.
   * Can be used to pass information between visited nodes.
   */
  data: Data;
};
