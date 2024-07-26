import type ts from "typescript";
import { getToolComment } from "./tool-comment.ts";
import { getToolDescriptorForCall } from "./tool-descriptor.ts";
import { valueToExpression } from "./utils/literals.ts";

const transformGenerateExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  generativeModelExpression: ts.Expression,
  callExpression: ts.CallExpression,
  toolScope: Record<string, ts.Identifier | undefined>,
  bindingName?: ts.DeclarationName,
): ts.Expression => {
  const callSignature = checker.getResolvedSignature(callExpression);
  ts.Debug.assert(callSignature !== undefined);

  const toolComment = getToolComment(ts, checker, callExpression);

  // Extract the arguments to the call expression.

  let instructionsExpression: ts.Expression | undefined;
  let argumentsExpression: ts.Expression | undefined;
  let optionsExpression: ts.Expression | undefined;
  if (callSignature.parameters.length === 3) {
    instructionsExpression = callExpression.arguments[0];
    argumentsExpression = callExpression.arguments[1];
    optionsExpression = callExpression.arguments[2];
  } else {
    argumentsExpression = callExpression.arguments[0];
    optionsExpression = callExpression.arguments[1];
  }

  // Define `options` argument assignments.

  if (instructionsExpression === undefined) {
    const instructions = toolComment?.tags.get("instructions");
    if (instructions !== undefined) {
      instructionsExpression = factory.createStringLiteral(instructions);
    }
  }

  const toolDescriptor = getToolDescriptorForCall(
    ts,
    checker,
    addDiagnostic,
    argumentsExpression,
    checker.getAwaitedType(checker.getTypeAtLocation(callExpression)),
    bindingName,
    toolComment,
    callExpression,
  );

  const toolExpressions: ts.Expression[] = [];
  for (const toolName in toolScope) {
    const toolExpression = toolScope[toolName];
    if (toolExpression !== undefined) {
      toolExpressions.push(toolExpression);
    }
  }

  const optionsAssignments: ts.ObjectLiteralElementLike[] = [
    ...(instructionsExpression !== undefined ?
      [factory.createPropertyAssignment("instructions", instructionsExpression)]
    : []),

    factory.createPropertyAssignment(
      "descriptor",
      valueToExpression(ts, factory, toolDescriptor, callExpression),
    ),

    factory.createPropertyAssignment(
      "tools",
      factory.createArrayLiteralExpression(toolExpressions, true),
    ),

    ...(optionsExpression !== undefined ?
      [factory.createSpreadAssignment(optionsExpression)]
    : []),
  ];

  // Define the generative model call.

  const generativeModelCallExpression = factory.createCallExpression(
    generativeModelExpression,
    undefined, // typeArguments
    factory.createNodeArray([
      argumentsExpression ?? factory.createIdentifier("undefined"),
      factory.createObjectLiteralExpression(optionsAssignments, true),
    ]),
  );

  return ts.setOriginalNode(generativeModelCallExpression, callExpression);
};

export { transformGenerateExpression };
