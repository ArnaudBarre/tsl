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

export type Config<BaseRuleName extends string> = {
  rules: (Rule<BaseRuleName, any> | Promise<Rule<BaseRuleName, any>[]>)[];
  ignore?: string[];
  overrides?: {
    files: string[];
    disabled?: NoInfer<BaseRuleName>[];
    rules?: Rule<string, any>[];
  }[];
};

export type Rule<Name extends string = string, Data = undefined> = {
  name: Name;
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
export type Context<Data = undefined> = {
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

export type AllRulesPreset<
  Key extends string,
  Props extends Partial<Record<Key, "off" | "on" | Record<string, unknown>>>,
> = <UsedProps extends Props>(
  rules: UsedProps,
) => Promise<
  Rule<
    {
      [K in keyof UsedProps]: K extends Key
        ? UsedProps[K] extends "off"
          ? never
          : K
        : never;
    }[keyof UsedProps],
    any
  >[]
>;
