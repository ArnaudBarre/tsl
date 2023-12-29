### Node diffs

| Kind                    | Node                          |
| ----------------------- | ----------------------------- |
| ArrayType               | ArrayTypeNode                 |
| ConditionalType         | ConditionalTypeNode           |
| ConstructorType         | ConstructorTypeNode           |
| FunctionType            | FunctionTypeNode              |
| ImportType              | ImportTypeNode                |
| IndexedAccessType       | IndexedAccessTypeNode         |
| InferType               | InferTypeNode                 |
| IntersectionType        | IntersectionTypeNode          |
| LiteralType             | LiteralTypeNode               |
| MappedType              | MappedTypeNode                |
| OptionalType            | OptionalTypeNode              |
| ParenthesizedType       | ParenthesizedTypeNode         |
| RestType                | RestTypeNode                  |
| TemplateLiteralType     | TemplateLiteralTypeNode       |
| ThisType                | ThisTypeNode                  |
| TupleType               | TupleTypeNode                 |
| TypeLiteral             | TypeLiteralNode               |
| TypeOperator            | TypeOperatorNode              |
| TypePredicate           | TypePredicateNode             |
| TypeQuery               | TypeQueryNode                 |
| TypeReference           | TypeReferenceNode             |
| UnionType               | UnionTypeNode                 |
|                         |                               |
| CallSignature           | CallSignatureDeclaration      |
| ConstructSignature      | ConstructSignatureDeclaration |
| Constructor             | ConstructorDeclaration        |
| GetAccessor             | GetAccessorDeclaration        |
| IndexSignature          | IndexSignatureDeclaration     |
| Parameter               | ParameterDeclaration          |
| SetAccessor             | SetAccessorDeclaration        |
| TypeParameter           | TypeParameterDeclaration      |
|                         |                               |
| FalseKeyword            | FalseLiteral                  |
| NullKeyword             | NullLiteral                   |
| TrueKeyword             | TrueLiteral                   |
|                         |                               |
| ImportKeyword           | ImportExpression              |
| SuperKeyword            | SuperExpression               |
| ThisKeyword             | ThisExpression                |
| TypeAssertionExpression | TypeAssertion                 |

### Nodes typed but without SyntaxKind

| Node                      | ParentNode               |
| ------------------------- | ------------------------ |
| JSDocNamespaceDeclaration | ModuleDeclaration        |
| NamespaceDeclaration      | ModuleDeclaration        |
| JsxTagNamePropertyAccess  | PropertyAccessExpression |
