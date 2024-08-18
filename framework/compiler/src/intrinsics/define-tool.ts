import type ts from "typescript";
import { error } from "../utils/errors.ts";
import { moveLeadingComments } from "../utils/comments.ts";
import { valueToExpression } from "../utils/literals.ts";
import { createForwardFunctionExpression } from "../utils/functions.ts";
import { Diagnostics } from "../diagnostics.ts";
import { getComment } from "../comment.ts";
import { getNodeTypeId } from "../node-id.ts";
import { signatureToSchema } from "../schema.ts";
import type { ToolcogManifest } from "../manifest.ts";

const defineToolExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  getCommonSourceDirectory: (() => string) | undefined,
  manifest: ToolcogManifest,
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
      getCommonSourceDirectory,
    }) ?? "";

  if (toolId in manifest.tools || toolId.length === 0 || toolId.endsWith(":")) {
    const baseId = toolId;
    let conflictCount = 0;
    while (true) {
      toolId = baseId + "#" + conflictCount;
      if (!(toolId in manifest.tools)) {
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

  // Define the function property.

  const functionSchema = signatureToSchema(
    ts,
    checker,
    addDiagnostic,
    signature,
    toolId.replace(/[^a-zA-Z0-9_-]/g, "_"),
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

  // Add the tool to the manifest.

  manifest.tools[toolId] = { function: functionSchema };

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
          functionAssignment,
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
