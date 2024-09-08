import type ts from "typescript";
import type { ModuleDef } from "@toolcog/runtime";
import { error } from "../utils/errors.ts";
import { moveLeadingComments } from "../utils/comments.ts";
import { valueToExpression } from "../utils/literals.ts";
import { createForwardFunctionExpression } from "../utils/functions.ts";
import { Diagnostics } from "../diagnostics.ts";
import { getComment } from "../comment.ts";
import { getNodeTypeId } from "../node-id.ts";
import { signatureToSchema } from "../schema.ts";

const defineToolExpression = (
  ts: typeof import("typescript"),
  host: ts.ModuleResolutionHost,
  program: ts.Program,
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  moduleDef: ModuleDef,
  toolType: ts.Type,
  funcExpression: ts.Expression,
  funcType: ts.Type,
  errorNode: ts.Node,
): ts.Expression => {
  // Check for a previously compiled tool.
  if (checker.isTypeAssignableTo(funcType, toolType)) {
    return funcExpression;
  }

  // Unwrap `as` expressions.
  if (ts.isAsExpression(funcExpression)) {
    funcExpression = funcExpression.expression;
  }

  const signature = funcType.getCallSignatures()[0];
  ts.Debug.assert(signature !== undefined);

  let toolId =
    getNodeTypeId(ts, funcExpression, funcType, {
      package: true,
      module: true,
      host,
      program,
    }) ?? "";

  if (
    toolId in moduleDef.tools ||
    toolId.length === 0 ||
    toolId.endsWith(":")
  ) {
    const baseId = toolId;
    let conflictCount = 0;
    while (true) {
      toolId = baseId + "#" + conflictCount;
      if (!(toolId in moduleDef.tools)) {
        break;
      }
      conflictCount += 1;
    }
  }

  const toolIdentifier = factory.createIdentifier("tool");

  const comment = getComment(ts, checker, funcExpression, funcType);
  if (comment === undefined) {
    error(
      ts,
      addDiagnostic,
      errorNode,
      Diagnostics.CommentNeededToDescribeToolToLLM,
    );
  }

  const toolSchema = signatureToSchema(
    ts,
    checker,
    addDiagnostic,
    signature,
    toolId.replace(/[^a-zA-Z0-9_-]/g, "_"),
    comment,
    errorNode,
  );

  // Define the func parameter.

  const funcParameterName = factory.createIdentifier("func");
  const funcParameterDeclaration = factory.createParameterDeclaration(
    undefined, // modifiers
    undefined, // dotDotDotToken
    funcParameterName,
    undefined, // questionToken
    undefined, // type
    undefined, // initializer
  );

  // Define the id property.

  const idAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(toolIdentifier, "id"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      factory.createStringLiteral(toolId),
    ),
  );

  // Define the name property.

  let nameAssignment: ts.Statement | undefined;
  if (toolSchema.name !== undefined) {
    nameAssignment = factory.createExpressionStatement(
      factory.createCallExpression(
        factory.createPropertyAccessExpression(
          factory.createIdentifier("Object"),
          "defineProperty",
        ),
        undefined, // typeArguments
        [
          toolIdentifier,
          factory.createStringLiteral("name"),
          factory.createObjectLiteralExpression(
            [
              factory.createPropertyAssignment(
                "value",
                factory.createStringLiteral(toolSchema.name),
              ),
              factory.createPropertyAssignment(
                "writable",
                factory.createFalse(),
              ),
              factory.createPropertyAssignment(
                "enumerable",
                factory.createFalse(),
              ),
              factory.createPropertyAssignment(
                "configurable",
                factory.createTrue(),
              ),
            ],
            true, // multiLine
          ),
        ],
      ),
    );
  }

  // Define the description property.

  const descriptionAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(toolIdentifier, "description"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      toolSchema.description !== undefined ?
        factory.createStringLiteral(toolSchema.description)
      : factory.createVoidZero(),
    ),
  );

  // Define the parameters property.

  const parametersAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(toolIdentifier, "parameters"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      valueToExpression(ts, factory, toolSchema.parameters, errorNode),
    ),
  );

  // Define the returns property.

  const returnsAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(toolIdentifier, "returns"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      valueToExpression(ts, factory, toolSchema.returns, errorNode),
    ),
  );

  // Define the tool function.

  const toolFunction =
    (
      !ts.isFunctionExpression(funcExpression) &&
      !ts.isArrowFunction(funcExpression)
    ) ?
      // Wrap existing functions to prevent observable mutation.
      createForwardFunctionExpression(ts, factory, funcParameterName)
    : funcParameterName;

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

  // Add the tool to the module module manifest.

  moduleDef.tools[toolId] = {
    ...toolSchema,
  };

  // Create and return an IIFE wrapper.

  const iifeExpression = factory.createCallExpression(
    factory.createArrowFunction(
      undefined, // modifiers,
      undefined, // typeParameters,
      [funcParameterDeclaration],
      undefined, // type
      undefined, // equalsGreaterThanToken,
      factory.createBlock(
        [
          toolFunctionDeclaration,
          idAssignment,
          ...(nameAssignment !== undefined ? [nameAssignment] : []),
          descriptionAssignment,
          parametersAssignment,
          returnsAssignment,
          factory.createReturnStatement(toolIdentifier),
        ],
        true, // multiLine
      ),
    ),
    undefined, // typeArguments
    [funcExpression],
  );

  moveLeadingComments(ts, funcExpression, iifeExpression);

  return ts.setOriginalNode(iifeExpression, funcExpression);
};

export { defineToolExpression };
