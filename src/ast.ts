/* Generated */
/* tsl-ignore core/noRedundantTypeConstituents */
import type {
  __String,
  AmdDependency,
  FileReference,
  LanguageVariant,
  LineAndCharacter,
  Node,
  NodeArray,
  ResolutionMode,
  ScriptTarget,
  SyntaxKind,
  TextChangeRange,
  Type,
} from "typescript";
import type { Context } from "./types.ts";

export interface SourceFile extends Node {
  readonly kind: SyntaxKind.SourceFile;

  readonly statements: NodeArray<Statement>;
  readonly endOfFileToken: Token<SyntaxKind.EndOfFileToken, SourceFile>;
  fileName: string;
  text: string;
  amdDependencies: readonly AmdDependency[];
  moduleName?: string;
  referencedFiles: readonly FileReference[];
  typeReferenceDirectives: readonly FileReference[];
  libReferenceDirectives: readonly FileReference[];
  languageVariant: LanguageVariant;
  isDeclarationFile: boolean;
  /**
   * lib.d.ts should have a reference comment like
   *
   *  /// <reference no-default-lib="true"/>
   *
   * If any other file has this comment, it signals not to include lib.d.ts
   * because this containing file is intended to act as a default library.
   */
  hasNoDefaultLib: boolean;
  languageVersion: ScriptTarget;
  /**
   * When `module` is `Node16` or `NodeNext`, this field controls whether the
   * source file in question is an ESNext-output-format file, or a CommonJS-output-format
   * module. This is derived by the module resolver as it looks up the file, since
   * it is derived from either the file extension of the module, or the containing
   * `package.json` context, and affects both checking and emit.
   *
   * It is _public_ so that (pre)transformers can set this field,
   * since it switches the builtin `node` module transform. Generally speaking, if unset,
   * the field is treated as though it is `ModuleKind.CommonJS`.
   *
   * Note that this field is only set by the module resolution process when
   * `moduleResolution` is `Node16` or `NodeNext`, which is implied by the `module` setting
   * of `Node16` or `NodeNext`, respectively, but may be overriden (eg, by a `moduleResolution`
   * of `node`). If so, this field will be unset and source files will be considered to be
   * CommonJS-output-format by the node module transformer and type checker, regardless of extension or context.
   */
  impliedNodeFormat?: ResolutionMode;
  getLineAndCharacterOfPosition(pos: number): LineAndCharacter;
  getLineEndOfPosition(pos: number): number;
  getLineStarts(): readonly number[];
  getPositionOfLineAndCharacter(line: number, character: number): number;
  update(newText: string, textChangeRange: TextChangeRange): SourceFile;
  readonly parent: Node;
  _declarationBrand: any;
  _localsContainerBrand: any;
}
export type Statement =
  | DeclarationStatement
  | NotEmittedStatement
  | EmptyStatement
  | DebuggerStatement
  | Block
  | VariableStatement
  | ExpressionStatement
  | IfStatement
  | IterationStatement
  | BreakStatement
  | ContinueStatement
  | ReturnStatement
  | WithStatement
  | SwitchStatement
  | LabeledStatement
  | ThrowStatement
  | TryStatement
  | ModuleBlock
  | ImportDeclaration;
export type DeclarationStatement =
  | FunctionDeclaration
  | MissingDeclaration
  | ClassDeclaration
  | InterfaceDeclaration
  | TypeAliasDeclaration
  | EnumDeclaration
  | ModuleDeclaration
  | ImportEqualsDeclaration
  | NamespaceExportDeclaration
  | ExportDeclaration
  | ExportAssignment;
export interface FunctionDeclaration extends Node {
  readonly kind: SyntaxKind.FunctionDeclaration;

  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name?: Identifier;
  readonly body?: FunctionBody;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  readonly parent: Node;
  _functionLikeDeclarationBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _statementBrand: any;
  _localsContainerBrand: any;
}
export type ModifierLike = Modifier | Decorator;
export type Modifier =
  | AbstractKeyword
  | AccessorKeyword
  | AsyncKeyword
  | ConstKeyword
  | DeclareKeyword
  | DefaultKeyword
  | ExportKeyword
  | InKeyword
  | PrivateKeyword
  | ProtectedKeyword
  | PublicKeyword
  | OutKeyword
  | OverrideKeyword
  | ReadonlyKeyword
  | StaticKeyword;
export interface AbstractKeyword extends Node {
  readonly kind: SyntaxKind.AbstractKeyword;
  readonly parent: Node;
}
export interface AccessorKeyword extends Node {
  readonly kind: SyntaxKind.AccessorKeyword;
  readonly parent: Node;
}
export interface AsyncKeyword extends Node {
  readonly kind: SyntaxKind.AsyncKeyword;
  readonly parent: Node;
}
export interface ConstKeyword extends Node {
  readonly kind: SyntaxKind.ConstKeyword;
  readonly parent: Node;
}
export interface DeclareKeyword extends Node {
  readonly kind: SyntaxKind.DeclareKeyword;
  readonly parent: Node;
}
export interface DefaultKeyword extends Node {
  readonly kind: SyntaxKind.DefaultKeyword;
  readonly parent: Node;
}
export interface ExportKeyword extends Node {
  readonly kind: SyntaxKind.ExportKeyword;
  readonly parent: Node;
}
export interface InKeyword extends Node {
  readonly kind: SyntaxKind.InKeyword;
  readonly parent: Node;
}
export interface PrivateKeyword extends Node {
  readonly kind: SyntaxKind.PrivateKeyword;
  readonly parent: Node;
}
export interface ProtectedKeyword extends Node {
  readonly kind: SyntaxKind.ProtectedKeyword;
  readonly parent: Node;
}
export interface PublicKeyword extends Node {
  readonly kind: SyntaxKind.PublicKeyword;
  readonly parent: Node;
}
export interface OutKeyword extends Node {
  readonly kind: SyntaxKind.OutKeyword;
  readonly parent: Node;
}
export interface OverrideKeyword extends Node {
  readonly kind: SyntaxKind.OverrideKeyword;
  readonly parent: Node;
}
export interface ReadonlyKeyword extends Node {
  readonly kind: SyntaxKind.ReadonlyKeyword;
  readonly parent: Node;
}
export interface StaticKeyword extends Node {
  readonly kind: SyntaxKind.StaticKeyword;
  readonly parent: Node;
}
export interface Decorator extends Node {
  readonly kind: SyntaxKind.Decorator;

  readonly parent: NamedDeclaration;
  readonly expression: LeftHandSideExpression;
}
export type NamedDeclaration =
  | DeclarationStatement
  | TypeParameterDeclaration
  | SignatureDeclarationBase
  | VariableDeclaration
  | ParameterDeclaration
  | BindingElement
  | ObjectLiteralElement
  | PropertyAccessExpression
  | ClassLikeDeclarationBase
  | ClassElement
  | TypeElement
  | EnumMember
  | ImportClause
  | NamespaceImport
  | NamespaceExport
  | ImportSpecifier
  | ExportSpecifier
  | JSDocTypedefTag
  | JSDocCallbackTag;
export interface TypeParameterDeclaration extends Node {
  readonly kind: SyntaxKind.TypeParameter;

  readonly parent: DeclarationWithTypeParameterChildren | InferTypeNode;
  readonly modifiers?: NodeArray<Modifier>;
  readonly name: Identifier;
  /** Note: Consider calling `getEffectiveConstraintOfTypeParameter` */
  readonly constraint?: TypeNode;
  readonly default?: TypeNode;
  expression?: Expression;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
}
export type DeclarationWithTypeParameterChildren =
  | SignatureDeclaration
  | ClassLikeDeclaration
  | InterfaceDeclaration
  | TypeAliasDeclaration
  | JSDocTemplateTag;
export type SignatureDeclaration =
  | CallSignatureDeclaration
  | ConstructSignatureDeclaration
  | MethodSignature
  | IndexSignatureDeclaration
  | FunctionTypeNode
  | ConstructorTypeNode
  | JSDocFunctionType
  | FunctionDeclaration
  | MethodDeclaration
  | ConstructorDeclaration
  | AccessorDeclaration
  | FunctionExpression
  | ArrowFunction;
export interface CallSignatureDeclaration extends Node {
  readonly kind: SyntaxKind.CallSignature;

  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  readonly parent: Node;
  readonly questionToken?: QuestionToken | undefined;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _typeElementBrand: any;
  _localsContainerBrand: any;
}
export type PropertyName =
  | Identifier
  | StringLiteral
  | NoSubstitutionTemplateLiteral
  | NumericLiteral
  | ComputedPropertyName
  | PrivateIdentifier
  | BigIntLiteral;
export interface Identifier extends Node {
  readonly kind: SyntaxKind.Identifier;

  /**
   * Prefer to use `id.unescapedText`. (Note: This is available only in services, not internally to the TypeScript compiler.)
   * Text of identifier, but if the identifier begins with two underscores, this will begin with three.
   */
  readonly escapedText: __String;
  readonly text: string;
  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export interface StringLiteral extends Node {
  readonly kind: SyntaxKind.StringLiteral;

  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
  readonly parent: Node;
  _literalExpressionBrand: any;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _declarationBrand: any;
}
export interface NoSubstitutionTemplateLiteral extends Node {
  readonly kind: SyntaxKind.NoSubstitutionTemplateLiteral;

  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
  readonly parent: Node;
  rawText?: string;
  _literalExpressionBrand: any;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _declarationBrand: any;
}
export interface NumericLiteral extends Node {
  readonly kind: SyntaxKind.NumericLiteral;

  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
  readonly parent: Node;
  _literalExpressionBrand: any;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _declarationBrand: any;
}
export interface ComputedPropertyName extends Node {
  readonly kind: SyntaxKind.ComputedPropertyName;

  readonly parent: Declaration;
  readonly expression: Expression;
}
export type Declaration =
  | Identifier
  | NamedDeclaration
  | TypeLiteralNode
  | NamedTupleMember
  | MappedTypeNode
  | StringLiteral
  | BinaryExpression
  | NoSubstitutionTemplateLiteral
  | NumericLiteral
  | ObjectLiteralExpressionBase
  | ElementAccessExpression
  | CallExpression
  | NewExpression
  | JsxAttributes
  | JsxAttribute
  | JSDocEnumTag
  | JSDocSignature
  | JSDocPropertyLikeTag
  | JSDocTypeLiteral
  | SourceFile;
export interface TypeLiteralNode extends Node {
  readonly kind: SyntaxKind.TypeLiteral;

  readonly members: NodeArray<TypeElement>;
  readonly parent: Node;
  _typeNodeBrand: any;
  _declarationBrand: any;
}
export type TypeElement =
  | CallSignatureDeclaration
  | ConstructSignatureDeclaration
  | PropertySignature
  | MethodSignature
  | GetAccessorDeclaration
  | SetAccessorDeclaration
  | IndexSignatureDeclaration
  | NotEmittedTypeElement;
export interface ConstructSignatureDeclaration extends Node {
  readonly kind: SyntaxKind.ConstructSignature;

  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  readonly parent: Node;
  readonly questionToken?: QuestionToken | undefined;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _typeElementBrand: any;
  _localsContainerBrand: any;
}
export interface ParameterDeclaration extends Node {
  readonly kind: SyntaxKind.Parameter;

  readonly parent: SignatureDeclaration;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly dotDotDotToken?: DotDotDotToken;
  readonly name: BindingName;
  readonly questionToken?: QuestionToken;
  readonly type?: TypeNode;
  readonly initializer?: Expression;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
}
export interface DotDotDotToken extends Node {
  readonly kind: SyntaxKind.DotDotDotToken;
  readonly parent: Node;
}
export type BindingName = Identifier | BindingPattern;
export type BindingPattern = ObjectBindingPattern | ArrayBindingPattern;
export interface ObjectBindingPattern extends Node {
  readonly kind: SyntaxKind.ObjectBindingPattern;

  readonly parent: VariableDeclaration | ParameterDeclaration | BindingElement;
  readonly elements: NodeArray<BindingElement>;
}
export interface VariableDeclaration extends Node {
  readonly kind: SyntaxKind.VariableDeclaration;

  readonly parent: VariableDeclarationList | CatchClause;
  readonly name: BindingName;
  readonly exclamationToken?: ExclamationToken;
  readonly type?: TypeNode;
  readonly initializer?: Expression;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
}
export interface VariableDeclarationList extends Node {
  readonly kind: SyntaxKind.VariableDeclarationList;

  readonly parent: VariableStatement | ForStatement | ForOfStatement | ForInStatement;
  readonly declarations: NodeArray<VariableDeclaration>;
}
export interface VariableStatement extends Node {
  readonly kind: SyntaxKind.VariableStatement;

  readonly modifiers?: NodeArray<ModifierLike>;
  readonly declarationList: VariableDeclarationList;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export interface ForStatement extends Node {
  readonly kind: SyntaxKind.ForStatement;

  readonly initializer?: ForInitializer;
  readonly condition?: Expression;
  readonly incrementor?: Expression;
  readonly statement: Statement;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _localsContainerBrand: any;
  _flowContainerBrand: any;
}
export type ForInitializer = VariableDeclarationList | Expression;
export type Expression =
  | OmittedExpression
  | UnaryExpression
  | YieldExpression
  | SyntheticExpression
  | BinaryExpression
  | ConditionalExpression
  | ArrowFunction
  | SpreadElement
  | AsExpression
  | SatisfiesExpression
  | JsxOpeningElement
  | JsxOpeningFragment
  | JsxClosingFragment
  | JsxExpression
  | CommaListExpression;
export interface OmittedExpression extends Node {
  readonly kind: SyntaxKind.OmittedExpression;

  readonly parent: Node;
  _expressionBrand: any;
}
export type UnaryExpression =
  | UpdateExpression
  | DeleteExpression
  | TypeOfExpression
  | VoidExpression
  | AwaitExpression
  | TypeAssertion;
export type UpdateExpression = PrefixUnaryExpression | PostfixUnaryExpression | LeftHandSideExpression;
export interface PrefixUnaryExpression extends Node {
  readonly kind: SyntaxKind.PrefixUnaryExpression;

  readonly operator: PrefixUnaryOperator;
  readonly operand: UnaryExpression;
  readonly parent: Node;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export type PrefixUnaryOperator =
  | SyntaxKind.PlusPlusToken
  | SyntaxKind.MinusMinusToken
  | SyntaxKind.PlusToken
  | SyntaxKind.MinusToken
  | SyntaxKind.TildeToken
  | SyntaxKind.ExclamationToken;
export interface PostfixUnaryExpression extends Node {
  readonly kind: SyntaxKind.PostfixUnaryExpression;

  readonly operand: LeftHandSideExpression;
  readonly operator: PostfixUnaryOperator;
  readonly parent: Node;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export type LeftHandSideExpression = PartiallyEmittedExpression | MemberExpression | CallExpression | NonNullExpression;
export interface PartiallyEmittedExpression extends Node {
  readonly kind: SyntaxKind.PartiallyEmittedExpression;

  readonly expression: Expression;
  readonly parent: Node;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export type MemberExpression =
  | PrimaryExpression
  | PropertyAccessExpression
  | ElementAccessExpression
  | ExpressionWithTypeArguments
  | TaggedTemplateExpression;
export type PrimaryExpression =
  | Identifier
  | PrivateIdentifier
  | NullLiteral
  | TrueLiteral
  | FalseLiteral
  | ThisExpression
  | SuperExpression
  | ImportExpression
  | FunctionExpression
  | LiteralExpression
  | TemplateExpression
  | ParenthesizedExpression
  | ArrayLiteralExpression
  | ObjectLiteralExpressionBase
  | NewExpression
  | MetaProperty
  | JsxElement
  | JsxAttributes
  | JsxSelfClosingElement
  | JsxFragment
  | MissingDeclaration
  | ClassExpression;
export interface PrivateIdentifier extends Node {
  readonly kind: SyntaxKind.PrivateIdentifier;

  readonly escapedText: __String;
  readonly text: string;
  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface NullLiteral extends Node {
  readonly kind: SyntaxKind.NullKeyword;

  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface TrueLiteral extends Node {
  readonly kind: SyntaxKind.TrueKeyword;

  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface FalseLiteral extends Node {
  readonly kind: SyntaxKind.FalseKeyword;

  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface ThisExpression extends Node {
  readonly kind: SyntaxKind.ThisKeyword;

  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _flowContainerBrand: any;
}
export interface SuperExpression extends Node {
  readonly kind: SyntaxKind.SuperKeyword;

  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _flowContainerBrand: any;
}
export interface ImportExpression extends Node {
  readonly kind: SyntaxKind.ImportKeyword;

  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface FunctionExpression extends Node {
  readonly kind: SyntaxKind.FunctionExpression;

  readonly modifiers?: NodeArray<Modifier>;
  readonly name?: Identifier;
  readonly body: FunctionBody;
  readonly parent: Node;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _functionLikeDeclarationBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _localsContainerBrand: any;
  _flowContainerBrand: any;
}
export type FunctionBody = Block;
export interface Block extends Node {
  readonly kind: SyntaxKind.Block;

  readonly statements: NodeArray<Statement>;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _localsContainerBrand: any;
}
export interface AsteriskToken extends Node {
  readonly kind: SyntaxKind.AsteriskToken;
  readonly parent: Node;
}
export interface QuestionToken extends Node {
  readonly kind: SyntaxKind.QuestionToken;
  readonly parent: Node;
}
export interface ExclamationToken extends Node {
  readonly kind: SyntaxKind.ExclamationToken;
  readonly parent: Node;
}
export type TypeNode =
  | AnyKeyword
  | BigIntKeyword
  | BooleanKeyword
  | IntrinsicKeyword
  | NeverKeyword
  | NumberKeyword
  | ObjectKeyword
  | StringKeyword
  | SymbolKeyword
  | UndefinedKeyword
  | UnknownKeyword
  | VoidKeyword
  | ThisTypeNode
  | FunctionOrConstructorTypeNodeBase
  | NodeWithTypeArguments
  | TypePredicateNode
  | TypeLiteralNode
  | ArrayTypeNode
  | TupleTypeNode
  | NamedTupleMember
  | OptionalTypeNode
  | RestTypeNode
  | UnionTypeNode
  | IntersectionTypeNode
  | ConditionalTypeNode
  | InferTypeNode
  | ParenthesizedTypeNode
  | TypeOperatorNode
  | IndexedAccessTypeNode
  | MappedTypeNode
  | LiteralTypeNode
  | TemplateLiteralTypeNode
  | TemplateLiteralTypeSpan
  | JSDocTypeExpression
  | JSDocType;
export interface AnyKeyword extends Node {
  readonly kind: SyntaxKind.AnyKeyword;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface BigIntKeyword extends Node {
  readonly kind: SyntaxKind.BigIntKeyword;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface BooleanKeyword extends Node {
  readonly kind: SyntaxKind.BooleanKeyword;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface IntrinsicKeyword extends Node {
  readonly kind: SyntaxKind.IntrinsicKeyword;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface NeverKeyword extends Node {
  readonly kind: SyntaxKind.NeverKeyword;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface NumberKeyword extends Node {
  readonly kind: SyntaxKind.NumberKeyword;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface ObjectKeyword extends Node {
  readonly kind: SyntaxKind.ObjectKeyword;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface StringKeyword extends Node {
  readonly kind: SyntaxKind.StringKeyword;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface SymbolKeyword extends Node {
  readonly kind: SyntaxKind.SymbolKeyword;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface UndefinedKeyword extends Node {
  readonly kind: SyntaxKind.UndefinedKeyword;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface UnknownKeyword extends Node {
  readonly kind: SyntaxKind.UnknownKeyword;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface VoidKeyword extends Node {
  readonly kind: SyntaxKind.VoidKeyword;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface ThisTypeNode extends Node {
  readonly kind: SyntaxKind.ThisType;

  readonly parent: Node;
  _typeNodeBrand: any;
}
export type FunctionOrConstructorTypeNodeBase = FunctionTypeNode | ConstructorTypeNode;
export interface FunctionTypeNode extends Node {
  readonly kind: SyntaxKind.FunctionType;

  readonly type: TypeNode;
  readonly parent: Node;
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  _typeNodeBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _localsContainerBrand: any;
}
export interface ConstructorTypeNode extends Node {
  readonly kind: SyntaxKind.ConstructorType;

  readonly modifiers?: NodeArray<Modifier>;
  readonly type: TypeNode;
  readonly parent: Node;
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  _typeNodeBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _localsContainerBrand: any;
}
export type NodeWithTypeArguments = ImportTypeNode | TypeReferenceNode | TypeQueryNode | ExpressionWithTypeArguments;
export interface ImportTypeNode extends Node {
  readonly kind: SyntaxKind.ImportType;

  readonly isTypeOf: boolean;
  readonly argument: TypeNode;
  readonly attributes?: ImportAttributes;
  readonly qualifier?: EntityName;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface ImportAttributes extends Node {
  readonly kind: SyntaxKind.ImportAttributes;

  readonly token: SyntaxKind.WithKeyword | SyntaxKind.AssertKeyword;
  readonly parent: ImportDeclaration | ExportDeclaration;
  readonly elements: NodeArray<ImportAttribute>;
  readonly multiLine?: boolean;
}
export interface ImportDeclaration extends Node {
  readonly kind: SyntaxKind.ImportDeclaration;

  readonly parent: SourceFile | ModuleBlock;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly importClause?: ImportClause;
  /** If this is not a StringLiteral it will be a grammar error. */
  readonly moduleSpecifier: Expression;
  readonly attributes?: ImportAttributes;
  _statementBrand: any;
  _jsdocContainerBrand: any;
}
export interface ModuleBlock extends Node {
  readonly kind: SyntaxKind.ModuleBlock;

  readonly parent: ModuleDeclaration;
  readonly statements: NodeArray<Statement>;
  _statementBrand: any;
  _jsdocContainerBrand: any;
}
export interface ModuleDeclaration extends Node {
  readonly kind: SyntaxKind.ModuleDeclaration;

  readonly parent: ModuleBody | SourceFile;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: ModuleName;
  readonly body?: ModuleBody | JSDocNamespaceDeclaration;
  _declarationBrand: any;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _localsContainerBrand: any;
}
export type ModuleBody = NamespaceBody | JSDocNamespaceBody;
export type NamespaceBody = ModuleBlock | NamespaceDeclaration;
export interface NamespaceDeclaration extends Node {
  readonly kind: SyntaxKind.ModuleDeclaration;

  readonly name: Identifier;
  readonly body: NamespaceBody;
  readonly parent: ModuleBody | SourceFile;
  readonly modifiers?: NodeArray<ModifierLike>;
  _declarationBrand: any;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _localsContainerBrand: any;
}
export type JSDocNamespaceBody = Identifier | JSDocNamespaceDeclaration;
export interface JSDocNamespaceDeclaration extends Node {
  readonly kind: SyntaxKind.ModuleDeclaration;

  readonly name: Identifier;
  readonly body?: JSDocNamespaceBody;
  readonly parent: ModuleBody | SourceFile;
  readonly modifiers?: NodeArray<ModifierLike>;
  _declarationBrand: any;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _localsContainerBrand: any;
}
export type ModuleName = Identifier | StringLiteral;
export interface ImportClause extends Node {
  readonly kind: SyntaxKind.ImportClause;

  readonly parent: ImportDeclaration | JSDocImportTag;
  /** @deprecated Use `phaseModifier` instead */
  readonly isTypeOnly: boolean;
  readonly phaseModifier: undefined | ImportPhaseModifierSyntaxKind;
  readonly name?: Identifier;
  readonly namedBindings?: NamedImportBindings;
  _declarationBrand: any;
}
export interface JSDocImportTag extends Node {
  readonly kind: SyntaxKind.JSDocImportTag;

  readonly parent: JSDoc;
  readonly importClause?: ImportClause;
  readonly moduleSpecifier: Expression;
  readonly attributes?: ImportAttributes;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDoc extends Node {
  readonly kind: SyntaxKind.JSDoc;

  readonly parent: HasJSDoc;
  readonly tags?: NodeArray<JSDocTag>;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export type HasJSDoc =
  | AccessorDeclaration
  | ArrowFunction
  | BinaryExpression
  | Block
  | BreakStatement
  | CallSignatureDeclaration
  | CaseClause
  | ClassLikeDeclaration
  | ClassStaticBlockDeclaration
  | ConstructorDeclaration
  | ConstructorTypeNode
  | ConstructSignatureDeclaration
  | ContinueStatement
  | DebuggerStatement
  | DoStatement
  | ElementAccessExpression
  | EmptyStatement
  | EndOfFileToken
  | EnumDeclaration
  | EnumMember
  | ExportAssignment
  | ExportDeclaration
  | ExportSpecifier
  | ExpressionStatement
  | ForInStatement
  | ForOfStatement
  | ForStatement
  | FunctionDeclaration
  | FunctionExpression
  | FunctionTypeNode
  | Identifier
  | IfStatement
  | ImportDeclaration
  | ImportEqualsDeclaration
  | IndexSignatureDeclaration
  | InterfaceDeclaration
  | JSDocFunctionType
  | JSDocSignature
  | LabeledStatement
  | MethodDeclaration
  | MethodSignature
  | ModuleDeclaration
  | NamedTupleMember
  | NamespaceExportDeclaration
  | ObjectLiteralExpression
  | ParameterDeclaration
  | ParenthesizedExpression
  | PropertyAccessExpression
  | PropertyAssignment
  | PropertyDeclaration
  | PropertySignature
  | ReturnStatement
  | SemicolonClassElement
  | ShorthandPropertyAssignment
  | SpreadAssignment
  | SwitchStatement
  | ThrowStatement
  | TryStatement
  | TypeAliasDeclaration
  | TypeParameterDeclaration
  | VariableDeclaration
  | VariableStatement
  | WhileStatement
  | WithStatement;
export type AccessorDeclaration = GetAccessorDeclaration | SetAccessorDeclaration;
export interface GetAccessorDeclaration extends Node {
  readonly kind: SyntaxKind.GetAccessor;

  readonly parent: ClassLikeDeclaration | ObjectLiteralExpression | TypeLiteralNode | InterfaceDeclaration;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: PropertyName;
  readonly body?: FunctionBody;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  _functionLikeDeclarationBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _classElementBrand: any;
  _typeElementBrand: any;
  _objectLiteralBrand: any;
  _localsContainerBrand: any;
  _flowContainerBrand: any;
}
export type ClassLikeDeclaration = ClassDeclaration | ClassExpression;
export interface ClassDeclaration extends Node {
  readonly kind: SyntaxKind.ClassDeclaration;

  readonly modifiers?: NodeArray<ModifierLike>;
  /** May be undefined in `export default class { ... }`. */
  readonly name?: Identifier;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration>;
  readonly heritageClauses?: NodeArray<HeritageClause>;
  readonly members: NodeArray<ClassElement>;
  readonly parent: Node;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _statementBrand: any;
}
export interface HeritageClause extends Node {
  readonly kind: SyntaxKind.HeritageClause;

  readonly parent: InterfaceDeclaration | ClassLikeDeclaration;
  readonly token: SyntaxKind.ExtendsKeyword | SyntaxKind.ImplementsKeyword;
  readonly types: NodeArray<ExpressionWithTypeArguments>;
}
export interface InterfaceDeclaration extends Node {
  readonly kind: SyntaxKind.InterfaceDeclaration;

  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: Identifier;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration>;
  readonly heritageClauses?: NodeArray<HeritageClause>;
  readonly members: NodeArray<TypeElement>;
  readonly parent: Node;
  _declarationBrand: any;
  _statementBrand: any;
  _jsdocContainerBrand: any;
}
export interface ExpressionWithTypeArguments extends Node {
  readonly kind: SyntaxKind.ExpressionWithTypeArguments;

  readonly expression: LeftHandSideExpression;
  readonly parent: Node;
  readonly typeArguments?: NodeArray<TypeNode>;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _typeNodeBrand: any;
}
export type ClassElement =
  | PropertyDeclaration
  | MethodDeclaration
  | ConstructorDeclaration
  | SemicolonClassElement
  | GetAccessorDeclaration
  | SetAccessorDeclaration
  | IndexSignatureDeclaration
  | ClassStaticBlockDeclaration;
export interface PropertyDeclaration extends Node {
  readonly kind: SyntaxKind.PropertyDeclaration;

  readonly parent: ClassLikeDeclaration;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: PropertyName;
  readonly questionToken?: QuestionToken;
  readonly exclamationToken?: ExclamationToken;
  readonly type?: TypeNode;
  readonly initializer?: Expression;
  _classElementBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
}
export interface MethodDeclaration extends Node {
  readonly kind: SyntaxKind.MethodDeclaration;

  readonly parent: ClassLikeDeclaration | ObjectLiteralExpression;
  readonly modifiers?: NodeArray<ModifierLike> | undefined;
  readonly name: PropertyName;
  readonly body?: FunctionBody | undefined;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  _functionLikeDeclarationBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _classElementBrand: any;
  _objectLiteralBrand: any;
  _localsContainerBrand: any;
  _flowContainerBrand: any;
}
export interface ObjectLiteralExpression extends Node {
  readonly kind: SyntaxKind.ObjectLiteralExpression;

  readonly properties: NodeArray<ObjectLiteralElementLike>;
  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
}
export type ObjectLiteralElementLike =
  | PropertyAssignment
  | ShorthandPropertyAssignment
  | SpreadAssignment
  | MethodDeclaration
  | AccessorDeclaration;
export interface PropertyAssignment extends Node {
  readonly kind: SyntaxKind.PropertyAssignment;

  readonly parent: ObjectLiteralExpression;
  readonly name: PropertyName;
  readonly initializer: Expression;
  _objectLiteralBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
}
export interface ShorthandPropertyAssignment extends Node {
  readonly kind: SyntaxKind.ShorthandPropertyAssignment;

  readonly parent: ObjectLiteralExpression;
  readonly name: Identifier;
  readonly equalsToken?: EqualsToken;
  readonly objectAssignmentInitializer?: Expression;
  _objectLiteralBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
}
export interface EqualsToken extends Node {
  readonly kind: SyntaxKind.EqualsToken;
  readonly parent: Node;
}
export interface SpreadAssignment extends Node {
  readonly kind: SyntaxKind.SpreadAssignment;

  readonly parent: ObjectLiteralExpression;
  readonly expression: Expression;
  readonly name?: PropertyName;
  _objectLiteralBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
}
export interface ConstructorDeclaration extends Node {
  readonly kind: SyntaxKind.Constructor;

  readonly parent: ClassLikeDeclaration;
  readonly modifiers?: NodeArray<ModifierLike> | undefined;
  readonly body?: FunctionBody | undefined;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  _functionLikeDeclarationBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _classElementBrand: any;
  _localsContainerBrand: any;
}
export interface SemicolonClassElement extends Node {
  readonly kind: SyntaxKind.SemicolonClassElement;

  readonly parent: ClassLikeDeclaration;
  readonly name?: PropertyName;
  _classElementBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
}
export interface SetAccessorDeclaration extends Node {
  readonly kind: SyntaxKind.SetAccessor;

  readonly parent: ClassLikeDeclaration | ObjectLiteralExpression | TypeLiteralNode | InterfaceDeclaration;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: PropertyName;
  readonly body?: FunctionBody;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  _functionLikeDeclarationBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _classElementBrand: any;
  _typeElementBrand: any;
  _objectLiteralBrand: any;
  _localsContainerBrand: any;
  _flowContainerBrand: any;
}
export interface IndexSignatureDeclaration extends Node {
  readonly kind: SyntaxKind.IndexSignature;

  readonly parent: ObjectTypeDeclaration;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly type: TypeNode;
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly questionToken?: QuestionToken | undefined;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _classElementBrand: any;
  _typeElementBrand: any;
  _localsContainerBrand: any;
}
export type ObjectTypeDeclaration = ClassLikeDeclaration | InterfaceDeclaration | TypeLiteralNode;
export interface ClassStaticBlockDeclaration extends Node {
  readonly kind: SyntaxKind.ClassStaticBlockDeclaration;

  readonly parent: ClassDeclaration | ClassExpression;
  readonly body: Block;
  readonly name?: PropertyName;
  _classElementBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _localsContainerBrand: any;
}
export interface ClassExpression extends Node {
  readonly kind: SyntaxKind.ClassExpression;

  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name?: Identifier;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration>;
  readonly heritageClauses?: NodeArray<HeritageClause>;
  readonly members: NodeArray<ClassElement>;
  readonly parent: Node;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface ArrowFunction extends Node {
  readonly kind: SyntaxKind.ArrowFunction;

  readonly modifiers?: NodeArray<Modifier>;
  readonly equalsGreaterThanToken: EqualsGreaterThanToken;
  readonly body: ConciseBody;
  readonly name: never;
  readonly parent: Node;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  _expressionBrand: any;
  _functionLikeDeclarationBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _localsContainerBrand: any;
  _flowContainerBrand: any;
}
export interface EqualsGreaterThanToken extends Node {
  readonly kind: SyntaxKind.EqualsGreaterThanToken;
  readonly parent: Node;
}
export type ConciseBody = FunctionBody | Expression;
export interface BinaryExpression extends Node {
  readonly kind: SyntaxKind.BinaryExpression;

  readonly left: Expression;
  readonly operatorToken: BinaryOperatorToken;
  readonly right: Expression;
  readonly parent: Node;
  _expressionBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
}
export interface BinaryOperatorToken extends Node {
  readonly kind: BinaryOperator;
  readonly parent: Node;
}
export type BinaryOperator = AssignmentOperatorOrHigher | SyntaxKind.CommaToken;
export type AssignmentOperatorOrHigher = SyntaxKind.QuestionQuestionToken | LogicalOperatorOrHigher | AssignmentOperator;
export type LogicalOperatorOrHigher = BitwiseOperatorOrHigher | LogicalOperator;
export type BitwiseOperatorOrHigher = EqualityOperatorOrHigher | BitwiseOperator;
export type EqualityOperatorOrHigher = RelationalOperatorOrHigher | EqualityOperator;
export type RelationalOperatorOrHigher = ShiftOperatorOrHigher | RelationalOperator;
export type ShiftOperatorOrHigher = AdditiveOperatorOrHigher | ShiftOperator;
export type AdditiveOperatorOrHigher = MultiplicativeOperatorOrHigher | AdditiveOperator;
export type MultiplicativeOperatorOrHigher = ExponentiationOperator | MultiplicativeOperator;
export type ExponentiationOperator = SyntaxKind.AsteriskAsteriskToken;
export type MultiplicativeOperator = SyntaxKind.AsteriskToken | SyntaxKind.SlashToken | SyntaxKind.PercentToken;
export type AdditiveOperator = SyntaxKind.PlusToken | SyntaxKind.MinusToken;
export type ShiftOperator =
  | SyntaxKind.LessThanLessThanToken
  | SyntaxKind.GreaterThanGreaterThanToken
  | SyntaxKind.GreaterThanGreaterThanGreaterThanToken;
export type RelationalOperator =
  | SyntaxKind.LessThanToken
  | SyntaxKind.LessThanEqualsToken
  | SyntaxKind.GreaterThanToken
  | SyntaxKind.GreaterThanEqualsToken
  | SyntaxKind.InstanceOfKeyword
  | SyntaxKind.InKeyword;
export type EqualityOperator =
  | SyntaxKind.EqualsEqualsToken
  | SyntaxKind.EqualsEqualsEqualsToken
  | SyntaxKind.ExclamationEqualsEqualsToken
  | SyntaxKind.ExclamationEqualsToken;
export type BitwiseOperator = SyntaxKind.AmpersandToken | SyntaxKind.BarToken | SyntaxKind.CaretToken;
export type LogicalOperator = SyntaxKind.AmpersandAmpersandToken | SyntaxKind.BarBarToken;
export type AssignmentOperator = SyntaxKind.EqualsToken | CompoundAssignmentOperator;
export type CompoundAssignmentOperator =
  | SyntaxKind.PlusEqualsToken
  | SyntaxKind.MinusEqualsToken
  | SyntaxKind.AsteriskAsteriskEqualsToken
  | SyntaxKind.AsteriskEqualsToken
  | SyntaxKind.SlashEqualsToken
  | SyntaxKind.PercentEqualsToken
  | SyntaxKind.AmpersandEqualsToken
  | SyntaxKind.BarEqualsToken
  | SyntaxKind.CaretEqualsToken
  | SyntaxKind.LessThanLessThanEqualsToken
  | SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken
  | SyntaxKind.GreaterThanGreaterThanEqualsToken
  | SyntaxKind.BarBarEqualsToken
  | SyntaxKind.AmpersandAmpersandEqualsToken
  | SyntaxKind.QuestionQuestionEqualsToken;
export interface BreakStatement extends Node {
  readonly kind: SyntaxKind.BreakStatement;

  readonly label?: Identifier;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export interface CaseClause extends Node {
  readonly kind: SyntaxKind.CaseClause;

  readonly parent: CaseBlock;
  readonly expression: Expression;
  readonly statements: NodeArray<Statement>;
  _jsdocContainerBrand: any;
}
export interface CaseBlock extends Node {
  readonly kind: SyntaxKind.CaseBlock;

  readonly parent: SwitchStatement;
  readonly clauses: NodeArray<CaseOrDefaultClause>;
  _localsContainerBrand: any;
}
export interface SwitchStatement extends Node {
  readonly kind: SyntaxKind.SwitchStatement;

  readonly expression: Expression;
  readonly caseBlock: CaseBlock;
  possiblyExhaustive?: boolean;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export type CaseOrDefaultClause = CaseClause | DefaultClause;
export interface DefaultClause extends Node {
  readonly kind: SyntaxKind.DefaultClause;

  readonly parent: CaseBlock;
  readonly statements: NodeArray<Statement>;
}
export interface ContinueStatement extends Node {
  readonly kind: SyntaxKind.ContinueStatement;

  readonly label?: Identifier;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export interface DebuggerStatement extends Node {
  readonly kind: SyntaxKind.DebuggerStatement;

  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export interface DoStatement extends Node {
  readonly kind: SyntaxKind.DoStatement;

  readonly expression: Expression;
  readonly statement: Statement;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export interface ElementAccessExpression extends Node {
  readonly kind: SyntaxKind.ElementAccessExpression;

  readonly expression: LeftHandSideExpression;
  readonly questionDotToken?: QuestionDotToken;
  readonly argumentExpression: Expression;
  readonly parent: Node;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export interface QuestionDotToken extends Node {
  readonly kind: SyntaxKind.QuestionDotToken;
  readonly parent: Node;
}
export interface EmptyStatement extends Node {
  readonly kind: SyntaxKind.EmptyStatement;

  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
}
export interface EnumDeclaration extends Node {
  readonly kind: SyntaxKind.EnumDeclaration;

  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: Identifier;
  readonly members: NodeArray<EnumMember>;
  readonly parent: Node;
  _declarationBrand: any;
  _statementBrand: any;
  _jsdocContainerBrand: any;
}
export interface EnumMember extends Node {
  readonly kind: SyntaxKind.EnumMember;

  readonly parent: EnumDeclaration;
  readonly name: PropertyName;
  readonly initializer?: Expression;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
}
export interface ExportAssignment extends Node {
  readonly kind: SyntaxKind.ExportAssignment;

  readonly parent: SourceFile;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly isExportEquals?: boolean;
  readonly expression: Expression;
  readonly name?: Identifier | StringLiteral | NumericLiteral;
  _declarationBrand: any;
  _statementBrand: any;
  _jsdocContainerBrand: any;
}
export interface ExportDeclaration extends Node {
  readonly kind: SyntaxKind.ExportDeclaration;

  readonly parent: SourceFile | ModuleBlock;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly isTypeOnly: boolean;
  /** Will not be assigned in the case of `export * from "foo";` */
  readonly exportClause?: NamedExportBindings;
  /** If this is not a StringLiteral it will be a grammar error. */
  readonly moduleSpecifier?: Expression;
  readonly attributes?: ImportAttributes;
  readonly name?: Identifier | StringLiteral | NumericLiteral;
  _declarationBrand: any;
  _statementBrand: any;
  _jsdocContainerBrand: any;
}
export type NamedExportBindings = NamespaceExport | NamedExports;
export interface NamespaceExport extends Node {
  readonly kind: SyntaxKind.NamespaceExport;

  readonly parent: ExportDeclaration;
  readonly name: ModuleExportName;
  _declarationBrand: any;
}
export type ModuleExportName = Identifier | StringLiteral;
export interface NamedExports extends Node {
  readonly kind: SyntaxKind.NamedExports;

  readonly parent: ExportDeclaration;
  readonly elements: NodeArray<ExportSpecifier>;
}
export interface ExportSpecifier extends Node {
  readonly kind: SyntaxKind.ExportSpecifier;

  readonly parent: NamedExports;
  readonly isTypeOnly: boolean;
  readonly propertyName?: ModuleExportName;
  readonly name: ModuleExportName;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
}
export interface ExpressionStatement extends Node {
  readonly kind: SyntaxKind.ExpressionStatement;

  readonly expression: Expression;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export interface ForInStatement extends Node {
  readonly kind: SyntaxKind.ForInStatement;

  readonly initializer: ForInitializer;
  readonly expression: Expression;
  readonly statement: Statement;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _localsContainerBrand: any;
  _flowContainerBrand: any;
}
export interface ForOfStatement extends Node {
  readonly kind: SyntaxKind.ForOfStatement;

  readonly awaitModifier?: AwaitKeyword;
  readonly initializer: ForInitializer;
  readonly expression: Expression;
  readonly statement: Statement;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _localsContainerBrand: any;
  _flowContainerBrand: any;
}
export interface AwaitKeyword extends Node {
  readonly kind: SyntaxKind.AwaitKeyword;
  readonly parent: Node;
}
export interface IfStatement extends Node {
  readonly kind: SyntaxKind.IfStatement;

  readonly expression: Expression;
  readonly thenStatement: Statement;
  readonly elseStatement?: Statement;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export interface ImportEqualsDeclaration extends Node {
  readonly kind: SyntaxKind.ImportEqualsDeclaration;

  readonly parent: SourceFile | ModuleBlock;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: Identifier;
  readonly isTypeOnly: boolean;
  readonly moduleReference: ModuleReference;
  _declarationBrand: any;
  _statementBrand: any;
  _jsdocContainerBrand: any;
}
export type ModuleReference = EntityName | ExternalModuleReference;
export type EntityName = Identifier | QualifiedName;
export interface QualifiedName extends Node {
  readonly kind: SyntaxKind.QualifiedName;

  readonly left: EntityName;
  readonly right: Identifier;
  readonly parent: Node;
  _flowContainerBrand: any;
}
export interface ExternalModuleReference extends Node {
  readonly kind: SyntaxKind.ExternalModuleReference;

  readonly parent: ImportEqualsDeclaration;
  readonly expression: Expression;
}
export interface JSDocFunctionType extends Node {
  readonly kind: SyntaxKind.JSDocFunctionType;

  readonly parent: Node;
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  _jsDocTypeBrand: any;
  _typeNodeBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _localsContainerBrand: any;
}
export interface JSDocSignature extends Node {
  readonly kind: SyntaxKind.JSDocSignature;

  readonly typeParameters?: readonly JSDocTemplateTag[];
  readonly parameters: readonly JSDocParameterTag[];
  readonly type: JSDocReturnTag | undefined;
  readonly parent: Node;
  _jsDocTypeBrand: any;
  _typeNodeBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _localsContainerBrand: any;
}
export interface JSDocTemplateTag extends Node {
  readonly kind: SyntaxKind.JSDocTemplateTag;

  readonly constraint: JSDocTypeExpression | undefined;
  readonly typeParameters: NodeArray<TypeParameterDeclaration>;
  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocTypeExpression extends Node {
  readonly kind: SyntaxKind.JSDocTypeExpression;

  readonly type: TypeNode;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface JSDocTypeLiteral extends Node {
  readonly kind: SyntaxKind.JSDocTypeLiteral;

  readonly jsDocPropertyTags?: readonly JSDocPropertyLikeTag[];
  /** If true, then this type literal represents an *array* of its type. */
  readonly isArrayType: boolean;
  readonly parent: Node;
  _jsDocTypeBrand: any;
  _typeNodeBrand: any;
  _declarationBrand: any;
}
export type JSDocPropertyLikeTag = JSDocPropertyTag | JSDocParameterTag;
export interface JSDocPropertyTag extends Node {
  readonly kind: SyntaxKind.JSDocPropertyTag;

  readonly parent: JSDoc;
  readonly name: EntityName;
  readonly typeExpression?: JSDocTypeExpression;
  /** Whether the property name came before the type -- non-standard for JSDoc, but Typescript-like */
  readonly isNameFirst: boolean;
  readonly isBracketed: boolean;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
  _declarationBrand: any;
}
export type JSDocComment = JSDocText | JSDocLink | JSDocLinkCode | JSDocLinkPlain;
export interface JSDocText extends Node {
  readonly kind: SyntaxKind.JSDocText;

  text: string;
  readonly parent: Node;
}
export interface JSDocLink extends Node {
  readonly kind: SyntaxKind.JSDocLink;

  readonly name?: EntityName | JSDocMemberName;
  text: string;
  readonly parent: Node;
}
export interface JSDocMemberName extends Node {
  readonly kind: SyntaxKind.JSDocMemberName;

  readonly left: EntityName | JSDocMemberName;
  readonly right: Identifier;
  readonly parent: Node;
}
export interface JSDocLinkCode extends Node {
  readonly kind: SyntaxKind.JSDocLinkCode;

  readonly name?: EntityName | JSDocMemberName;
  text: string;
  readonly parent: Node;
}
export interface JSDocLinkPlain extends Node {
  readonly kind: SyntaxKind.JSDocLinkPlain;

  readonly name?: EntityName | JSDocMemberName;
  text: string;
  readonly parent: Node;
}
export interface JSDocParameterTag extends Node {
  readonly kind: SyntaxKind.JSDocParameterTag;

  readonly parent: JSDoc;
  readonly name: EntityName;
  readonly typeExpression?: JSDocTypeExpression;
  /** Whether the property name came before the type -- non-standard for JSDoc, but Typescript-like */
  readonly isNameFirst: boolean;
  readonly isBracketed: boolean;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
  _declarationBrand: any;
}
export interface JSDocReturnTag extends Node {
  readonly kind: SyntaxKind.JSDocReturnTag;

  readonly typeExpression?: JSDocTypeExpression;
  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface LabeledStatement extends Node {
  readonly kind: SyntaxKind.LabeledStatement;

  readonly label: Identifier;
  readonly statement: Statement;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export interface MethodSignature extends Node {
  readonly kind: SyntaxKind.MethodSignature;

  readonly parent: TypeLiteralNode | InterfaceDeclaration;
  readonly modifiers?: NodeArray<Modifier>;
  readonly name: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  readonly questionToken?: QuestionToken | undefined;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _typeElementBrand: any;
  _localsContainerBrand: any;
}
export interface NamedTupleMember extends Node {
  readonly kind: SyntaxKind.NamedTupleMember;

  readonly dotDotDotToken?: Token<SyntaxKind.DotDotDotToken, NamedTupleMember>;
  readonly name: Identifier;
  readonly questionToken?: Token<SyntaxKind.QuestionToken, NamedTupleMember>;
  readonly type: TypeNode;
  readonly parent: Node;
  _typeNodeBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
}
export interface NamespaceExportDeclaration extends Node {
  readonly kind: SyntaxKind.NamespaceExportDeclaration;

  readonly name: Identifier;
  readonly parent: Node;
  _declarationBrand: any;
  _statementBrand: any;
  _jsdocContainerBrand: any;
}
export interface ParenthesizedExpression extends Node {
  readonly kind: SyntaxKind.ParenthesizedExpression;

  readonly expression: Expression;
  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _jsdocContainerBrand: any;
}
export interface PropertyAccessExpression extends Node {
  readonly kind: SyntaxKind.PropertyAccessExpression;

  readonly expression: LeftHandSideExpression;
  readonly questionDotToken?: QuestionDotToken;
  readonly name: MemberName;
  readonly parent: Node;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export type MemberName = Identifier | PrivateIdentifier;
export interface PropertySignature extends Node {
  readonly kind: SyntaxKind.PropertySignature;

  readonly parent: TypeLiteralNode | InterfaceDeclaration;
  readonly modifiers?: NodeArray<Modifier>;
  readonly name: PropertyName;
  readonly questionToken?: QuestionToken;
  readonly type?: TypeNode;
  _typeElementBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
}
export interface ReturnStatement extends Node {
  readonly kind: SyntaxKind.ReturnStatement;

  readonly expression?: Expression;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export interface ThrowStatement extends Node {
  readonly kind: SyntaxKind.ThrowStatement;

  readonly expression: Expression;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export interface TryStatement extends Node {
  readonly kind: SyntaxKind.TryStatement;

  readonly tryBlock: Block;
  readonly catchClause?: CatchClause;
  readonly finallyBlock?: Block;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export interface CatchClause extends Node {
  readonly kind: SyntaxKind.CatchClause;

  readonly parent: TryStatement;
  readonly variableDeclaration?: VariableDeclaration;
  readonly block: Block;
  _localsContainerBrand: any;
}
export interface TypeAliasDeclaration extends Node {
  readonly kind: SyntaxKind.TypeAliasDeclaration;

  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: Identifier;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration>;
  readonly type: TypeNode;
  readonly parent: Node;
  _declarationBrand: any;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _localsContainerBrand: any;
}
export interface WhileStatement extends Node {
  readonly kind: SyntaxKind.WhileStatement;

  readonly expression: Expression;
  readonly statement: Statement;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export interface WithStatement extends Node {
  readonly kind: SyntaxKind.WithStatement;

  readonly expression: Expression;
  readonly statement: Statement;
  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export type JSDocTag =
  | JSDocUnknownTag
  | JSDocAugmentsTag
  | JSDocImplementsTag
  | JSDocAuthorTag
  | JSDocDeprecatedTag
  | JSDocClassTag
  | JSDocPublicTag
  | JSDocPrivateTag
  | JSDocProtectedTag
  | JSDocReadonlyTag
  | JSDocOverrideTag
  | JSDocEnumTag
  | JSDocThisTag
  | JSDocTemplateTag
  | JSDocSeeTag
  | JSDocReturnTag
  | JSDocTypeTag
  | JSDocTypedefTag
  | JSDocCallbackTag
  | JSDocOverloadTag
  | JSDocThrowsTag
  | JSDocPropertyLikeTag
  | JSDocSatisfiesTag
  | JSDocImportTag;
export interface JSDocUnknownTag extends Node {
  readonly kind: SyntaxKind.JSDocTag;

  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocAugmentsTag extends Node {
  readonly kind: SyntaxKind.JSDocAugmentsTag;

  readonly class: ExpressionWithTypeArguments & {
    readonly expression: Identifier | PropertyAccessEntityNameExpression;
  };
  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface PropertyAccessEntityNameExpression extends Node {
  readonly kind: SyntaxKind.PropertyAccessExpression;

  readonly expression: EntityNameExpression;
  readonly name: Identifier;
  readonly questionDotToken?: QuestionDotToken;
  readonly parent: Node;
  _propertyAccessExpressionLikeQualifiedNameBrand?: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export type EntityNameExpression = Identifier | PropertyAccessEntityNameExpression;
export interface JSDocImplementsTag extends Node {
  readonly kind: SyntaxKind.JSDocImplementsTag;

  readonly class: ExpressionWithTypeArguments & {
    readonly expression: Identifier | PropertyAccessEntityNameExpression;
  };
  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocAuthorTag extends Node {
  readonly kind: SyntaxKind.JSDocAuthorTag;

  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocDeprecatedTag extends Node {
  readonly kind: SyntaxKind.JSDocDeprecatedTag;

  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocClassTag extends Node {
  readonly kind: SyntaxKind.JSDocClassTag;

  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocPublicTag extends Node {
  readonly kind: SyntaxKind.JSDocPublicTag;

  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocPrivateTag extends Node {
  readonly kind: SyntaxKind.JSDocPrivateTag;

  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocProtectedTag extends Node {
  readonly kind: SyntaxKind.JSDocProtectedTag;

  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocReadonlyTag extends Node {
  readonly kind: SyntaxKind.JSDocReadonlyTag;

  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocOverrideTag extends Node {
  readonly kind: SyntaxKind.JSDocOverrideTag;

  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocEnumTag extends Node {
  readonly kind: SyntaxKind.JSDocEnumTag;

  readonly parent: JSDoc;
  readonly typeExpression: JSDocTypeExpression;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
  _declarationBrand: any;
  _localsContainerBrand: any;
}
export interface JSDocThisTag extends Node {
  readonly kind: SyntaxKind.JSDocThisTag;

  readonly typeExpression: JSDocTypeExpression;
  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocSeeTag extends Node {
  readonly kind: SyntaxKind.JSDocSeeTag;

  readonly name?: JSDocNameReference;
  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocNameReference extends Node {
  readonly kind: SyntaxKind.JSDocNameReference;

  readonly name: EntityName | JSDocMemberName;
  readonly parent: Node;
}
export interface JSDocTypeTag extends Node {
  readonly kind: SyntaxKind.JSDocTypeTag;

  readonly typeExpression: JSDocTypeExpression;
  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocTypedefTag extends Node {
  readonly kind: SyntaxKind.JSDocTypedefTag;

  readonly parent: JSDoc;
  readonly fullName?: JSDocNamespaceDeclaration | Identifier;
  readonly name?: Identifier;
  readonly typeExpression?: JSDocTypeExpression | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
  _declarationBrand: any;
  _localsContainerBrand: any;
}
export interface JSDocCallbackTag extends Node {
  readonly kind: SyntaxKind.JSDocCallbackTag;

  readonly parent: JSDoc;
  readonly fullName?: JSDocNamespaceDeclaration | Identifier;
  readonly name?: Identifier;
  readonly typeExpression: JSDocSignature;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
  _declarationBrand: any;
  _localsContainerBrand: any;
}
export interface JSDocOverloadTag extends Node {
  readonly kind: SyntaxKind.JSDocOverloadTag;

  readonly parent: JSDoc;
  readonly typeExpression: JSDocSignature;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocThrowsTag extends Node {
  readonly kind: SyntaxKind.JSDocThrowsTag;

  readonly typeExpression?: JSDocTypeExpression;
  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocSatisfiesTag extends Node {
  readonly kind: SyntaxKind.JSDocSatisfiesTag;

  readonly typeExpression: JSDocTypeExpression;
  readonly parent: JSDoc | JSDocTypeLiteral;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export type ImportPhaseModifierSyntaxKind = SyntaxKind.TypeKeyword | SyntaxKind.DeferKeyword;
export type NamedImportBindings = NamespaceImport | NamedImports;
export interface NamespaceImport extends Node {
  readonly kind: SyntaxKind.NamespaceImport;

  readonly parent: ImportClause;
  readonly name: Identifier;
  _declarationBrand: any;
}
export interface NamedImports extends Node {
  readonly kind: SyntaxKind.NamedImports;

  readonly parent: ImportClause;
  readonly elements: NodeArray<ImportSpecifier>;
}
export interface ImportSpecifier extends Node {
  readonly kind: SyntaxKind.ImportSpecifier;

  readonly parent: NamedImports;
  readonly propertyName?: ModuleExportName;
  readonly name: Identifier;
  readonly isTypeOnly: boolean;
  _declarationBrand: any;
}
export interface ImportAttribute extends Node {
  readonly kind: SyntaxKind.ImportAttribute;

  readonly parent: ImportAttributes;
  readonly name: ImportAttributeName;
  readonly value: Expression;
}
export type ImportAttributeName = Identifier | StringLiteral;
export interface TypeReferenceNode extends Node {
  readonly kind: SyntaxKind.TypeReference;

  readonly typeName: EntityName;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface TypeQueryNode extends Node {
  readonly kind: SyntaxKind.TypeQuery;

  readonly exprName: EntityName;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface TypePredicateNode extends Node {
  readonly kind: SyntaxKind.TypePredicate;

  readonly parent: SignatureDeclaration | JSDocTypeExpression;
  readonly assertsModifier?: AssertsKeyword;
  readonly parameterName: Identifier | ThisTypeNode;
  readonly type?: TypeNode;
  _typeNodeBrand: any;
}
export interface AssertsKeyword extends Node {
  readonly kind: SyntaxKind.AssertsKeyword;
  readonly parent: Node;
}
export interface ArrayTypeNode extends Node {
  readonly kind: SyntaxKind.ArrayType;

  readonly elementType: TypeNode;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface TupleTypeNode extends Node {
  readonly kind: SyntaxKind.TupleType;

  readonly elements: NodeArray<TypeNode | NamedTupleMember>;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface OptionalTypeNode extends Node {
  readonly kind: SyntaxKind.OptionalType;

  readonly type: TypeNode;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface RestTypeNode extends Node {
  readonly kind: SyntaxKind.RestType;

  readonly type: TypeNode;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface UnionTypeNode extends Node {
  readonly kind: SyntaxKind.UnionType;

  readonly types: NodeArray<TypeNode>;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface IntersectionTypeNode extends Node {
  readonly kind: SyntaxKind.IntersectionType;

  readonly types: NodeArray<TypeNode>;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface ConditionalTypeNode extends Node {
  readonly kind: SyntaxKind.ConditionalType;

  readonly checkType: TypeNode;
  readonly extendsType: TypeNode;
  readonly trueType: TypeNode;
  readonly falseType: TypeNode;
  readonly parent: Node;
  _typeNodeBrand: any;
  _localsContainerBrand: any;
}
export interface InferTypeNode extends Node {
  readonly kind: SyntaxKind.InferType;

  readonly typeParameter: TypeParameterDeclaration;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface ParenthesizedTypeNode extends Node {
  readonly kind: SyntaxKind.ParenthesizedType;

  readonly type: TypeNode;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface TypeOperatorNode extends Node {
  readonly kind: SyntaxKind.TypeOperator;

  readonly operator: SyntaxKind.KeyOfKeyword | SyntaxKind.UniqueKeyword | SyntaxKind.ReadonlyKeyword;
  readonly type: TypeNode;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface IndexedAccessTypeNode extends Node {
  readonly kind: SyntaxKind.IndexedAccessType;

  readonly objectType: TypeNode;
  readonly indexType: TypeNode;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface MappedTypeNode extends Node {
  readonly kind: SyntaxKind.MappedType;

  readonly readonlyToken?: ReadonlyKeyword | PlusToken | MinusToken;
  readonly typeParameter: TypeParameterDeclaration;
  readonly nameType?: TypeNode;
  readonly questionToken?: QuestionToken | PlusToken | MinusToken;
  readonly type?: TypeNode;
  /** Used only to produce grammar errors */
  readonly members?: NodeArray<TypeElement>;
  readonly parent: Node;
  _typeNodeBrand: any;
  _declarationBrand: any;
  _localsContainerBrand: any;
}
export interface PlusToken extends Node {
  readonly kind: SyntaxKind.PlusToken;
  readonly parent: Node;
}
export interface MinusToken extends Node {
  readonly kind: SyntaxKind.MinusToken;
  readonly parent: Node;
}
export interface LiteralTypeNode extends Node {
  readonly kind: SyntaxKind.LiteralType;

  readonly literal: NullLiteral | BooleanLiteral | LiteralExpression | PrefixUnaryExpression;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export type BooleanLiteral = TrueLiteral | FalseLiteral;
export type LiteralExpression =
  | StringLiteral
  | RegularExpressionLiteral
  | NoSubstitutionTemplateLiteral
  | NumericLiteral
  | BigIntLiteral;
export interface RegularExpressionLiteral extends Node {
  readonly kind: SyntaxKind.RegularExpressionLiteral;

  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
  readonly parent: Node;
  _literalExpressionBrand: any;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface BigIntLiteral extends Node {
  readonly kind: SyntaxKind.BigIntLiteral;

  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
  readonly parent: Node;
  _literalExpressionBrand: any;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface TemplateLiteralTypeNode extends Node {
  readonly kind: SyntaxKind.TemplateLiteralType;

  readonly head: TemplateHead;
  readonly templateSpans: NodeArray<TemplateLiteralTypeSpan>;
  readonly parent: Node;
  _typeNodeBrand: any;
}
export interface TemplateHead extends Node {
  readonly kind: SyntaxKind.TemplateHead;

  readonly parent: TemplateExpression | TemplateLiteralTypeNode;
  rawText?: string;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
}
export interface TemplateExpression extends Node {
  readonly kind: SyntaxKind.TemplateExpression;

  readonly head: TemplateHead;
  readonly templateSpans: NodeArray<TemplateSpan>;
  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface TemplateSpan extends Node {
  readonly kind: SyntaxKind.TemplateSpan;

  readonly parent: TemplateExpression;
  readonly expression: Expression;
  readonly literal: TemplateMiddle | TemplateTail;
}
export interface TemplateMiddle extends Node {
  readonly kind: SyntaxKind.TemplateMiddle;

  readonly parent: TemplateSpan | TemplateLiteralTypeSpan;
  rawText?: string;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
}
export interface TemplateLiteralTypeSpan extends Node {
  readonly kind: SyntaxKind.TemplateLiteralTypeSpan;

  readonly parent: TemplateLiteralTypeNode;
  readonly type: TypeNode;
  readonly literal: TemplateMiddle | TemplateTail;
  _typeNodeBrand: any;
}
export interface TemplateTail extends Node {
  readonly kind: SyntaxKind.TemplateTail;

  readonly parent: TemplateSpan | TemplateLiteralTypeSpan;
  rawText?: string;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
}
export type JSDocType =
  | JSDocAllType
  | JSDocUnknownType
  | JSDocNonNullableType
  | JSDocNullableType
  | JSDocOptionalType
  | JSDocFunctionType
  | JSDocVariadicType
  | JSDocNamepathType
  | JSDocSignature
  | JSDocTypeLiteral;
export interface JSDocAllType extends Node {
  readonly kind: SyntaxKind.JSDocAllType;

  readonly parent: Node;
  _jsDocTypeBrand: any;
  _typeNodeBrand: any;
}
export interface JSDocUnknownType extends Node {
  readonly kind: SyntaxKind.JSDocUnknownType;

  readonly parent: Node;
  _jsDocTypeBrand: any;
  _typeNodeBrand: any;
}
export interface JSDocNonNullableType extends Node {
  readonly kind: SyntaxKind.JSDocNonNullableType;

  readonly type: TypeNode;
  readonly postfix: boolean;
  readonly parent: Node;
  _jsDocTypeBrand: any;
  _typeNodeBrand: any;
}
export interface JSDocNullableType extends Node {
  readonly kind: SyntaxKind.JSDocNullableType;

  readonly type: TypeNode;
  readonly postfix: boolean;
  readonly parent: Node;
  _jsDocTypeBrand: any;
  _typeNodeBrand: any;
}
export interface JSDocOptionalType extends Node {
  readonly kind: SyntaxKind.JSDocOptionalType;

  readonly type: TypeNode;
  readonly parent: Node;
  _jsDocTypeBrand: any;
  _typeNodeBrand: any;
}
export interface JSDocVariadicType extends Node {
  readonly kind: SyntaxKind.JSDocVariadicType;

  readonly type: TypeNode;
  readonly parent: Node;
  _jsDocTypeBrand: any;
  _typeNodeBrand: any;
}
export interface JSDocNamepathType extends Node {
  readonly kind: SyntaxKind.JSDocNamepathType;

  readonly type: TypeNode;
  readonly parent: Node;
  _jsDocTypeBrand: any;
  _typeNodeBrand: any;
}
export interface ArrayLiteralExpression extends Node {
  readonly kind: SyntaxKind.ArrayLiteralExpression;

  readonly elements: NodeArray<Expression>;
  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export type ObjectLiteralExpressionBase = ObjectLiteralExpression;
export interface NewExpression extends Node {
  readonly kind: SyntaxKind.NewExpression;

  readonly expression: LeftHandSideExpression;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly arguments?: NodeArray<Expression>;
  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _declarationBrand: any;
}
export interface MetaProperty extends Node {
  readonly kind: SyntaxKind.MetaProperty;

  readonly keywordToken: SyntaxKind.NewKeyword | SyntaxKind.ImportKeyword;
  readonly name: Identifier;
  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _flowContainerBrand: any;
}
export interface JsxElement extends Node {
  readonly kind: SyntaxKind.JsxElement;

  readonly openingElement: JsxOpeningElement;
  readonly children: NodeArray<JsxChild>;
  readonly closingElement: JsxClosingElement;
  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface JsxOpeningElement extends Node {
  readonly kind: SyntaxKind.JsxOpeningElement;

  readonly parent: JsxElement;
  readonly tagName: JsxTagNameExpression;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly attributes: JsxAttributes;
  _expressionBrand: any;
}
export type JsxTagNameExpression = Identifier | ThisExpression | JsxTagNamePropertyAccess | JsxNamespacedName;
export interface JsxTagNamePropertyAccess extends Node {
  readonly kind: SyntaxKind.PropertyAccessExpression;

  readonly expression: Identifier | ThisExpression | JsxTagNamePropertyAccess;
  readonly questionDotToken?: QuestionDotToken;
  readonly name: MemberName;
  readonly parent: Node;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _declarationBrand: any;
  _jsdocContainerBrand: any;
  _flowContainerBrand: any;
}
export interface JsxNamespacedName extends Node {
  readonly kind: SyntaxKind.JsxNamespacedName;

  readonly name: Identifier;
  readonly namespace: Identifier;
  readonly parent: Node;
}
export interface JsxAttributes extends Node {
  readonly kind: SyntaxKind.JsxAttributes;

  readonly properties: NodeArray<JsxAttributeLike>;
  readonly parent: JsxOpeningLikeElement;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _declarationBrand: any;
}
export type JsxAttributeLike = JsxAttribute | JsxSpreadAttribute;
export interface JsxAttribute extends Node {
  readonly kind: SyntaxKind.JsxAttribute;

  readonly parent: JsxAttributes;
  readonly name: JsxAttributeName;
  readonly initializer?: JsxAttributeValue;
  _declarationBrand: any;
}
export type JsxAttributeName = Identifier | JsxNamespacedName;
export type JsxAttributeValue = StringLiteral | JsxExpression | JsxElement | JsxSelfClosingElement | JsxFragment;
export interface JsxExpression extends Node {
  readonly kind: SyntaxKind.JsxExpression;

  readonly parent: JsxElement | JsxFragment | JsxAttributeLike;
  readonly dotDotDotToken?: Token<SyntaxKind.DotDotDotToken, JsxExpression>;
  readonly expression?: Expression;
  _expressionBrand: any;
}
export interface JsxFragment extends Node {
  readonly kind: SyntaxKind.JsxFragment;

  readonly openingFragment: JsxOpeningFragment;
  readonly children: NodeArray<JsxChild>;
  readonly closingFragment: JsxClosingFragment;
  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface JsxOpeningFragment extends Node {
  readonly kind: SyntaxKind.JsxOpeningFragment;

  readonly parent: JsxFragment;
  _expressionBrand: any;
}
export type JsxChild = JsxText | JsxExpression | JsxElement | JsxSelfClosingElement | JsxFragment;
export interface JsxText extends Node {
  readonly kind: SyntaxKind.JsxText;

  readonly parent: JsxElement | JsxFragment;
  readonly containsOnlyTriviaWhiteSpaces: boolean;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
}
export interface JsxSelfClosingElement extends Node {
  readonly kind: SyntaxKind.JsxSelfClosingElement;

  readonly tagName: JsxTagNameExpression;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly attributes: JsxAttributes;
  readonly parent: Node;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface JsxClosingFragment extends Node {
  readonly kind: SyntaxKind.JsxClosingFragment;

  readonly parent: JsxFragment;
  _expressionBrand: any;
}
export interface JsxSpreadAttribute extends Node {
  readonly kind: SyntaxKind.JsxSpreadAttribute;

  readonly parent: JsxAttributes;
  readonly expression: Expression;
  readonly name?: PropertyName;
  _objectLiteralBrand: any;
  _declarationBrand: any;
}
export type JsxOpeningLikeElement = JsxSelfClosingElement | JsxOpeningElement;
export interface JsxClosingElement extends Node {
  readonly kind: SyntaxKind.JsxClosingElement;

  readonly parent: JsxElement;
  readonly tagName: JsxTagNameExpression;
}
export interface MissingDeclaration extends Node {
  readonly kind: SyntaxKind.MissingDeclaration;

  readonly name?: Identifier;
  readonly parent: Node;
  _declarationBrand: any;
  _statementBrand: any;
  _jsdocContainerBrand: any;
  _primaryExpressionBrand: any;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface TaggedTemplateExpression extends Node {
  readonly kind: SyntaxKind.TaggedTemplateExpression;

  readonly tag: LeftHandSideExpression;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly template: TemplateLiteral;
  readonly parent: Node;
  _memberExpressionBrand: any;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export type TemplateLiteral = TemplateExpression | NoSubstitutionTemplateLiteral;
export interface CallExpression extends Node {
  readonly kind: SyntaxKind.CallExpression;

  readonly expression: LeftHandSideExpression;
  readonly questionDotToken?: QuestionDotToken;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly arguments: NodeArray<Expression>;
  readonly parent: Node;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
  _declarationBrand: any;
}
export interface NonNullExpression extends Node {
  readonly kind: SyntaxKind.NonNullExpression;

  readonly expression: Expression;
  readonly parent: Node;
  _leftHandSideExpressionBrand: any;
  _updateExpressionBrand: any;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export type PostfixUnaryOperator = SyntaxKind.PlusPlusToken | SyntaxKind.MinusMinusToken;
export interface DeleteExpression extends Node {
  readonly kind: SyntaxKind.DeleteExpression;

  readonly expression: UnaryExpression;
  readonly parent: Node;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface TypeOfExpression extends Node {
  readonly kind: SyntaxKind.TypeOfExpression;

  readonly expression: UnaryExpression;
  readonly parent: Node;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface VoidExpression extends Node {
  readonly kind: SyntaxKind.VoidExpression;

  readonly expression: UnaryExpression;
  readonly parent: Node;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface AwaitExpression extends Node {
  readonly kind: SyntaxKind.AwaitExpression;

  readonly expression: UnaryExpression;
  readonly parent: Node;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface TypeAssertion extends Node {
  readonly kind: SyntaxKind.TypeAssertionExpression;

  readonly type: TypeNode;
  readonly expression: UnaryExpression;
  readonly parent: Node;
  _unaryExpressionBrand: any;
  _expressionBrand: any;
}
export interface YieldExpression extends Node {
  readonly kind: SyntaxKind.YieldExpression;

  readonly asteriskToken?: AsteriskToken;
  readonly expression?: Expression;
  readonly parent: Node;
  _expressionBrand: any;
}
export interface SyntheticExpression extends Node {
  readonly kind: SyntaxKind.SyntheticExpression;

  readonly isSpread: boolean;
  readonly type: Type;
  readonly tupleNameSource?: ParameterDeclaration | NamedTupleMember;
  readonly parent: Node;
  _expressionBrand: any;
}
export interface ConditionalExpression extends Node {
  readonly kind: SyntaxKind.ConditionalExpression;

  readonly condition: Expression;
  readonly questionToken: QuestionToken;
  readonly whenTrue: Expression;
  readonly colonToken: ColonToken;
  readonly whenFalse: Expression;
  readonly parent: Node;
  _expressionBrand: any;
}
export interface ColonToken extends Node {
  readonly kind: SyntaxKind.ColonToken;
  readonly parent: Node;
}
export interface SpreadElement extends Node {
  readonly kind: SyntaxKind.SpreadElement;

  readonly parent: ArrayLiteralExpression | CallExpression | NewExpression;
  readonly expression: Expression;
  _expressionBrand: any;
}
export interface AsExpression extends Node {
  readonly kind: SyntaxKind.AsExpression;

  readonly expression: Expression;
  readonly type: TypeNode;
  readonly parent: Node;
  _expressionBrand: any;
}
export interface SatisfiesExpression extends Node {
  readonly kind: SyntaxKind.SatisfiesExpression;

  readonly expression: Expression;
  readonly type: TypeNode;
  readonly parent: Node;
  _expressionBrand: any;
}
export interface CommaListExpression extends Node {
  readonly kind: SyntaxKind.CommaListExpression;

  readonly elements: NodeArray<Expression>;
  readonly parent: Node;
  _expressionBrand: any;
}
export interface BindingElement extends Node {
  readonly kind: SyntaxKind.BindingElement;

  readonly parent: BindingPattern;
  readonly propertyName?: PropertyName;
  readonly dotDotDotToken?: DotDotDotToken;
  readonly name: BindingName;
  readonly initializer?: Expression;
  _declarationBrand: any;
  _flowContainerBrand: any;
}
export interface ArrayBindingPattern extends Node {
  readonly kind: SyntaxKind.ArrayBindingPattern;

  readonly parent: VariableDeclaration | ParameterDeclaration | BindingElement;
  readonly elements: NodeArray<ArrayBindingElement>;
}
export type ArrayBindingElement = BindingElement | OmittedExpression;
export interface NotEmittedTypeElement extends Node {
  readonly kind: SyntaxKind.NotEmittedTypeElement;

  readonly name?: PropertyName;
  readonly questionToken?: QuestionToken | undefined;
  readonly parent: Node;
  _typeElementBrand: any;
  _declarationBrand: any;
}
export type ObjectLiteralElement =
  | PropertyAssignment
  | ShorthandPropertyAssignment
  | SpreadAssignment
  | MethodDeclaration
  | GetAccessorDeclaration
  | SetAccessorDeclaration
  | JsxSpreadAttribute;
export type ClassLikeDeclarationBase = ClassDeclaration | ClassExpression;
export interface NotEmittedStatement extends Node {
  readonly kind: SyntaxKind.NotEmittedStatement;

  readonly parent: Node;
  _statementBrand: any;
  _jsdocContainerBrand: any;
}
export type IterationStatement = DoStatement | WhileStatement | ForStatement | ForInStatement | ForOfStatement;

interface Token<Kind extends SyntaxKind, Parent extends Node> extends Node {
  readonly kind: Kind;
  readonly parent: Parent;
}

export type AnyNode =
  | AnyKeyword
  | ArrayBindingPattern
  | ArrayLiteralExpression
  | ArrayTypeNode
  | ArrowFunction
  | AsExpression
  | AwaitExpression
  | BigIntKeyword
  | BigIntLiteral
  | BinaryExpression
  | BindingElement
  | Block
  | BooleanKeyword
  | BreakStatement
  | CallExpression
  | CallSignatureDeclaration
  | CaseBlock
  | CaseClause
  | CatchClause
  | ClassDeclaration
  | ClassExpression
  | ClassStaticBlockDeclaration
  | CommaListExpression
  | ComputedPropertyName
  | ConditionalExpression
  | ConditionalTypeNode
  | ConstructSignatureDeclaration
  | ConstructorDeclaration
  | ConstructorTypeNode
  | ContinueStatement
  | DebuggerStatement
  | Decorator
  | DefaultClause
  | DeleteExpression
  | DoStatement
  | ElementAccessExpression
  | EmptyStatement
  | EnumDeclaration
  | EnumMember
  | ExportAssignment
  | ExportDeclaration
  | ExportSpecifier
  | ExpressionStatement
  | ExpressionWithTypeArguments
  | ExternalModuleReference
  | FalseLiteral
  | ForInStatement
  | ForOfStatement
  | ForStatement
  | FunctionDeclaration
  | FunctionExpression
  | FunctionTypeNode
  | GetAccessorDeclaration
  | HeritageClause
  | Identifier
  | IfStatement
  | ImportAttribute
  | ImportAttributes
  | ImportClause
  | ImportDeclaration
  | ImportEqualsDeclaration
  | ImportExpression
  | ImportSpecifier
  | ImportTypeNode
  | IndexSignatureDeclaration
  | IndexedAccessTypeNode
  | InferTypeNode
  | InterfaceDeclaration
  | IntersectionTypeNode
  | IntrinsicKeyword
  | JSDoc
  | JSDocAllType
  | JSDocAugmentsTag
  | JSDocAuthorTag
  | JSDocCallbackTag
  | JSDocClassTag
  | JSDocDeprecatedTag
  | JSDocEnumTag
  | JSDocFunctionType
  | JSDocImplementsTag
  | JSDocImportTag
  | JSDocLink
  | JSDocLinkCode
  | JSDocLinkPlain
  | JSDocMemberName
  | JSDocNameReference
  | JSDocNamepathType
  | JSDocNamespaceDeclaration
  | JSDocNonNullableType
  | JSDocNullableType
  | JSDocOptionalType
  | JSDocOverloadTag
  | JSDocOverrideTag
  | JSDocParameterTag
  | JSDocPrivateTag
  | JSDocPropertyTag
  | JSDocProtectedTag
  | JSDocPublicTag
  | JSDocReadonlyTag
  | JSDocReturnTag
  | JSDocSatisfiesTag
  | JSDocSeeTag
  | JSDocSignature
  | JSDocTemplateTag
  | JSDocText
  | JSDocThisTag
  | JSDocThrowsTag
  | JSDocTypeExpression
  | JSDocTypeLiteral
  | JSDocTypeTag
  | JSDocTypedefTag
  | JSDocUnknownTag
  | JSDocUnknownType
  | JSDocVariadicType
  | JsxAttribute
  | JsxAttributes
  | JsxClosingElement
  | JsxClosingFragment
  | JsxElement
  | JsxExpression
  | JsxFragment
  | JsxNamespacedName
  | JsxOpeningElement
  | JsxOpeningFragment
  | JsxSelfClosingElement
  | JsxSpreadAttribute
  | JsxTagNamePropertyAccess
  | JsxText
  | LabeledStatement
  | LiteralTypeNode
  | MappedTypeNode
  | MetaProperty
  | MethodDeclaration
  | MethodSignature
  | MissingDeclaration
  | ModuleBlock
  | ModuleDeclaration
  | NamedExports
  | NamedImports
  | NamedTupleMember
  | NamespaceDeclaration
  | NamespaceExport
  | NamespaceExportDeclaration
  | NamespaceImport
  | NeverKeyword
  | NewExpression
  | NoSubstitutionTemplateLiteral
  | NonNullExpression
  | NotEmittedStatement
  | NotEmittedTypeElement
  | NullLiteral
  | NumberKeyword
  | NumericLiteral
  | ObjectBindingPattern
  | ObjectKeyword
  | ObjectLiteralExpression
  | OmittedExpression
  | OptionalTypeNode
  | ParameterDeclaration
  | ParenthesizedExpression
  | ParenthesizedTypeNode
  | PartiallyEmittedExpression
  | PostfixUnaryExpression
  | PrefixUnaryExpression
  | PrivateIdentifier
  | PropertyAccessEntityNameExpression
  | PropertyAccessExpression
  | PropertyAssignment
  | PropertyDeclaration
  | PropertySignature
  | QualifiedName
  | RegularExpressionLiteral
  | RestTypeNode
  | ReturnStatement
  | SatisfiesExpression
  | SemicolonClassElement
  | SetAccessorDeclaration
  | ShorthandPropertyAssignment
  | SourceFile
  | SpreadAssignment
  | SpreadElement
  | StringKeyword
  | StringLiteral
  | SuperExpression
  | SwitchStatement
  | SymbolKeyword
  | SyntheticExpression
  | TaggedTemplateExpression
  | TemplateExpression
  | TemplateHead
  | TemplateLiteralTypeNode
  | TemplateLiteralTypeSpan
  | TemplateMiddle
  | TemplateSpan
  | TemplateTail
  | ThisExpression
  | ThisTypeNode
  | ThrowStatement
  | TrueLiteral
  | TryStatement
  | TupleTypeNode
  | TypeAliasDeclaration
  | TypeAssertion
  | TypeLiteralNode
  | TypeOfExpression
  | TypeOperatorNode
  | TypeParameterDeclaration
  | TypePredicateNode
  | TypeQueryNode
  | TypeReferenceNode
  | UndefinedKeyword
  | UnionTypeNode
  | UnknownKeyword
  | VariableDeclaration
  | VariableDeclarationList
  | VariableStatement
  | VoidExpression
  | VoidKeyword
  | WhileStatement
  | WithStatement
  | YieldExpression;

export type Visitor<Data = undefined> = {
  AnyKeyword?(context: Context<Data>, node: AnyKeyword): void;
  AnyKeyword_exit?(context: Context<Data>, node: AnyKeyword): void;
  ArrayBindingPattern?(context: Context<Data>, node: ArrayBindingPattern): void;
  ArrayBindingPattern_exit?(context: Context<Data>, node: ArrayBindingPattern): void;
  ArrayLiteralExpression?(context: Context<Data>, node: ArrayLiteralExpression): void;
  ArrayLiteralExpression_exit?(context: Context<Data>, node: ArrayLiteralExpression): void;
  ArrayType?(context: Context<Data>, node: ArrayTypeNode): void;
  ArrayType_exit?(context: Context<Data>, node: ArrayTypeNode): void;
  ArrowFunction?(context: Context<Data>, node: ArrowFunction): void;
  ArrowFunction_exit?(context: Context<Data>, node: ArrowFunction): void;
  AsExpression?(context: Context<Data>, node: AsExpression): void;
  AsExpression_exit?(context: Context<Data>, node: AsExpression): void;
  AwaitExpression?(context: Context<Data>, node: AwaitExpression): void;
  AwaitExpression_exit?(context: Context<Data>, node: AwaitExpression): void;
  BigIntKeyword?(context: Context<Data>, node: BigIntKeyword): void;
  BigIntKeyword_exit?(context: Context<Data>, node: BigIntKeyword): void;
  BigIntLiteral?(context: Context<Data>, node: BigIntLiteral): void;
  BigIntLiteral_exit?(context: Context<Data>, node: BigIntLiteral): void;
  BinaryExpression?(context: Context<Data>, node: BinaryExpression): void;
  BinaryExpression_exit?(context: Context<Data>, node: BinaryExpression): void;
  BindingElement?(context: Context<Data>, node: BindingElement): void;
  BindingElement_exit?(context: Context<Data>, node: BindingElement): void;
  Block?(context: Context<Data>, node: Block): void;
  Block_exit?(context: Context<Data>, node: Block): void;
  BooleanKeyword?(context: Context<Data>, node: BooleanKeyword): void;
  BooleanKeyword_exit?(context: Context<Data>, node: BooleanKeyword): void;
  BreakStatement?(context: Context<Data>, node: BreakStatement): void;
  BreakStatement_exit?(context: Context<Data>, node: BreakStatement): void;
  CallExpression?(context: Context<Data>, node: CallExpression): void;
  CallExpression_exit?(context: Context<Data>, node: CallExpression): void;
  CallSignature?(context: Context<Data>, node: CallSignatureDeclaration): void;
  CallSignature_exit?(context: Context<Data>, node: CallSignatureDeclaration): void;
  CaseBlock?(context: Context<Data>, node: CaseBlock): void;
  CaseBlock_exit?(context: Context<Data>, node: CaseBlock): void;
  CaseClause?(context: Context<Data>, node: CaseClause): void;
  CaseClause_exit?(context: Context<Data>, node: CaseClause): void;
  CatchClause?(context: Context<Data>, node: CatchClause): void;
  CatchClause_exit?(context: Context<Data>, node: CatchClause): void;
  ClassDeclaration?(context: Context<Data>, node: ClassDeclaration): void;
  ClassDeclaration_exit?(context: Context<Data>, node: ClassDeclaration): void;
  ClassExpression?(context: Context<Data>, node: ClassExpression): void;
  ClassExpression_exit?(context: Context<Data>, node: ClassExpression): void;
  ClassStaticBlockDeclaration?(context: Context<Data>, node: ClassStaticBlockDeclaration): void;
  ClassStaticBlockDeclaration_exit?(context: Context<Data>, node: ClassStaticBlockDeclaration): void;
  CommaListExpression?(context: Context<Data>, node: CommaListExpression): void;
  CommaListExpression_exit?(context: Context<Data>, node: CommaListExpression): void;
  ComputedPropertyName?(context: Context<Data>, node: ComputedPropertyName): void;
  ComputedPropertyName_exit?(context: Context<Data>, node: ComputedPropertyName): void;
  ConditionalExpression?(context: Context<Data>, node: ConditionalExpression): void;
  ConditionalExpression_exit?(context: Context<Data>, node: ConditionalExpression): void;
  ConditionalType?(context: Context<Data>, node: ConditionalTypeNode): void;
  ConditionalType_exit?(context: Context<Data>, node: ConditionalTypeNode): void;
  ConstructSignature?(context: Context<Data>, node: ConstructSignatureDeclaration): void;
  ConstructSignature_exit?(context: Context<Data>, node: ConstructSignatureDeclaration): void;
  Constructor?(context: Context<Data>, node: ConstructorDeclaration): void;
  Constructor_exit?(context: Context<Data>, node: ConstructorDeclaration): void;
  ConstructorType?(context: Context<Data>, node: ConstructorTypeNode): void;
  ConstructorType_exit?(context: Context<Data>, node: ConstructorTypeNode): void;
  ContinueStatement?(context: Context<Data>, node: ContinueStatement): void;
  ContinueStatement_exit?(context: Context<Data>, node: ContinueStatement): void;
  DebuggerStatement?(context: Context<Data>, node: DebuggerStatement): void;
  DebuggerStatement_exit?(context: Context<Data>, node: DebuggerStatement): void;
  Decorator?(context: Context<Data>, node: Decorator): void;
  Decorator_exit?(context: Context<Data>, node: Decorator): void;
  DefaultClause?(context: Context<Data>, node: DefaultClause): void;
  DefaultClause_exit?(context: Context<Data>, node: DefaultClause): void;
  DeleteExpression?(context: Context<Data>, node: DeleteExpression): void;
  DeleteExpression_exit?(context: Context<Data>, node: DeleteExpression): void;
  DoStatement?(context: Context<Data>, node: DoStatement): void;
  DoStatement_exit?(context: Context<Data>, node: DoStatement): void;
  ElementAccessExpression?(context: Context<Data>, node: ElementAccessExpression): void;
  ElementAccessExpression_exit?(context: Context<Data>, node: ElementAccessExpression): void;
  EmptyStatement?(context: Context<Data>, node: EmptyStatement): void;
  EmptyStatement_exit?(context: Context<Data>, node: EmptyStatement): void;
  EnumDeclaration?(context: Context<Data>, node: EnumDeclaration): void;
  EnumDeclaration_exit?(context: Context<Data>, node: EnumDeclaration): void;
  EnumMember?(context: Context<Data>, node: EnumMember): void;
  EnumMember_exit?(context: Context<Data>, node: EnumMember): void;
  ExportAssignment?(context: Context<Data>, node: ExportAssignment): void;
  ExportAssignment_exit?(context: Context<Data>, node: ExportAssignment): void;
  ExportDeclaration?(context: Context<Data>, node: ExportDeclaration): void;
  ExportDeclaration_exit?(context: Context<Data>, node: ExportDeclaration): void;
  ExportSpecifier?(context: Context<Data>, node: ExportSpecifier): void;
  ExportSpecifier_exit?(context: Context<Data>, node: ExportSpecifier): void;
  ExpressionStatement?(context: Context<Data>, node: ExpressionStatement): void;
  ExpressionStatement_exit?(context: Context<Data>, node: ExpressionStatement): void;
  ExpressionWithTypeArguments?(context: Context<Data>, node: ExpressionWithTypeArguments): void;
  ExpressionWithTypeArguments_exit?(context: Context<Data>, node: ExpressionWithTypeArguments): void;
  ExternalModuleReference?(context: Context<Data>, node: ExternalModuleReference): void;
  ExternalModuleReference_exit?(context: Context<Data>, node: ExternalModuleReference): void;
  FalseKeyword?(context: Context<Data>, node: FalseLiteral): void;
  FalseKeyword_exit?(context: Context<Data>, node: FalseLiteral): void;
  ForInStatement?(context: Context<Data>, node: ForInStatement): void;
  ForInStatement_exit?(context: Context<Data>, node: ForInStatement): void;
  ForOfStatement?(context: Context<Data>, node: ForOfStatement): void;
  ForOfStatement_exit?(context: Context<Data>, node: ForOfStatement): void;
  ForStatement?(context: Context<Data>, node: ForStatement): void;
  ForStatement_exit?(context: Context<Data>, node: ForStatement): void;
  FunctionDeclaration?(context: Context<Data>, node: FunctionDeclaration): void;
  FunctionDeclaration_exit?(context: Context<Data>, node: FunctionDeclaration): void;
  FunctionExpression?(context: Context<Data>, node: FunctionExpression): void;
  FunctionExpression_exit?(context: Context<Data>, node: FunctionExpression): void;
  FunctionType?(context: Context<Data>, node: FunctionTypeNode): void;
  FunctionType_exit?(context: Context<Data>, node: FunctionTypeNode): void;
  GetAccessor?(context: Context<Data>, node: GetAccessorDeclaration): void;
  GetAccessor_exit?(context: Context<Data>, node: GetAccessorDeclaration): void;
  HeritageClause?(context: Context<Data>, node: HeritageClause): void;
  HeritageClause_exit?(context: Context<Data>, node: HeritageClause): void;
  Identifier?(context: Context<Data>, node: Identifier): void;
  Identifier_exit?(context: Context<Data>, node: Identifier): void;
  IfStatement?(context: Context<Data>, node: IfStatement): void;
  IfStatement_exit?(context: Context<Data>, node: IfStatement): void;
  ImportAttribute?(context: Context<Data>, node: ImportAttribute): void;
  ImportAttribute_exit?(context: Context<Data>, node: ImportAttribute): void;
  ImportAttributes?(context: Context<Data>, node: ImportAttributes): void;
  ImportAttributes_exit?(context: Context<Data>, node: ImportAttributes): void;
  ImportClause?(context: Context<Data>, node: ImportClause): void;
  ImportClause_exit?(context: Context<Data>, node: ImportClause): void;
  ImportDeclaration?(context: Context<Data>, node: ImportDeclaration): void;
  ImportDeclaration_exit?(context: Context<Data>, node: ImportDeclaration): void;
  ImportEqualsDeclaration?(context: Context<Data>, node: ImportEqualsDeclaration): void;
  ImportEqualsDeclaration_exit?(context: Context<Data>, node: ImportEqualsDeclaration): void;
  ImportKeyword?(context: Context<Data>, node: ImportExpression): void;
  ImportKeyword_exit?(context: Context<Data>, node: ImportExpression): void;
  ImportSpecifier?(context: Context<Data>, node: ImportSpecifier): void;
  ImportSpecifier_exit?(context: Context<Data>, node: ImportSpecifier): void;
  ImportType?(context: Context<Data>, node: ImportTypeNode): void;
  ImportType_exit?(context: Context<Data>, node: ImportTypeNode): void;
  IndexSignature?(context: Context<Data>, node: IndexSignatureDeclaration): void;
  IndexSignature_exit?(context: Context<Data>, node: IndexSignatureDeclaration): void;
  IndexedAccessType?(context: Context<Data>, node: IndexedAccessTypeNode): void;
  IndexedAccessType_exit?(context: Context<Data>, node: IndexedAccessTypeNode): void;
  InferType?(context: Context<Data>, node: InferTypeNode): void;
  InferType_exit?(context: Context<Data>, node: InferTypeNode): void;
  InterfaceDeclaration?(context: Context<Data>, node: InterfaceDeclaration): void;
  InterfaceDeclaration_exit?(context: Context<Data>, node: InterfaceDeclaration): void;
  IntersectionType?(context: Context<Data>, node: IntersectionTypeNode): void;
  IntersectionType_exit?(context: Context<Data>, node: IntersectionTypeNode): void;
  IntrinsicKeyword?(context: Context<Data>, node: IntrinsicKeyword): void;
  IntrinsicKeyword_exit?(context: Context<Data>, node: IntrinsicKeyword): void;
  JSDoc?(context: Context<Data>, node: JSDoc): void;
  JSDoc_exit?(context: Context<Data>, node: JSDoc): void;
  JSDocAllType?(context: Context<Data>, node: JSDocAllType): void;
  JSDocAllType_exit?(context: Context<Data>, node: JSDocAllType): void;
  JSDocAugmentsTag?(context: Context<Data>, node: JSDocAugmentsTag): void;
  JSDocAugmentsTag_exit?(context: Context<Data>, node: JSDocAugmentsTag): void;
  JSDocAuthorTag?(context: Context<Data>, node: JSDocAuthorTag): void;
  JSDocAuthorTag_exit?(context: Context<Data>, node: JSDocAuthorTag): void;
  JSDocCallbackTag?(context: Context<Data>, node: JSDocCallbackTag): void;
  JSDocCallbackTag_exit?(context: Context<Data>, node: JSDocCallbackTag): void;
  JSDocClassTag?(context: Context<Data>, node: JSDocClassTag): void;
  JSDocClassTag_exit?(context: Context<Data>, node: JSDocClassTag): void;
  JSDocDeprecatedTag?(context: Context<Data>, node: JSDocDeprecatedTag): void;
  JSDocDeprecatedTag_exit?(context: Context<Data>, node: JSDocDeprecatedTag): void;
  JSDocEnumTag?(context: Context<Data>, node: JSDocEnumTag): void;
  JSDocEnumTag_exit?(context: Context<Data>, node: JSDocEnumTag): void;
  JSDocFunctionType?(context: Context<Data>, node: JSDocFunctionType): void;
  JSDocFunctionType_exit?(context: Context<Data>, node: JSDocFunctionType): void;
  JSDocImplementsTag?(context: Context<Data>, node: JSDocImplementsTag): void;
  JSDocImplementsTag_exit?(context: Context<Data>, node: JSDocImplementsTag): void;
  JSDocImportTag?(context: Context<Data>, node: JSDocImportTag): void;
  JSDocImportTag_exit?(context: Context<Data>, node: JSDocImportTag): void;
  JSDocLink?(context: Context<Data>, node: JSDocLink): void;
  JSDocLink_exit?(context: Context<Data>, node: JSDocLink): void;
  JSDocLinkCode?(context: Context<Data>, node: JSDocLinkCode): void;
  JSDocLinkCode_exit?(context: Context<Data>, node: JSDocLinkCode): void;
  JSDocLinkPlain?(context: Context<Data>, node: JSDocLinkPlain): void;
  JSDocLinkPlain_exit?(context: Context<Data>, node: JSDocLinkPlain): void;
  JSDocMemberName?(context: Context<Data>, node: JSDocMemberName): void;
  JSDocMemberName_exit?(context: Context<Data>, node: JSDocMemberName): void;
  JSDocNameReference?(context: Context<Data>, node: JSDocNameReference): void;
  JSDocNameReference_exit?(context: Context<Data>, node: JSDocNameReference): void;
  JSDocNamepathType?(context: Context<Data>, node: JSDocNamepathType): void;
  JSDocNamepathType_exit?(context: Context<Data>, node: JSDocNamepathType): void;
  JSDocNonNullableType?(context: Context<Data>, node: JSDocNonNullableType): void;
  JSDocNonNullableType_exit?(context: Context<Data>, node: JSDocNonNullableType): void;
  JSDocNullableType?(context: Context<Data>, node: JSDocNullableType): void;
  JSDocNullableType_exit?(context: Context<Data>, node: JSDocNullableType): void;
  JSDocOptionalType?(context: Context<Data>, node: JSDocOptionalType): void;
  JSDocOptionalType_exit?(context: Context<Data>, node: JSDocOptionalType): void;
  JSDocOverloadTag?(context: Context<Data>, node: JSDocOverloadTag): void;
  JSDocOverloadTag_exit?(context: Context<Data>, node: JSDocOverloadTag): void;
  JSDocOverrideTag?(context: Context<Data>, node: JSDocOverrideTag): void;
  JSDocOverrideTag_exit?(context: Context<Data>, node: JSDocOverrideTag): void;
  JSDocParameterTag?(context: Context<Data>, node: JSDocParameterTag): void;
  JSDocParameterTag_exit?(context: Context<Data>, node: JSDocParameterTag): void;
  JSDocPrivateTag?(context: Context<Data>, node: JSDocPrivateTag): void;
  JSDocPrivateTag_exit?(context: Context<Data>, node: JSDocPrivateTag): void;
  JSDocPropertyTag?(context: Context<Data>, node: JSDocPropertyTag): void;
  JSDocPropertyTag_exit?(context: Context<Data>, node: JSDocPropertyTag): void;
  JSDocProtectedTag?(context: Context<Data>, node: JSDocProtectedTag): void;
  JSDocProtectedTag_exit?(context: Context<Data>, node: JSDocProtectedTag): void;
  JSDocPublicTag?(context: Context<Data>, node: JSDocPublicTag): void;
  JSDocPublicTag_exit?(context: Context<Data>, node: JSDocPublicTag): void;
  JSDocReadonlyTag?(context: Context<Data>, node: JSDocReadonlyTag): void;
  JSDocReadonlyTag_exit?(context: Context<Data>, node: JSDocReadonlyTag): void;
  JSDocReturnTag?(context: Context<Data>, node: JSDocReturnTag): void;
  JSDocReturnTag_exit?(context: Context<Data>, node: JSDocReturnTag): void;
  JSDocSatisfiesTag?(context: Context<Data>, node: JSDocSatisfiesTag): void;
  JSDocSatisfiesTag_exit?(context: Context<Data>, node: JSDocSatisfiesTag): void;
  JSDocSeeTag?(context: Context<Data>, node: JSDocSeeTag): void;
  JSDocSeeTag_exit?(context: Context<Data>, node: JSDocSeeTag): void;
  JSDocSignature?(context: Context<Data>, node: JSDocSignature): void;
  JSDocSignature_exit?(context: Context<Data>, node: JSDocSignature): void;
  JSDocTemplateTag?(context: Context<Data>, node: JSDocTemplateTag): void;
  JSDocTemplateTag_exit?(context: Context<Data>, node: JSDocTemplateTag): void;
  JSDocText?(context: Context<Data>, node: JSDocText): void;
  JSDocText_exit?(context: Context<Data>, node: JSDocText): void;
  JSDocThisTag?(context: Context<Data>, node: JSDocThisTag): void;
  JSDocThisTag_exit?(context: Context<Data>, node: JSDocThisTag): void;
  JSDocThrowsTag?(context: Context<Data>, node: JSDocThrowsTag): void;
  JSDocThrowsTag_exit?(context: Context<Data>, node: JSDocThrowsTag): void;
  JSDocTypeExpression?(context: Context<Data>, node: JSDocTypeExpression): void;
  JSDocTypeExpression_exit?(context: Context<Data>, node: JSDocTypeExpression): void;
  JSDocTypeLiteral?(context: Context<Data>, node: JSDocTypeLiteral): void;
  JSDocTypeLiteral_exit?(context: Context<Data>, node: JSDocTypeLiteral): void;
  JSDocTypeTag?(context: Context<Data>, node: JSDocTypeTag): void;
  JSDocTypeTag_exit?(context: Context<Data>, node: JSDocTypeTag): void;
  JSDocTypedefTag?(context: Context<Data>, node: JSDocTypedefTag): void;
  JSDocTypedefTag_exit?(context: Context<Data>, node: JSDocTypedefTag): void;
  JSDocTag?(context: Context<Data>, node: JSDocUnknownTag): void;
  JSDocTag_exit?(context: Context<Data>, node: JSDocUnknownTag): void;
  JSDocUnknownType?(context: Context<Data>, node: JSDocUnknownType): void;
  JSDocUnknownType_exit?(context: Context<Data>, node: JSDocUnknownType): void;
  JSDocVariadicType?(context: Context<Data>, node: JSDocVariadicType): void;
  JSDocVariadicType_exit?(context: Context<Data>, node: JSDocVariadicType): void;
  JsxAttribute?(context: Context<Data>, node: JsxAttribute): void;
  JsxAttribute_exit?(context: Context<Data>, node: JsxAttribute): void;
  JsxAttributes?(context: Context<Data>, node: JsxAttributes): void;
  JsxAttributes_exit?(context: Context<Data>, node: JsxAttributes): void;
  JsxClosingElement?(context: Context<Data>, node: JsxClosingElement): void;
  JsxClosingElement_exit?(context: Context<Data>, node: JsxClosingElement): void;
  JsxClosingFragment?(context: Context<Data>, node: JsxClosingFragment): void;
  JsxClosingFragment_exit?(context: Context<Data>, node: JsxClosingFragment): void;
  JsxElement?(context: Context<Data>, node: JsxElement): void;
  JsxElement_exit?(context: Context<Data>, node: JsxElement): void;
  JsxExpression?(context: Context<Data>, node: JsxExpression): void;
  JsxExpression_exit?(context: Context<Data>, node: JsxExpression): void;
  JsxFragment?(context: Context<Data>, node: JsxFragment): void;
  JsxFragment_exit?(context: Context<Data>, node: JsxFragment): void;
  JsxNamespacedName?(context: Context<Data>, node: JsxNamespacedName): void;
  JsxNamespacedName_exit?(context: Context<Data>, node: JsxNamespacedName): void;
  JsxOpeningElement?(context: Context<Data>, node: JsxOpeningElement): void;
  JsxOpeningElement_exit?(context: Context<Data>, node: JsxOpeningElement): void;
  JsxOpeningFragment?(context: Context<Data>, node: JsxOpeningFragment): void;
  JsxOpeningFragment_exit?(context: Context<Data>, node: JsxOpeningFragment): void;
  JsxSelfClosingElement?(context: Context<Data>, node: JsxSelfClosingElement): void;
  JsxSelfClosingElement_exit?(context: Context<Data>, node: JsxSelfClosingElement): void;
  JsxSpreadAttribute?(context: Context<Data>, node: JsxSpreadAttribute): void;
  JsxSpreadAttribute_exit?(context: Context<Data>, node: JsxSpreadAttribute): void;
  JsxText?(context: Context<Data>, node: JsxText): void;
  JsxText_exit?(context: Context<Data>, node: JsxText): void;
  LabeledStatement?(context: Context<Data>, node: LabeledStatement): void;
  LabeledStatement_exit?(context: Context<Data>, node: LabeledStatement): void;
  LiteralType?(context: Context<Data>, node: LiteralTypeNode): void;
  LiteralType_exit?(context: Context<Data>, node: LiteralTypeNode): void;
  MappedType?(context: Context<Data>, node: MappedTypeNode): void;
  MappedType_exit?(context: Context<Data>, node: MappedTypeNode): void;
  MetaProperty?(context: Context<Data>, node: MetaProperty): void;
  MetaProperty_exit?(context: Context<Data>, node: MetaProperty): void;
  MethodDeclaration?(context: Context<Data>, node: MethodDeclaration): void;
  MethodDeclaration_exit?(context: Context<Data>, node: MethodDeclaration): void;
  MethodSignature?(context: Context<Data>, node: MethodSignature): void;
  MethodSignature_exit?(context: Context<Data>, node: MethodSignature): void;
  MissingDeclaration?(context: Context<Data>, node: MissingDeclaration): void;
  MissingDeclaration_exit?(context: Context<Data>, node: MissingDeclaration): void;
  ModuleBlock?(context: Context<Data>, node: ModuleBlock): void;
  ModuleBlock_exit?(context: Context<Data>, node: ModuleBlock): void;
  ModuleDeclaration?(context: Context<Data>, node: ModuleDeclaration): void;
  ModuleDeclaration_exit?(context: Context<Data>, node: ModuleDeclaration): void;
  NamedExports?(context: Context<Data>, node: NamedExports): void;
  NamedExports_exit?(context: Context<Data>, node: NamedExports): void;
  NamedImports?(context: Context<Data>, node: NamedImports): void;
  NamedImports_exit?(context: Context<Data>, node: NamedImports): void;
  NamedTupleMember?(context: Context<Data>, node: NamedTupleMember): void;
  NamedTupleMember_exit?(context: Context<Data>, node: NamedTupleMember): void;
  NamespaceExport?(context: Context<Data>, node: NamespaceExport): void;
  NamespaceExport_exit?(context: Context<Data>, node: NamespaceExport): void;
  NamespaceExportDeclaration?(context: Context<Data>, node: NamespaceExportDeclaration): void;
  NamespaceExportDeclaration_exit?(context: Context<Data>, node: NamespaceExportDeclaration): void;
  NamespaceImport?(context: Context<Data>, node: NamespaceImport): void;
  NamespaceImport_exit?(context: Context<Data>, node: NamespaceImport): void;
  NeverKeyword?(context: Context<Data>, node: NeverKeyword): void;
  NeverKeyword_exit?(context: Context<Data>, node: NeverKeyword): void;
  NewExpression?(context: Context<Data>, node: NewExpression): void;
  NewExpression_exit?(context: Context<Data>, node: NewExpression): void;
  NoSubstitutionTemplateLiteral?(context: Context<Data>, node: NoSubstitutionTemplateLiteral): void;
  NoSubstitutionTemplateLiteral_exit?(context: Context<Data>, node: NoSubstitutionTemplateLiteral): void;
  NonNullExpression?(context: Context<Data>, node: NonNullExpression): void;
  NonNullExpression_exit?(context: Context<Data>, node: NonNullExpression): void;
  NotEmittedStatement?(context: Context<Data>, node: NotEmittedStatement): void;
  NotEmittedStatement_exit?(context: Context<Data>, node: NotEmittedStatement): void;
  NotEmittedTypeElement?(context: Context<Data>, node: NotEmittedTypeElement): void;
  NotEmittedTypeElement_exit?(context: Context<Data>, node: NotEmittedTypeElement): void;
  NullKeyword?(context: Context<Data>, node: NullLiteral): void;
  NullKeyword_exit?(context: Context<Data>, node: NullLiteral): void;
  NumberKeyword?(context: Context<Data>, node: NumberKeyword): void;
  NumberKeyword_exit?(context: Context<Data>, node: NumberKeyword): void;
  NumericLiteral?(context: Context<Data>, node: NumericLiteral): void;
  NumericLiteral_exit?(context: Context<Data>, node: NumericLiteral): void;
  ObjectBindingPattern?(context: Context<Data>, node: ObjectBindingPattern): void;
  ObjectBindingPattern_exit?(context: Context<Data>, node: ObjectBindingPattern): void;
  ObjectKeyword?(context: Context<Data>, node: ObjectKeyword): void;
  ObjectKeyword_exit?(context: Context<Data>, node: ObjectKeyword): void;
  ObjectLiteralExpression?(context: Context<Data>, node: ObjectLiteralExpression): void;
  ObjectLiteralExpression_exit?(context: Context<Data>, node: ObjectLiteralExpression): void;
  OmittedExpression?(context: Context<Data>, node: OmittedExpression): void;
  OmittedExpression_exit?(context: Context<Data>, node: OmittedExpression): void;
  OptionalType?(context: Context<Data>, node: OptionalTypeNode): void;
  OptionalType_exit?(context: Context<Data>, node: OptionalTypeNode): void;
  Parameter?(context: Context<Data>, node: ParameterDeclaration): void;
  Parameter_exit?(context: Context<Data>, node: ParameterDeclaration): void;
  ParenthesizedExpression?(context: Context<Data>, node: ParenthesizedExpression): void;
  ParenthesizedExpression_exit?(context: Context<Data>, node: ParenthesizedExpression): void;
  ParenthesizedType?(context: Context<Data>, node: ParenthesizedTypeNode): void;
  ParenthesizedType_exit?(context: Context<Data>, node: ParenthesizedTypeNode): void;
  PartiallyEmittedExpression?(context: Context<Data>, node: PartiallyEmittedExpression): void;
  PartiallyEmittedExpression_exit?(context: Context<Data>, node: PartiallyEmittedExpression): void;
  PostfixUnaryExpression?(context: Context<Data>, node: PostfixUnaryExpression): void;
  PostfixUnaryExpression_exit?(context: Context<Data>, node: PostfixUnaryExpression): void;
  PrefixUnaryExpression?(context: Context<Data>, node: PrefixUnaryExpression): void;
  PrefixUnaryExpression_exit?(context: Context<Data>, node: PrefixUnaryExpression): void;
  PrivateIdentifier?(context: Context<Data>, node: PrivateIdentifier): void;
  PrivateIdentifier_exit?(context: Context<Data>, node: PrivateIdentifier): void;
  PropertyAccessExpression?(context: Context<Data>, node: PropertyAccessEntityNameExpression): void;
  PropertyAccessExpression_exit?(context: Context<Data>, node: PropertyAccessEntityNameExpression): void;
  PropertyAccessExpression?(context: Context<Data>, node: PropertyAccessExpression): void;
  PropertyAccessExpression_exit?(context: Context<Data>, node: PropertyAccessExpression): void;
  PropertyAssignment?(context: Context<Data>, node: PropertyAssignment): void;
  PropertyAssignment_exit?(context: Context<Data>, node: PropertyAssignment): void;
  PropertyDeclaration?(context: Context<Data>, node: PropertyDeclaration): void;
  PropertyDeclaration_exit?(context: Context<Data>, node: PropertyDeclaration): void;
  PropertySignature?(context: Context<Data>, node: PropertySignature): void;
  PropertySignature_exit?(context: Context<Data>, node: PropertySignature): void;
  QualifiedName?(context: Context<Data>, node: QualifiedName): void;
  QualifiedName_exit?(context: Context<Data>, node: QualifiedName): void;
  RegularExpressionLiteral?(context: Context<Data>, node: RegularExpressionLiteral): void;
  RegularExpressionLiteral_exit?(context: Context<Data>, node: RegularExpressionLiteral): void;
  RestType?(context: Context<Data>, node: RestTypeNode): void;
  RestType_exit?(context: Context<Data>, node: RestTypeNode): void;
  ReturnStatement?(context: Context<Data>, node: ReturnStatement): void;
  ReturnStatement_exit?(context: Context<Data>, node: ReturnStatement): void;
  SatisfiesExpression?(context: Context<Data>, node: SatisfiesExpression): void;
  SatisfiesExpression_exit?(context: Context<Data>, node: SatisfiesExpression): void;
  SemicolonClassElement?(context: Context<Data>, node: SemicolonClassElement): void;
  SemicolonClassElement_exit?(context: Context<Data>, node: SemicolonClassElement): void;
  SetAccessor?(context: Context<Data>, node: SetAccessorDeclaration): void;
  SetAccessor_exit?(context: Context<Data>, node: SetAccessorDeclaration): void;
  ShorthandPropertyAssignment?(context: Context<Data>, node: ShorthandPropertyAssignment): void;
  ShorthandPropertyAssignment_exit?(context: Context<Data>, node: ShorthandPropertyAssignment): void;
  SourceFile?(context: Context<Data>, node: SourceFile): void;
  SourceFile_exit?(context: Context<Data>, node: SourceFile): void;
  SpreadAssignment?(context: Context<Data>, node: SpreadAssignment): void;
  SpreadAssignment_exit?(context: Context<Data>, node: SpreadAssignment): void;
  SpreadElement?(context: Context<Data>, node: SpreadElement): void;
  SpreadElement_exit?(context: Context<Data>, node: SpreadElement): void;
  StringKeyword?(context: Context<Data>, node: StringKeyword): void;
  StringKeyword_exit?(context: Context<Data>, node: StringKeyword): void;
  StringLiteral?(context: Context<Data>, node: StringLiteral): void;
  StringLiteral_exit?(context: Context<Data>, node: StringLiteral): void;
  SuperKeyword?(context: Context<Data>, node: SuperExpression): void;
  SuperKeyword_exit?(context: Context<Data>, node: SuperExpression): void;
  SwitchStatement?(context: Context<Data>, node: SwitchStatement): void;
  SwitchStatement_exit?(context: Context<Data>, node: SwitchStatement): void;
  SymbolKeyword?(context: Context<Data>, node: SymbolKeyword): void;
  SymbolKeyword_exit?(context: Context<Data>, node: SymbolKeyword): void;
  SyntheticExpression?(context: Context<Data>, node: SyntheticExpression): void;
  SyntheticExpression_exit?(context: Context<Data>, node: SyntheticExpression): void;
  TaggedTemplateExpression?(context: Context<Data>, node: TaggedTemplateExpression): void;
  TaggedTemplateExpression_exit?(context: Context<Data>, node: TaggedTemplateExpression): void;
  TemplateExpression?(context: Context<Data>, node: TemplateExpression): void;
  TemplateExpression_exit?(context: Context<Data>, node: TemplateExpression): void;
  TemplateHead?(context: Context<Data>, node: TemplateHead): void;
  TemplateHead_exit?(context: Context<Data>, node: TemplateHead): void;
  TemplateLiteralType?(context: Context<Data>, node: TemplateLiteralTypeNode): void;
  TemplateLiteralType_exit?(context: Context<Data>, node: TemplateLiteralTypeNode): void;
  TemplateLiteralTypeSpan?(context: Context<Data>, node: TemplateLiteralTypeSpan): void;
  TemplateLiteralTypeSpan_exit?(context: Context<Data>, node: TemplateLiteralTypeSpan): void;
  TemplateMiddle?(context: Context<Data>, node: TemplateMiddle): void;
  TemplateMiddle_exit?(context: Context<Data>, node: TemplateMiddle): void;
  TemplateSpan?(context: Context<Data>, node: TemplateSpan): void;
  TemplateSpan_exit?(context: Context<Data>, node: TemplateSpan): void;
  TemplateTail?(context: Context<Data>, node: TemplateTail): void;
  TemplateTail_exit?(context: Context<Data>, node: TemplateTail): void;
  ThisKeyword?(context: Context<Data>, node: ThisExpression): void;
  ThisKeyword_exit?(context: Context<Data>, node: ThisExpression): void;
  ThisType?(context: Context<Data>, node: ThisTypeNode): void;
  ThisType_exit?(context: Context<Data>, node: ThisTypeNode): void;
  ThrowStatement?(context: Context<Data>, node: ThrowStatement): void;
  ThrowStatement_exit?(context: Context<Data>, node: ThrowStatement): void;
  TrueKeyword?(context: Context<Data>, node: TrueLiteral): void;
  TrueKeyword_exit?(context: Context<Data>, node: TrueLiteral): void;
  TryStatement?(context: Context<Data>, node: TryStatement): void;
  TryStatement_exit?(context: Context<Data>, node: TryStatement): void;
  TupleType?(context: Context<Data>, node: TupleTypeNode): void;
  TupleType_exit?(context: Context<Data>, node: TupleTypeNode): void;
  TypeAliasDeclaration?(context: Context<Data>, node: TypeAliasDeclaration): void;
  TypeAliasDeclaration_exit?(context: Context<Data>, node: TypeAliasDeclaration): void;
  TypeAssertionExpression?(context: Context<Data>, node: TypeAssertion): void;
  TypeAssertionExpression_exit?(context: Context<Data>, node: TypeAssertion): void;
  TypeLiteral?(context: Context<Data>, node: TypeLiteralNode): void;
  TypeLiteral_exit?(context: Context<Data>, node: TypeLiteralNode): void;
  TypeOfExpression?(context: Context<Data>, node: TypeOfExpression): void;
  TypeOfExpression_exit?(context: Context<Data>, node: TypeOfExpression): void;
  TypeOperator?(context: Context<Data>, node: TypeOperatorNode): void;
  TypeOperator_exit?(context: Context<Data>, node: TypeOperatorNode): void;
  TypeParameter?(context: Context<Data>, node: TypeParameterDeclaration): void;
  TypeParameter_exit?(context: Context<Data>, node: TypeParameterDeclaration): void;
  TypePredicate?(context: Context<Data>, node: TypePredicateNode): void;
  TypePredicate_exit?(context: Context<Data>, node: TypePredicateNode): void;
  TypeQuery?(context: Context<Data>, node: TypeQueryNode): void;
  TypeQuery_exit?(context: Context<Data>, node: TypeQueryNode): void;
  TypeReference?(context: Context<Data>, node: TypeReferenceNode): void;
  TypeReference_exit?(context: Context<Data>, node: TypeReferenceNode): void;
  UndefinedKeyword?(context: Context<Data>, node: UndefinedKeyword): void;
  UndefinedKeyword_exit?(context: Context<Data>, node: UndefinedKeyword): void;
  UnionType?(context: Context<Data>, node: UnionTypeNode): void;
  UnionType_exit?(context: Context<Data>, node: UnionTypeNode): void;
  UnknownKeyword?(context: Context<Data>, node: UnknownKeyword): void;
  UnknownKeyword_exit?(context: Context<Data>, node: UnknownKeyword): void;
  VariableDeclaration?(context: Context<Data>, node: VariableDeclaration): void;
  VariableDeclaration_exit?(context: Context<Data>, node: VariableDeclaration): void;
  VariableDeclarationList?(context: Context<Data>, node: VariableDeclarationList): void;
  VariableDeclarationList_exit?(context: Context<Data>, node: VariableDeclarationList): void;
  VariableStatement?(context: Context<Data>, node: VariableStatement): void;
  VariableStatement_exit?(context: Context<Data>, node: VariableStatement): void;
  VoidExpression?(context: Context<Data>, node: VoidExpression): void;
  VoidExpression_exit?(context: Context<Data>, node: VoidExpression): void;
  VoidKeyword?(context: Context<Data>, node: VoidKeyword): void;
  VoidKeyword_exit?(context: Context<Data>, node: VoidKeyword): void;
  WhileStatement?(context: Context<Data>, node: WhileStatement): void;
  WhileStatement_exit?(context: Context<Data>, node: WhileStatement): void;
  WithStatement?(context: Context<Data>, node: WithStatement): void;
  WithStatement_exit?(context: Context<Data>, node: WithStatement): void;
  YieldExpression?(context: Context<Data>, node: YieldExpression): void;
  YieldExpression_exit?(context: Context<Data>, node: YieldExpression): void;
};
