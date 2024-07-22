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

const isMethodCallExpression = (
  ts: typeof import("typescript"),
  checker: ts.TypeChecker,
  node: ts.Node,
  receiverType: ts.Type,
): node is ts.CallExpression & {
  readonly expression: ts.PropertyAccessExpression;
} => {
  if (
    !ts.isCallExpression(node) ||
    !ts.isPropertyAccessExpression(node.expression)
  ) {
    return false;
  }
  const expressionType = checker.getTypeAtLocation(node.expression.expression);
  if ((expressionType.flags & ts.TypeFlags.Any) !== 0) {
    return false;
  }
  return checker.isTypeAssignableTo(expressionType, receiverType);
};

const createForwardFunctionExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  callableExpression: ts.Expression,
): ts.FunctionExpression => {
  // Create an anonymous wrapper function to avoid mutating the original.
  const argsIdentifier = factory.createUniqueName(
    "args",
    ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
      ts.GeneratedIdentifierFlags.Optimistic |
      ts.GeneratedIdentifierFlags.AllowNameSubstitution,
  );
  return factory.createFunctionExpression(
    undefined,
    undefined,
    undefined,
    undefined,
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier("this"),
        undefined,
        factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
        undefined,
      ),
      factory.createParameterDeclaration(
        undefined,
        factory.createToken(ts.SyntaxKind.DotDotDotToken),
        argsIdentifier,
        undefined,
        factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
        undefined,
      ),
    ],
    factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
    factory.createBlock(
      [
        factory.createReturnStatement(
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              callableExpression,
              factory.createIdentifier("call"),
            ),
            undefined,
            [factory.createThis(), factory.createSpreadElement(argsIdentifier)],
          ),
        ),
      ],
      true,
    ),
  );
};

export {
  isFunctionCallExpression,
  isFunctionCallStatement,
  isMethodCallExpression,
  createForwardFunctionExpression,
};
