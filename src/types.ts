import type {
  CompilerOptions,
  Node,
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
  "getContextualType" | "isArrayType" | "isTupleType"
> & {
  /* Fix Expression _Brand check */
  getContextualType(node: AST.Expression): Type | undefined;
  /* Improve narrowing, borrow from TS-ESLint */
  isArrayType(type: Type): type is TypeReference;
  isTupleType(type: Type): type is TupleTypeReference;
};

export type ReportDescriptor = { node: Node; message: string };
export type Context<OptionsOutput = undefined, Data = undefined> = {
  sourceFile: AST.SourceFile;
  checker: Checker;
  compilerOptions: CompilerOptions;
  utils: ContextUtils;
  report(descriptor: ReportDescriptor): void;
  options: OptionsOutput;
  data: Data;
};
