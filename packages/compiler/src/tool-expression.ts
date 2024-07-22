import type ts from "typescript";
import { Diagnostics } from "./diagnostics.ts";
import { getToolDescriptor } from "./tool-descriptor.ts";
import { error, abort } from "./utils/errors.ts";
import { valueToExpression } from "./utils/literals.ts";
import { createForwardFunctionExpression } from "./utils/functions.ts";

type ToolDeclaration = [ts.Expression, ts.DeclarationName | undefined];

const transformToolExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  expression: ts.Expression,
  toolType: ts.Type,
  bindingName?: ts.BindingName | ts.PropertyName,
): ToolDeclaration => {
  let declarationName = ts.getNameOfDeclaration(expression);
  if (declarationName === undefined) {
    declarationName = bindingName;
  }

  const expressionType = checker.getTypeAtLocation(expression);
  if (checker.isTypeAssignableTo(expressionType, toolType)) {
    return [expression, declarationName];
  }

  const toolDescriptor = getToolDescriptor(
    ts,
    checker,
    addDiagnostic,
    expression,
    declarationName,
  );

  const toolExpression = ts.setOriginalNode(
    factory.createCallExpression(
      factory.createPropertyAccessExpression(
        factory.createIdentifier("Object"),
        factory.createIdentifier("assign"),
      ),
      undefined,
      [
        // Don't mutate existing functions.
        (
          !ts.isFunctionExpression(expression) &&
          !ts.isArrowFunction(expression)
        ) ?
          createForwardFunctionExpression(ts, factory, expression)
        : expression,
        factory.createObjectLiteralExpression(
          [
            factory.createPropertyAssignment(
              factory.createIdentifier("descriptor"),
              valueToExpression(ts, factory, expression, toolDescriptor),
            ),
          ],
          true,
        ),
      ],
    ),
    expression,
  );

  return [toolExpression, declarationName];
};

const transformToolsExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  expression: ts.Expression,
  funcType: ts.Type,
  toolType: ts.Type,
  toolsType: ts.Type,
  bindingName?: ts.BindingName | ts.PropertyName,
): [ts.Expression, ToolDeclaration[]] => {
  const toolDeclarations: ToolDeclaration[] = [];

  const expressionType = checker.getTypeAtLocation(expression);

  if (checker.isArrayLikeType(expressionType)) {
    if (!ts.isArrayLiteralExpression(expression)) {
      if (checker.isTypeAssignableTo(expressionType, toolsType)) {
        return [expression, toolDeclarations];
      }
      return abort(
        ts,
        addDiagnostic,
        expression,
        Diagnostics.UnableToStaticallyAnalyzeSyntax,
        ts.SyntaxKind[expression.kind],
      );
    }

    const toolExpressions: ts.Expression[] = [];
    for (let index = 0; index < expression.elements.length; index += 1) {
      const element = expression.elements[index]!;
      const elementBinding =
        bindingName !== undefined && ts.isArrayBindingPattern(bindingName) ?
          bindingName.elements[index]
        : undefined;
      const elementName =
        elementBinding !== undefined && ts.isBindingElement(elementBinding) ?
          elementBinding.name
        : undefined;
      const elementType = checker.getTypeAtLocation(element);

      let toolExpression: ts.Expression;
      if (checker.isTypeAssignableTo(elementType, funcType)) {
        const toolDeclaration = transformToolExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          element,
          toolType,
          elementName,
        );
        toolDeclarations.push(toolDeclaration);
        toolExpression = toolDeclaration[0];
      } else {
        toolExpression = transformToolsExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          element,
          funcType,
          toolType,
          toolsType,
          elementName,
        )[0];
      }
      toolExpressions.push(toolExpression);
    }

    return [
      factory.updateArrayLiteralExpression(expression, toolExpressions),
      toolDeclarations,
    ];
  }

  if (expressionType.getCallSignatures().length === 0) {
    if (!ts.isObjectLiteralExpression(expression)) {
      if (checker.isTypeAssignableTo(expressionType, toolsType)) {
        return [expression, toolDeclarations];
      }
      return abort(
        ts,
        addDiagnostic,
        expression,
        Diagnostics.UnableToStaticallyAnalyzeSyntax,
        ts.SyntaxKind[expression.kind],
      );
    }

    const toolProperties: ts.ObjectLiteralElementLike[] = [];
    for (const property of expression.properties) {
      let propertyName: ts.PropertyName;
      let propertyValue: ts.Expression;
      if (ts.isPropertyAssignment(property)) {
        propertyName = property.name;
        propertyValue = property.initializer;
      } else if (ts.isShorthandPropertyAssignment(property)) {
        propertyName = property.name;
        propertyValue = property.name;
      } else {
        error(ts, addDiagnostic, property, Diagnostics.UnsupportedToolProperty);
        continue;
      }
      const propertyType = checker.getTypeAtLocation(propertyValue);

      let toolExpression: ts.Expression;
      if (checker.isTypeAssignableTo(propertyType, funcType)) {
        const toolDeclaration = transformToolExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          propertyValue,
          toolType,
          propertyName,
        );
        toolDeclarations.push(toolDeclaration);
        toolExpression = toolDeclaration[0];
      } else {
        toolExpression = transformToolsExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          propertyValue,
          funcType,
          toolType,
          toolsType,
          undefined,
        )[0];
      }
      toolProperties.push(
        factory.createPropertyAssignment(propertyName, toolExpression),
      );
    }

    return [
      factory.updateObjectLiteralExpression(expression, toolProperties),
      toolDeclarations,
    ];
  }

  if (checker.isTypeAssignableTo(expressionType, toolType)) {
    let expressionName: ts.DeclarationName | undefined = bindingName;
    if (expressionName === undefined) {
      expressionName = ts.getNameOfDeclaration(expression);
    }
    toolDeclarations.push([expression, expressionName]);
    return [expression, toolDeclarations];
  }

  const toolDeclaration = transformToolExpression(
    ts,
    factory,
    checker,
    addDiagnostic,
    expression,
    toolType,
    bindingName,
  );
  toolDeclarations.push(toolDeclaration);

  return [toolDeclaration[0], toolDeclarations];
};

const transformToolsDeclarations = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  expression: ts.Expression,
  funcType: ts.Type,
  toolType: ts.Type,
  toolsType: ts.Type,
): ts.VariableStatement[] => {
  const toolDeclarations = transformToolsExpression(
    ts,
    factory,
    checker,
    addDiagnostic,
    expression,
    funcType,
    toolType,
    toolsType,
    undefined,
  )[1];

  const variableStatements: ts.VariableStatement[] = [];
  for (const [toolExpression, declarationName] of toolDeclarations) {
    const variableName =
      declarationName !== undefined && ts.isIdentifier(declarationName) ?
        factory.createUniqueName(
          declarationName.text + "Tool",
          ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
            ts.GeneratedIdentifierFlags.Optimistic |
            ts.GeneratedIdentifierFlags.AllowNameSubstitution,
        )
      : factory.createUniqueName(
          "tool",
          ts.GeneratedIdentifierFlags.ReservedInNestedScopes,
        );

    const variableStatement = factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            variableName,
            undefined,
            undefined,
            toolExpression,
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );
    variableStatements.push(variableStatement);
  }
  return variableStatements;
};

export type { ToolDeclaration };
export { transformToolsExpression, transformToolsDeclarations };
