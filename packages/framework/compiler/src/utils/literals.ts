import type ts from "typescript";

const valueToExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  value: unknown,
  errorNode?: ts.Node,
): ts.Expression => {
  if (value === undefined) {
    return factory.createVoidZero();
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
    return factory.createArrayLiteralExpression(
      value.map((value: unknown) =>
        valueToExpression(ts, factory, value, errorNode),
      ),
    );
  }

  if (typeof value === "object") {
    const propertyExpressions = Object.entries(value).map(([key, value]) =>
      factory.createPropertyAssignment(
        ts.isIdentifierText(key, ts.ScriptTarget.ESNext) ?
          factory.createIdentifier(key)
        : factory.createStringLiteral(key),
        valueToExpression(ts, factory, value, errorNode),
      ),
    );
    return factory.createObjectLiteralExpression(propertyExpressions, true);
  }

  return ts.Debug.fail(`Unsupported value type \`${typeof value}\``);
};

export { valueToExpression };
