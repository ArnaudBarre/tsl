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
import type { ContextUtils } from "./getContextUtils.ts";
export type { AST };

export type Config<BaseRuleName extends string> = {
  rules: (Rule<BaseRuleName, any> | Promise<Rule<BaseRuleName, any>[]>)[];
  ignore?: string[];
  overrides?: {
    files: string[];
    disabled?: NoInfer<BaseRuleName>[];
    rules?: AnyRule[];
  }[];
};

export type AnyRule = Rule<string, any>;
export type UnknownRule = Rule<string, unknown>;
export type Rule<Name extends string = string, Data = undefined> = {
  name: Name;
  createData?: (context: Omit<Context, "data">) => Data;
  visitor: AST.Visitor<Data>;
};

export type Infer<CreateData extends (context: Omit<Context, "data">) => any> =
  CreateData extends (context: Omit<Context, "data">) => infer Data
    ? { Data: Data; Context: Context<Data>; Visitor: AST.Visitor<Data> }
    : never;

export type Checker = Omit<
  TypeChecker,
  | "getContextualType"
  | "getTypeFromTypeNode"
  | "getResolvedSignature"
  | "isArrayType"
  | "isTupleType"
> & {
  /* Fix Expression _Brand check */
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
  /* Improve narrowing, borrow from TS-ESLint */
  isArrayType(type: Type): type is TypeReference;
  isTupleType(type: Type): type is TupleTypeReference;
  /**
   * See https://github.com/microsoft/TypeScript/pull/56448
   *
   * Returns true if the "source" type is assignable to the "target" type.
   *
   * ```ts
   * declare const abcLiteral: ts.Type; // Type of "abc"
   * declare const stringType: ts.Type; // Type of string
   *
   * isTypeAssignableTo(abcLiteral, abcLiteral); // true; "abc" is assignable to "abc"
   * isTypeAssignableTo(abcLiteral, stringType); // true; "abc" is assignable to string
   * isTypeAssignableTo(stringType, abcLiteral); // false; string is not assignable to "abc"
   * isTypeAssignableTo(stringType, stringType); // true; string is assignable to string
   * ```
   */
  isTypeAssignableTo(source: Type, target: Type): boolean;
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
export type Context<Data = undefined> = {
  sourceFile: AST.SourceFile;
  program: Program;
  checker: Checker;
  rawChecker: TypeChecker;
  compilerOptions: CompilerOptions;
  utils: ContextUtils;
  report(descriptor: ReportDescriptor): void;
  data: Data;
};
