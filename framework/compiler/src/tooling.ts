import type ts from "typescript";
import { error } from "./utils/errors.ts";
import { valueToExpression } from "./utils/literals.ts";
import { createForwardFunctionExpression } from "./utils/functions.ts";
import { Diagnostics } from "./diagnostics.ts";
import { getComment } from "./comment.ts";
import { getNodeId, getNodeName } from "./node-id.ts";
import { signatureToSchema } from "./schema.ts";

const transformToolingIntrinsic = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  getCommonSourceDirectory: (() => string) | undefined,
  toolsType: ts.Type,
  callExpression: ts.CallExpression,
): ts.Expression => {
  const transformToolsArray = (
    expression: ts.Expression,
    expressionType: ts.Type,
    errorNode: ts.Node,
    toolElements: ts.Expression[] = [],
  ): ts.ArrayLiteralExpression => {
    if (ts.isArrayLiteralExpression(expression)) {
      // Transform tools array literal.
      for (const element of expression.elements) {
        toolElements.push(transformTools(element, undefined, errorNode));
      }
      return factory.updateArrayLiteralExpression(expression, toolElements);
    }

    if (!checker.isTupleType(expressionType)) {
      // Can't transform homogeneously-typed array.
      error(
        ts,
        addDiagnostic,
        errorNode,
        Diagnostics.CannotTransformHomogeneousArray,
        checker.typeToString(expressionType),
      );
      return factory.createArrayLiteralExpression([]);
    }

    // Transform tools array expression.
    for (const property of expressionType.getApparentProperties()) {
      const index = parseInt(property.name);
      if (!isFinite(index)) {
        continue;
      }
      toolElements.push(
        transformTools(
          factory.createElementAccessExpression(expression, index),
          checker.getTypeOfSymbolAtLocation(property, expression),
          errorNode,
        ),
      );
    }
    return factory.createArrayLiteralExpression(toolElements, true);
  };

  const transformToolsObject = (
    expression: ts.Expression,
    expressionType: ts.Type,
    errorNode: ts.Node,
    toolAssignments: ts.ObjectLiteralElementLike[] = [],
  ): ts.ObjectLiteralExpression => {
    // Transform tools object literal.
    if (ts.isObjectLiteralExpression(expression)) {
      for (const property of expression.properties) {
        let propertyName: ts.PropertyName;
        let propertyValue: ts.Expression;
        if (ts.isPropertyAssignment(property)) {
          propertyName = property.name;
          propertyValue = property.initializer;
        } else if (ts.isShorthandPropertyAssignment(property)) {
          propertyName = property.name;
          propertyValue = property.name;
        } else if (ts.isSpreadAssignment(property)) {
          transformToolsObject(
            property.expression,
            checker.getTypeAtLocation(property.expression),
            errorNode,
            toolAssignments,
          );
          continue;
        } else {
          error(
            ts,
            addDiagnostic,
            property,
            Diagnostics.CannotTransformNonStableProperty,
            ts.getTextOfPropertyName(property.name) as string,
          );
          continue;
        }
        toolAssignments.push(
          factory.createPropertyAssignment(
            propertyName,
            transformTools(propertyValue, undefined, errorNode),
          ),
        );
      }
      return factory.updateObjectLiteralExpression(expression, toolAssignments);
    }

    // Transform tools object expression.
    for (const property of expressionType.getApparentProperties()) {
      toolAssignments.push(
        factory.createPropertyAssignment(
          property.name,
          transformTools(
            ts.isIdentifierText(property.name, ts.ScriptTarget.ESNext) ?
              factory.createPropertyAccessExpression(expression, property.name)
            : factory.createElementAccessExpression(
                expression,
                factory.createStringLiteral(property.name),
              ),
            checker.getTypeOfSymbolAtLocation(property, expression),
            errorNode,
          ),
        ),
      );
    }
    return factory.createObjectLiteralExpression(toolAssignments, true);
  };

  const transformTool = (
    expression: ts.Expression,
    expressionType: ts.Type,
    errorNode: ts.Node,
  ): ts.Expression => {
    const toolSignature = expressionType.getCallSignatures()[0];
    ts.Debug.assert(toolSignature !== undefined);

    const toolDeclaration =
      expressionType.getSymbol()?.declarations?.[0] ?? expression;

    const toolId = getNodeId(ts, toolDeclaration, {
      package: true,
      module: true,
      getCommonSourceDirectory,
    });

    const toolName = getNodeName(ts, toolDeclaration);

    const toolIdentifier = factory.createUniqueName(
      toolName !== undefined ? toolName + "Tool" : "tool",
      // Prevent shadowing by tool function local names.
      ts.GeneratedIdentifierFlags.Optimistic |
        ts.GeneratedIdentifierFlags.ReservedInNestedScopes,
    );

    const comment = getComment(ts, checker, expression, expressionType);

    if (comment === undefined) {
      error(
        ts,
        addDiagnostic,
        errorNode,
        Diagnostics.CommentNeededToDescribeToolToLLM,
      );
    }

    // Define the id property.

    const idAssignment = factory.createExpressionStatement(
      factory.createBinaryExpression(
        factory.createPropertyAccessExpression(toolIdentifier, "id"),
        factory.createToken(ts.SyntaxKind.EqualsToken),
        toolId !== undefined ?
          factory.createStringLiteral(toolId)
        : factory.createVoidExpression(factory.createNumericLiteral(0)),
      ),
    );

    // Define the function property.

    const functionSchema = signatureToSchema(
      ts,
      checker,
      addDiagnostic,
      toolSignature,
      toolId?.replace(/[^a-zA-Z0-9_-]/g, "_"),
      comment,
      errorNode,
    );

    const functionExpression = valueToExpression(
      ts,
      factory,
      functionSchema,
      errorNode,
    );

    const functionAssignment = factory.createExpressionStatement(
      factory.createBinaryExpression(
        factory.createPropertyAccessExpression(toolIdentifier, "function"),
        factory.createToken(ts.SyntaxKind.EqualsToken),
        functionExpression,
      ),
    );

    // Define the tool function implementation.

    const toolFunction =
      !ts.isFunctionExpression(expression) && !ts.isArrowFunction(expression) ?
        // Wrap existing functions to prevent observable mutation.
        createForwardFunctionExpression(ts, factory, expression)
      : expression;

    const toolFunctionDeclaration = factory.createVariableStatement(
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
            toolFunctionDeclaration,
            idAssignment,
            functionAssignment,
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

  const transformTools = (
    expression: ts.Expression,
    expressionType: ts.Type | undefined,
    errorNode: ts.Node | undefined,
  ): ts.Expression => {
    if (expressionType === undefined) {
      expressionType = checker.getTypeAtLocation(expression);
    }

    if (errorNode === undefined) {
      errorNode = expression;
    }

    if (checker.isTypeAssignableTo(expressionType, toolsType)) {
      // Return previously compiled tools.
      return expression;
    }

    if (ts.isAsExpression(expression)) {
      // Unwrap `as` expression.
      expression = expression.expression;
    }

    if (checker.isArrayLikeType(expressionType)) {
      // Recursively transform tools array.
      return transformToolsArray(expression, expressionType, errorNode);
    }

    if (expressionType.getCallSignatures().length === 0) {
      // Recursively transform tools object.
      return transformToolsObject(expression, expressionType, errorNode);
    }

    // Transform individual tool.
    return transformTool(expression, expressionType, errorNode);
  };

  // Transform the tools argument to the intrinsic call.
  const expression = callExpression.arguments[0]!;
  return transformTools(expression, undefined, expression);
};

export { transformToolingIntrinsic };
