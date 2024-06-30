import type ts from "typescript";
import type { ToolcogHost } from "./host.ts";
import { getToolDescriptor } from "./tool-descriptor.ts";
import { valueToExpression } from "./utils/literals.ts";

const transformUseToolExpression = (
  host: ToolcogHost,
  callExpression: ts.CallExpression,
): ts.Expression => {
  const callableExpression = callExpression.arguments[0];
  host.ts.Debug.assert(callableExpression !== undefined);

  const optionsExpression = callExpression.arguments[1];

  const descriptor = getToolDescriptor(host, callableExpression);

  const optionsLiterals: ts.ObjectLiteralElementLike[] = [];
  optionsLiterals.push(
    host.factory.createPropertyAssignment(
      "function",
      valueToExpression(host, callableExpression, descriptor),
    ),
  );
  if (optionsExpression !== undefined) {
    optionsLiterals.push(
      host.factory.createSpreadAssignment(optionsExpression),
    );
  }

  return host.factory.updateCallExpression(
    callExpression,
    callExpression.expression,
    callExpression.typeArguments,
    host.factory.createNodeArray([
      callableExpression,
      host.factory.createObjectLiteralExpression(optionsLiterals, true),
    ]),
  );
};

const transformUseToolStatement = (
  host: ToolcogHost,
  callStatement: ts.ExpressionStatement & {
    readonly expression: ts.CallExpression;
  },
): ts.VariableStatement => {
  const argumentName = host.ts.getNameOfDeclaration(
    callStatement.expression.arguments[0],
  );
  const variableName = host.factory.createUniqueName(
    argumentName !== undefined && host.ts.isIdentifier(argumentName) ?
      argumentName.text + "Tool"
    : "tool",
    host.ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
      host.ts.GeneratedIdentifierFlags.Optimistic |
      host.ts.GeneratedIdentifierFlags.AllowNameSubstitution,
  );

  const useToolExpression = transformUseToolExpression(
    host,
    callStatement.expression,
  );

  const variableDeclaration = host.factory.createVariableDeclaration(
    variableName,
    undefined,
    undefined,
    useToolExpression,
  );
  const variableStatement = host.factory.createVariableStatement(
    undefined,
    host.factory.createVariableDeclarationList(
      [variableDeclaration],
      host.ts.NodeFlags.Const,
    ),
  );

  return variableStatement;
};

export { transformUseToolExpression, transformUseToolStatement };
