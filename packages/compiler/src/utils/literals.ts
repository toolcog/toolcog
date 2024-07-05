import type ts from "typescript";

const valueToExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  errorNode: ts.Node,
  value: unknown,
): ts.Expression => {
  if (value === undefined) {
    return factory.createIdentifier("undefined");
  }

  if (value === null) {
    return factory.createNull();
  }

  if (typeof value === "boolean") {
    return value ? factory.createTrue() : factory.createFalse();
  }

  if (typeof value === "number") {
    return factory.createNumericLiteral(value);
  }

  if (typeof value === "string") {
    return factory.createStringLiteral(value);
  }

  if (Array.isArray(value)) {
    const elementExpressions = value.map(
      valueToExpression.bind(null, ts, factory, errorNode),
    );
    return factory.createArrayLiteralExpression(elementExpressions);
  }

  if (typeof value === "object") {
    const propertyExpressions = Object.entries(value).map(([key, value]) =>
      factory.createPropertyAssignment(
        key,
        valueToExpression(ts, factory, errorNode, value),
      ),
    );
    return factory.createObjectLiteralExpression(propertyExpressions, true);
  }

  return ts.Debug.fail(`Unsupported value type \`${typeof value}\``);
};

export { valueToExpression };
