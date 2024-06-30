import type ts from "typescript";
import type { ToolcogHost } from "../host.ts";

const valueToExpression = (
  host: ToolcogHost,
  node: ts.Node,
  value: unknown,
): ts.Expression => {
  if (value === undefined) {
    return host.factory.createIdentifier("undefined");
  }

  if (value === null) {
    return host.factory.createNull();
  }

  if (typeof value === "boolean") {
    return value ? host.factory.createTrue() : host.factory.createFalse();
  }

  if (typeof value === "number") {
    return host.factory.createNumericLiteral(value);
  }

  if (typeof value === "string") {
    return host.factory.createStringLiteral(value);
  }

  if (Array.isArray(value)) {
    const elementExpressions = value.map(
      valueToExpression.bind(null, host, node),
    );
    return host.factory.createArrayLiteralExpression(elementExpressions);
  }

  if (typeof value === "object") {
    const propertyExpressions = Object.entries(value).map(([key, value]) =>
      host.factory.createPropertyAssignment(
        key,
        valueToExpression(host, node, value),
      ),
    );
    return host.factory.createObjectLiteralExpression(
      propertyExpressions,
      true,
    );
  }

  return host.ts.Debug.fail(`Unsupported value type \`${typeof value}\``);
};

export { valueToExpression };
