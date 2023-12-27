import type {
  __String,
  AmdDependency,
  FileReference,
  LanguageVariant,
  LineAndCharacter,
  NodeFlags,
  ReadonlyTextRange,
  ResolutionMode,
  ScriptTarget,
  SyntaxKind,
  TextChangeRange,
  Type,
} from "typescript";

export type SourceFile = Node<SyntaxKind.SourceFile, undefined> & {
  readonly statements: NodeArray<Statement>;
  readonly endOfFileToken: Node<SyntaxKind.EndOfFileToken, SourceFile>;
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
};
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
export type FunctionDeclaration = Node<SyntaxKind.FunctionDeclaration, StatementParent> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name?: Identifier;
  readonly body?: FunctionBody;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
};
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
export type AbstractKeyword = Node<SyntaxKind.AbstractKeyword, ModifierParent>;
export type AccessorKeyword = Node<SyntaxKind.AccessorKeyword, ModifierParent>;
export type AsyncKeyword = Node<SyntaxKind.AsyncKeyword, ModifierParent>;
export type ConstKeyword = Node<SyntaxKind.ConstKeyword, ModifierParent>;
export type DeclareKeyword = Node<SyntaxKind.DeclareKeyword, ModifierParent>;
export type DefaultKeyword = Node<SyntaxKind.DefaultKeyword, ModifierParent>;
export type ExportKeyword = Node<SyntaxKind.ExportKeyword, ModifierParent>;
export type InKeyword = Node<SyntaxKind.InKeyword, ModifierParent>;
export type PrivateKeyword = Node<SyntaxKind.PrivateKeyword, ModifierParent>;
export type ProtectedKeyword = Node<SyntaxKind.ProtectedKeyword, ModifierParent>;
export type PublicKeyword = Node<SyntaxKind.PublicKeyword, ModifierParent>;
export type OutKeyword = Node<SyntaxKind.OutKeyword, ModifierParent>;
export type OverrideKeyword = Node<SyntaxKind.OverrideKeyword, ModifierParent>;
export type ReadonlyKeyword = Node<SyntaxKind.ReadonlyKeyword, ModifierParent | MappedTypeNode>;
export type StaticKeyword = Node<SyntaxKind.StaticKeyword, ModifierParent>;
export type Decorator = Node<
  SyntaxKind.Decorator,
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
> & {
  readonly expression: LeftHandSideExpression;
};
export type LeftHandSideExpression = PartiallyEmittedExpression | MemberExpression | CallExpression | NonNullExpression;
export type PartiallyEmittedExpression = Node<SyntaxKind.PartiallyEmittedExpression, LeftHandSideExpressionParent> & {
  readonly expression: Expression;
};
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
export type OmittedExpression = Node<SyntaxKind.OmittedExpression, ExpressionParent | ArrayBindingPattern>;
export type UnaryExpression =
  | UpdateExpression
  | DeleteExpression
  | TypeOfExpression
  | VoidExpression
  | AwaitExpression
  | TypeAssertion;
export type UpdateExpression = PrefixUnaryExpression | PostfixUnaryExpression | LeftHandSideExpression;
export type PrefixUnaryExpression = Node<
  SyntaxKind.PrefixUnaryExpression,
  | ExpressionParent
  | PrefixUnaryExpression
  | DeleteExpression
  | TypeOfExpression
  | VoidExpression
  | AwaitExpression
  | TypeAssertion
  | LiteralTypeNode
> & {
  readonly operator: PrefixUnaryOperator;
  readonly operand: UnaryExpression;
};
export type PrefixUnaryOperator =
  | SyntaxKind.PlusPlusToken
  | SyntaxKind.MinusMinusToken
  | SyntaxKind.PlusToken
  | SyntaxKind.MinusToken
  | SyntaxKind.TildeToken
  | SyntaxKind.ExclamationToken;
export type PostfixUnaryExpression = Node<
  SyntaxKind.PostfixUnaryExpression,
  | ExpressionParent
  | PrefixUnaryExpression
  | DeleteExpression
  | TypeOfExpression
  | VoidExpression
  | AwaitExpression
  | TypeAssertion
> & {
  readonly operand: LeftHandSideExpression;
  readonly operator: PostfixUnaryOperator;
};
export type PostfixUnaryOperator = SyntaxKind.PlusPlusToken | SyntaxKind.MinusMinusToken;
export type DeleteExpression = Node<
  SyntaxKind.DeleteExpression,
  | ExpressionParent
  | PrefixUnaryExpression
  | DeleteExpression
  | TypeOfExpression
  | VoidExpression
  | AwaitExpression
  | TypeAssertion
> & {
  readonly expression: UnaryExpression;
};
export type TypeOfExpression = Node<
  SyntaxKind.TypeOfExpression,
  | ExpressionParent
  | PrefixUnaryExpression
  | DeleteExpression
  | TypeOfExpression
  | VoidExpression
  | AwaitExpression
  | TypeAssertion
> & {
  readonly expression: UnaryExpression;
};
export type VoidExpression = Node<
  SyntaxKind.VoidExpression,
  | ExpressionParent
  | PrefixUnaryExpression
  | DeleteExpression
  | TypeOfExpression
  | VoidExpression
  | AwaitExpression
  | TypeAssertion
> & {
  readonly expression: UnaryExpression;
};
export type AwaitExpression = Node<
  SyntaxKind.AwaitExpression,
  | ExpressionParent
  | PrefixUnaryExpression
  | DeleteExpression
  | TypeOfExpression
  | VoidExpression
  | AwaitExpression
  | TypeAssertion
> & {
  readonly expression: UnaryExpression;
};
export type TypeAssertion = Node<
  SyntaxKind.TypeAssertionExpression,
  | ExpressionParent
  | PrefixUnaryExpression
  | DeleteExpression
  | TypeOfExpression
  | VoidExpression
  | AwaitExpression
  | TypeAssertion
> & {
  readonly type: TypeNode;
  readonly expression: UnaryExpression;
};
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
export type ThisTypeNode = Node<SyntaxKind.ThisType, TypeNodeParent>;
export type FunctionOrConstructorTypeNodeBase = FunctionTypeNode | ConstructorTypeNode;
export type FunctionTypeNode = Node<SyntaxKind.FunctionType, TypeNodeParent> & {
  readonly type: TypeNode;
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
};
export type PropertyName =
  | Identifier
  | StringLiteral
  | NoSubstitutionTemplateLiteral
  | NumericLiteral
  | ComputedPropertyName
  | PrivateIdentifier;
export type Identifier = Node<
  SyntaxKind.Identifier,
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
  | ImportSpecifier
> & {
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
};
export type StringLiteral = Node<
  SyntaxKind.StringLiteral,
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
  | ModuleDeclaration
> & {
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
};
export type NoSubstitutionTemplateLiteral = Node<
  SyntaxKind.NoSubstitutionTemplateLiteral,
  | LeftHandSideExpressionParent
  | TypeElement
  | FunctionOrConstructorTypeNodeBase
  | JSDocFunctionType
  | MethodDeclaration
  | ConstructorDeclaration
  | SemicolonClassElement
  | ClassStaticBlockDeclaration
  | LiteralTypeNode
> & {
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
  rawText?: string;
};
export type NumericLiteral = Node<
  SyntaxKind.NumericLiteral,
  | LeftHandSideExpressionParent
  | TypeElement
  | FunctionOrConstructorTypeNodeBase
  | JSDocFunctionType
  | MethodDeclaration
  | ConstructorDeclaration
  | SemicolonClassElement
  | ClassStaticBlockDeclaration
  | LiteralTypeNode
> & {
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
};
export type ComputedPropertyName = Node<
  SyntaxKind.ComputedPropertyName,
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
  | EnumMember
> & {
  readonly expression: Expression;
};
export type PrivateIdentifier = Node<
  SyntaxKind.PrivateIdentifier,
  | LeftHandSideExpressionParent
  | TypeElement
  | FunctionOrConstructorTypeNodeBase
  | JSDocFunctionType
  | MethodDeclaration
  | ConstructorDeclaration
  | SemicolonClassElement
  | ClassStaticBlockDeclaration
  | JsxTagNamePropertyAccess
> & {
  readonly escapedText: __String;
  readonly text: string;
};
export type TypeParameterDeclaration = Node<
  SyntaxKind.TypeParameter,
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
  | TypeAliasDeclaration
> & {
  readonly modifiers?: NodeArray<Modifier>;
  readonly name: Identifier;
  /** Note: Consider calling `getEffectiveConstraintOfTypeParameter` */
  readonly constraint?: TypeNode;
  readonly default?: TypeNode;
  expression?: Expression;
};
export type ParameterDeclaration = Node<
  SyntaxKind.Parameter,
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
  | FunctionDeclaration
> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly dotDotDotToken?: DotDotDotToken;
  readonly name: BindingName;
  readonly questionToken?: QuestionToken;
  readonly type?: TypeNode;
  readonly initializer?: Expression;
};
export type DotDotDotToken = Node<SyntaxKind.DotDotDotToken, ParameterDeclaration | BindingElement>;
export type BindingName = Identifier | BindingPattern;
export type BindingPattern = ObjectBindingPattern | ArrayBindingPattern;
export type ObjectBindingPattern = Node<
  SyntaxKind.ObjectBindingPattern,
  BindingElement | ParameterDeclaration | VariableDeclaration
> & {
  readonly elements: NodeArray<BindingElement>;
};
export type BindingElement = Node<SyntaxKind.BindingElement, BindingPattern> & {
  readonly propertyName?: PropertyName;
  readonly dotDotDotToken?: DotDotDotToken;
  readonly name: BindingName;
  readonly initializer?: Expression;
};
export type ArrayBindingPattern = Node<
  SyntaxKind.ArrayBindingPattern,
  BindingElement | ParameterDeclaration | VariableDeclaration
> & {
  readonly elements: NodeArray<ArrayBindingElement>;
};
export type ArrayBindingElement = BindingElement | OmittedExpression;
export type QuestionToken = Node<
  SyntaxKind.QuestionToken,
  | TypeElement
  | ParameterDeclaration
  | MappedTypeNode
  | ConditionalExpression
  | ArrowFunction
  | FunctionExpression
  | MethodDeclaration
  | PropertyDeclaration
  | ConstructorDeclaration
  | FunctionDeclaration
>;
export type ConstructorTypeNode = Node<SyntaxKind.ConstructorType, TypeNodeParent> & {
  readonly modifiers?: NodeArray<Modifier>;
  readonly type: TypeNode;
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
};
export type NodeWithTypeArguments = ImportTypeNode | TypeReferenceNode | TypeQueryNode | ExpressionWithTypeArguments;
export type ImportTypeNode = Node<SyntaxKind.ImportType, TypeNodeParent> & {
  readonly isTypeOf: boolean;
  readonly argument: TypeNode;
  readonly attributes?: ImportAttributes;
  readonly qualifier?: EntityName;
  readonly typeArguments?: NodeArray<TypeNode>;
};
export type ImportAttributes = Node<
  SyntaxKind.ImportAttributes,
  ImportTypeNode | ExportDeclaration | ImportDeclaration
> & {
  readonly token: SyntaxKind.WithKeyword | SyntaxKind.AssertKeyword;
  readonly elements: NodeArray<ImportAttribute>;
  readonly multiLine?: boolean;
};
export type ImportAttribute = Node<SyntaxKind.ImportAttribute, ImportAttributes> & {
  readonly name: ImportAttributeName;
  readonly value: Expression;
};
export type ImportAttributeName = Identifier | StringLiteral;
export type EntityName = Identifier | QualifiedName;
export type QualifiedName = Node<
  SyntaxKind.QualifiedName,
  | JSDocPropertyLikeTag
  | QualifiedName
  | ImportTypeNode
  | TypeReferenceNode
  | TypeQueryNode
  | JSDocLink
  | JSDocMemberName
  | JSDocLinkCode
  | JSDocLinkPlain
  | ImportEqualsDeclaration
> & {
  readonly left: EntityName;
  readonly right: Identifier;
};
export type TypeReferenceNode = Node<SyntaxKind.TypeReference, TypeNodeParent> & {
  readonly typeName: EntityName;
  readonly typeArguments?: NodeArray<TypeNode>;
};
export type TypeQueryNode = Node<SyntaxKind.TypeQuery, TypeNodeParent> & {
  readonly exprName: EntityName;
  readonly typeArguments?: NodeArray<TypeNode>;
};
export type ExpressionWithTypeArguments = Node<
  SyntaxKind.ExpressionWithTypeArguments,
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
  | Decorator
> & {
  readonly expression: LeftHandSideExpression;
  readonly typeArguments?: NodeArray<TypeNode>;
};
export type TypePredicateNode = Node<SyntaxKind.TypePredicate, TypeNodeParent> & {
  readonly assertsModifier?: AssertsKeyword;
  readonly parameterName: Identifier | ThisTypeNode;
  readonly type?: TypeNode;
};
export type AssertsKeyword = Node<SyntaxKind.AssertsKeyword, TypePredicateNode>;
export type TypeLiteralNode = Node<SyntaxKind.TypeLiteral, TypeNodeParent> & {
  readonly members: NodeArray<TypeElement>;
};
export type TypeElement =
  | CallSignatureDeclaration
  | ConstructSignatureDeclaration
  | PropertySignature
  | MethodSignature
  | GetAccessorDeclaration
  | SetAccessorDeclaration
  | IndexSignatureDeclaration;
export type CallSignatureDeclaration = Node<
  SyntaxKind.CallSignature,
  TypeLiteralNode | MappedTypeNode | InterfaceDeclaration
> & {
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  readonly questionToken?: QuestionToken | undefined;
};
export type ConstructSignatureDeclaration = Node<
  SyntaxKind.ConstructSignature,
  TypeLiteralNode | MappedTypeNode | InterfaceDeclaration
> & {
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  readonly questionToken?: QuestionToken | undefined;
};
export type PropertySignature = Node<
  SyntaxKind.PropertySignature,
  TypeLiteralNode | MappedTypeNode | InterfaceDeclaration
> & {
  readonly modifiers?: NodeArray<Modifier>;
  readonly name: PropertyName;
  readonly questionToken?: QuestionToken;
  readonly type?: TypeNode;
};
export type MethodSignature = Node<
  SyntaxKind.MethodSignature,
  TypeLiteralNode | MappedTypeNode | InterfaceDeclaration
> & {
  readonly modifiers?: NodeArray<Modifier>;
  readonly name: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
  readonly questionToken?: QuestionToken | undefined;
};
export type GetAccessorDeclaration = Node<
  SyntaxKind.GetAccessor,
  | ObjectLiteralExpressionBase
  | TypeLiteralNode
  | MappedTypeNode
  | InterfaceDeclaration
  | ClassExpression
  | ClassDeclaration
> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: PropertyName;
  readonly body?: FunctionBody;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
};
export type FunctionBody = Block;
export type Block = Node<
  SyntaxKind.Block,
  | StatementParent
  | AccessorDeclaration
  | ArrowFunction
  | FunctionExpression
  | MethodDeclaration
  | ConstructorDeclaration
  | FunctionDeclaration
  | ClassStaticBlockDeclaration
  | TryStatement
  | CatchClause
> & {
  readonly statements: NodeArray<Statement>;
};
export type AsteriskToken = Node<
  SyntaxKind.AsteriskToken,
  | AccessorDeclaration
  | YieldExpression
  | ArrowFunction
  | FunctionExpression
  | MethodDeclaration
  | ConstructorDeclaration
  | FunctionDeclaration
>;
export type ExclamationToken = Node<
  SyntaxKind.ExclamationToken,
  | AccessorDeclaration
  | ArrowFunction
  | FunctionExpression
  | MethodDeclaration
  | PropertyDeclaration
  | ConstructorDeclaration
  | FunctionDeclaration
  | VariableDeclaration
>;
export type SetAccessorDeclaration = Node<
  SyntaxKind.SetAccessor,
  | ObjectLiteralExpressionBase
  | TypeLiteralNode
  | MappedTypeNode
  | InterfaceDeclaration
  | ClassExpression
  | ClassDeclaration
> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: PropertyName;
  readonly body?: FunctionBody;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
};
export type IndexSignatureDeclaration = Node<
  SyntaxKind.IndexSignature,
  TypeLiteralNode | MappedTypeNode | InterfaceDeclaration | ClassExpression | ClassDeclaration
> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly type: TypeNode;
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly questionToken?: QuestionToken | undefined;
};
export type ArrayTypeNode = Node<SyntaxKind.ArrayType, TypeNodeParent> & {
  readonly elementType: TypeNode;
};
export type TupleTypeNode = Node<SyntaxKind.TupleType, TypeNodeParent> & {
  readonly elements: NodeArray<TypeNode | NamedTupleMember>;
};
export type NamedTupleMember = Node<SyntaxKind.NamedTupleMember, TypeNodeParent | SyntheticExpression> & {
  readonly dotDotDotToken?: Node<SyntaxKind.DotDotDotToken, NamedTupleMember>;
  readonly name: Identifier;
  readonly questionToken?: Node<SyntaxKind.QuestionToken, NamedTupleMember>;
  readonly type: TypeNode;
};
export type OptionalTypeNode = Node<SyntaxKind.OptionalType, TypeNodeParent> & {
  readonly type: TypeNode;
};
export type RestTypeNode = Node<SyntaxKind.RestType, TypeNodeParent> & {
  readonly type: TypeNode;
};
export type UnionTypeNode = Node<SyntaxKind.UnionType, TypeNodeParent> & {
  readonly types: NodeArray<TypeNode>;
};
export type IntersectionTypeNode = Node<SyntaxKind.IntersectionType, TypeNodeParent> & {
  readonly types: NodeArray<TypeNode>;
};
export type ConditionalTypeNode = Node<SyntaxKind.ConditionalType, TypeNodeParent> & {
  readonly checkType: TypeNode;
  readonly extendsType: TypeNode;
  readonly trueType: TypeNode;
  readonly falseType: TypeNode;
};
export type InferTypeNode = Node<SyntaxKind.InferType, TypeNodeParent> & {
  readonly typeParameter: TypeParameterDeclaration;
};
export type ParenthesizedTypeNode = Node<SyntaxKind.ParenthesizedType, TypeNodeParent> & {
  readonly type: TypeNode;
};
export type TypeOperatorNode = Node<SyntaxKind.TypeOperator, TypeNodeParent> & {
  readonly operator: SyntaxKind.KeyOfKeyword | SyntaxKind.UniqueKeyword | SyntaxKind.ReadonlyKeyword;
  readonly type: TypeNode;
};
export type IndexedAccessTypeNode = Node<SyntaxKind.IndexedAccessType, TypeNodeParent> & {
  readonly objectType: TypeNode;
  readonly indexType: TypeNode;
};
export type MappedTypeNode = Node<SyntaxKind.MappedType, TypeNodeParent> & {
  readonly readonlyToken?: ReadonlyKeyword | PlusToken | MinusToken;
  readonly typeParameter: TypeParameterDeclaration;
  readonly nameType?: TypeNode;
  readonly questionToken?: QuestionToken | PlusToken | MinusToken;
  readonly type?: TypeNode;
  /** Used only to produce grammar errors */
  readonly members?: NodeArray<TypeElement>;
};
export type PlusToken = Node<SyntaxKind.PlusToken, MappedTypeNode>;
export type MinusToken = Node<SyntaxKind.MinusToken, MappedTypeNode>;
export type LiteralTypeNode = Node<SyntaxKind.LiteralType, TypeNodeParent> & {
  readonly literal: NullLiteral | BooleanLiteral | LiteralExpression | PrefixUnaryExpression;
};
export type NullLiteral = Node<SyntaxKind.NullKeyword, LeftHandSideExpressionParent | LiteralTypeNode>;
export type BooleanLiteral = TrueLiteral | FalseLiteral;
export type TrueLiteral = Node<SyntaxKind.TrueKeyword, LeftHandSideExpressionParent | LiteralTypeNode>;
export type FalseLiteral = Node<SyntaxKind.FalseKeyword, LeftHandSideExpressionParent | LiteralTypeNode>;
export type LiteralExpression =
  | StringLiteral
  | RegularExpressionLiteral
  | NoSubstitutionTemplateLiteral
  | NumericLiteral
  | BigIntLiteral;
export type RegularExpressionLiteral = Node<
  SyntaxKind.RegularExpressionLiteral,
  LeftHandSideExpressionParent | LiteralTypeNode
> & {
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
};
export type BigIntLiteral = Node<SyntaxKind.BigIntLiteral, LeftHandSideExpressionParent | LiteralTypeNode> & {
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
};
export type TemplateLiteralTypeNode = Node<SyntaxKind.TemplateLiteralType, TypeNodeParent> & {
  readonly head: TemplateHead;
  readonly templateSpans: NodeArray<TemplateLiteralTypeSpan>;
};
export type TemplateHead = Node<SyntaxKind.TemplateHead, TemplateLiteralTypeNode | TemplateExpression> & {
  rawText?: string;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
};
export type TemplateLiteralTypeSpan = Node<
  SyntaxKind.TemplateLiteralTypeSpan,
  TypeNodeParent | TemplateLiteralTypeNode
> & {
  readonly type: TypeNode;
  readonly literal: TemplateMiddle | TemplateTail;
};
export type TemplateMiddle = Node<SyntaxKind.TemplateMiddle, TemplateLiteralTypeSpan | TemplateSpan> & {
  rawText?: string;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
};
export type TemplateTail = Node<SyntaxKind.TemplateTail, TemplateLiteralTypeSpan | TemplateSpan> & {
  rawText?: string;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
};
export type JSDocTypeExpression = Node<
  SyntaxKind.JSDocTypeExpression,
  TypeNodeParent | JSDocPropertyLikeTag | JSDocTemplateTag | JSDocReturnTag
> & {
  readonly type: TypeNode;
};
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
export type JSDocAllType = Node<SyntaxKind.JSDocAllType, TypeNodeParent>;
export type JSDocUnknownType = Node<SyntaxKind.JSDocUnknownType, TypeNodeParent>;
export type JSDocNonNullableType = Node<SyntaxKind.JSDocNonNullableType, TypeNodeParent> & {
  readonly type: TypeNode;
  readonly postfix: boolean;
};
export type JSDocNullableType = Node<SyntaxKind.JSDocNullableType, TypeNodeParent> & {
  readonly type: TypeNode;
  readonly postfix: boolean;
};
export type JSDocOptionalType = Node<SyntaxKind.JSDocOptionalType, TypeNodeParent> & {
  readonly type: TypeNode;
};
export type JSDocFunctionType = Node<SyntaxKind.JSDocFunctionType, TypeNodeParent> & {
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
};
export type JSDocVariadicType = Node<SyntaxKind.JSDocVariadicType, TypeNodeParent> & {
  readonly type: TypeNode;
};
export type JSDocNamepathType = Node<SyntaxKind.JSDocNamepathType, TypeNodeParent> & {
  readonly type: TypeNode;
};
export type JSDocSignature = Node<SyntaxKind.JSDocSignature, TypeNodeParent> & {
  readonly typeParameters?: readonly JSDocTemplateTag[];
  readonly parameters: readonly JSDocParameterTag[];
  readonly type: JSDocReturnTag | undefined;
};
export type JSDocTemplateTag = Node<SyntaxKind.JSDocTemplateTag, JSDocSignature> & {
  readonly constraint: JSDocTypeExpression | undefined;
  readonly typeParameters: NodeArray<TypeParameterDeclaration>;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
};
export type JSDocComment = JSDocText | JSDocLink | JSDocLinkCode | JSDocLinkPlain;
export type JSDocText = Node<SyntaxKind.JSDocText, JSDocPropertyLikeTag | JSDocTemplateTag | JSDocReturnTag> & {
  text: string;
};
export type JSDocLink = Node<SyntaxKind.JSDocLink, JSDocPropertyLikeTag | JSDocTemplateTag | JSDocReturnTag> & {
  readonly name?: EntityName | JSDocMemberName;
  text: string;
};
export type JSDocMemberName = Node<
  SyntaxKind.JSDocMemberName,
  JSDocMemberName | JSDocLink | JSDocLinkCode | JSDocLinkPlain
> & {
  readonly left: EntityName | JSDocMemberName;
  readonly right: Identifier;
};
export type JSDocLinkCode = Node<SyntaxKind.JSDocLinkCode, JSDocPropertyLikeTag | JSDocTemplateTag | JSDocReturnTag> & {
  readonly name?: EntityName | JSDocMemberName;
  text: string;
};
export type JSDocLinkPlain = Node<
  SyntaxKind.JSDocLinkPlain,
  JSDocPropertyLikeTag | JSDocTemplateTag | JSDocReturnTag
> & {
  readonly name?: EntityName | JSDocMemberName;
  text: string;
};
export type JSDocParameterTag = Node<SyntaxKind.JSDocParameterTag, JSDocSignature | JSDocTypeLiteral> & {
  readonly name: EntityName;
  readonly typeExpression?: JSDocTypeExpression;
  /** Whether the property name came before the type -- non-standard for JSDoc, but Typescript-like */
  readonly isNameFirst: boolean;
  readonly isBracketed: boolean;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
};
export type JSDocReturnTag = Node<SyntaxKind.JSDocReturnTag, JSDocSignature> & {
  readonly typeExpression?: JSDocTypeExpression;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
};
export type JSDocTypeLiteral = Node<SyntaxKind.JSDocTypeLiteral, TypeNodeParent> & {
  readonly jsDocPropertyTags?: readonly JSDocPropertyLikeTag[];
  /** If true, then this type literal represents an *array* of its type. */
  readonly isArrayType: boolean;
};
export type JSDocPropertyLikeTag = JSDocPropertyTag | JSDocParameterTag;
export type JSDocPropertyTag = Node<SyntaxKind.JSDocPropertyTag, JSDocTypeLiteral> & {
  readonly name: EntityName;
  readonly typeExpression?: JSDocTypeExpression;
  /** Whether the property name came before the type -- non-standard for JSDoc, but Typescript-like */
  readonly isNameFirst: boolean;
  readonly isBracketed: boolean;
  readonly tagName: Identifier;
  readonly comment?: string | NodeArray<JSDocComment>;
};
export type YieldExpression = Node<SyntaxKind.YieldExpression, ExpressionParent> & {
  readonly asteriskToken?: AsteriskToken;
  readonly expression?: Expression;
};
export type SyntheticExpression = Node<SyntaxKind.SyntheticExpression, ExpressionParent> & {
  readonly isSpread: boolean;
  readonly type: Type;
  readonly tupleNameSource?: ParameterDeclaration | NamedTupleMember;
};
export type BinaryExpression = Node<SyntaxKind.BinaryExpression, ExpressionParent> & {
  readonly left: Expression;
  readonly operatorToken: BinaryOperatorToken;
  readonly right: Expression;
};
export type BinaryOperatorToken = Node<BinaryOperator, BinaryExpression>;
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
export type ConditionalExpression = Node<SyntaxKind.ConditionalExpression, ExpressionParent> & {
  readonly condition: Expression;
  readonly questionToken: QuestionToken;
  readonly whenTrue: Expression;
  readonly colonToken: ColonToken;
  readonly whenFalse: Expression;
};
export type ColonToken = Node<SyntaxKind.ColonToken, ConditionalExpression>;
export type ArrowFunction = Node<SyntaxKind.ArrowFunction, ExpressionParent> & {
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
};
export type EqualsGreaterThanToken = Node<SyntaxKind.EqualsGreaterThanToken, ArrowFunction>;
export type ConciseBody = FunctionBody | Expression;
export type SpreadElement = Node<SyntaxKind.SpreadElement, ExpressionParent> & {
  readonly expression: Expression;
};
export type AsExpression = Node<SyntaxKind.AsExpression, ExpressionParent> & {
  readonly expression: Expression;
  readonly type: TypeNode;
};
export type SatisfiesExpression = Node<SyntaxKind.SatisfiesExpression, ExpressionParent> & {
  readonly expression: Expression;
  readonly type: TypeNode;
};
export type JsxOpeningElement = Node<SyntaxKind.JsxOpeningElement, ExpressionParent | JsxElement> & {
  readonly tagName: JsxTagNameExpression;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly attributes: JsxAttributes;
};
export type JsxTagNameExpression = Identifier | ThisExpression | JsxTagNamePropertyAccess | JsxNamespacedName;
export type ThisExpression = Node<
  SyntaxKind.ThisKeyword,
  | LeftHandSideExpressionParent
  | JsxOpeningElement
  | JsxSelfClosingElement
  | JsxClosingElement
  | JsxTagNamePropertyAccess
>;
export type JsxTagNamePropertyAccess = Node<
  SyntaxKind.PropertyAccessExpression,
  JsxTagNamePropertyAccess | JsxOpeningElement | JsxSelfClosingElement | JsxClosingElement
> & {
  readonly expression: Identifier | ThisExpression | JsxTagNamePropertyAccess;
  readonly questionDotToken?: QuestionDotToken;
  readonly name: MemberName;
};
export type QuestionDotToken = Node<
  SyntaxKind.QuestionDotToken,
  JsxTagNamePropertyAccess | PropertyAccessExpression | ElementAccessExpression | CallExpression
>;
export type MemberName = Identifier | PrivateIdentifier;
export type JsxNamespacedName = Node<
  SyntaxKind.JsxNamespacedName,
  JsxOpeningElement | JsxSelfClosingElement | JsxClosingElement | JsxAttribute
> & {
  readonly name: Identifier;
  readonly namespace: Identifier;
};
export type JsxAttributes = Node<
  SyntaxKind.JsxAttributes,
  LeftHandSideExpressionParent | JsxSelfClosingElement | JsxOpeningElement
> & {
  readonly properties: NodeArray<JsxAttributeLike>;
};
export type JsxAttributeLike = JsxAttribute | JsxSpreadAttribute;
export type JsxAttribute = Node<SyntaxKind.JsxAttribute, JsxAttributes> & {
  readonly name: JsxAttributeName;
  readonly initializer?: JsxAttributeValue;
};
export type JsxAttributeName = Identifier | JsxNamespacedName;
export type JsxAttributeValue = StringLiteral | JsxExpression | JsxElement | JsxSelfClosingElement | JsxFragment;
export type JsxExpression = Node<
  SyntaxKind.JsxExpression,
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
  | ImportDeclaration
> & {
  readonly dotDotDotToken?: Node<SyntaxKind.DotDotDotToken, JsxExpression>;
  readonly expression?: Expression;
};
export type JsxElement = Node<
  SyntaxKind.JsxElement,
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
  | Decorator
> & {
  readonly openingElement: JsxOpeningElement;
  readonly children: NodeArray<JsxChild>;
  readonly closingElement: JsxClosingElement;
};
export type JsxChild = JsxText | JsxExpression | JsxElement | JsxSelfClosingElement | JsxFragment;
export type JsxText = Node<SyntaxKind.JsxText, JsxFragment | JsxElement> & {
  readonly containsOnlyTriviaWhiteSpaces: boolean;
  text: string;
  isUnterminated?: boolean;
  hasExtendedUnicodeEscape?: boolean;
};
export type JsxSelfClosingElement = Node<
  SyntaxKind.JsxSelfClosingElement,
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
  | Decorator
> & {
  readonly tagName: JsxTagNameExpression;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly attributes: JsxAttributes;
};
export type JsxFragment = Node<
  SyntaxKind.JsxFragment,
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
  | Decorator
> & {
  readonly openingFragment: JsxOpeningFragment;
  readonly children: NodeArray<JsxChild>;
  readonly closingFragment: JsxClosingFragment;
};
export type JsxOpeningFragment = Node<SyntaxKind.JsxOpeningFragment, ExpressionParent | JsxFragment>;
export type JsxClosingFragment = Node<SyntaxKind.JsxClosingFragment, ExpressionParent | JsxFragment>;
export type JsxClosingElement = Node<SyntaxKind.JsxClosingElement, JsxElement> & {
  readonly tagName: JsxTagNameExpression;
};
export type JsxSpreadAttribute = Node<SyntaxKind.JsxSpreadAttribute, JsxAttributes> & {
  readonly expression: Expression;
  readonly name?: PropertyName;
};
export type CommaListExpression = Node<SyntaxKind.CommaListExpression, ExpressionParent> & {
  readonly elements: NodeArray<Expression>;
};
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
export type SuperExpression = Node<SyntaxKind.SuperKeyword, LeftHandSideExpressionParent>;
export type ImportExpression = Node<SyntaxKind.ImportKeyword, LeftHandSideExpressionParent>;
export type FunctionExpression = Node<SyntaxKind.FunctionExpression, LeftHandSideExpressionParent> & {
  readonly modifiers?: NodeArray<Modifier>;
  readonly name?: Identifier;
  readonly body: FunctionBody;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
};
export type TemplateExpression = Node<SyntaxKind.TemplateExpression, LeftHandSideExpressionParent> & {
  readonly head: TemplateHead;
  readonly templateSpans: NodeArray<TemplateSpan>;
};
export type TemplateSpan = Node<SyntaxKind.TemplateSpan, TemplateExpression> & {
  readonly expression: Expression;
  readonly literal: TemplateMiddle | TemplateTail;
};
export type ParenthesizedExpression = Node<SyntaxKind.ParenthesizedExpression, LeftHandSideExpressionParent> & {
  readonly expression: Expression;
};
export type ArrayLiteralExpression = Node<SyntaxKind.ArrayLiteralExpression, LeftHandSideExpressionParent> & {
  readonly elements: NodeArray<Expression>;
};
export type ObjectLiteralExpressionBase = ObjectLiteralExpression;
export type ObjectLiteralExpression = Node<SyntaxKind.ObjectLiteralExpression, LeftHandSideExpressionParent> & {
  readonly properties: NodeArray<ObjectLiteralElementLike>;
};
export type ObjectLiteralElementLike =
  | PropertyAssignment
  | ShorthandPropertyAssignment
  | SpreadAssignment
  | MethodDeclaration
  | AccessorDeclaration;
export type PropertyAssignment = Node<SyntaxKind.PropertyAssignment, ObjectLiteralExpressionBase> & {
  readonly name: PropertyName;
  readonly initializer: Expression;
};
export type ShorthandPropertyAssignment = Node<SyntaxKind.ShorthandPropertyAssignment, ObjectLiteralExpressionBase> & {
  readonly name: Identifier;
  readonly equalsToken?: EqualsToken;
  readonly objectAssignmentInitializer?: Expression;
};
export type EqualsToken = Node<SyntaxKind.EqualsToken, ShorthandPropertyAssignment>;
export type SpreadAssignment = Node<SyntaxKind.SpreadAssignment, ObjectLiteralExpressionBase> & {
  readonly expression: Expression;
  readonly name?: PropertyName;
};
export type MethodDeclaration = Node<
  SyntaxKind.MethodDeclaration,
  ObjectLiteralExpressionBase | ClassExpression | ClassDeclaration
> & {
  readonly modifiers?: NodeArray<ModifierLike> | undefined;
  readonly name: PropertyName;
  readonly body?: FunctionBody | undefined;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
};
export type AccessorDeclaration = GetAccessorDeclaration | SetAccessorDeclaration;
export type NewExpression = Node<SyntaxKind.NewExpression, LeftHandSideExpressionParent> & {
  readonly expression: LeftHandSideExpression;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly arguments?: NodeArray<Expression>;
};
export type MetaProperty = Node<SyntaxKind.MetaProperty, LeftHandSideExpressionParent> & {
  readonly keywordToken: SyntaxKind.NewKeyword | SyntaxKind.ImportKeyword;
  readonly name: Identifier;
};
export type MissingDeclaration = Node<
  SyntaxKind.MissingDeclaration,
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
  | Decorator
> & {
  readonly name?: Identifier;
};
export type ClassExpression = Node<SyntaxKind.ClassExpression, LeftHandSideExpressionParent> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name?: Identifier;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration>;
  readonly heritageClauses?: NodeArray<HeritageClause>;
  readonly members: NodeArray<ClassElement>;
};
export type HeritageClause = Node<
  SyntaxKind.HeritageClause,
  ClassExpression | ClassDeclaration | InterfaceDeclaration
> & {
  readonly token: SyntaxKind.ExtendsKeyword | SyntaxKind.ImplementsKeyword;
  readonly types: NodeArray<ExpressionWithTypeArguments>;
};
export type ClassElement =
  | PropertyDeclaration
  | MethodDeclaration
  | ConstructorDeclaration
  | SemicolonClassElement
  | GetAccessorDeclaration
  | SetAccessorDeclaration
  | IndexSignatureDeclaration
  | ClassStaticBlockDeclaration;
export type PropertyDeclaration = Node<SyntaxKind.PropertyDeclaration, ClassExpression | ClassDeclaration> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: PropertyName;
  readonly questionToken?: QuestionToken;
  readonly exclamationToken?: ExclamationToken;
  readonly type?: TypeNode;
  readonly initializer?: Expression;
};
export type ConstructorDeclaration = Node<SyntaxKind.Constructor, ClassExpression | ClassDeclaration> & {
  readonly modifiers?: NodeArray<ModifierLike> | undefined;
  readonly body?: FunctionBody | undefined;
  readonly asteriskToken?: AsteriskToken | undefined;
  readonly questionToken?: QuestionToken | undefined;
  readonly exclamationToken?: ExclamationToken | undefined;
  readonly name?: PropertyName;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration> | undefined;
  readonly parameters: NodeArray<ParameterDeclaration>;
  readonly type?: TypeNode | undefined;
};
export type SemicolonClassElement = Node<SyntaxKind.SemicolonClassElement, ClassExpression | ClassDeclaration> & {
  readonly name?: PropertyName;
};
export type ClassStaticBlockDeclaration = Node<
  SyntaxKind.ClassStaticBlockDeclaration,
  ClassExpression | ClassDeclaration
> & {
  readonly body: Block;
  readonly name?: PropertyName;
};
export type PropertyAccessExpression = Node<SyntaxKind.PropertyAccessExpression, LeftHandSideExpressionParent> & {
  readonly expression: LeftHandSideExpression;
  readonly questionDotToken?: QuestionDotToken;
  readonly name: MemberName;
};
export type ElementAccessExpression = Node<SyntaxKind.ElementAccessExpression, LeftHandSideExpressionParent> & {
  readonly expression: LeftHandSideExpression;
  readonly questionDotToken?: QuestionDotToken;
  readonly argumentExpression: Expression;
};
export type TaggedTemplateExpression = Node<SyntaxKind.TaggedTemplateExpression, LeftHandSideExpressionParent> & {
  readonly tag: LeftHandSideExpression;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly template: TemplateLiteral;
};
export type TemplateLiteral = TemplateExpression | NoSubstitutionTemplateLiteral;
export type CallExpression = Node<SyntaxKind.CallExpression, LeftHandSideExpressionParent> & {
  readonly expression: LeftHandSideExpression;
  readonly questionDotToken?: QuestionDotToken;
  readonly typeArguments?: NodeArray<TypeNode>;
  readonly arguments: NodeArray<Expression>;
};
export type NonNullExpression = Node<SyntaxKind.NonNullExpression, LeftHandSideExpressionParent> & {
  readonly expression: Expression;
};
export type ClassDeclaration = Node<SyntaxKind.ClassDeclaration, StatementParent> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  /** May be undefined in `export default class { ... }`. */
  readonly name?: Identifier;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration>;
  readonly heritageClauses?: NodeArray<HeritageClause>;
  readonly members: NodeArray<ClassElement>;
};
export type InterfaceDeclaration = Node<SyntaxKind.InterfaceDeclaration, StatementParent> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: Identifier;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration>;
  readonly heritageClauses?: NodeArray<HeritageClause>;
  readonly members: NodeArray<TypeElement>;
};
export type TypeAliasDeclaration = Node<SyntaxKind.TypeAliasDeclaration, StatementParent> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: Identifier;
  readonly typeParameters?: NodeArray<TypeParameterDeclaration>;
  readonly type: TypeNode;
};
export type EnumDeclaration = Node<SyntaxKind.EnumDeclaration, StatementParent> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: Identifier;
  readonly members: NodeArray<EnumMember>;
};
export type EnumMember = Node<SyntaxKind.EnumMember, EnumDeclaration> & {
  readonly name: PropertyName;
  readonly initializer?: Expression;
};
export type ModuleDeclaration = Node<SyntaxKind.ModuleDeclaration, StatementParent> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: ModuleName;
  readonly body?: ModuleBody | JSDocNamespaceDeclaration;
};
export type ModuleName = Identifier | StringLiteral;
export type ModuleBody = NamespaceBody | JSDocNamespaceBody;
export type NamespaceBody = ModuleBlock | NamespaceDeclaration;
export type ModuleBlock = Node<
  SyntaxKind.ModuleBlock,
  | CaseOrDefaultClause
  | IterationStatement
  | NamespaceBody
  | ModuleDeclaration
  | Block
  | IfStatement
  | WithStatement
  | LabeledStatement
  | SourceFile
> & {
  readonly statements: NodeArray<Statement>;
};
export type NamespaceDeclaration = Node<SyntaxKind.ModuleDeclaration, NamespaceDeclaration | ModuleDeclaration> & {
  readonly name: Identifier;
  readonly body: NamespaceBody;
  readonly modifiers?: NodeArray<ModifierLike>;
};
export type JSDocNamespaceBody = Identifier | JSDocNamespaceDeclaration;
export type JSDocNamespaceDeclaration = Node<
  SyntaxKind.ModuleDeclaration,
  JSDocNamespaceDeclaration | ModuleDeclaration
> & {
  readonly name: Identifier;
  readonly body?: JSDocNamespaceBody;
  readonly modifiers?: NodeArray<ModifierLike>;
};
export type ImportEqualsDeclaration = Node<SyntaxKind.ImportEqualsDeclaration, StatementParent> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly name: Identifier;
  readonly isTypeOnly: boolean;
  readonly moduleReference: ModuleReference;
};
export type ModuleReference = EntityName | ExternalModuleReference;
export type ExternalModuleReference = Node<SyntaxKind.ExternalModuleReference, ImportEqualsDeclaration> & {
  readonly expression: Expression;
};
export type NamespaceExportDeclaration = Node<SyntaxKind.NamespaceExportDeclaration, StatementParent> & {
  readonly name: Identifier;
};
export type ExportDeclaration = Node<SyntaxKind.ExportDeclaration, StatementParent> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly isTypeOnly: boolean;
  /** Will not be assigned in the case of `export * from "foo";` */
  readonly exportClause?: NamedExportBindings;
  /** If this is not a StringLiteral it will be a grammar error. */
  readonly moduleSpecifier?: Expression;
  readonly attributes?: ImportAttributes;
  readonly name?: Identifier | StringLiteral | NumericLiteral;
};
export type NamedExportBindings = NamespaceExport | NamedExports;
export type NamespaceExport = Node<SyntaxKind.NamespaceExport, ExportDeclaration> & {
  readonly name: Identifier;
};
export type NamedExports = Node<SyntaxKind.NamedExports, ExportDeclaration> & {
  readonly elements: NodeArray<ExportSpecifier>;
};
export type ExportSpecifier = Node<SyntaxKind.ExportSpecifier, NamedExports> & {
  readonly isTypeOnly: boolean;
  readonly propertyName?: Identifier;
  readonly name: Identifier;
};
export type ExportAssignment = Node<SyntaxKind.ExportAssignment, StatementParent> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly isExportEquals?: boolean;
  readonly expression: Expression;
  readonly name?: Identifier | StringLiteral | NumericLiteral;
};
export type NotEmittedStatement = Node<SyntaxKind.NotEmittedStatement, StatementParent>;
export type EmptyStatement = Node<SyntaxKind.EmptyStatement, StatementParent>;
export type DebuggerStatement = Node<SyntaxKind.DebuggerStatement, StatementParent>;
export type VariableStatement = Node<SyntaxKind.VariableStatement, StatementParent> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly declarationList: VariableDeclarationList;
};
export type VariableDeclarationList = Node<
  SyntaxKind.VariableDeclarationList,
  VariableStatement | ForStatement | ForInStatement | ForOfStatement
> & {
  readonly declarations: NodeArray<VariableDeclaration>;
};
export type VariableDeclaration = Node<SyntaxKind.VariableDeclaration, VariableDeclarationList | CatchClause> & {
  readonly name: BindingName;
  readonly exclamationToken?: ExclamationToken;
  readonly type?: TypeNode;
  readonly initializer?: Expression;
};
export type ExpressionStatement = Node<SyntaxKind.ExpressionStatement, StatementParent> & {
  readonly expression: Expression;
};
export type IfStatement = Node<SyntaxKind.IfStatement, StatementParent> & {
  readonly expression: Expression;
  readonly thenStatement: Statement;
  readonly elseStatement?: Statement;
};
export type IterationStatement = DoStatement | WhileStatement | ForStatement | ForInStatement | ForOfStatement;
export type DoStatement = Node<SyntaxKind.DoStatement, StatementParent> & {
  readonly expression: Expression;
  readonly statement: Statement;
};
export type WhileStatement = Node<SyntaxKind.WhileStatement, StatementParent> & {
  readonly expression: Expression;
  readonly statement: Statement;
};
export type ForStatement = Node<SyntaxKind.ForStatement, StatementParent> & {
  readonly initializer?: ForInitializer;
  readonly condition?: Expression;
  readonly incrementor?: Expression;
  readonly statement: Statement;
};
export type ForInitializer = VariableDeclarationList | Expression;
export type ForInStatement = Node<SyntaxKind.ForInStatement, StatementParent> & {
  readonly initializer: ForInitializer;
  readonly expression: Expression;
  readonly statement: Statement;
};
export type ForOfStatement = Node<SyntaxKind.ForOfStatement, StatementParent> & {
  readonly awaitModifier?: AwaitKeyword;
  readonly initializer: ForInitializer;
  readonly expression: Expression;
  readonly statement: Statement;
};
export type AwaitKeyword = Node<SyntaxKind.AwaitKeyword, ForOfStatement>;
export type BreakStatement = Node<SyntaxKind.BreakStatement, StatementParent> & {
  readonly label?: Identifier;
};
export type ContinueStatement = Node<SyntaxKind.ContinueStatement, StatementParent> & {
  readonly label?: Identifier;
};
export type ReturnStatement = Node<SyntaxKind.ReturnStatement, StatementParent> & {
  readonly expression?: Expression;
};
export type WithStatement = Node<SyntaxKind.WithStatement, StatementParent> & {
  readonly expression: Expression;
  readonly statement: Statement;
};
export type SwitchStatement = Node<SyntaxKind.SwitchStatement, StatementParent> & {
  readonly expression: Expression;
  readonly caseBlock: CaseBlock;
  possiblyExhaustive?: boolean;
};
export type CaseBlock = Node<SyntaxKind.CaseBlock, SwitchStatement> & {
  readonly clauses: NodeArray<CaseOrDefaultClause>;
};
export type CaseOrDefaultClause = CaseClause | DefaultClause;
export type CaseClause = Node<SyntaxKind.CaseClause, CaseBlock> & {
  readonly expression: Expression;
  readonly statements: NodeArray<Statement>;
};
export type DefaultClause = Node<SyntaxKind.DefaultClause, CaseBlock> & {
  readonly statements: NodeArray<Statement>;
};
export type LabeledStatement = Node<SyntaxKind.LabeledStatement, StatementParent> & {
  readonly label: Identifier;
  readonly statement: Statement;
};
export type ThrowStatement = Node<SyntaxKind.ThrowStatement, StatementParent> & {
  readonly expression: Expression;
};
export type TryStatement = Node<SyntaxKind.TryStatement, StatementParent> & {
  readonly tryBlock: Block;
  readonly catchClause?: CatchClause;
  readonly finallyBlock?: Block;
};
export type CatchClause = Node<SyntaxKind.CatchClause, TryStatement> & {
  readonly variableDeclaration?: VariableDeclaration;
  readonly block: Block;
};
export type ImportDeclaration = Node<SyntaxKind.ImportDeclaration, StatementParent> & {
  readonly modifiers?: NodeArray<ModifierLike>;
  readonly importClause?: ImportClause;
  /** If this is not a StringLiteral it will be a grammar error. */
  readonly moduleSpecifier: Expression;
  readonly attributes?: ImportAttributes;
};
export type ImportClause = Node<SyntaxKind.ImportClause, ImportDeclaration> & {
  readonly isTypeOnly: boolean;
  readonly name?: Identifier;
  readonly namedBindings?: NamedImportBindings;
};
export type NamedImportBindings = NamespaceImport | NamedImports;
export type NamespaceImport = Node<SyntaxKind.NamespaceImport, ImportClause> & {
  readonly name: Identifier;
};
export type NamedImports = Node<SyntaxKind.NamedImports, ImportClause> & {
  readonly elements: NodeArray<ImportSpecifier>;
};
export type ImportSpecifier = Node<SyntaxKind.ImportSpecifier, NamedImports> & {
  readonly propertyName?: Identifier;
  readonly name: Identifier;
  readonly isTypeOnly: boolean;
};

interface NodeArray<T> extends ReadonlyArray<T>, ReadonlyTextRange {
  readonly hasTrailingComma: boolean;
}
interface Node<Kind extends SyntaxKind, Parent> extends ReadonlyTextRange {
  readonly kind: Kind;
  readonly parent: Parent;
  readonly flags: NodeFlags;
  getSourceFile(): SourceFile;
  getStart(sourceFile?: SourceFile, includeJsDocComment?: boolean): number;
  getFullStart(): number;
  getEnd(): number;
  getWidth(): number;
  getFullWidth(): number;
  getLeadingTriviaWidth(sourceFile?: SourceFile): number;
  getFullText(sourceFile?: SourceFile): string;
  getText(sourceFile?: SourceFile): string;
  /* getChildren, getChildAt, ... are removed until better typed  */
}

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
