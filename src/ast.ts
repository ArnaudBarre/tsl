/** Generated **/
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
  // parent is undefined but Node type doesn't allow it
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
  readonly parent: StatementParent;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name?: Identifier;
  readonly body?: FunctionBody;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
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
  readonly parent: ModifierParent;
}
export interface AccessorKeyword extends Node {
  readonly kind: SyntaxKind.AccessorKeyword;
  readonly parent: ModifierParent;
}
export interface AsyncKeyword extends Node {
  readonly kind: SyntaxKind.AsyncKeyword;
  readonly parent: ModifierParent;
}
export interface ConstKeyword extends Node {
  readonly kind: SyntaxKind.ConstKeyword;
  readonly parent: ModifierParent;
}
export interface DeclareKeyword extends Node {
  readonly kind: SyntaxKind.DeclareKeyword;
  readonly parent: ModifierParent;
}
export interface DefaultKeyword extends Node {
  readonly kind: SyntaxKind.DefaultKeyword;
  readonly parent: ModifierParent;
}
export interface ExportKeyword extends Node {
  readonly kind: SyntaxKind.ExportKeyword;
  readonly parent: ModifierParent;
}
export interface InKeyword extends Node {
  readonly kind: SyntaxKind.InKeyword;
  readonly parent: ModifierParent;
}
export interface PrivateKeyword extends Node {
  readonly kind: SyntaxKind.PrivateKeyword;
  readonly parent: ModifierParent;
}
export interface ProtectedKeyword extends Node {
  readonly kind: SyntaxKind.ProtectedKeyword;
  readonly parent: ModifierParent;
}
export interface PublicKeyword extends Node {
  readonly kind: SyntaxKind.PublicKeyword;
  readonly parent: ModifierParent;
}
export interface OutKeyword extends Node {
  readonly kind: SyntaxKind.OutKeyword;
  readonly parent: ModifierParent;
}
export interface OverrideKeyword extends Node {
  readonly kind: SyntaxKind.OverrideKeyword;
  readonly parent: ModifierParent;
}
export interface ReadonlyKeyword extends Node {
  readonly kind: SyntaxKind.ReadonlyKeyword;
  readonly parent: ModifierParent | MappedTypeNode;
}
export interface StaticKeyword extends Node {
  readonly kind: SyntaxKind.StaticKeyword;
  readonly parent: ModifierParent;
}
export interface Decorator extends Node {
  readonly kind: SyntaxKind.Decorator;
  readonly parent:
    | AccessorDeclaration
    | ParameterDeclaration
    | IndexSignatureDeclaration
    | MethodDeclaration
    | ClassExpression
    | PropertyDeclaration
    | ConstructorDeclaration
    | FunctionDeclaration
    | ClassDeclaration
    | InterfaceDeclaration
    | TypeAliasDeclaration
    | EnumDeclaration
    | ModuleDeclaration
    | NamespaceDeclaration
    | JSDocNamespaceDeclaration
    | ImportEqualsDeclaration
    | ExportDeclaration
    | ExportAssignment
    | VariableStatement
    | ImportDeclaration;
  readonly expression: LeftHandSideExpression;
}
export type LeftHandSideExpression = PartiallyEmittedExpression | MemberExpression | CallExpression | NonNullExpression;
export interface PartiallyEmittedExpression extends Node {
  readonly kind: SyntaxKind.PartiallyEmittedExpression;
  readonly parent: LeftHandSideExpressionParent;
  readonly expression: Expression;
}
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
  readonly parent: ExpressionParent | ArrayBindingPattern;
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
  readonly parent:
    | ExpressionParent
    | PrefixUnaryExpression
    | DeleteExpression
    | TypeOfExpression
    | VoidExpression
    | AwaitExpression
    | TypeAssertion
    | LiteralTypeNode;
  readonly operator: PrefixUnaryOperator;
  readonly operand: UnaryExpression;
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
  readonly parent:
    | ExpressionParent
    | PrefixUnaryExpression
    | DeleteExpression
    | TypeOfExpression
    | VoidExpression
    | AwaitExpression
    | TypeAssertion;
  readonly operand: LeftHandSideExpression;
  readonly operator: PostfixUnaryOperator;
}
export type PostfixUnaryOperator = SyntaxKind.PlusPlusToken | SyntaxKind.MinusMinusToken;
export interface DeleteExpression extends Node {
  readonly kind: SyntaxKind.DeleteExpression;
  readonly parent:
    | ExpressionParent
    | PrefixUnaryExpression
    | DeleteExpression
    | TypeOfExpression
    | VoidExpression
    | AwaitExpression
    | TypeAssertion;
  readonly expression: UnaryExpression;
}
export interface TypeOfExpression extends Node {
  readonly kind: SyntaxKind.TypeOfExpression;
  readonly parent:
    | ExpressionParent
    | PrefixUnaryExpression
    | DeleteExpression
    | TypeOfExpression
    | VoidExpression
    | AwaitExpression
    | TypeAssertion;
  readonly expression: UnaryExpression;
}
export interface VoidExpression extends Node {
  readonly kind: SyntaxKind.VoidExpression;
  readonly parent:
    | ExpressionParent
    | PrefixUnaryExpression
    | DeleteExpression
    | TypeOfExpression
    | VoidExpression
    | AwaitExpression
    | TypeAssertion;
  readonly expression: UnaryExpression;
}
export interface AwaitExpression extends Node {
  readonly kind: SyntaxKind.AwaitExpression;
  readonly parent:
    | ExpressionParent
    | PrefixUnaryExpression
    | DeleteExpression
    | TypeOfExpression
    | VoidExpression
    | AwaitExpression
    | TypeAssertion;
  readonly expression: UnaryExpression;
}
export interface TypeAssertion extends Node {
  readonly kind: SyntaxKind.TypeAssertionExpression;
  readonly parent:
    | ExpressionParent
    | PrefixUnaryExpression
    | DeleteExpression
    | TypeOfExpression
    | VoidExpression
    | AwaitExpression
    | TypeAssertion;
  readonly type: TypeNode;
  readonly expression: UnaryExpression;
}
export type TypeNode =
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
export interface ThisTypeNode extends Node {
  readonly kind: SyntaxKind.ThisType;
  readonly parent: TypeNodeParent;
}
export type FunctionOrConstructorTypeNodeBase = FunctionTypeNode | ConstructorTypeNode;
export interface FunctionTypeNode extends Node {
  readonly kind: SyntaxKind.FunctionType;
  readonly parent: TypeNodeParent;
  readonly type: TypeNode;
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
}
export type PropertyName =
  | Identifier
  | StringLiteral
  | NoSubstitutionTemplateLiteral
  | NumericLiteral
  | ComputedPropertyName
  | PrivateIdentifier;
export interface Identifier extends Node {
  readonly kind: SyntaxKind.Identifier;
  readonly parent:
    | IterationStatement
    | JsxAttributeLike
    | JSDocPropertyLikeTag
    | TypeElement
    | NodeWithTypeArguments
    | FunctionOrConstructorTypeNodeBase
    | DeclarationStatement
    | BindingElement
    | JSDocFunctionType
    | PropertyAssignment
    | SpreadAssignment
    | MethodDeclaration
    | PropertyDeclaration
    | ConstructorDeclaration
    | SemicolonClassElement
    | ClassStaticBlockDeclaration
    | EnumMember
    | TypeParameterDeclaration
    | ParameterDeclaration
    | VariableDeclaration
    | ImportAttribute
    | QualifiedName
    | JSDocLink
    | JSDocMemberName
    | JSDocLinkCode
    | JSDocLinkPlain
    | TypePredicateNode
    | NamedTupleMember
    | JSDocTemplateTag
    | JSDocReturnTag
    | JsxOpeningElement
    | JsxSelfClosingElement
    | JsxClosingElement
    | JsxTagNamePropertyAccess
    | PropertyAccessExpression
    | JsxNamespacedName
    | PostfixUnaryExpression
    | PrefixUnaryExpression
    | DeleteExpression
    | TypeOfExpression
    | VoidExpression
    | AwaitExpression
    | TypeAssertion
    | ComputedPropertyName
    | YieldExpression
    | BinaryExpression
    | ConditionalExpression
    | ArrowFunction
    | SpreadElement
    | AsExpression
    | SatisfiesExpression
    | JsxExpression
    | CommaListExpression
    | PartiallyEmittedExpression
    | TemplateSpan
    | ParenthesizedExpression
    | ArrayLiteralExpression
    | ShorthandPropertyAssignment
    | NewExpression
    | ElementAccessExpression
    | CallExpression
    | NonNullExpression
    | ExternalModuleReference
    | ExpressionStatement
    | IfStatement
    | ReturnStatement
    | WithStatement
    | SwitchStatement
    | CaseClause
    | ThrowStatement
    | ImportDeclaration
    | TaggedTemplateExpression
    | Decorator
    | FunctionExpression
    | MetaProperty
    | ClassExpression
    | NamespaceDeclaration
    | JSDocNamespaceDeclaration
    | NamespaceExport
    | ExportSpecifier
    | BreakStatement
    | ContinueStatement
    | LabeledStatement
    | ImportClause
    | NamespaceImport
    | ImportSpecifier;
  /**
   * Prefer to use `id.unescapedText`. (Note: This is available only in services, not internally to the TypeScript compiler.)
   * Text of identifier, but if the identifier begins with two underscores, this will begin with three.
   */
  readonly escapedText: __String;
  readonly text: string;
  /** @deprecated Use `idKeyword(identifier)` instead. */
  readonly originalKeywordKind?: SyntaxKind;
  /** @deprecated Use `.parent` or the surrounding context to determine this instead. */
  readonly isInJSDocNamespace?: boolean;
}
export interface StringLiteral extends Node {
  readonly kind: SyntaxKind.StringLiteral;
  readonly parent:
    | IterationStatement
    | JsxAttributeLike
    | TypeElement
    | FunctionOrConstructorTypeNodeBase
    | BindingElement
    | JSDocFunctionType
    | PropertyAssignment
    | SpreadAssignment
    | MethodDeclaration
    | PropertyDeclaration
    | ConstructorDeclaration
    | SemicolonClassElement
    | ClassStaticBlockDeclaration
    | EnumMember
    | ImportAttribute
    | LiteralTypeNode
    | PostfixUnaryExpression
    | PrefixUnaryExpression
    | DeleteExpression
    | TypeOfExpression
    | VoidExpression
    | AwaitExpression
    | TypeAssertion
    | ComputedPropertyName
    | TypeParameterDeclaration
    | ParameterDeclaration
    | YieldExpression
    | BinaryExpression
    | ConditionalExpression
    | ArrowFunction
    | SpreadElement
    | AsExpression
    | SatisfiesExpression
    | JsxExpression
    | CommaListExpression
    | PartiallyEmittedExpression
    | TemplateSpan
    | ParenthesizedExpression
    | ArrayLiteralExpression
    | ShorthandPropertyAssignment
    | NewExpression
    | ElementAccessExpression
    | CallExpression
    | NonNullExpression
    | ExternalModuleReference
    | ExportDeclaration
    | ExportAssignment
    | VariableDeclaration
    | ExpressionStatement
    | IfStatement
    | ReturnStatement
    | WithStatement
    | SwitchStatement
    | CaseClause
    | ThrowStatement
    | ImportDeclaration
    | ExpressionWithTypeArguments
    | PropertyAccessExpression
    | TaggedTemplateExpression
    | Decorator
    | ModuleDeclaration;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
}
export interface NoSubstitutionTemplateLiteral extends Node {
  readonly kind: SyntaxKind.NoSubstitutionTemplateLiteral;
  readonly parent:
    | LeftHandSideExpressionParent
    | TypeElement
    | FunctionOrConstructorTypeNodeBase
    | JSDocFunctionType
    | MethodDeclaration
    | ConstructorDeclaration
    | SemicolonClassElement
    | ClassStaticBlockDeclaration
    | LiteralTypeNode;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
  rawText?: string;
}
export interface NumericLiteral extends Node {
  readonly kind: SyntaxKind.NumericLiteral;
  readonly parent:
    | LeftHandSideExpressionParent
    | TypeElement
    | FunctionOrConstructorTypeNodeBase
    | JSDocFunctionType
    | MethodDeclaration
    | ConstructorDeclaration
    | SemicolonClassElement
    | ClassStaticBlockDeclaration
    | LiteralTypeNode;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
}
export interface ComputedPropertyName extends Node {
  readonly kind: SyntaxKind.ComputedPropertyName;
  readonly parent:
    | TypeElement
    | FunctionOrConstructorTypeNodeBase
    | BindingElement
    | JSDocFunctionType
    | JsxSpreadAttribute
    | PropertyAssignment
    | SpreadAssignment
    | MethodDeclaration
    | PropertyDeclaration
    | ConstructorDeclaration
    | SemicolonClassElement
    | ClassStaticBlockDeclaration
    | EnumMember;
  readonly expression: Expression;
}
export interface PrivateIdentifier extends Node {
  readonly kind: SyntaxKind.PrivateIdentifier;
  readonly parent:
    | LeftHandSideExpressionParent
    | TypeElement
    | FunctionOrConstructorTypeNodeBase
    | JSDocFunctionType
    | MethodDeclaration
    | ConstructorDeclaration
    | SemicolonClassElement
    | ClassStaticBlockDeclaration
    | JsxTagNamePropertyAccess;
  readonly escapedText: __String;
  readonly text: string;
}
export interface TypeParameterDeclaration extends Node {
  readonly kind: SyntaxKind.TypeParameter;
  readonly parent:
    | AccessorDeclaration
    | FunctionOrConstructorTypeNodeBase
    | CallSignatureDeclaration
    | ConstructSignatureDeclaration
    | MethodSignature
    | IndexSignatureDeclaration
    | InferTypeNode
    | MappedTypeNode
    | JSDocFunctionType
    | JSDocTemplateTag
    | ArrowFunction
    | FunctionExpression
    | MethodDeclaration
    | ClassExpression
    | ConstructorDeclaration
    | FunctionDeclaration
    | ClassDeclaration
    | InterfaceDeclaration
    | TypeAliasDeclaration;
  readonly modifiers?: NodeArray<Modifier>;
  readonly name: Identifier;
  /** Note: Consider calling `getEffectiveConstraintOfTypeParameter` */
  readonly constraint?: TypeNode;
  readonly default?: TypeNode;
  expression?: Expression;
}
export interface ParameterDeclaration extends Node {
  readonly kind: SyntaxKind.Parameter;
  readonly parent:
    | AccessorDeclaration
    | FunctionOrConstructorTypeNodeBase
    | CallSignatureDeclaration
    | ConstructSignatureDeclaration
    | MethodSignature
    | IndexSignatureDeclaration
    | JSDocFunctionType
    | SyntheticExpression
    | ArrowFunction
    | FunctionExpression
    | MethodDeclaration
    | ConstructorDeclaration
    | FunctionDeclaration;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly dotDotDotToken?: DotDotDotToken;
  readonly name: BindingName;
  readonly questionToken?: QuestionToken;
  readonly type?: TypeNode;
  readonly initializer?: Expression;
}
export interface DotDotDotToken extends Node {
  readonly kind: SyntaxKind.DotDotDotToken;
  readonly parent: ParameterDeclaration | BindingElement;
}
export type BindingName = Identifier | BindingPattern;
export type BindingPattern = ObjectBindingPattern | ArrayBindingPattern;
export interface ObjectBindingPattern extends Node {
  readonly kind: SyntaxKind.ObjectBindingPattern;
  readonly parent: BindingElement | ParameterDeclaration | VariableDeclaration;
  readonly elements: NodeArray<BindingElement>;
}
export interface BindingElement extends Node {
  readonly kind: SyntaxKind.BindingElement;
  readonly parent: BindingPattern;
  readonly propertyName?: PropertyName;
  readonly dotDotDotToken?: DotDotDotToken;
  readonly name: BindingName;
  readonly initializer?: Expression;
}
export interface ArrayBindingPattern extends Node {
  readonly kind: SyntaxKind.ArrayBindingPattern;
  readonly parent: BindingElement | ParameterDeclaration | VariableDeclaration;
  readonly elements: NodeArray<ArrayBindingElement>;
}
export type ArrayBindingElement = BindingElement | OmittedExpression;
export interface QuestionToken extends Node {
  readonly kind: SyntaxKind.QuestionToken;
  readonly parent:
    | TypeElement
    | ParameterDeclaration
    | MappedTypeNode
    | ConditionalExpression
    | ArrowFunction
    | FunctionExpression
    | MethodDeclaration
    | PropertyDeclaration
    | ConstructorDeclaration
    | FunctionDeclaration;
}
export interface ConstructorTypeNode extends Node {
  readonly kind: SyntaxKind.ConstructorType;
  readonly parent: TypeNodeParent;
  readonly modifiers?: NodeArray<Modifier>;
  readonly type: TypeNode;
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
}
export type NodeWithTypeArguments = ImportTypeNode | TypeReferenceNode | TypeQueryNode | ExpressionWithTypeArguments;
export interface ImportTypeNode extends Node {
  readonly kind: SyntaxKind.ImportType;
  readonly parent: TypeNodeParent;
  readonly isTypeOf: boolean;
  readonly argument: TypeNode;
  readonly attributes?: ImportAttributes;
  readonly qualifier?: EntityName;
  readonly typeArguments?: NodeArray<TypeNode>;
}
export interface ImportAttributes extends Node {
  readonly kind: SyntaxKind.ImportAttributes;
  readonly parent: ImportTypeNode | ExportDeclaration | ImportDeclaration;
  readonly token: SyntaxKind.WithKeyword | SyntaxKind.AssertKeyword;
  readonly elements: NodeArray<ImportAttribute>;
  readonly multiLine?: boolean;
}
export interface ImportAttribute extends Node {
  readonly kind: SyntaxKind.ImportAttribute;
  readonly parent: ImportAttributes;
  readonly name: ImportAttributeName;
  readonly value: Expression;
}
export type ImportAttributeName = Identifier | StringLiteral;
export type EntityName = Identifier | QualifiedName;
export interface QualifiedName extends Node {
  readonly kind: SyntaxKind.QualifiedName;
  readonly parent:
    | JSDocPropertyLikeTag
    | QualifiedName
    | ImportTypeNode
    | TypeReferenceNode
    | TypeQueryNode
    | JSDocLink
    | JSDocMemberName
    | JSDocLinkCode
    | JSDocLinkPlain
    | ImportEqualsDeclaration;
  readonly left: EntityName;
  readonly right: Identifier;
}
export interface TypeReferenceNode extends Node {
  readonly kind: SyntaxKind.TypeReference;
  readonly parent: TypeNodeParent;
  readonly typeName: EntityName;
  readonly typeArguments?: NodeArray<TypeNode>;
}
export interface TypeQueryNode extends Node {
  readonly kind: SyntaxKind.TypeQuery;
  readonly parent: TypeNodeParent;
  readonly exprName: EntityName;
  readonly typeArguments?: NodeArray<TypeNode>;
}
export interface ExpressionWithTypeArguments extends Node {
  readonly kind: SyntaxKind.ExpressionWithTypeArguments;
  readonly parent:
    | ExpressionParent
    | TypeElement
    | NodeWithTypeArguments
    | FunctionOrConstructorTypeNodeBase
    | TypePredicateNode
    | ArrayTypeNode
    | TupleTypeNode
    | NamedTupleMember
    | OptionalTypeNode
    | RestTypeNode
    | UnionTypeNode
    | IntersectionTypeNode
    | ConditionalTypeNode
    | ParenthesizedTypeNode
    | TypeOperatorNode
    | IndexedAccessTypeNode
    | MappedTypeNode
    | TemplateLiteralTypeSpan
    | JSDocTypeExpression
    | JSDocNonNullableType
    | JSDocNullableType
    | JSDocOptionalType
    | JSDocFunctionType
    | JSDocVariadicType
    | JSDocNamepathType
    | TypeAssertion
    | JsxOpeningElement
    | JsxSelfClosingElement
    | FunctionExpression
    | MethodDeclaration
    | ConstructorDeclaration
    | TaggedTemplateExpression
    | FunctionDeclaration
    | TypeAliasDeclaration
    | HeritageClause
    | PostfixUnaryExpression
    | PrefixUnaryExpression
    | DeleteExpression
    | TypeOfExpression
    | VoidExpression
    | AwaitExpression
    | PropertyAccessExpression
    | Decorator;
  readonly expression: LeftHandSideExpression;
  readonly typeArguments?: NodeArray<TypeNode>;
}
export interface TypePredicateNode extends Node {
  readonly kind: SyntaxKind.TypePredicate;
  readonly parent: TypeNodeParent;
  readonly assertsModifier?: AssertsKeyword;
  readonly parameterName: Identifier | ThisTypeNode;
  readonly type?: TypeNode;
}
export interface AssertsKeyword extends Node {
  readonly kind: SyntaxKind.AssertsKeyword;
  readonly parent: TypePredicateNode;
}
export interface TypeLiteralNode extends Node {
  readonly kind: SyntaxKind.TypeLiteral;
  readonly parent: TypeNodeParent;
  readonly members: NodeArray<TypeElement>;
}
export type TypeElement =
  | CallSignatureDeclaration
  | ConstructSignatureDeclaration
  | PropertySignature
  | MethodSignature
  | GetAccessorDeclaration
  | SetAccessorDeclaration
  | IndexSignatureDeclaration;
export interface CallSignatureDeclaration extends Node {
  readonly kind: SyntaxKind.CallSignature;
  readonly parent: TypeLiteralNode | MappedTypeNode | InterfaceDeclaration;
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  readonly questionToken?: QuestionToken | undefined;
}
export interface ConstructSignatureDeclaration extends Node {
  readonly kind: SyntaxKind.ConstructSignature;
  readonly parent: TypeLiteralNode | MappedTypeNode | InterfaceDeclaration;
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  readonly questionToken?: QuestionToken | undefined;
}
export interface PropertySignature extends Node {
  readonly kind: SyntaxKind.PropertySignature;
  readonly parent: TypeLiteralNode | MappedTypeNode | InterfaceDeclaration;
  readonly modifiers?: NodeArray<Modifier>;
  readonly name: PropertyName;
  readonly questionToken?: QuestionToken;
  readonly type?: TypeNode;
}
export interface MethodSignature extends Node {
  readonly kind: SyntaxKind.MethodSignature;
  readonly parent: TypeLiteralNode | MappedTypeNode | InterfaceDeclaration;
  readonly modifiers?: NodeArray<Modifier>;
  readonly name: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  readonly questionToken?: QuestionToken | undefined;
}
export interface GetAccessorDeclaration extends Node {
  readonly kind: SyntaxKind.GetAccessor;
  readonly parent:
    | ObjectLiteralExpressionBase
    | TypeLiteralNode
    | MappedTypeNode
    | InterfaceDeclaration
    | ClassExpression
    | ClassDeclaration;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: PropertyName;
  readonly body?: FunctionBody;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
}
export type FunctionBody = Block;
export interface Block extends Node {
  readonly kind: SyntaxKind.Block;
  readonly parent:
    | StatementParent
    | AccessorDeclaration
    | ArrowFunction
    | FunctionExpression
    | MethodDeclaration
    | ConstructorDeclaration
    | FunctionDeclaration
    | ClassStaticBlockDeclaration
    | TryStatement
    | CatchClause;
  readonly statements: NodeArray<Statement>;
}
export interface AsteriskToken extends Node {
  readonly kind: SyntaxKind.AsteriskToken;
  readonly parent:
    | AccessorDeclaration
    | YieldExpression
    | ArrowFunction
    | FunctionExpression
    | MethodDeclaration
    | ConstructorDeclaration
    | FunctionDeclaration;
}
export interface ExclamationToken extends Node {
  readonly kind: SyntaxKind.ExclamationToken;
  readonly parent:
    | AccessorDeclaration
    | ArrowFunction
    | FunctionExpression
    | MethodDeclaration
    | PropertyDeclaration
    | ConstructorDeclaration
    | FunctionDeclaration
    | VariableDeclaration;
}
export interface SetAccessorDeclaration extends Node {
  readonly kind: SyntaxKind.SetAccessor;
  readonly parent:
    | ObjectLiteralExpressionBase
    | TypeLiteralNode
    | MappedTypeNode
    | InterfaceDeclaration
    | ClassExpression
    | ClassDeclaration;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: PropertyName;
  readonly body?: FunctionBody;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
}
export interface IndexSignatureDeclaration extends Node {
  readonly kind: SyntaxKind.IndexSignature;
  readonly parent: TypeLiteralNode | MappedTypeNode | InterfaceDeclaration | ClassExpression | ClassDeclaration;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly type: TypeNode;
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly questionToken?: QuestionToken | undefined;
}
export interface ArrayTypeNode extends Node {
  readonly kind: SyntaxKind.ArrayType;
  readonly parent: TypeNodeParent;
  readonly elementType: TypeNode;
}
export interface TupleTypeNode extends Node {
  readonly kind: SyntaxKind.TupleType;
  readonly parent: TypeNodeParent;
  readonly elements: NodeArray<TypeNode | NamedTupleMember>;
}
export interface NamedTupleMember extends Node {
  readonly kind: SyntaxKind.NamedTupleMember;
  readonly parent: TypeNodeParent | SyntheticExpression;
  readonly dotDotDotToken?: Token<SyntaxKind.DotDotDotToken, NamedTupleMember>;
  readonly name: Identifier;
  readonly questionToken?: Token<SyntaxKind.QuestionToken, NamedTupleMember>;
  readonly type: TypeNode;
}
export interface OptionalTypeNode extends Node {
  readonly kind: SyntaxKind.OptionalType;
  readonly parent: TypeNodeParent;
  readonly type: TypeNode;
}
export interface RestTypeNode extends Node {
  readonly kind: SyntaxKind.RestType;
  readonly parent: TypeNodeParent;
  readonly type: TypeNode;
}
export interface UnionTypeNode extends Node {
  readonly kind: SyntaxKind.UnionType;
  readonly parent: TypeNodeParent;
  readonly types: NodeArray<TypeNode>;
}
export interface IntersectionTypeNode extends Node {
  readonly kind: SyntaxKind.IntersectionType;
  readonly parent: TypeNodeParent;
  readonly types: NodeArray<TypeNode>;
}
export interface ConditionalTypeNode extends Node {
  readonly kind: SyntaxKind.ConditionalType;
  readonly parent: TypeNodeParent;
  readonly checkType: TypeNode;
  readonly extendsType: TypeNode;
  readonly trueType: TypeNode;
  readonly falseType: TypeNode;
}
export interface InferTypeNode extends Node {
  readonly kind: SyntaxKind.InferType;
  readonly parent: TypeNodeParent;
  readonly typeParameter: TypeParameterDeclaration;
}
export interface ParenthesizedTypeNode extends Node {
  readonly kind: SyntaxKind.ParenthesizedType;
  readonly parent: TypeNodeParent;
  readonly type: TypeNode;
}
export interface TypeOperatorNode extends Node {
  readonly kind: SyntaxKind.TypeOperator;
  readonly parent: TypeNodeParent;
  readonly operator: SyntaxKind.KeyOfKeyword | SyntaxKind.UniqueKeyword | SyntaxKind.ReadonlyKeyword;
  readonly type: TypeNode;
}
export interface IndexedAccessTypeNode extends Node {
  readonly kind: SyntaxKind.IndexedAccessType;
  readonly parent: TypeNodeParent;
  readonly objectType: TypeNode;
  readonly indexType: TypeNode;
}
export interface MappedTypeNode extends Node {
  readonly kind: SyntaxKind.MappedType;
  readonly parent: TypeNodeParent;
  readonly readonlyToken?: ReadonlyKeyword | PlusToken | MinusToken;
  readonly typeParameter: TypeParameterDeclaration;
  readonly nameType?: TypeNode;
  readonly questionToken?: QuestionToken | PlusToken | MinusToken;
  readonly type?: TypeNode;
  /** Used only to produce grammar errors */
  readonly members?: NodeArray<TypeElement>;
}
export interface PlusToken extends Node {
  readonly kind: SyntaxKind.PlusToken;
  readonly parent: MappedTypeNode;
}
export interface MinusToken extends Node {
  readonly kind: SyntaxKind.MinusToken;
  readonly parent: MappedTypeNode;
}
export interface LiteralTypeNode extends Node {
  readonly kind: SyntaxKind.LiteralType;
  readonly parent: TypeNodeParent;
  readonly literal: NullLiteral | BooleanLiteral | LiteralExpression | PrefixUnaryExpression;
}
export interface NullLiteral extends Node {
  readonly kind: SyntaxKind.NullKeyword;
  readonly parent: LeftHandSideExpressionParent | LiteralTypeNode;
}
export type BooleanLiteral = TrueLiteral | FalseLiteral;
export interface TrueLiteral extends Node {
  readonly kind: SyntaxKind.TrueKeyword;
  readonly parent: LeftHandSideExpressionParent | LiteralTypeNode;
}
export interface FalseLiteral extends Node {
  readonly kind: SyntaxKind.FalseKeyword;
  readonly parent: LeftHandSideExpressionParent | LiteralTypeNode;
}
export type LiteralExpression =
  | StringLiteral
  | RegularExpressionLiteral
  | NoSubstitutionTemplateLiteral
  | NumericLiteral
  | BigIntLiteral;
export interface RegularExpressionLiteral extends Node {
  readonly kind: SyntaxKind.RegularExpressionLiteral;
  readonly parent: LeftHandSideExpressionParent | LiteralTypeNode;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
}
export interface BigIntLiteral extends Node {
  readonly kind: SyntaxKind.BigIntLiteral;
  readonly parent: LeftHandSideExpressionParent | LiteralTypeNode;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
}
export interface TemplateLiteralTypeNode extends Node {
  readonly kind: SyntaxKind.TemplateLiteralType;
  readonly parent: TypeNodeParent;
  readonly head: TemplateHead;
  readonly templateSpans: NodeArray<TemplateLiteralTypeSpan>;
}
export interface TemplateHead extends Node {
  readonly kind: SyntaxKind.TemplateHead;
  readonly parent: TemplateLiteralTypeNode | TemplateExpression;
  rawText?: string;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
}
export interface TemplateLiteralTypeSpan extends Node {
  readonly kind: SyntaxKind.TemplateLiteralTypeSpan;
  readonly parent: TypeNodeParent | TemplateLiteralTypeNode;
  readonly type: TypeNode;
  readonly literal: TemplateMiddle | TemplateTail;
}
export interface TemplateMiddle extends Node {
  readonly kind: SyntaxKind.TemplateMiddle;
  readonly parent: TemplateLiteralTypeSpan | TemplateSpan;
  rawText?: string;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
}
export interface TemplateTail extends Node {
  readonly kind: SyntaxKind.TemplateTail;
  readonly parent: TemplateLiteralTypeSpan | TemplateSpan;
  rawText?: string;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
}
export interface JSDocTypeExpression extends Node {
  readonly kind: SyntaxKind.JSDocTypeExpression;
  readonly parent: TypeNodeParent | JSDocPropertyLikeTag | JSDocTemplateTag | JSDocReturnTag;
  readonly type: TypeNode;
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
  readonly parent: TypeNodeParent;
}
export interface JSDocUnknownType extends Node {
  readonly kind: SyntaxKind.JSDocUnknownType;
  readonly parent: TypeNodeParent;
}
export interface JSDocNonNullableType extends Node {
  readonly kind: SyntaxKind.JSDocNonNullableType;
  readonly parent: TypeNodeParent;
  readonly type: TypeNode;
  readonly postfix: boolean;
}
export interface JSDocNullableType extends Node {
  readonly kind: SyntaxKind.JSDocNullableType;
  readonly parent: TypeNodeParent;
  readonly type: TypeNode;
  readonly postfix: boolean;
}
export interface JSDocOptionalType extends Node {
  readonly kind: SyntaxKind.JSDocOptionalType;
  readonly parent: TypeNodeParent;
  readonly type: TypeNode;
}
export interface JSDocFunctionType extends Node {
  readonly kind: SyntaxKind.JSDocFunctionType;
  readonly parent: TypeNodeParent;
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
}
export interface JSDocVariadicType extends Node {
  readonly kind: SyntaxKind.JSDocVariadicType;
  readonly parent: TypeNodeParent;
  readonly type: TypeNode;
}
export interface JSDocNamepathType extends Node {
  readonly kind: SyntaxKind.JSDocNamepathType;
  readonly parent: TypeNodeParent;
  readonly type: TypeNode;
}
export interface JSDocSignature extends Node {
  readonly kind: SyntaxKind.JSDocSignature;
  readonly parent: TypeNodeParent;
  readonly typeParameters?: readonly JSDocTemplateTag[];
  readonly parameters: readonly JSDocParameterTag[];
  readonly type: JSDocReturnTag | undefined;
}
export interface JSDocTemplateTag extends Node {
  readonly kind: SyntaxKind.JSDocTemplateTag;
  readonly parent: JSDocSignature;
  readonly constraint: JSDocTypeExpression | undefined;
  readonly typeParameters: NodeArray<TypeParameterDeclaration>;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export type JSDocComment = JSDocText | JSDocLink | JSDocLinkCode | JSDocLinkPlain;
export interface JSDocText extends Node {
  readonly kind: SyntaxKind.JSDocText;
  readonly parent: JSDocPropertyLikeTag | JSDocTemplateTag | JSDocReturnTag;
  text: string;
}
export interface JSDocLink extends Node {
  readonly kind: SyntaxKind.JSDocLink;
  readonly parent: JSDocPropertyLikeTag | JSDocTemplateTag | JSDocReturnTag;
  readonly name?: EntityName | JSDocMemberName;
  text: string;
}
export interface JSDocMemberName extends Node {
  readonly kind: SyntaxKind.JSDocMemberName;
  readonly parent: JSDocMemberName | JSDocLink | JSDocLinkCode | JSDocLinkPlain;
  readonly left: EntityName | JSDocMemberName;
  readonly right: Identifier;
}
export interface JSDocLinkCode extends Node {
  readonly kind: SyntaxKind.JSDocLinkCode;
  readonly parent: JSDocPropertyLikeTag | JSDocTemplateTag | JSDocReturnTag;
  readonly name?: EntityName | JSDocMemberName;
  text: string;
}
export interface JSDocLinkPlain extends Node {
  readonly kind: SyntaxKind.JSDocLinkPlain;
  readonly parent: JSDocPropertyLikeTag | JSDocTemplateTag | JSDocReturnTag;
  readonly name?: EntityName | JSDocMemberName;
  text: string;
}
export interface JSDocParameterTag extends Node {
  readonly kind: SyntaxKind.JSDocParameterTag;
  readonly parent: JSDocSignature | JSDocTypeLiteral;
  readonly name: EntityName;
  readonly typeExpression?: JSDocTypeExpression;
  /** Whether the property name came before the type -- non-standard for JSDoc, but Typescript-like */
  readonly isNameFirst: boolean;
  readonly isBracketed: boolean;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocReturnTag extends Node {
  readonly kind: SyntaxKind.JSDocReturnTag;
  readonly parent: JSDocSignature;
  readonly typeExpression?: JSDocTypeExpression;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface JSDocTypeLiteral extends Node {
  readonly kind: SyntaxKind.JSDocTypeLiteral;
  readonly parent: TypeNodeParent;
  readonly jsDocPropertyTags?: readonly JSDocPropertyLikeTag[];
  /** If true, then this type literal represents an *array* of its type. */
  readonly isArrayType: boolean;
}
export type JSDocPropertyLikeTag = JSDocPropertyTag | JSDocParameterTag;
export interface JSDocPropertyTag extends Node {
  readonly kind: SyntaxKind.JSDocPropertyTag;
  readonly parent: JSDocTypeLiteral;
  readonly name: EntityName;
  readonly typeExpression?: JSDocTypeExpression;
  /** Whether the property name came before the type -- non-standard for JSDoc, but Typescript-like */
  readonly isNameFirst: boolean;
  readonly isBracketed: boolean;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
}
export interface YieldExpression extends Node {
  readonly kind: SyntaxKind.YieldExpression;
  readonly parent: ExpressionParent;
  readonly asteriskToken?: AsteriskToken;
  readonly expression?: Expression;
}
export interface SyntheticExpression extends Node {
  readonly kind: SyntaxKind.SyntheticExpression;
  readonly parent: ExpressionParent;
  readonly isSpread: boolean;
  readonly type: Type;
  readonly tupleNameSource?: ParameterDeclaration | NamedTupleMember;
}
export interface BinaryExpression extends Node {
  readonly kind: SyntaxKind.BinaryExpression;
  readonly parent: ExpressionParent;
  readonly left: Expression;
  readonly operatorToken: BinaryOperatorToken;
  readonly right: Expression;
}
export interface BinaryOperatorToken extends Node {
  readonly kind: BinaryOperator;
  readonly parent: BinaryExpression;
}
export type BinaryOperator = AssignmentOperatorOrHigher | SyntaxKind.CommaToken;
export type AssignmentOperatorOrHigher =
  | SyntaxKind.QuestionQuestionToken
  | LogicalOperatorOrHigher
  | AssignmentOperator;
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
export interface ConditionalExpression extends Node {
  readonly kind: SyntaxKind.ConditionalExpression;
  readonly parent: ExpressionParent;
  readonly condition: Expression;
  readonly questionToken: QuestionToken;
  readonly whenTrue: Expression;
  readonly colonToken: ColonToken;
  readonly whenFalse: Expression;
}
export interface ColonToken extends Node {
  readonly kind: SyntaxKind.ColonToken;
  readonly parent: ConditionalExpression;
}
export interface ArrowFunction extends Node {
  readonly kind: SyntaxKind.ArrowFunction;
  readonly parent: ExpressionParent;
  readonly modifiers?: NodeArray<Modifier>;
  readonly equalsGreaterThanToken: EqualsGreaterThanToken;
  readonly body: ConciseBody;
  readonly name: never;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
}
export interface EqualsGreaterThanToken extends Node {
  readonly kind: SyntaxKind.EqualsGreaterThanToken;
  readonly parent: ArrowFunction;
}
export type ConciseBody = FunctionBody | Expression;
export interface SpreadElement extends Node {
  readonly kind: SyntaxKind.SpreadElement;
  readonly parent: ExpressionParent;
  readonly expression: Expression;
}
export interface AsExpression extends Node {
  readonly kind: SyntaxKind.AsExpression;
  readonly parent: ExpressionParent;
  readonly expression: Expression;
  readonly type: TypeNode;
}
export interface SatisfiesExpression extends Node {
  readonly kind: SyntaxKind.SatisfiesExpression;
  readonly parent: ExpressionParent;
  readonly expression: Expression;
  readonly type: TypeNode;
}
export interface JsxOpeningElement extends Node {
  readonly kind: SyntaxKind.JsxOpeningElement;
  readonly parent: ExpressionParent | JsxElement;
  readonly tagName: JsxTagNameExpression;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly attributes: JsxAttributes;
}
export type JsxTagNameExpression = Identifier | ThisExpression | JsxTagNamePropertyAccess | JsxNamespacedName;
export interface ThisExpression extends Node {
  readonly kind: SyntaxKind.ThisKeyword;
  readonly parent:
    | LeftHandSideExpressionParent
    | JsxOpeningElement
    | JsxSelfClosingElement
    | JsxClosingElement
    | JsxTagNamePropertyAccess;
}
export interface JsxTagNamePropertyAccess extends Node {
  readonly kind: SyntaxKind.PropertyAccessExpression;
  readonly parent: JsxTagNamePropertyAccess | JsxOpeningElement | JsxSelfClosingElement | JsxClosingElement;
  readonly expression: Identifier | ThisExpression | JsxTagNamePropertyAccess;
  readonly questionDotToken?: QuestionDotToken;
  readonly name: MemberName;
}
export interface QuestionDotToken extends Node {
  readonly kind: SyntaxKind.QuestionDotToken;
  readonly parent: JsxTagNamePropertyAccess | PropertyAccessExpression | ElementAccessExpression | CallExpression;
}
export type MemberName = Identifier | PrivateIdentifier;
export interface JsxNamespacedName extends Node {
  readonly kind: SyntaxKind.JsxNamespacedName;
  readonly parent: JsxOpeningElement | JsxSelfClosingElement | JsxClosingElement | JsxAttribute;
  readonly name: Identifier;
  readonly namespace: Identifier;
}
export interface JsxAttributes extends Node {
  readonly kind: SyntaxKind.JsxAttributes;
  readonly parent: LeftHandSideExpressionParent | JsxSelfClosingElement | JsxOpeningElement;
  readonly properties: NodeArray<JsxAttributeLike>;
}
export type JsxAttributeLike = JsxAttribute | JsxSpreadAttribute;
export interface JsxAttribute extends Node {
  readonly kind: SyntaxKind.JsxAttribute;
  readonly parent: JsxAttributes;
  readonly name: JsxAttributeName;
  readonly initializer?: JsxAttributeValue;
}
export type JsxAttributeName = Identifier | JsxNamespacedName;
export type JsxAttributeValue = StringLiteral | JsxExpression | JsxElement | JsxSelfClosingElement | JsxFragment;
export interface JsxExpression extends Node {
  readonly kind: SyntaxKind.JsxExpression;
  readonly parent:
    | IterationStatement
    | JsxAttributeLike
    | JsxFragment
    | JsxElement
    | ComputedPropertyName
    | TypeParameterDeclaration
    | BindingElement
    | ParameterDeclaration
    | ImportAttribute
    | YieldExpression
    | BinaryExpression
    | ConditionalExpression
    | ArrowFunction
    | SpreadElement
    | AsExpression
    | SatisfiesExpression
    | JsxExpression
    | CommaListExpression
    | PartiallyEmittedExpression
    | TemplateSpan
    | ParenthesizedExpression
    | ArrayLiteralExpression
    | PropertyAssignment
    | ShorthandPropertyAssignment
    | SpreadAssignment
    | NewExpression
    | PropertyDeclaration
    | ElementAccessExpression
    | CallExpression
    | NonNullExpression
    | EnumMember
    | ExternalModuleReference
    | ExportDeclaration
    | ExportAssignment
    | VariableDeclaration
    | ExpressionStatement
    | IfStatement
    | ReturnStatement
    | WithStatement
    | SwitchStatement
    | CaseClause
    | ThrowStatement
    | ImportDeclaration;
  readonly dotDotDotToken?: Token<SyntaxKind.DotDotDotToken, JsxExpression>;
  readonly expression?: Expression;
}
export interface JsxElement extends Node {
  readonly kind: SyntaxKind.JsxElement;
  readonly parent:
    | IterationStatement
    | JsxAttributeLike
    | JsxFragment
    | JsxElement
    | PostfixUnaryExpression
    | PrefixUnaryExpression
    | DeleteExpression
    | TypeOfExpression
    | VoidExpression
    | AwaitExpression
    | TypeAssertion
    | ComputedPropertyName
    | TypeParameterDeclaration
    | BindingElement
    | ParameterDeclaration
    | ImportAttribute
    | YieldExpression
    | BinaryExpression
    | ConditionalExpression
    | ArrowFunction
    | SpreadElement
    | AsExpression
    | SatisfiesExpression
    | JsxExpression
    | CommaListExpression
    | PartiallyEmittedExpression
    | TemplateSpan
    | ParenthesizedExpression
    | ArrayLiteralExpression
    | PropertyAssignment
    | ShorthandPropertyAssignment
    | SpreadAssignment
    | NewExpression
    | PropertyDeclaration
    | ElementAccessExpression
    | CallExpression
    | NonNullExpression
    | EnumMember
    | ExternalModuleReference
    | ExportDeclaration
    | ExportAssignment
    | VariableDeclaration
    | ExpressionStatement
    | IfStatement
    | ReturnStatement
    | WithStatement
    | SwitchStatement
    | CaseClause
    | ThrowStatement
    | ImportDeclaration
    | ExpressionWithTypeArguments
    | PropertyAccessExpression
    | TaggedTemplateExpression
    | Decorator;
  readonly openingElement: JsxOpeningElement;
  readonly children: NodeArray<JsxChild>;
  readonly closingElement: JsxClosingElement;
}
export type JsxChild = JsxText | JsxExpression | JsxElement | JsxSelfClosingElement | JsxFragment;
export interface JsxText extends Node {
  readonly kind: SyntaxKind.JsxText;
  readonly parent: JsxFragment | JsxElement;
  readonly containsOnlyTriviaWhiteSpaces: boolean;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
}
export interface JsxSelfClosingElement extends Node {
  readonly kind: SyntaxKind.JsxSelfClosingElement;
  readonly parent:
    | IterationStatement
    | JsxAttributeLike
    | JsxFragment
    | JsxElement
    | PostfixUnaryExpression
    | PrefixUnaryExpression
    | DeleteExpression
    | TypeOfExpression
    | VoidExpression
    | AwaitExpression
    | TypeAssertion
    | ComputedPropertyName
    | TypeParameterDeclaration
    | BindingElement
    | ParameterDeclaration
    | ImportAttribute
    | YieldExpression
    | BinaryExpression
    | ConditionalExpression
    | ArrowFunction
    | SpreadElement
    | AsExpression
    | SatisfiesExpression
    | JsxExpression
    | CommaListExpression
    | PartiallyEmittedExpression
    | TemplateSpan
    | ParenthesizedExpression
    | ArrayLiteralExpression
    | PropertyAssignment
    | ShorthandPropertyAssignment
    | SpreadAssignment
    | NewExpression
    | PropertyDeclaration
    | ElementAccessExpression
    | CallExpression
    | NonNullExpression
    | EnumMember
    | ExternalModuleReference
    | ExportDeclaration
    | ExportAssignment
    | VariableDeclaration
    | ExpressionStatement
    | IfStatement
    | ReturnStatement
    | WithStatement
    | SwitchStatement
    | CaseClause
    | ThrowStatement
    | ImportDeclaration
    | ExpressionWithTypeArguments
    | PropertyAccessExpression
    | TaggedTemplateExpression
    | Decorator;
  readonly tagName: JsxTagNameExpression;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly attributes: JsxAttributes;
}
export interface JsxFragment extends Node {
  readonly kind: SyntaxKind.JsxFragment;
  readonly parent:
    | IterationStatement
    | JsxAttributeLike
    | JsxFragment
    | JsxElement
    | PostfixUnaryExpression
    | PrefixUnaryExpression
    | DeleteExpression
    | TypeOfExpression
    | VoidExpression
    | AwaitExpression
    | TypeAssertion
    | ComputedPropertyName
    | TypeParameterDeclaration
    | BindingElement
    | ParameterDeclaration
    | ImportAttribute
    | YieldExpression
    | BinaryExpression
    | ConditionalExpression
    | ArrowFunction
    | SpreadElement
    | AsExpression
    | SatisfiesExpression
    | JsxExpression
    | CommaListExpression
    | PartiallyEmittedExpression
    | TemplateSpan
    | ParenthesizedExpression
    | ArrayLiteralExpression
    | PropertyAssignment
    | ShorthandPropertyAssignment
    | SpreadAssignment
    | NewExpression
    | PropertyDeclaration
    | ElementAccessExpression
    | CallExpression
    | NonNullExpression
    | EnumMember
    | ExternalModuleReference
    | ExportDeclaration
    | ExportAssignment
    | VariableDeclaration
    | ExpressionStatement
    | IfStatement
    | ReturnStatement
    | WithStatement
    | SwitchStatement
    | CaseClause
    | ThrowStatement
    | ImportDeclaration
    | ExpressionWithTypeArguments
    | PropertyAccessExpression
    | TaggedTemplateExpression
    | Decorator;
  readonly openingFragment: JsxOpeningFragment;
  readonly children: NodeArray<JsxChild>;
  readonly closingFragment: JsxClosingFragment;
}
export interface JsxOpeningFragment extends Node {
  readonly kind: SyntaxKind.JsxOpeningFragment;
  readonly parent: ExpressionParent | JsxFragment;
}
export interface JsxClosingFragment extends Node {
  readonly kind: SyntaxKind.JsxClosingFragment;
  readonly parent: ExpressionParent | JsxFragment;
}
export interface JsxClosingElement extends Node {
  readonly kind: SyntaxKind.JsxClosingElement;
  readonly parent: JsxElement;
  readonly tagName: JsxTagNameExpression;
}
export interface JsxSpreadAttribute extends Node {
  readonly kind: SyntaxKind.JsxSpreadAttribute;
  readonly parent: JsxAttributes;
  readonly expression: Expression;
  readonly name?: PropertyName;
}
export interface CommaListExpression extends Node {
  readonly kind: SyntaxKind.CommaListExpression;
  readonly parent: ExpressionParent;
  readonly elements: NodeArray<Expression>;
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
export interface SuperExpression extends Node {
  readonly kind: SyntaxKind.SuperKeyword;
  readonly parent: LeftHandSideExpressionParent;
}
export interface ImportExpression extends Node {
  readonly kind: SyntaxKind.ImportKeyword;
  readonly parent: LeftHandSideExpressionParent;
}
export interface FunctionExpression extends Node {
  readonly kind: SyntaxKind.FunctionExpression;
  readonly parent: LeftHandSideExpressionParent;
  readonly modifiers?: NodeArray<Modifier>;
  readonly name?: Identifier;
  readonly body: FunctionBody;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
}
export interface TemplateExpression extends Node {
  readonly kind: SyntaxKind.TemplateExpression;
  readonly parent: LeftHandSideExpressionParent;
  readonly head: TemplateHead;
  readonly templateSpans: NodeArray<TemplateSpan>;
}
export interface TemplateSpan extends Node {
  readonly kind: SyntaxKind.TemplateSpan;
  readonly parent: TemplateExpression;
  readonly expression: Expression;
  readonly literal: TemplateMiddle | TemplateTail;
}
export interface ParenthesizedExpression extends Node {
  readonly kind: SyntaxKind.ParenthesizedExpression;
  readonly parent: LeftHandSideExpressionParent;
  readonly expression: Expression;
}
export interface ArrayLiteralExpression extends Node {
  readonly kind: SyntaxKind.ArrayLiteralExpression;
  readonly parent: LeftHandSideExpressionParent;
  readonly elements: NodeArray<Expression>;
}
export type ObjectLiteralExpressionBase = ObjectLiteralExpression;
export interface ObjectLiteralExpression extends Node {
  readonly kind: SyntaxKind.ObjectLiteralExpression;
  readonly parent: LeftHandSideExpressionParent;
  readonly properties: NodeArray<ObjectLiteralElementLike>;
}
export type ObjectLiteralElementLike =
  | PropertyAssignment
  | ShorthandPropertyAssignment
  | SpreadAssignment
  | MethodDeclaration
  | AccessorDeclaration;
export interface PropertyAssignment extends Node {
  readonly kind: SyntaxKind.PropertyAssignment;
  readonly parent: ObjectLiteralExpressionBase;
  readonly name: PropertyName;
  readonly initializer: Expression;
}
export interface ShorthandPropertyAssignment extends Node {
  readonly kind: SyntaxKind.ShorthandPropertyAssignment;
  readonly parent: ObjectLiteralExpressionBase;
  readonly name: Identifier;
  readonly equalsToken?: EqualsToken;
  readonly objectAssignmentInitializer?: Expression;
}
export interface EqualsToken extends Node {
  readonly kind: SyntaxKind.EqualsToken;
  readonly parent: ShorthandPropertyAssignment;
}
export interface SpreadAssignment extends Node {
  readonly kind: SyntaxKind.SpreadAssignment;
  readonly parent: ObjectLiteralExpressionBase;
  readonly expression: Expression;
  readonly name?: PropertyName;
}
export interface MethodDeclaration extends Node {
  readonly kind: SyntaxKind.MethodDeclaration;
  readonly parent: ObjectLiteralExpressionBase | ClassExpression | ClassDeclaration;
  readonly modifiers?: NodeArray<ModifierLike> | undefined;
  readonly name: PropertyName;
  readonly body?: FunctionBody | undefined;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
}
export type AccessorDeclaration = GetAccessorDeclaration | SetAccessorDeclaration;
export interface NewExpression extends Node {
  readonly kind: SyntaxKind.NewExpression;
  readonly parent: LeftHandSideExpressionParent;
  readonly expression: LeftHandSideExpression;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly arguments?: NodeArray<Expression>;
}
export interface MetaProperty extends Node {
  readonly kind: SyntaxKind.MetaProperty;
  readonly parent: LeftHandSideExpressionParent;
  readonly keywordToken: SyntaxKind.NewKeyword | SyntaxKind.ImportKeyword;
  readonly name: Identifier;
}
export interface MissingDeclaration extends Node {
  readonly kind: SyntaxKind.MissingDeclaration;
  readonly parent:
    | StatementParent
    | PostfixUnaryExpression
    | PrefixUnaryExpression
    | DeleteExpression
    | TypeOfExpression
    | VoidExpression
    | AwaitExpression
    | TypeAssertion
    | ComputedPropertyName
    | TypeParameterDeclaration
    | BindingElement
    | ParameterDeclaration
    | ImportAttribute
    | YieldExpression
    | BinaryExpression
    | ConditionalExpression
    | ArrowFunction
    | SpreadElement
    | AsExpression
    | SatisfiesExpression
    | JsxExpression
    | JsxSpreadAttribute
    | CommaListExpression
    | PartiallyEmittedExpression
    | TemplateSpan
    | ParenthesizedExpression
    | ArrayLiteralExpression
    | PropertyAssignment
    | ShorthandPropertyAssignment
    | SpreadAssignment
    | NewExpression
    | PropertyDeclaration
    | ElementAccessExpression
    | CallExpression
    | NonNullExpression
    | EnumMember
    | ExternalModuleReference
    | ExportDeclaration
    | ExportAssignment
    | VariableDeclaration
    | ExpressionStatement
    | ReturnStatement
    | SwitchStatement
    | ThrowStatement
    | ImportDeclaration
    | ExpressionWithTypeArguments
    | PropertyAccessExpression
    | TaggedTemplateExpression
    | Decorator;
  readonly name?: Identifier;
}
export interface ClassExpression extends Node {
  readonly kind: SyntaxKind.ClassExpression;
  readonly parent: LeftHandSideExpressionParent;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name?: Identifier;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration>;
  readonly heritageClauses?: NodeArray<HeritageClause>;
  readonly members: NodeArray<ClassElement>;
}
export interface HeritageClause extends Node {
  readonly kind: SyntaxKind.HeritageClause;
  readonly parent: ClassExpression | ClassDeclaration | InterfaceDeclaration;
  readonly token: SyntaxKind.ExtendsKeyword | SyntaxKind.ImplementsKeyword;
  readonly types: NodeArray<ExpressionWithTypeArguments>;
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
  readonly parent: ClassExpression | ClassDeclaration;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: PropertyName;
  readonly questionToken?: QuestionToken;
  readonly exclamationToken?: ExclamationToken;
  readonly type?: TypeNode;
  readonly initializer?: Expression;
}
export interface ConstructorDeclaration extends Node {
  readonly kind: SyntaxKind.Constructor;
  readonly parent: ClassExpression | ClassDeclaration;
  readonly modifiers?: NodeArray<ModifierLike> | undefined;
  readonly body?: FunctionBody | undefined;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
}
export interface SemicolonClassElement extends Node {
  readonly kind: SyntaxKind.SemicolonClassElement;
  readonly parent: ClassExpression | ClassDeclaration;
  readonly name?: PropertyName;
}
export interface ClassStaticBlockDeclaration extends Node {
  readonly kind: SyntaxKind.ClassStaticBlockDeclaration;
  readonly parent: ClassExpression | ClassDeclaration;
  readonly body: Block;
  readonly name?: PropertyName;
}
export interface PropertyAccessExpression extends Node {
  readonly kind: SyntaxKind.PropertyAccessExpression;
  readonly parent: LeftHandSideExpressionParent;
  readonly expression: LeftHandSideExpression;
  readonly questionDotToken?: QuestionDotToken;
  readonly name: MemberName;
}
export interface ElementAccessExpression extends Node {
  readonly kind: SyntaxKind.ElementAccessExpression;
  readonly parent: LeftHandSideExpressionParent;
  readonly expression: LeftHandSideExpression;
  readonly questionDotToken?: QuestionDotToken;
  readonly argumentExpression: Expression;
}
export interface TaggedTemplateExpression extends Node {
  readonly kind: SyntaxKind.TaggedTemplateExpression;
  readonly parent: LeftHandSideExpressionParent;
  readonly tag: LeftHandSideExpression;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly template: TemplateLiteral;
}
export type TemplateLiteral = TemplateExpression | NoSubstitutionTemplateLiteral;
export interface CallExpression extends Node {
  readonly kind: SyntaxKind.CallExpression;
  readonly parent: LeftHandSideExpressionParent;
  readonly expression: LeftHandSideExpression;
  readonly questionDotToken?: QuestionDotToken;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly arguments: NodeArray<Expression>;
}
export interface NonNullExpression extends Node {
  readonly kind: SyntaxKind.NonNullExpression;
  readonly parent: LeftHandSideExpressionParent;
  readonly expression: Expression;
}
export interface ClassDeclaration extends Node {
  readonly kind: SyntaxKind.ClassDeclaration;
  readonly parent: StatementParent;
  readonly modifiers?: NodeArray<ModifierLike>;
  /** May be undefined in `export default class { ... }`. */
  readonly name?: Identifier;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration>;
  readonly heritageClauses?: NodeArray<HeritageClause>;
  readonly members: NodeArray<ClassElement>;
}
export interface InterfaceDeclaration extends Node {
  readonly kind: SyntaxKind.InterfaceDeclaration;
  readonly parent: StatementParent;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: Identifier;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration>;
  readonly heritageClauses?: NodeArray<HeritageClause>;
  readonly members: NodeArray<TypeElement>;
}
export interface TypeAliasDeclaration extends Node {
  readonly kind: SyntaxKind.TypeAliasDeclaration;
  readonly parent: StatementParent;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: Identifier;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration>;
  readonly type: TypeNode;
}
export interface EnumDeclaration extends Node {
  readonly kind: SyntaxKind.EnumDeclaration;
  readonly parent: StatementParent;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: Identifier;
  readonly members: NodeArray<EnumMember>;
}
export interface EnumMember extends Node {
  readonly kind: SyntaxKind.EnumMember;
  readonly parent: EnumDeclaration;
  readonly name: PropertyName;
  readonly initializer?: Expression;
}
export interface ModuleDeclaration extends Node {
  readonly kind: SyntaxKind.ModuleDeclaration;
  readonly parent: StatementParent;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: ModuleName;
  readonly body?: ModuleBody | JSDocNamespaceDeclaration;
}
export type ModuleName = Identifier | StringLiteral;
export type ModuleBody = NamespaceBody | JSDocNamespaceBody;
export type NamespaceBody = ModuleBlock | NamespaceDeclaration;
export interface ModuleBlock extends Node {
  readonly kind: SyntaxKind.ModuleBlock;
  readonly parent:
    | CaseOrDefaultClause
    | IterationStatement
    | NamespaceBody
    | ModuleDeclaration
    | Block
    | IfStatement
    | WithStatement
    | LabeledStatement
    | SourceFile;
  readonly statements: NodeArray<Statement>;
}
export interface NamespaceDeclaration extends Node {
  readonly kind: SyntaxKind.ModuleDeclaration;
  readonly parent: NamespaceDeclaration | ModuleDeclaration;
  readonly name: Identifier;
  readonly body: NamespaceBody;
  readonly modifiers?: NodeArray<ModifierLike>;
}
export type JSDocNamespaceBody = Identifier | JSDocNamespaceDeclaration;
export interface JSDocNamespaceDeclaration extends Node {
  readonly kind: SyntaxKind.ModuleDeclaration;
  readonly parent: JSDocNamespaceDeclaration | ModuleDeclaration;
  readonly name: Identifier;
  readonly body?: JSDocNamespaceBody;
  readonly modifiers?: NodeArray<ModifierLike>;
}
export interface ImportEqualsDeclaration extends Node {
  readonly kind: SyntaxKind.ImportEqualsDeclaration;
  readonly parent: StatementParent;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: Identifier;
  readonly isTypeOnly: boolean;
  readonly moduleReference: ModuleReference;
}
export type ModuleReference = EntityName | ExternalModuleReference;
export interface ExternalModuleReference extends Node {
  readonly kind: SyntaxKind.ExternalModuleReference;
  readonly parent: ImportEqualsDeclaration;
  readonly expression: Expression;
}
export interface NamespaceExportDeclaration extends Node {
  readonly kind: SyntaxKind.NamespaceExportDeclaration;
  readonly parent: StatementParent;
  readonly name: Identifier;
}
export interface ExportDeclaration extends Node {
  readonly kind: SyntaxKind.ExportDeclaration;
  readonly parent: StatementParent;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly isTypeOnly: boolean;
  /** Will not be assigned in the case of `export * from "foo";` */
  readonly exportClause?: NamedExportBindings;
  /** If this is not a StringLiteral it will be a grammar error. */
  readonly moduleSpecifier?: Expression;
  readonly attributes?: ImportAttributes;
  readonly name?: Identifier | StringLiteral | NumericLiteral;
}
export type NamedExportBindings = NamespaceExport | NamedExports;
export interface NamespaceExport extends Node {
  readonly kind: SyntaxKind.NamespaceExport;
  readonly parent: ExportDeclaration;
  readonly name: Identifier;
}
export interface NamedExports extends Node {
  readonly kind: SyntaxKind.NamedExports;
  readonly parent: ExportDeclaration;
  readonly elements: NodeArray<ExportSpecifier>;
}
export interface ExportSpecifier extends Node {
  readonly kind: SyntaxKind.ExportSpecifier;
  readonly parent: NamedExports;
  readonly isTypeOnly: boolean;
  readonly propertyName?: Identifier;
  readonly name: Identifier;
}
export interface ExportAssignment extends Node {
  readonly kind: SyntaxKind.ExportAssignment;
  readonly parent: StatementParent;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly isExportEquals?: boolean;
  readonly expression: Expression;
  readonly name?: Identifier | StringLiteral | NumericLiteral;
}
export interface NotEmittedStatement extends Node {
  readonly kind: SyntaxKind.NotEmittedStatement;
  readonly parent: StatementParent;
}
export interface EmptyStatement extends Node {
  readonly kind: SyntaxKind.EmptyStatement;
  readonly parent: StatementParent;
}
export interface DebuggerStatement extends Node {
  readonly kind: SyntaxKind.DebuggerStatement;
  readonly parent: StatementParent;
}
export interface VariableStatement extends Node {
  readonly kind: SyntaxKind.VariableStatement;
  readonly parent: StatementParent;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly declarationList: VariableDeclarationList;
}
export interface VariableDeclarationList extends Node {
  readonly kind: SyntaxKind.VariableDeclarationList;
  readonly parent: VariableStatement | ForStatement | ForInStatement | ForOfStatement;
  readonly declarations: NodeArray<VariableDeclaration>;
}
export interface VariableDeclaration extends Node {
  readonly kind: SyntaxKind.VariableDeclaration;
  readonly parent: VariableDeclarationList | CatchClause;
  readonly name: BindingName;
  readonly exclamationToken?: ExclamationToken;
  readonly type?: TypeNode;
  readonly initializer?: Expression;
}
export interface ExpressionStatement extends Node {
  readonly kind: SyntaxKind.ExpressionStatement;
  readonly parent: StatementParent;
  readonly expression: Expression;
}
export interface IfStatement extends Node {
  readonly kind: SyntaxKind.IfStatement;
  readonly parent: StatementParent;
  readonly expression: Expression;
  readonly thenStatement: Statement;
  readonly elseStatement?: Statement;
}
export type IterationStatement = DoStatement | WhileStatement | ForStatement | ForInStatement | ForOfStatement;
export interface DoStatement extends Node {
  readonly kind: SyntaxKind.DoStatement;
  readonly parent: StatementParent;
  readonly expression: Expression;
  readonly statement: Statement;
}
export interface WhileStatement extends Node {
  readonly kind: SyntaxKind.WhileStatement;
  readonly parent: StatementParent;
  readonly expression: Expression;
  readonly statement: Statement;
}
export interface ForStatement extends Node {
  readonly kind: SyntaxKind.ForStatement;
  readonly parent: StatementParent;
  readonly initializer?: ForInitializer;
  readonly condition?: Expression;
  readonly incrementor?: Expression;
  readonly statement: Statement;
}
export type ForInitializer = VariableDeclarationList | Expression;
export interface ForInStatement extends Node {
  readonly kind: SyntaxKind.ForInStatement;
  readonly parent: StatementParent;
  readonly initializer: ForInitializer;
  readonly expression: Expression;
  readonly statement: Statement;
}
export interface ForOfStatement extends Node {
  readonly kind: SyntaxKind.ForOfStatement;
  readonly parent: StatementParent;
  readonly awaitModifier?: AwaitKeyword;
  readonly initializer: ForInitializer;
  readonly expression: Expression;
  readonly statement: Statement;
}
export interface AwaitKeyword extends Node {
  readonly kind: SyntaxKind.AwaitKeyword;
  readonly parent: ForOfStatement;
}
export interface BreakStatement extends Node {
  readonly kind: SyntaxKind.BreakStatement;
  readonly parent: StatementParent;
  readonly label?: Identifier;
}
export interface ContinueStatement extends Node {
  readonly kind: SyntaxKind.ContinueStatement;
  readonly parent: StatementParent;
  readonly label?: Identifier;
}
export interface ReturnStatement extends Node {
  readonly kind: SyntaxKind.ReturnStatement;
  readonly parent: StatementParent;
  readonly expression?: Expression;
}
export interface WithStatement extends Node {
  readonly kind: SyntaxKind.WithStatement;
  readonly parent: StatementParent;
  readonly expression: Expression;
  readonly statement: Statement;
}
export interface SwitchStatement extends Node {
  readonly kind: SyntaxKind.SwitchStatement;
  readonly parent: StatementParent;
  readonly expression: Expression;
  readonly caseBlock: CaseBlock;
  possiblyExhaustive?: boolean;
}
export interface CaseBlock extends Node {
  readonly kind: SyntaxKind.CaseBlock;
  readonly parent: SwitchStatement;
  readonly clauses: NodeArray<CaseOrDefaultClause>;
}
export type CaseOrDefaultClause = CaseClause | DefaultClause;
export interface CaseClause extends Node {
  readonly kind: SyntaxKind.CaseClause;
  readonly parent: CaseBlock;
  readonly expression: Expression;
  readonly statements: NodeArray<Statement>;
}
export interface DefaultClause extends Node {
  readonly kind: SyntaxKind.DefaultClause;
  readonly parent: CaseBlock;
  readonly statements: NodeArray<Statement>;
}
export interface LabeledStatement extends Node {
  readonly kind: SyntaxKind.LabeledStatement;
  readonly parent: StatementParent;
  readonly label: Identifier;
  readonly statement: Statement;
}
export interface ThrowStatement extends Node {
  readonly kind: SyntaxKind.ThrowStatement;
  readonly parent: StatementParent;
  readonly expression: Expression;
}
export interface TryStatement extends Node {
  readonly kind: SyntaxKind.TryStatement;
  readonly parent: StatementParent;
  readonly tryBlock: Block;
  readonly catchClause?: CatchClause;
  readonly finallyBlock?: Block;
}
export interface CatchClause extends Node {
  readonly kind: SyntaxKind.CatchClause;
  readonly parent: TryStatement;
  readonly variableDeclaration?: VariableDeclaration;
  readonly block: Block;
}
export interface ImportDeclaration extends Node {
  readonly kind: SyntaxKind.ImportDeclaration;
  readonly parent: StatementParent;
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly importClause?: ImportClause;
  /** If this is not a StringLiteral it will be a grammar error. */
  readonly moduleSpecifier: Expression;
  readonly attributes?: ImportAttributes;
}
export interface ImportClause extends Node {
  readonly kind: SyntaxKind.ImportClause;
  readonly parent: ImportDeclaration;
  readonly isTypeOnly: boolean;
  readonly name?: Identifier;
  readonly namedBindings?: NamedImportBindings;
}
export type NamedImportBindings = NamespaceImport | NamedImports;
export interface NamespaceImport extends Node {
  readonly kind: SyntaxKind.NamespaceImport;
  readonly parent: ImportClause;
  readonly name: Identifier;
}
export interface NamedImports extends Node {
  readonly kind: SyntaxKind.NamedImports;
  readonly parent: ImportClause;
  readonly elements: NodeArray<ImportSpecifier>;
}
export interface ImportSpecifier extends Node {
  readonly kind: SyntaxKind.ImportSpecifier;
  readonly parent: NamedImports;
  readonly propertyName?: Identifier;
  readonly name: Identifier;
  readonly isTypeOnly: boolean;
}

interface Token<Kind extends SyntaxKind, Parent extends Node> extends Node {
  readonly kind: Kind;
  readonly parent: Parent;
}

/* Enums here just for factorisation */
export type ExpressionParent =
  | IterationStatement
  | ComputedPropertyName
  | TypeParameterDeclaration
  | BindingElement
  | ParameterDeclaration
  | ImportAttribute
  | YieldExpression
  | BinaryExpression
  | ConditionalExpression
  | ArrowFunction
  | SpreadElement
  | AsExpression
  | SatisfiesExpression
  | JsxExpression
  | JsxSpreadAttribute
  | CommaListExpression
  | PartiallyEmittedExpression
  | TemplateSpan
  | ParenthesizedExpression
  | ArrayLiteralExpression
  | PropertyAssignment
  | ShorthandPropertyAssignment
  | SpreadAssignment
  | NewExpression
  | PropertyDeclaration
  | ElementAccessExpression
  | CallExpression
  | NonNullExpression
  | EnumMember
  | ExternalModuleReference
  | ExportDeclaration
  | ExportAssignment
  | VariableDeclaration
  | ExpressionStatement
  | IfStatement
  | ReturnStatement
  | WithStatement
  | SwitchStatement
  | CaseClause
  | ThrowStatement
  | ImportDeclaration;
export type TypeNodeParent =
  | TypeElement
  | NodeWithTypeArguments
  | FunctionOrConstructorTypeNodeBase
  | TypeParameterDeclaration
  | ParameterDeclaration
  | TypePredicateNode
  | ArrayTypeNode
  | TupleTypeNode
  | NamedTupleMember
  | OptionalTypeNode
  | RestTypeNode
  | UnionTypeNode
  | IntersectionTypeNode
  | ConditionalTypeNode
  | ParenthesizedTypeNode
  | TypeOperatorNode
  | IndexedAccessTypeNode
  | MappedTypeNode
  | TemplateLiteralTypeSpan
  | JSDocTypeExpression
  | JSDocNonNullableType
  | JSDocNullableType
  | JSDocOptionalType
  | JSDocFunctionType
  | JSDocVariadicType
  | JSDocNamepathType
  | TypeAssertion
  | ArrowFunction
  | AsExpression
  | SatisfiesExpression
  | JsxOpeningElement
  | JsxSelfClosingElement
  | FunctionExpression
  | MethodDeclaration
  | NewExpression
  | PropertyDeclaration
  | ConstructorDeclaration
  | TaggedTemplateExpression
  | CallExpression
  | FunctionDeclaration
  | TypeAliasDeclaration
  | VariableDeclaration;
export type ModifierParent =
  | AccessorDeclaration
  | ParameterDeclaration
  | IndexSignatureDeclaration
  | MethodDeclaration
  | ClassExpression
  | PropertyDeclaration
  | ConstructorDeclaration
  | FunctionDeclaration
  | ClassDeclaration
  | InterfaceDeclaration
  | TypeAliasDeclaration
  | EnumDeclaration
  | ModuleDeclaration
  | NamespaceDeclaration
  | JSDocNamespaceDeclaration
  | ImportEqualsDeclaration
  | ExportDeclaration
  | ExportAssignment
  | VariableStatement
  | ImportDeclaration
  | TypeParameterDeclaration
  | ConstructorTypeNode
  | PropertySignature
  | MethodSignature
  | ArrowFunction
  | FunctionExpression;
export type StatementParent =
  | CaseOrDefaultClause
  | IterationStatement
  | Block
  | ModuleBlock
  | IfStatement
  | WithStatement
  | LabeledStatement
  | SourceFile;
export type LeftHandSideExpressionParent =
  | ExpressionParent
  | PostfixUnaryExpression
  | PrefixUnaryExpression
  | DeleteExpression
  | TypeOfExpression
  | VoidExpression
  | AwaitExpression
  | TypeAssertion
  | ExpressionWithTypeArguments
  | PropertyAccessExpression
  | TaggedTemplateExpression
  | Decorator;

export type Visitor<OptionsOutput = undefined, Data = undefined> = {
  ArrayBindingPattern?(node: ArrayBindingPattern, context: Context<OptionsOutput, Data>): void;
  ArrayLiteralExpression?(node: ArrayLiteralExpression, context: Context<OptionsOutput, Data>): void;
  ArrayTypeNode?(node: ArrayTypeNode, context: Context<OptionsOutput, Data>): void;
  ArrowFunction?(node: ArrowFunction, context: Context<OptionsOutput, Data>): void;
  AsExpression?(node: AsExpression, context: Context<OptionsOutput, Data>): void;
  AwaitExpression?(node: AwaitExpression, context: Context<OptionsOutput, Data>): void;
  BigIntLiteral?(node: BigIntLiteral, context: Context<OptionsOutput, Data>): void;
  BinaryExpression?(node: BinaryExpression, context: Context<OptionsOutput, Data>): void;
  BindingElement?(node: BindingElement, context: Context<OptionsOutput, Data>): void;
  Block?(node: Block, context: Context<OptionsOutput, Data>): void;
  BreakStatement?(node: BreakStatement, context: Context<OptionsOutput, Data>): void;
  CallExpression?(node: CallExpression, context: Context<OptionsOutput, Data>): void;
  CallSignatureDeclaration?(node: CallSignatureDeclaration, context: Context<OptionsOutput, Data>): void;
  CaseBlock?(node: CaseBlock, context: Context<OptionsOutput, Data>): void;
  CaseClause?(node: CaseClause, context: Context<OptionsOutput, Data>): void;
  CatchClause?(node: CatchClause, context: Context<OptionsOutput, Data>): void;
  ClassDeclaration?(node: ClassDeclaration, context: Context<OptionsOutput, Data>): void;
  ClassExpression?(node: ClassExpression, context: Context<OptionsOutput, Data>): void;
  ClassStaticBlockDeclaration?(node: ClassStaticBlockDeclaration, context: Context<OptionsOutput, Data>): void;
  CommaListExpression?(node: CommaListExpression, context: Context<OptionsOutput, Data>): void;
  ComputedPropertyName?(node: ComputedPropertyName, context: Context<OptionsOutput, Data>): void;
  ConditionalExpression?(node: ConditionalExpression, context: Context<OptionsOutput, Data>): void;
  ConditionalTypeNode?(node: ConditionalTypeNode, context: Context<OptionsOutput, Data>): void;
  ConstructSignatureDeclaration?(node: ConstructSignatureDeclaration, context: Context<OptionsOutput, Data>): void;
  ConstructorDeclaration?(node: ConstructorDeclaration, context: Context<OptionsOutput, Data>): void;
  ConstructorTypeNode?(node: ConstructorTypeNode, context: Context<OptionsOutput, Data>): void;
  ContinueStatement?(node: ContinueStatement, context: Context<OptionsOutput, Data>): void;
  DebuggerStatement?(node: DebuggerStatement, context: Context<OptionsOutput, Data>): void;
  Decorator?(node: Decorator, context: Context<OptionsOutput, Data>): void;
  DefaultClause?(node: DefaultClause, context: Context<OptionsOutput, Data>): void;
  DeleteExpression?(node: DeleteExpression, context: Context<OptionsOutput, Data>): void;
  DoStatement?(node: DoStatement, context: Context<OptionsOutput, Data>): void;
  ElementAccessExpression?(node: ElementAccessExpression, context: Context<OptionsOutput, Data>): void;
  EmptyStatement?(node: EmptyStatement, context: Context<OptionsOutput, Data>): void;
  EnumDeclaration?(node: EnumDeclaration, context: Context<OptionsOutput, Data>): void;
  EnumMember?(node: EnumMember, context: Context<OptionsOutput, Data>): void;
  ExportAssignment?(node: ExportAssignment, context: Context<OptionsOutput, Data>): void;
  ExportDeclaration?(node: ExportDeclaration, context: Context<OptionsOutput, Data>): void;
  ExportSpecifier?(node: ExportSpecifier, context: Context<OptionsOutput, Data>): void;
  ExpressionStatement?(node: ExpressionStatement, context: Context<OptionsOutput, Data>): void;
  ExpressionWithTypeArguments?(node: ExpressionWithTypeArguments, context: Context<OptionsOutput, Data>): void;
  ExternalModuleReference?(node: ExternalModuleReference, context: Context<OptionsOutput, Data>): void;
  FalseLiteral?(node: FalseLiteral, context: Context<OptionsOutput, Data>): void;
  ForInStatement?(node: ForInStatement, context: Context<OptionsOutput, Data>): void;
  ForOfStatement?(node: ForOfStatement, context: Context<OptionsOutput, Data>): void;
  ForStatement?(node: ForStatement, context: Context<OptionsOutput, Data>): void;
  FunctionDeclaration?(node: FunctionDeclaration, context: Context<OptionsOutput, Data>): void;
  FunctionExpression?(node: FunctionExpression, context: Context<OptionsOutput, Data>): void;
  FunctionTypeNode?(node: FunctionTypeNode, context: Context<OptionsOutput, Data>): void;
  GetAccessorDeclaration?(node: GetAccessorDeclaration, context: Context<OptionsOutput, Data>): void;
  HeritageClause?(node: HeritageClause, context: Context<OptionsOutput, Data>): void;
  Identifier?(node: Identifier, context: Context<OptionsOutput, Data>): void;
  IfStatement?(node: IfStatement, context: Context<OptionsOutput, Data>): void;
  ImportAttribute?(node: ImportAttribute, context: Context<OptionsOutput, Data>): void;
  ImportAttributes?(node: ImportAttributes, context: Context<OptionsOutput, Data>): void;
  ImportClause?(node: ImportClause, context: Context<OptionsOutput, Data>): void;
  ImportDeclaration?(node: ImportDeclaration, context: Context<OptionsOutput, Data>): void;
  ImportEqualsDeclaration?(node: ImportEqualsDeclaration, context: Context<OptionsOutput, Data>): void;
  ImportExpression?(node: ImportExpression, context: Context<OptionsOutput, Data>): void;
  ImportSpecifier?(node: ImportSpecifier, context: Context<OptionsOutput, Data>): void;
  ImportTypeNode?(node: ImportTypeNode, context: Context<OptionsOutput, Data>): void;
  IndexSignatureDeclaration?(node: IndexSignatureDeclaration, context: Context<OptionsOutput, Data>): void;
  IndexedAccessTypeNode?(node: IndexedAccessTypeNode, context: Context<OptionsOutput, Data>): void;
  InferTypeNode?(node: InferTypeNode, context: Context<OptionsOutput, Data>): void;
  InterfaceDeclaration?(node: InterfaceDeclaration, context: Context<OptionsOutput, Data>): void;
  IntersectionTypeNode?(node: IntersectionTypeNode, context: Context<OptionsOutput, Data>): void;
  JSDocAllType?(node: JSDocAllType, context: Context<OptionsOutput, Data>): void;
  JSDocFunctionType?(node: JSDocFunctionType, context: Context<OptionsOutput, Data>): void;
  JSDocLink?(node: JSDocLink, context: Context<OptionsOutput, Data>): void;
  JSDocLinkCode?(node: JSDocLinkCode, context: Context<OptionsOutput, Data>): void;
  JSDocLinkPlain?(node: JSDocLinkPlain, context: Context<OptionsOutput, Data>): void;
  JSDocMemberName?(node: JSDocMemberName, context: Context<OptionsOutput, Data>): void;
  JSDocNamepathType?(node: JSDocNamepathType, context: Context<OptionsOutput, Data>): void;
  JSDocNonNullableType?(node: JSDocNonNullableType, context: Context<OptionsOutput, Data>): void;
  JSDocNullableType?(node: JSDocNullableType, context: Context<OptionsOutput, Data>): void;
  JSDocOptionalType?(node: JSDocOptionalType, context: Context<OptionsOutput, Data>): void;
  JSDocParameterTag?(node: JSDocParameterTag, context: Context<OptionsOutput, Data>): void;
  JSDocPropertyTag?(node: JSDocPropertyTag, context: Context<OptionsOutput, Data>): void;
  JSDocReturnTag?(node: JSDocReturnTag, context: Context<OptionsOutput, Data>): void;
  JSDocSignature?(node: JSDocSignature, context: Context<OptionsOutput, Data>): void;
  JSDocTemplateTag?(node: JSDocTemplateTag, context: Context<OptionsOutput, Data>): void;
  JSDocText?(node: JSDocText, context: Context<OptionsOutput, Data>): void;
  JSDocTypeExpression?(node: JSDocTypeExpression, context: Context<OptionsOutput, Data>): void;
  JSDocTypeLiteral?(node: JSDocTypeLiteral, context: Context<OptionsOutput, Data>): void;
  JSDocUnknownType?(node: JSDocUnknownType, context: Context<OptionsOutput, Data>): void;
  JSDocVariadicType?(node: JSDocVariadicType, context: Context<OptionsOutput, Data>): void;
  JsxAttribute?(node: JsxAttribute, context: Context<OptionsOutput, Data>): void;
  JsxAttributes?(node: JsxAttributes, context: Context<OptionsOutput, Data>): void;
  JsxClosingElement?(node: JsxClosingElement, context: Context<OptionsOutput, Data>): void;
  JsxClosingFragment?(node: JsxClosingFragment, context: Context<OptionsOutput, Data>): void;
  JsxElement?(node: JsxElement, context: Context<OptionsOutput, Data>): void;
  JsxExpression?(node: JsxExpression, context: Context<OptionsOutput, Data>): void;
  JsxFragment?(node: JsxFragment, context: Context<OptionsOutput, Data>): void;
  JsxNamespacedName?(node: JsxNamespacedName, context: Context<OptionsOutput, Data>): void;
  JsxOpeningElement?(node: JsxOpeningElement, context: Context<OptionsOutput, Data>): void;
  JsxOpeningFragment?(node: JsxOpeningFragment, context: Context<OptionsOutput, Data>): void;
  JsxSelfClosingElement?(node: JsxSelfClosingElement, context: Context<OptionsOutput, Data>): void;
  JsxSpreadAttribute?(node: JsxSpreadAttribute, context: Context<OptionsOutput, Data>): void;
  JsxText?(node: JsxText, context: Context<OptionsOutput, Data>): void;
  LabeledStatement?(node: LabeledStatement, context: Context<OptionsOutput, Data>): void;
  LiteralTypeNode?(node: LiteralTypeNode, context: Context<OptionsOutput, Data>): void;
  MappedTypeNode?(node: MappedTypeNode, context: Context<OptionsOutput, Data>): void;
  MetaProperty?(node: MetaProperty, context: Context<OptionsOutput, Data>): void;
  MethodDeclaration?(node: MethodDeclaration, context: Context<OptionsOutput, Data>): void;
  MethodSignature?(node: MethodSignature, context: Context<OptionsOutput, Data>): void;
  MissingDeclaration?(node: MissingDeclaration, context: Context<OptionsOutput, Data>): void;
  ModuleBlock?(node: ModuleBlock, context: Context<OptionsOutput, Data>): void;
  ModuleDeclaration?(node: ModuleDeclaration, context: Context<OptionsOutput, Data>): void;
  NamedExports?(node: NamedExports, context: Context<OptionsOutput, Data>): void;
  NamedImports?(node: NamedImports, context: Context<OptionsOutput, Data>): void;
  NamedTupleMember?(node: NamedTupleMember, context: Context<OptionsOutput, Data>): void;
  NamespaceExport?(node: NamespaceExport, context: Context<OptionsOutput, Data>): void;
  NamespaceExportDeclaration?(node: NamespaceExportDeclaration, context: Context<OptionsOutput, Data>): void;
  NamespaceImport?(node: NamespaceImport, context: Context<OptionsOutput, Data>): void;
  NewExpression?(node: NewExpression, context: Context<OptionsOutput, Data>): void;
  NoSubstitutionTemplateLiteral?(node: NoSubstitutionTemplateLiteral, context: Context<OptionsOutput, Data>): void;
  NonNullExpression?(node: NonNullExpression, context: Context<OptionsOutput, Data>): void;
  NotEmittedStatement?(node: NotEmittedStatement, context: Context<OptionsOutput, Data>): void;
  NullLiteral?(node: NullLiteral, context: Context<OptionsOutput, Data>): void;
  NumericLiteral?(node: NumericLiteral, context: Context<OptionsOutput, Data>): void;
  ObjectBindingPattern?(node: ObjectBindingPattern, context: Context<OptionsOutput, Data>): void;
  ObjectLiteralExpression?(node: ObjectLiteralExpression, context: Context<OptionsOutput, Data>): void;
  OmittedExpression?(node: OmittedExpression, context: Context<OptionsOutput, Data>): void;
  OptionalTypeNode?(node: OptionalTypeNode, context: Context<OptionsOutput, Data>): void;
  ParameterDeclaration?(node: ParameterDeclaration, context: Context<OptionsOutput, Data>): void;
  ParenthesizedExpression?(node: ParenthesizedExpression, context: Context<OptionsOutput, Data>): void;
  ParenthesizedTypeNode?(node: ParenthesizedTypeNode, context: Context<OptionsOutput, Data>): void;
  PartiallyEmittedExpression?(node: PartiallyEmittedExpression, context: Context<OptionsOutput, Data>): void;
  PostfixUnaryExpression?(node: PostfixUnaryExpression, context: Context<OptionsOutput, Data>): void;
  PrefixUnaryExpression?(node: PrefixUnaryExpression, context: Context<OptionsOutput, Data>): void;
  PrivateIdentifier?(node: PrivateIdentifier, context: Context<OptionsOutput, Data>): void;
  PropertyAccessExpression?(node: PropertyAccessExpression, context: Context<OptionsOutput, Data>): void;
  PropertyAssignment?(node: PropertyAssignment, context: Context<OptionsOutput, Data>): void;
  PropertyDeclaration?(node: PropertyDeclaration, context: Context<OptionsOutput, Data>): void;
  PropertySignature?(node: PropertySignature, context: Context<OptionsOutput, Data>): void;
  QualifiedName?(node: QualifiedName, context: Context<OptionsOutput, Data>): void;
  RegularExpressionLiteral?(node: RegularExpressionLiteral, context: Context<OptionsOutput, Data>): void;
  RestTypeNode?(node: RestTypeNode, context: Context<OptionsOutput, Data>): void;
  ReturnStatement?(node: ReturnStatement, context: Context<OptionsOutput, Data>): void;
  SatisfiesExpression?(node: SatisfiesExpression, context: Context<OptionsOutput, Data>): void;
  SemicolonClassElement?(node: SemicolonClassElement, context: Context<OptionsOutput, Data>): void;
  SetAccessorDeclaration?(node: SetAccessorDeclaration, context: Context<OptionsOutput, Data>): void;
  ShorthandPropertyAssignment?(node: ShorthandPropertyAssignment, context: Context<OptionsOutput, Data>): void;
  SourceFile?(node: SourceFile, context: Context<OptionsOutput, Data>): void;
  SpreadAssignment?(node: SpreadAssignment, context: Context<OptionsOutput, Data>): void;
  SpreadElement?(node: SpreadElement, context: Context<OptionsOutput, Data>): void;
  StringLiteral?(node: StringLiteral, context: Context<OptionsOutput, Data>): void;
  SuperExpression?(node: SuperExpression, context: Context<OptionsOutput, Data>): void;
  SwitchStatement?(node: SwitchStatement, context: Context<OptionsOutput, Data>): void;
  SyntheticExpression?(node: SyntheticExpression, context: Context<OptionsOutput, Data>): void;
  TaggedTemplateExpression?(node: TaggedTemplateExpression, context: Context<OptionsOutput, Data>): void;
  TemplateExpression?(node: TemplateExpression, context: Context<OptionsOutput, Data>): void;
  TemplateHead?(node: TemplateHead, context: Context<OptionsOutput, Data>): void;
  TemplateLiteralTypeNode?(node: TemplateLiteralTypeNode, context: Context<OptionsOutput, Data>): void;
  TemplateLiteralTypeSpan?(node: TemplateLiteralTypeSpan, context: Context<OptionsOutput, Data>): void;
  TemplateMiddle?(node: TemplateMiddle, context: Context<OptionsOutput, Data>): void;
  TemplateSpan?(node: TemplateSpan, context: Context<OptionsOutput, Data>): void;
  TemplateTail?(node: TemplateTail, context: Context<OptionsOutput, Data>): void;
  ThisExpression?(node: ThisExpression, context: Context<OptionsOutput, Data>): void;
  ThisTypeNode?(node: ThisTypeNode, context: Context<OptionsOutput, Data>): void;
  ThrowStatement?(node: ThrowStatement, context: Context<OptionsOutput, Data>): void;
  TrueLiteral?(node: TrueLiteral, context: Context<OptionsOutput, Data>): void;
  TryStatement?(node: TryStatement, context: Context<OptionsOutput, Data>): void;
  TupleTypeNode?(node: TupleTypeNode, context: Context<OptionsOutput, Data>): void;
  TypeAliasDeclaration?(node: TypeAliasDeclaration, context: Context<OptionsOutput, Data>): void;
  TypeAssertion?(node: TypeAssertion, context: Context<OptionsOutput, Data>): void;
  TypeLiteralNode?(node: TypeLiteralNode, context: Context<OptionsOutput, Data>): void;
  TypeOfExpression?(node: TypeOfExpression, context: Context<OptionsOutput, Data>): void;
  TypeOperatorNode?(node: TypeOperatorNode, context: Context<OptionsOutput, Data>): void;
  TypeParameterDeclaration?(node: TypeParameterDeclaration, context: Context<OptionsOutput, Data>): void;
  TypePredicateNode?(node: TypePredicateNode, context: Context<OptionsOutput, Data>): void;
  TypeQueryNode?(node: TypeQueryNode, context: Context<OptionsOutput, Data>): void;
  TypeReferenceNode?(node: TypeReferenceNode, context: Context<OptionsOutput, Data>): void;
  UnionTypeNode?(node: UnionTypeNode, context: Context<OptionsOutput, Data>): void;
  VariableDeclaration?(node: VariableDeclaration, context: Context<OptionsOutput, Data>): void;
  VariableDeclarationList?(node: VariableDeclarationList, context: Context<OptionsOutput, Data>): void;
  VariableStatement?(node: VariableStatement, context: Context<OptionsOutput, Data>): void;
  VoidExpression?(node: VoidExpression, context: Context<OptionsOutput, Data>): void;
  WhileStatement?(node: WhileStatement, context: Context<OptionsOutput, Data>): void;
  WithStatement?(node: WithStatement, context: Context<OptionsOutput, Data>): void;
  YieldExpression?(node: YieldExpression, context: Context<OptionsOutput, Data>): void;
};
