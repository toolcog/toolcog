import type ts from "typescript";
import { Diagnostics } from "./diagnostics.ts";
import { getToolDescriptorForNode } from "./tool-descriptor.ts";
import { error, abort } from "./utils/errors.ts";
import { valueToExpression } from "./utils/literals.ts";
import { createForwardFunctionExpression } from "./utils/functions.ts";

const transformToolExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  expression: ts.Expression,
  toolsType: ts.Type,
  bindingName?: ts.DeclarationName,
): ts.Expression => {
  const expressionType = checker.getTypeAtLocation(expression);

  // Check if the expression has already been compiled.
  if (checker.isTypeAssignableTo(expressionType, toolsType)) {
    return expression;
  }

  // Recursively transform tool arrays.

  if (checker.isArrayLikeType(expressionType)) {
    // Only array literals can be transformed.
    if (!ts.isArrayLiteralExpression(expression)) {
      return abort(
        ts,
        addDiagnostic,
        expression,
        Diagnostics.UnableToStaticallyAnalyzeSyntax,
        ts.SyntaxKind[expression.kind],
      );
    }

    const toolElements: ts.Expression[] = [];
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

      toolElements.push(
        transformToolExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          element,
          toolsType,
          elementName,
        ),
      );
    }

    return factory.updateArrayLiteralExpression(expression, toolElements);
  }

  // Recursively transform tool objects.

  if (expressionType.getCallSignatures().length === 0) {
    // Only object literals can be transformed.
    if (!ts.isObjectLiteralExpression(expression)) {
      return abort(
        ts,
        addDiagnostic,
        expression,
        Diagnostics.UnableToStaticallyAnalyzeSyntax,
        ts.SyntaxKind[expression.kind],
      );
    }

    const toolAssignments: ts.ObjectLiteralElementLike[] = [];
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

      toolAssignments.push(
        factory.createPropertyAssignment(
          propertyName,
          transformToolExpression(
            ts,
            factory,
            checker,
            addDiagnostic,
            propertyValue,
            toolsType,
            undefined,
          ),
        ),
      );
    }

    return factory.updateObjectLiteralExpression(expression, toolAssignments);
  }

  // Transform individual tools.

  const toolIdentifier = factory.createUniqueName(
    bindingName !== undefined && ts.isIdentifier(bindingName) ?
      bindingName.text + "Tool"
    : "tool",
    ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
      ts.GeneratedIdentifierFlags.Optimistic |
      ts.GeneratedIdentifierFlags.AllowNameSubstitution,
  );

  const toolFunction =
    !ts.isFunctionExpression(expression) && !ts.isArrowFunction(expression) ?
      // Wrap existing functions to avoid mutating them.
      createForwardFunctionExpression(ts, factory, expression)
    : expression;

  const toolDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          toolIdentifier,
          undefined, // exclamationToken
          undefined, // type
          toolFunction,
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  // Define the `descriptor` property.

  const toolDescriptor = getToolDescriptorForNode(
    ts,
    checker,
    addDiagnostic,
    expression,
    ts.getNameOfDeclaration(expression) ?? bindingName,
  );

  const descriptorAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(toolIdentifier, "descriptor"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      valueToExpression(ts, factory, toolDescriptor, expression),
    ),
  );

  // Create and return an IIFE wrapper.

  const iifeExpression = factory.createCallExpression(
    factory.createArrowFunction(
      undefined, // modifiers,
      undefined, // typeParameters,
      [], // parameters
      undefined, // type
      undefined, // equalsGreaterThanToken,
      factory.createBlock(
        [
          toolDeclaration,
          descriptorAssignment,
          factory.createReturnStatement(toolIdentifier),
        ],
        true,
      ),
    ),
    undefined, // typeArguments
    undefined, // arguments
  );

  return ts.setOriginalNode(iifeExpression, expression);
};

export { transformToolExpression };
