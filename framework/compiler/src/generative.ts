import type ts from "typescript";
import { error } from "./utils/errors.ts";
import { valueToExpression } from "./utils/literals.ts";
import { Diagnostics } from "./diagnostics.ts";
import { getComment } from "./comment.ts";
import { getNodeId, getNodeName } from "./node-id.ts";
import { signatureToSchema } from "./schema.ts";

const transformGenerativeIntrinsic = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  getCommonSourceDirectory: (() => string) | undefined,
  generativeModelExpression: ts.Expression,
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

  const functionId = getNodeId(ts, callExpression, {
    package: true,
    module: true,
    getCommonSourceDirectory,
  });

  const functionName = getNodeName(ts, callExpression);

  const functionIdentifier = factory.createUniqueName(
    functionName !== undefined ?
      functionName + "Function"
    : "generativeFunction",
    // Prevent shadowing by generative function parameter names.
    ts.GeneratedIdentifierFlags.Optimistic |
      ts.GeneratedIdentifierFlags.ReservedInNestedScopes,
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

  // Define the generative model parameter.

  const generativeModelParameterName = factory.createUniqueName(
    "generativeModel",
    // Prevent shadowing by generative function parameter names.
    ts.GeneratedIdentifierFlags.Optimistic |
      ts.GeneratedIdentifierFlags.ReservedInNestedScopes,
  );

  const generativeModelParameterDeclaration =
    factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
      generativeModelParameterName,
      undefined, // questionToken
      undefined, // type
      undefined, // initializer
    );

  // Define the context tools parameter.

  let contextToolsParameterName: ts.Identifier | undefined;
  let contextToolsParameterDeclaration: ts.ParameterDeclaration | undefined;

  if (contextToolsExpression !== undefined) {
    contextToolsParameterName = factory.createUniqueName(
      "contextTools",
      // Prevent shadowing by generative function parameter names.
      ts.GeneratedIdentifierFlags.Optimistic |
        ts.GeneratedIdentifierFlags.ReservedInNestedScopes,
    );

    contextToolsParameterDeclaration = factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
      contextToolsParameterName,
      undefined, // questionToken
      undefined, // type
      undefined, // initializer
    );
  }

  // Define the destructured props parameter.

  let defaultsIdentifier: ts.Identifier | undefined;
  let instructionsIdentifier: ts.Identifier | undefined;
  let toolsIdentifier: ts.Identifier | undefined;
  let modelIdentifier: ts.Identifier | undefined;
  let propsIdentifier: ts.Identifier | undefined;

  let propsParameterDeclaration: ts.ParameterDeclaration | undefined;

  if (propsExpression !== undefined) {
    defaultsIdentifier = factory.createIdentifier("defaults");
    instructionsIdentifier = factory.createIdentifier("instructions");
    toolsIdentifier = factory.createIdentifier("tools");
    modelIdentifier = factory.createIdentifier("model");
    propsIdentifier = factory.createUniqueName(
      "props",
      // Prevent shadowing by generative function parameter names.
      ts.GeneratedIdentifierFlags.Optimistic |
        ts.GeneratedIdentifierFlags.ReservedInNestedScopes,
    );

    propsParameterDeclaration = factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
      factory.createObjectBindingPattern([
        factory.createBindingElement(
          undefined, // dotDotDotToken
          undefined, // propertyName
          defaultsIdentifier,
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
          toolsIdentifier,
          undefined, // initializer
        ),
        factory.createBindingElement(
          undefined, // dotDotDotToken
          undefined, // propertyName
          modelIdentifier,
          undefined, // initializer
        ),
        factory.createBindingElement(
          factory.createToken(ts.SyntaxKind.DotDotDotToken),
          undefined, // propertyName
          propsIdentifier,
          undefined, // initializer
        ),
      ]),
      undefined, // questionToken
      undefined, // type
      factory.createObjectLiteralExpression(),
    );
  }

  // Define generative function parameters and argument assignments.

  let variadic = false;
  const parameterDeclarations: ts.ParameterDeclaration[] = [];
  const argumentAssignments: ts.ObjectLiteralElementLike[] = [];

  for (const parameterDeclaration of signatureDeclaration.parameters) {
    ts.Debug.assert(ts.isIdentifier(parameterDeclaration.name));

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
      ts.setOriginalNode(
        factory.createParameterDeclaration(
          parameterDeclaration.modifiers,
          parameterDeclaration.dotDotDotToken,
          parameterDeclaration.name,
          parameterDeclaration.questionToken,
          parameterDeclaration.type,
          parameterInitializer,
        ),
        parameterDeclaration,
      ),
    );

    if (parameterDeclaration.dotDotDotToken === undefined) {
      // Assign ordinal arguments to named properties.
      argumentAssignments.push(
        factory.createShorthandPropertyAssignment(parameterDeclaration.name),
      );
    } else {
      // Spread variadic arguments into an array and assign to named property.
      variadic = true;
      argumentAssignments.push(
        factory.createPropertyAssignment(
          parameterDeclaration.name,
          factory.createArrayLiteralExpression(
            [factory.createSpreadElement(parameterDeclaration.name)],
            false, // multiLine
          ),
        ),
      );
    }
  }

  // Define the id property.

  const idAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(functionIdentifier, "id"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      functionId !== undefined ?
        factory.createStringLiteral(functionId)
      : factory.createVoidExpression(factory.createNumericLiteral(0)),
    ),
  );

  // Define the function property.

  const functionSchema = signatureToSchema(
    ts,
    checker,
    addDiagnostic,
    functionSignature,
    functionId?.replace(/[^a-zA-Z0-9_-]/g, "_"),
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
    instructionsExpression = factory.createVoidExpression(
      factory.createNumericLiteral("0"),
    );
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

  // Define the model property.

  let modelExpression: ts.Expression;
  if (modelIdentifier !== undefined) {
    modelExpression = modelIdentifier;
  } else {
    modelExpression = factory.createVoidExpression(
      factory.createNumericLiteral("0"),
    );
  }

  const modelAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(functionIdentifier, "model"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      modelExpression,
    ),
  );

  // Define the generative function options parameter.

  let optionsParameterName: ts.Identifier | undefined;
  if (!variadic) {
    optionsParameterName = factory.createUniqueName(
      "options",
      // Prevent conflicts with other parameter names.
      ts.GeneratedIdentifierFlags.Optimistic |
        ts.GeneratedIdentifierFlags.ReservedInNestedScopes,
    );
    parameterDeclarations.push(
      factory.createParameterDeclaration(
        undefined, // modifiers
        undefined, // dotDotDotToken
        optionsParameterName,
        factory.createToken(ts.SyntaxKind.QuestionToken),
        undefined, // type
        undefined, // initializer
      ),
    );
  }

  // Define the options for the generative model call.

  const optionsAssignments: ts.ObjectLiteralElementLike[] = [
    factory.createPropertyAssignment(
      "function",
      factory.createPropertyAccessExpression(functionIdentifier, "function"),
    ),

    factory.createPropertyAssignment(
      "instructions",
      factory.createPropertyAccessExpression(
        functionIdentifier,
        "instructions",
      ),
    ),

    factory.createPropertyAssignment(
      "tools",
      factory.createPropertyAccessExpression(functionIdentifier, "tools"),
    ),

    factory.createPropertyAssignment(
      "model",
      factory.createPropertyAccessExpression(functionIdentifier, "model"),
    ),

    ...(propsIdentifier !== undefined ?
      [factory.createSpreadAssignment(propsIdentifier)]
    : []),

    ...(optionsParameterName !== undefined ?
      [factory.createSpreadAssignment(optionsParameterName)]
    : []),
  ];

  // Define the generative function implementation.

  const generativeModelCallExpression = factory.createCallExpression(
    generativeModelParameterName,
    undefined, // typeArguments
    [
      factory.createObjectLiteralExpression(argumentAssignments, true),
      factory.createObjectLiteralExpression(optionsAssignments, true),
    ],
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
          factory.createAwaitExpression(generativeModelCallExpression),
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

  // Create and return an IIFE wrapper.

  const iifeExpression = factory.createCallExpression(
    factory.createArrowFunction(
      undefined, // modifiers,
      undefined, // typeParameters,
      [
        generativeModelParameterDeclaration,
        ...(contextToolsParameterDeclaration !== undefined ?
          [contextToolsParameterDeclaration]
        : []),
        ...(propsParameterDeclaration !== undefined ?
          [propsParameterDeclaration]
        : []),
      ],
      undefined, // type
      undefined, // equalsGreaterThanToken,
      factory.createBlock(
        [
          generativeFunctionDeclaration,
          idAssignment,
          functionAssignment,
          instructionsAssignment,
          toolsAssignment,
          modelAssignment,
          factory.createReturnStatement(functionIdentifier),
        ],
        true,
      ),
    ),
    undefined, // typeArguments
    [
      generativeModelExpression,
      ...(contextToolsExpression !== undefined ? [contextToolsExpression] : []),
      ...(propsExpression !== undefined ? [propsExpression] : []),
    ],
  );

  return ts.setOriginalNode(iifeExpression, callExpression);
};

export { transformGenerativeIntrinsic };
