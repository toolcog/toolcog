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

export {
  isFunctionCallExpression,
  isFunctionCallStatement,
  isMethodCallExpression,
};
