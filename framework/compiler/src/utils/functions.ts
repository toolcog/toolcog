import type ts from "typescript";

const isFunctionCallExpression = (
  ts: typeof import("typescript"),
  checker: ts.TypeChecker,
  node: ts.Node,
  functionType: ts.Type,
): node is ts.CallExpression => {
  if (!ts.isCallExpression(node)) {
    return false;
  }
  const expressionType = checker.getTypeAtLocation(node.expression);
  if ((expressionType.flags & ts.TypeFlags.Any) !== 0) {
    return false;
  }
  return checker.isTypeAssignableTo(expressionType, functionType);
};

const isFunctionCallStatement = (
  ts: typeof import("typescript"),
  checker: ts.TypeChecker,
  node: ts.Node,
  functionType: ts.Type,
): node is ts.ExpressionStatement & {
  readonly expression: ts.CallExpression;
} => {
  return (
    ts.isExpressionStatement(node) &&
    isFunctionCallExpression(ts, checker, node.expression, functionType)
  );
};

const createForwardFunctionExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  callableExpression: ts.Expression,
): ts.FunctionExpression => {
  // Create an anonymous wrapper function to avoid mutating the original.
  const argsIdentifier = factory.createUniqueName(
    "args",
    // Avoid shadowing identifiers in the call expression.
    ts.GeneratedIdentifierFlags.Optimistic |
      ts.GeneratedIdentifierFlags.ReservedInNestedScopes,
  );
  return factory.createFunctionExpression(
    undefined, // modifiers
    undefined, // asteriskToken
    undefined, // name
    undefined, // typeParameters
    [
      factory.createParameterDeclaration(
        undefined, // modifiers
        undefined, // dotDotDotToken
        factory.createIdentifier("this"),
        undefined, // questionToken
        factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
        undefined, // initializer
      ),
      factory.createParameterDeclaration(
        undefined, // modifiers
        factory.createToken(ts.SyntaxKind.DotDotDotToken),
        argsIdentifier,
        undefined, // questionToken
        factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
        undefined, // initializer
      ),
    ],
    factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
    factory.createBlock(
      [
        factory.createReturnStatement(
          factory.createCallExpression(
            factory.createPropertyAccessExpression(callableExpression, "call"),
            undefined, // typeArguments
            [factory.createThis(), factory.createSpreadElement(argsIdentifier)],
          ),
        ),
      ],
      true, // multiLine
    ),
  );
};

export {
  isFunctionCallExpression,
  isFunctionCallStatement,
  createForwardFunctionExpression,
};
