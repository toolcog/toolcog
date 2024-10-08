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
      true, // multiLine
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

const expressionToValue = (
  ts: typeof import("typescript"),
  expression: ts.Expression,
): unknown => {
  if (expression.kind === ts.SyntaxKind.UndefinedKeyword) {
    return undefined;
  }

  if (expression.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }

  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (ts.isNumericLiteral(expression)) {
    return parseFloat(expression.text);
  }

  if (ts.isStringLiteral(expression)) {
    return expression.text;
  }

  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.map((element) => expressionToValue(ts, element));
  }

  if (ts.isObjectLiteralExpression(expression)) {
    return Object.fromEntries(
      expression.properties.map((property) => {
        if (!ts.isPropertyAssignment(property)) {
          throw new Error(
            "Cannot statically resolve object literal property " +
              property.getText(),
          );
        }
        const name = property.name.getText();
        const value = expressionToValue(ts, property.initializer);
        return [name, value];
      }),
    );
  }

  if (ts.isPrefixUnaryExpression(expression)) {
    if (expression.operator === ts.SyntaxKind.MinusToken) {
      const value = expressionToValue(ts, expression.operand);
      return typeof value === "number" ? -value : undefined;
    } else if (expression.operator === ts.SyntaxKind.PlusToken) {
      const value = expressionToValue(ts, expression.operand);
      return typeof value === "number" ? +value : undefined;
    }
  }

  throw new Error(
    "Cannot statically resolve expression " + expression.getText(),
  );
};

export { valueToExpression, expressionToValue };
