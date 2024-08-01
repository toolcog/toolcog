import type ts from "typescript";
import { error } from "./utils/errors.ts";
import { valueToExpression } from "./utils/literals.ts";
import { Diagnostics } from "./diagnostics.ts";
import { getComment } from "./comment.ts";
import { getNodeId } from "./node-id.ts";
import { callSiteToSchema } from "./schema.ts";

const transformGenerateIntrinsic = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  getCommonSourceDirectory: (() => string) | undefined,
  generativeModelExpression: ts.Expression,
  contextToolsExpression: ts.Expression | undefined,
  callExpression: ts.CallExpression,
): ts.Expression => {
  const callSignature = checker.getResolvedSignature(callExpression);
  ts.Debug.assert(callSignature !== undefined);

  const returnType = checker.getAwaitedType(
    checker.getTypeAtLocation(callExpression),
  );

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

  const callId = getNodeId(ts, callExpression, {
    package: true,
    module: true,
    getCommonSourceDirectory,
  });

  const comment = getComment(ts, checker, callExpression);

  if (comment === undefined) {
    error(
      ts,
      addDiagnostic,
      callExpression,
      Diagnostics.CommentNeededToDescribeFunctionToLLM,
    );
  }

  // Define options for the generative model call.

  const functionSchema = callSiteToSchema(
    ts,
    checker,
    addDiagnostic,
    argumentsExpression,
    returnType,
    callId?.replace(/[^a-zA-Z0-9_-]/g, "_"),
    comment,
    callExpression,
  );

  const functionExpression = valueToExpression(
    ts,
    factory,
    functionSchema,
    callExpression,
  );

  if (instructionsExpression === undefined) {
    const instructions = comment?.tags.instructions;
    if (instructions !== undefined) {
      instructionsExpression = factory.createStringLiteral(instructions);
    }
  }

  let toolsExpression: ts.Expression | undefined;
  if (contextToolsExpression !== undefined) {
    toolsExpression = factory.createCallExpression(
      contextToolsExpression,
      undefined, // typeArguments
      undefined, // arguments
    );
  }

  const optionsAssignments: ts.ObjectLiteralElementLike[] = [
    factory.createPropertyAssignment("function", functionExpression),

    ...(instructionsExpression !== undefined ?
      [factory.createPropertyAssignment("instructions", instructionsExpression)]
    : []),

    ...(toolsExpression !== undefined ?
      [factory.createPropertyAssignment("tools", toolsExpression)]
    : []),

    ...(optionsExpression !== undefined ?
      [factory.createSpreadAssignment(optionsExpression)]
    : []),
  ];

  // Define the generative model call.

  const generativeModelCallExpression = factory.createCallExpression(
    generativeModelExpression,
    undefined, // typeArguments
    factory.createNodeArray([
      argumentsExpression ??
        factory.createVoidExpression(factory.createNumericLiteral(0)),
      factory.createObjectLiteralExpression(optionsAssignments, true),
    ]),
  );

  return ts.setOriginalNode(generativeModelCallExpression, callExpression);
};

export { transformGenerateIntrinsic };
