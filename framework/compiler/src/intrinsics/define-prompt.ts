import type ts from "typescript";
import { error } from "../utils/errors.ts";
import { valueToExpression } from "../utils/literals.ts";
import { Diagnostics } from "../diagnostics.ts";
import { getComment } from "../comment.ts";
import { getNodeId, getNodeIdentifier } from "../node-id.ts";
import { signatureToSchema } from "../schema.ts";
import type { ToolcogManifest } from "../manifest.ts";

const definePromptExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  getCommonSourceDirectory: (() => string) | undefined,
  manifest: ToolcogManifest,
  generatorExpression: ts.Expression,
  contextToolsExpression: ts.Expression | undefined,
  callExpression: ts.CallExpression,
): ts.Expression => {
  const functionTypeArgument = callExpression.typeArguments?.[0];
  ts.Debug.assert(functionTypeArgument !== undefined);

  const functionType = checker.getTypeFromTypeNode(functionTypeArgument);
  const functionSignature = functionType.getCallSignatures()[0];
  ts.Debug.assert(functionSignature !== undefined);

  const signatureDeclaration = functionSignature.declaration as
    | ts.SignatureDeclaration
    | undefined;
  ts.Debug.assert(signatureDeclaration !== undefined);

  const propsExpression = callExpression.arguments[0];

  let promptId =
    getNodeId(ts, callExpression, {
      package: true,
      module: true,
      getCommonSourceDirectory,
    }) ?? "";

  if (
    promptId in manifest.prompts ||
    promptId.length === 0 ||
    promptId.endsWith(":")
  ) {
    const baseId = promptId;
    let conflictCount = 0;
    while (true) {
      promptId = baseId + "#" + conflictCount;
      if (!(promptId in manifest.prompts)) {
        break;
      }
      conflictCount += 1;
    }
  }

  const functionName = getNodeIdentifier(ts, callExpression);

  const functionIdentifier = factory.createIdentifier(
    functionName !== undefined ? functionName + "Function" : "promptFunction",
  );

  const comment = getComment(ts, checker, callExpression);
  if (comment === undefined) {
    error(
      ts,
      addDiagnostic,
      callExpression,
      Diagnostics.CommentNeededToDescribeFunctionToLLM,
    );
  }

  // Define and destructure the props parameter.

  let propsParameterDeclaration: ts.ParameterDeclaration | undefined;

  let modelIdentifier: ts.Identifier | undefined;
  let toolsIdentifier: ts.Identifier | undefined;
  let instructionsIdentifier: ts.Identifier | undefined;
  let defaultsIdentifier: ts.Identifier | undefined;
  let generatorConfigIdentifier: ts.Identifier | undefined;

  let propsVariableDeclaration: ts.VariableStatement | undefined;

  if (propsExpression !== undefined) {
    const propsParameterName = factory.createIdentifier("props");
    propsParameterDeclaration = factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
      propsParameterName,
      undefined, // questionToken
      undefined, // type
      undefined, // initializer
    );

    modelIdentifier = factory.createIdentifier("model");
    toolsIdentifier = factory.createIdentifier("tools");
    instructionsIdentifier = factory.createIdentifier("instructions");
    defaultsIdentifier = factory.createIdentifier("defaults");
    generatorConfigIdentifier = factory.createIdentifier("generatorConfig");

    propsVariableDeclaration = factory.createVariableStatement(
      undefined, // modifiers
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createObjectBindingPattern([
              factory.createBindingElement(
                undefined, // dotDotDotToken
                undefined, // propertyName
                modelIdentifier,
                undefined, // initializer
              ),
              factory.createBindingElement(
                undefined, // dotDotDotToken
                undefined, // propertyName
                toolsIdentifier,
                undefined, // initializer
              ),
              factory.createBindingElement(
                undefined, // dotDotDotToken
                undefined, // propertyName
                instructionsIdentifier,
                undefined, // initializer
              ),
              factory.createBindingElement(
                undefined, // dotDotDotToken
                undefined, // propertyName
                defaultsIdentifier,
                undefined, // initializer
              ),
              factory.createBindingElement(
                factory.createToken(ts.SyntaxKind.DotDotDotToken),
                undefined, // propertyName
                generatorConfigIdentifier,
                undefined, // initializer
              ),
            ]),
            undefined, // exclamationToken
            undefined, // type
            factory.createBinaryExpression(
              propsParameterName,
              factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
              factory.createObjectLiteralExpression(),
            ),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );
  }

  // Define the context tools parameter.

  let contextToolsParameterName: ts.Identifier | undefined;
  let contextToolsParameterDeclaration: ts.ParameterDeclaration | undefined;

  if (contextToolsExpression !== undefined) {
    contextToolsParameterName = factory.createIdentifier("contextTools");
    contextToolsParameterDeclaration = factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
      contextToolsParameterName,
      undefined, // questionToken
      undefined, // type
      undefined, // initializer
    );
  }

  // Define the generator parameter.

  const generatorParameterName = factory.createIdentifier("generator");
  const generatorParameterDeclaration = factory.createParameterDeclaration(
    undefined, // modifiers
    undefined, // dotDotDotToken
    generatorParameterName,
    undefined, // questionToken
    undefined, // type
    undefined, // initializer
  );

  // Define generative function parameters and argument assignments.

  let variadic = false;
  const parameterDeclarations: ts.ParameterDeclaration[] = [];
  const argumentAssignments: ts.ObjectLiteralElementLike[] = [];

  for (const parameterDeclaration of signatureDeclaration.parameters) {
    ts.Debug.assert(ts.isIdentifier(parameterDeclaration.name));

    const parameterIdentifier = factory.createUniqueName(
      parameterDeclaration.name.text,
      ts.GeneratedIdentifierFlags.Optimistic,
    );

    const parameterInitializer =
      (
        defaultsIdentifier !== undefined &&
        parameterDeclaration.questionToken !== undefined
      ) ?
        factory.createPropertyAccessChain(
          defaultsIdentifier,
          factory.createToken(ts.SyntaxKind.QuestionDotToken),
          parameterDeclaration.name,
        )
      : undefined;

    parameterDeclarations.push(
      factory.createParameterDeclaration(
        parameterDeclaration.modifiers,
        parameterDeclaration.dotDotDotToken,
        parameterIdentifier,
        undefined, // questionToken
        undefined, // type
        parameterInitializer,
      ),
    );

    if (parameterDeclaration.dotDotDotToken === undefined) {
      // Assign ordinal arguments to named properties.
      argumentAssignments.push(
        factory.createPropertyAssignment(
          parameterDeclaration.name,
          parameterIdentifier,
        ),
      );
    } else {
      // Spread variadic arguments into an array and assign to named property.
      variadic = true;
      argumentAssignments.push(
        factory.createPropertyAssignment(
          parameterDeclaration.name,
          factory.createArrayLiteralExpression(
            [factory.createSpreadElement(parameterIdentifier)],
            false, // multiLine
          ),
        ),
      );
    }
  }

  const generatorCallArgs = factory.createObjectLiteralExpression(
    argumentAssignments,
    true, // multiLine
  );

  // Define the generative function options parameter.

  let optionsParameterName: ts.Identifier | undefined;
  if (!variadic) {
    optionsParameterName = factory.createIdentifier("options");
    parameterDeclarations.push(
      factory.createParameterDeclaration(
        undefined, // modifiers
        undefined, // dotDotDotToken
        optionsParameterName,
        undefined, // questionToken
        undefined, // type
        undefined, // initializer
      ),
    );
  }

  // Define the generative function implementation.

  const generatorCallOptions = factory.createObjectLiteralExpression(
    [
      factory.createPropertyAssignment(
        "model",
        factory.createPropertyAccessExpression(functionIdentifier, "model"),
      ),

      factory.createPropertyAssignment(
        "tools",
        factory.createPropertyAccessExpression(functionIdentifier, "tools"),
      ),

      factory.createPropertyAssignment(
        "instructions",
        factory.createPropertyAccessExpression(
          functionIdentifier,
          "instructions",
        ),
      ),

      factory.createPropertyAssignment(
        "function",
        factory.createPropertyAccessExpression(functionIdentifier, "function"),
      ),

      ...(generatorConfigIdentifier !== undefined ?
        [factory.createSpreadAssignment(generatorConfigIdentifier)]
      : []),

      ...(optionsParameterName !== undefined ?
        [factory.createSpreadAssignment(optionsParameterName)]
      : []),
    ],
    true,
  );

  const generativeFunction = factory.createArrowFunction(
    [factory.createToken(ts.SyntaxKind.AsyncKeyword)],
    undefined, // typeParameters
    parameterDeclarations, // parameters
    undefined, // type
    undefined, // equalsGreaterThanToken
    factory.createBlock(
      [
        factory.createReturnStatement(
          factory.createAwaitExpression(
            factory.createCallExpression(
              generatorParameterName,
              undefined, // typeArguments
              [generatorCallArgs, generatorCallOptions],
            ),
          ),
        ),
      ],
      true, // multiLine
    ),
  );

  const generativeFunctionDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          functionIdentifier,
          undefined, // exclamationToken
          undefined, // type
          generativeFunction,
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  // Define the id property.

  const idAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(functionIdentifier, "id"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      factory.createStringLiteral(promptId),
    ),
  );

  // Define the model property.

  let modelExpression: ts.Expression;
  if (modelIdentifier !== undefined) {
    modelExpression = modelIdentifier;
  } else {
    modelExpression = factory.createVoidZero();
  }

  const modelAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(functionIdentifier, "model"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      modelExpression,
    ),
  );

  // Define the tools property.

  let toolsExpression: ts.Expression;
  if (
    toolsIdentifier !== undefined &&
    contextToolsParameterName !== undefined
  ) {
    toolsExpression = factory.createBinaryExpression(
      toolsIdentifier,
      factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
      factory.createCallExpression(
        contextToolsParameterName,
        undefined, // typeArguments
        undefined, // arguments
      ),
    );
  } else if (toolsIdentifier !== undefined) {
    toolsExpression = factory.createBinaryExpression(
      toolsIdentifier,
      factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
      factory.createArrayLiteralExpression(),
    );
  } else if (contextToolsParameterName !== undefined) {
    toolsExpression = factory.createCallExpression(
      contextToolsParameterName,
      undefined, // typeArguments
      undefined, // arguments
    );
  } else {
    toolsExpression = factory.createArrayLiteralExpression();
  }

  const toolsAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(functionIdentifier, "tools"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      toolsExpression,
    ),
  );

  // Define the instructions property.

  const instructions = comment?.tags.instructions;

  let instructionsExpression: ts.Expression;
  if (instructionsIdentifier !== undefined && instructions !== undefined) {
    instructionsExpression = factory.createBinaryExpression(
      instructionsIdentifier,
      factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
      factory.createStringLiteral(instructions),
    );
  } else if (instructionsIdentifier !== undefined) {
    instructionsExpression = instructionsIdentifier;
  } else if (instructions !== undefined) {
    instructionsExpression = factory.createStringLiteral(instructions);
  } else {
    instructionsExpression = factory.createVoidZero();
  }

  const instructionsAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(
        functionIdentifier,
        "instructions",
      ),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      instructionsExpression,
    ),
  );

  // Define the function property.

  const functionSchema = signatureToSchema(
    ts,
    checker,
    addDiagnostic,
    functionSignature,
    promptId.replace(/[^a-zA-Z0-9_-]/g, "_"),
    comment,
    callExpression,
  );

  const functionExpression = valueToExpression(
    ts,
    factory,
    functionSchema,
    callExpression,
  );

  const functionAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(functionIdentifier, "function"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      functionExpression,
    ),
  );

  // Add the prompt to the manifest.

  manifest.prompts[promptId] = {
    instructions,
    function: functionSchema,
  };

  // Create and return an IIFE wrapper.

  const iifeExpression = factory.createCallExpression(
    factory.createArrowFunction(
      undefined, // modifiers,
      undefined, // typeParameters,
      [
        ...(propsParameterDeclaration !== undefined ?
          [propsParameterDeclaration]
        : []),
        ...(contextToolsParameterDeclaration !== undefined ?
          [contextToolsParameterDeclaration]
        : []),
        generatorParameterDeclaration,
      ],
      undefined, // type
      undefined, // equalsGreaterThanToken,
      factory.createBlock(
        [
          ...(propsVariableDeclaration !== undefined ?
            [propsVariableDeclaration]
          : []),
          generativeFunctionDeclaration,
          idAssignment,
          modelAssignment,
          toolsAssignment,
          instructionsAssignment,
          functionAssignment,
          factory.createReturnStatement(functionIdentifier),
        ],
        true, // multiLine
      ),
    ),
    undefined, // typeArguments
    [
      ...(propsExpression !== undefined ? [propsExpression] : []),
      ...(contextToolsExpression !== undefined ? [contextToolsExpression] : []),
      generatorExpression,
    ],
  );

  return ts.setOriginalNode(iifeExpression, callExpression);
};

export { definePromptExpression };
