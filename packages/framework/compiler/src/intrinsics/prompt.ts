import type ts from "typescript";
import type { ModuleDef } from "@toolcog/runtime";
import { error } from "../utils/errors.ts";
import { valueToExpression } from "../utils/literals.ts";
import { Diagnostics } from "../diagnostics.ts";
import { getComment } from "../comment.ts";
import { getNodeId } from "../node-id.ts";
import { callSiteToSchema } from "../schema.ts";

const promptExpression = (
  ts: typeof import("typescript"),
  host: ts.ModuleResolutionHost,
  program: ts.Program,
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  moduleDef: ModuleDef,
  generatorExpression: ts.Expression,
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

  let promptId =
    getNodeId(ts, callExpression, {
      package: true,
      module: true,
      host,
      program,
    }) ?? "";

  if (
    promptId in moduleDef.prompts ||
    promptId.length === 0 ||
    promptId.endsWith(":")
  ) {
    const baseId = promptId;
    let conflictCount = 0;
    while (true) {
      promptId = baseId + "#" + conflictCount;
      if (!(promptId in moduleDef.prompts)) {
        break;
      }
      conflictCount += 1;
    }
  }

  const comment = getComment(ts, checker, callExpression);
  if (comment === undefined) {
    error(
      ts,
      addDiagnostic,
      callExpression,
      Diagnostics.CommentNeededToDescribeFunctionToLLM,
    );
  }

  const functionSchema = callSiteToSchema(
    ts,
    checker,
    addDiagnostic,
    argumentsExpression,
    returnType,
    promptId.replace(/[^a-zA-Z0-9_-]/g, "_"),
    comment,
    callExpression,
  );

  // Define the options for the generator call.

  let parametersExpression: ts.Expression | undefined;
  if (functionSchema.parameters !== undefined) {
    parametersExpression = valueToExpression(
      ts,
      factory,
      functionSchema.parameters,
      callExpression,
    );
  }

  let returnsExpression: ts.Expression | undefined;
  if (functionSchema.returns !== undefined) {
    returnsExpression = valueToExpression(
      ts,
      factory,
      functionSchema.returns,
      callExpression,
    );
  }

  let instructions: string | undefined;
  if (instructionsExpression === undefined) {
    instructions = comment?.tags.instructions;
    if (instructions === undefined) {
      instructions = comment?.description;
    }
    if (instructions !== undefined) {
      instructionsExpression = factory.createStringLiteral(instructions);
    }
  } else if (ts.isStringLiteral(instructionsExpression)) {
    instructions = instructionsExpression.text;
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
    ...(parametersExpression !== undefined ?
      [factory.createPropertyAssignment("parameters", parametersExpression)]
    : []),

    ...(returnsExpression !== undefined ?
      [factory.createPropertyAssignment("returns", returnsExpression)]
    : []),

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

  // Add the prompt to the module manifest.

  moduleDef.prompts[promptId] = {
    ...functionSchema,
    instructions,
  };

  // Define the generator call.

  const generatorCallExpression = factory.createCallExpression(
    generatorExpression,
    undefined, // typeArguments
    [
      argumentsExpression ?? factory.createVoidZero(),
      factory.createObjectLiteralExpression(optionsAssignments, true),
    ],
  );

  return ts.setOriginalNode(generatorCallExpression, callExpression);
};

export { promptExpression };
