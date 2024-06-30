import type ts from "typescript";
import type { ToolcogHost } from "../host.ts";

const isFunctionCallExpression = (
  host: ToolcogHost,
  node: ts.Node,
  functionType: ts.Type,
): node is ts.CallExpression => {
  if (!host.ts.isCallExpression(node)) {
    return false;
  }
  const expressionType = host.checker.getTypeAtLocation(node.expression);
  if ((expressionType.flags & host.ts.TypeFlags.Any) !== 0) {
    return false;
  }
  return host.checker.isTypeAssignableTo(expressionType, functionType);
};

const isFunctionCallStatement = (
  host: ToolcogHost,
  node: ts.Node,
  functionType: ts.Type,
): node is ts.ExpressionStatement & {
  readonly expression: ts.CallExpression;
} => {
  return (
    host.ts.isExpressionStatement(node) &&
    isFunctionCallExpression(host, node.expression, functionType)
  );
};

const isMethodCallExpression = (
  host: ToolcogHost,
  node: ts.Node,
  receiverType: ts.Type,
): node is ts.CallExpression & {
  readonly expression: ts.PropertyAccessExpression;
} => {
  if (
    !host.ts.isCallExpression(node) ||
    !host.ts.isPropertyAccessExpression(node.expression)
  ) {
    return false;
  }
  const expressionType = host.checker.getTypeAtLocation(
    node.expression.expression,
  );
  if ((expressionType.flags & host.ts.TypeFlags.Any) !== 0) {
    return false;
  }
  return host.checker.isTypeAssignableTo(expressionType, receiverType);
};

export {
  isFunctionCallExpression,
  isFunctionCallStatement,
  isMethodCallExpression,
};
