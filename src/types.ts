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

export type Config<Rules extends AnyRule[]> = {
  rules: Rules;
  ignore?: string[];
  options?: {
    [Rule in Rules[number] as Rule["name"]]?: Rule["parseOptions"] extends
      | ((input: any) => any)
      | undefined
      ? Parameters<NonNullable<Rule["parseOptions"]>>[0] | "off"
      : "off";
  };
};

export type AnyRule = Rule<string, any, any, any>;
export type UnknownRule = Rule<string, unknown, unknown, unknown>;
export type Rule<
  Name extends string = string,
  OptionsInput = undefined,
  OptionsOutput = undefined,
  Data = undefined,
> = {
  name: Name;
  parseOptions?: (input?: OptionsInput) => OptionsOutput;
  createData?: (context: Omit<Context<OptionsOutput>, "data">) => Data;
  visitor:
    | ((options: OptionsOutput) => AST.Visitor<OptionsOutput, Data>)
    | AST.Visitor<OptionsOutput, Data>;
};

export type Infer<TRule> = TRule extends Rule<
  string,
  infer OptionsInput,
  infer OptionsOutput,
  infer Data
>
  ? {
      OptionsInput: OptionsInput;
      OptionsOutput: OptionsOutput;
      Data: Data;
      Context: Context<OptionsOutput, Data>;
    }
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
};

export type Suggestion = {
  message: string;
  changes: (
    | { start: number; length: number; newText: string }
    | { start: number; end: number; newText: string }
    | { node: Node; newText: string }
  )[];
};
export type ReportDescriptor = {
  node: Node;
  message: string;
  suggestions?: Suggestion[] | (() => Suggestion[]);
};
export type Context<OptionsOutput = undefined, Data = undefined> = {
  sourceFile: AST.SourceFile;
  program: Program;
  checker: Checker;
  rawChecker: TypeChecker;
  compilerOptions: CompilerOptions;
  utils: ContextUtils;
  report(descriptor: ReportDescriptor): void;
  options: OptionsOutput;
  data: Data;
};
