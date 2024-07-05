import type ts from "typescript";
import { getToolDescriptor } from "./tool-descriptor.ts";
import { valueToExpression } from "./utils/literals.ts";

const transformUseToolExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  callExpression: ts.CallExpression,
): ts.Expression => {
  const callableExpression = callExpression.arguments[0];
  ts.Debug.assert(callableExpression !== undefined);

  const optionsExpression = callExpression.arguments[1];

  const descriptor = getToolDescriptor(
    ts,
    checker,
    addDiagnostic,
    callableExpression,
  );

  const optionsLiterals: ts.ObjectLiteralElementLike[] = [];
  optionsLiterals.push(
    factory.createPropertyAssignment(
      "function",
      valueToExpression(ts, factory, callableExpression, descriptor),
    ),
  );
  if (optionsExpression !== undefined) {
    optionsLiterals.push(factory.createSpreadAssignment(optionsExpression));
  }

  return factory.updateCallExpression(
    callExpression,
    callExpression.expression,
    callExpression.typeArguments,
    factory.createNodeArray([
      callableExpression,
      factory.createObjectLiteralExpression(optionsLiterals, true),
    ]),
  );
};

const transformUseToolStatement = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  callStatement: ts.ExpressionStatement & {
    readonly expression: ts.CallExpression;
  },
): ts.VariableStatement => {
  const argumentName = ts.getNameOfDeclaration(
    callStatement.expression.arguments[0],
  );
  const variableName = factory.createUniqueName(
    argumentName !== undefined && ts.isIdentifier(argumentName) ?
      argumentName.text + "Tool"
    : "tool",
    ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
      ts.GeneratedIdentifierFlags.Optimistic |
      ts.GeneratedIdentifierFlags.AllowNameSubstitution,
  );

  const useToolExpression = transformUseToolExpression(
    ts,
    factory,
    checker,
    addDiagnostic,
    callStatement.expression,
  );

  const variableDeclaration = factory.createVariableDeclaration(
    variableName,
    undefined,
    undefined,
    useToolExpression,
  );
  const variableStatement = factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [variableDeclaration],
      ts.NodeFlags.Const,
    ),
  );

  return variableStatement;
};

export { transformUseToolExpression, transformUseToolStatement };
