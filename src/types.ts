import type {
  Node,
  TupleTypeReference,
  Type,
  TypeChecker,
  TypeFlags,
  TypeReference,
} from "typescript";
import type { Expression, SourceFile, Visitor } from "./ast.ts";

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
  parseOptions?: (input: OptionsInput) => OptionsOutput;
  createData?: (context: Omit<Context<OptionsOutput>, "data">) => Data;
  visitor:
    | ((options: OptionsOutput) => Visitor<OptionsOutput, Data>)
    | Visitor<OptionsOutput, Data>;
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

export type Checker = Omit<TypeChecker, "isArrayType" | "isTupleType"> & {
  utils: CheckerUtils;
  /* Fix Expression _Brand check */
  getContextualType(node: Expression): Type | undefined;
  /* Improve narrowing, borrow from TS-ESLint */
  isArrayType(type: Type): type is TypeReference;
  isTupleType(type: Type): type is TupleTypeReference;
};
export type CheckerUtils = {
  isTypeFlagSet(type: Type, flag: TypeFlags): boolean;
  getTypeFlags(type: Type): TypeFlags;
  unionTypeParts(type: Type): Type[];
  isNullableType(type: Type, isReceiver?: boolean): boolean;
  isThenableType(node: Node, type: Type): boolean;
};

export type Context<OptionsOutput = undefined, Data = undefined> = {
  sourceFile: SourceFile;
  checker: Checker;
  report(node: Node, message: string): void;
  options: OptionsOutput;
  data: Data;
};
