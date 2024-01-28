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

### Random notes for TSESLint maintainers

- High usage of esquery, which often lead to type assertion and becomes counterproductive in `no-unsafe-assignment`
- In `no-unsafe-return`, the signature loop doesn't loop (don't know if this is a bug or not)
- `isTypeFlagSet` naming clashes with the one form `ts-api-utils` but applies to union
- In `no-unnecessary-condition`, the edge case about "array access can "infect" deeper into the chain" is wrong. `arr2[42]?.x?.y?.z;`should be`arr2[42]?.x.y.z;`
- `no-unnecessary-condition` & `non-nullable-type-assertion-styl` were re-implemented from scratch using `isTypeAssignableTo`
