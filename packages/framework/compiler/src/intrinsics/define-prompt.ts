import type ts from "typescript";
import type { ModuleDef } from "@toolcog/runtime";
import { error } from "../utils/errors.ts";
import { valueToExpression } from "../utils/literals.ts";
import { Diagnostics } from "../diagnostics.ts";
import { getComment } from "../comment.ts";
import { getNodeId, getNodeIdentifier } from "../node-id.ts";
import { signatureToSchema } from "../schema.ts";

const definePromptExpression = (
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
  const functionTypeArgument = callExpression.typeArguments?.[0];
  ts.Debug.assert(functionTypeArgument !== undefined);

  const functionType = checker.getTypeFromTypeNode(functionTypeArgument);
  const functionSignature = functionType.getCallSignatures()[0];
  ts.Debug.assert(functionSignature !== undefined);

  const signatureDeclaration = functionSignature.declaration as
    | ts.SignatureDeclaration
    | undefined;
  ts.Debug.assert(signatureDeclaration !== undefined);

  const configExpression = callExpression.arguments[0];

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

  const functionSchema = signatureToSchema(
    ts,
    checker,
    addDiagnostic,
    functionSignature,
    promptId.replace(/[^a-zA-Z0-9_-]/g, "_"),
    comment,
    callExpression,
  );

  // Define and destructure the config parameter.

  let configParameterDeclaration: ts.ParameterDeclaration | undefined;

  let instructionsIdentifier: ts.Identifier | undefined;
  let toolsIdentifier: ts.Identifier | undefined;
  let defaultsIdentifier: ts.Identifier | undefined;
  let generatorConfigIdentifier: ts.Identifier | undefined;

  let configVariableDeclaration: ts.VariableStatement | undefined;

  if (configExpression !== undefined) {
    const configParameterName = factory.createIdentifier("config");
    configParameterDeclaration = factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
      configParameterName,
      undefined, // questionToken
      undefined, // type
      undefined, // initializer
    );

    instructionsIdentifier = factory.createIdentifier("instructions");
    toolsIdentifier = factory.createIdentifier("tools");
    defaultsIdentifier = factory.createIdentifier("defaults");
    generatorConfigIdentifier = factory.createIdentifier("generatorConfig");

    configVariableDeclaration = factory.createVariableStatement(
      undefined, // modifiers
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createObjectBindingPattern([
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
              configParameterName,
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
          factory.createArrayLiteralExpression([
            factory.createSpreadElement(parameterIdentifier),
          ]),
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
        "id",
        factory.createPropertyAccessExpression(functionIdentifier, "id"),
      ),

      factory.createPropertyAssignment(
        "parameters",
        factory.createPropertyAccessExpression(
          functionIdentifier,
          "parameters",
        ),
      ),

      factory.createPropertyAssignment(
        "returns",
        factory.createPropertyAccessExpression(functionIdentifier, "returns"),
      ),

      factory.createSpreadAssignment(
        factory.createParenthesizedExpression(
          factory.createConditionalExpression(
            factory.createBinaryExpression(
              factory.createPropertyAccessExpression(
                functionIdentifier,
                "instructions",
              ),
              factory.createToken(ts.SyntaxKind.ExclamationEqualsEqualsToken),
              factory.createVoidZero(),
            ),
            undefined, // questionToken
            factory.createObjectLiteralExpression([
              factory.createPropertyAssignment(
                "instructions",
                factory.createPropertyAccessExpression(
                  functionIdentifier,
                  "instructions",
                ),
              ),
            ]),
            undefined, // colonToken
            factory.createVoidZero(),
          ),
        ),
      ),

      factory.createPropertyAssignment(
        "tools",
        factory.createPropertyAccessExpression(functionIdentifier, "tools"),
      ),

      ...(generatorConfigIdentifier !== undefined ?
        [factory.createSpreadAssignment(generatorConfigIdentifier)]
      : []),

      ...(optionsParameterName !== undefined ?
        [factory.createSpreadAssignment(optionsParameterName)]
      : []),

      ...(optionsParameterName !== undefined ?
        [
          factory.createSpreadAssignment(
            factory.createParenthesizedExpression(
              factory.createConditionalExpression(
                factory.createBinaryExpression(
                  factory.createPropertyAccessChain(
                    optionsParameterName,
                    factory.createToken(ts.SyntaxKind.QuestionDotToken),
                    "tools",
                  ),
                  factory.createToken(
                    ts.SyntaxKind.ExclamationEqualsEqualsToken,
                  ),
                  factory.createVoidZero(),
                ),
                undefined, // questionToken
                factory.createObjectLiteralExpression([
                  factory.createPropertyAssignment(
                    "tools",
                    factory.createArrayLiteralExpression([
                      factory.createSpreadElement(
                        factory.createPropertyAccessExpression(
                          functionIdentifier,
                          "tools",
                        ),
                      ),
                      factory.createSpreadElement(
                        factory.createPropertyAccessExpression(
                          optionsParameterName,
                          "tools",
                        ),
                      ),
                    ]),
                  ),
                ]),
                undefined, // colonToken
                factory.createVoidZero(),
              ),
            ),
          ),
        ]
      : []),
    ],
    true, // multiLine
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

  // Define the name property.

  let nameAssignment: ts.Statement | undefined;
  if (functionSchema.name !== undefined) {
    nameAssignment = factory.createExpressionStatement(
      factory.createCallExpression(
        factory.createPropertyAccessExpression(
          factory.createIdentifier("Object"),
          "defineProperty",
        ),
        undefined, // typeArguments
        [
          functionIdentifier,
          factory.createStringLiteral("name"),
          factory.createObjectLiteralExpression(
            [
              factory.createPropertyAssignment(
                "value",
                factory.createStringLiteral(functionSchema.name),
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
      factory.createPropertyAccessExpression(functionIdentifier, "description"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      functionSchema.description !== undefined ?
        factory.createStringLiteral(functionSchema.description)
      : factory.createVoidZero(),
    ),
  );

  // Define the parameters property.

  const parametersAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(functionIdentifier, "parameters"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      valueToExpression(ts, factory, functionSchema.parameters, callExpression),
    ),
  );

  // Define the returns property.

  const returnsAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(functionIdentifier, "returns"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      valueToExpression(ts, factory, functionSchema.returns, callExpression),
    ),
  );

  // Define the instructions property.

  let instructions = comment?.tags.instructions;
  if (instructions === undefined) {
    instructions = comment?.description;
  }

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

  // Add the prompt to the module manifest.

  moduleDef.prompts[promptId] = {
    ...functionSchema,
    instructions,
  };

  // Create and return an IIFE wrapper.

  const iifeExpression = factory.createCallExpression(
    factory.createArrowFunction(
      undefined, // modifiers,
      undefined, // typeParameters,
      [
        ...(configParameterDeclaration !== undefined ?
          [configParameterDeclaration]
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
          ...(configVariableDeclaration !== undefined ?
            [configVariableDeclaration]
          : []),
          generativeFunctionDeclaration,
          idAssignment,
          ...(nameAssignment !== undefined ? [nameAssignment] : []),
          descriptionAssignment,
          parametersAssignment,
          returnsAssignment,
          instructionsAssignment,
          toolsAssignment,
          factory.createReturnStatement(functionIdentifier),
        ],
        true, // multiLine
      ),
    ),
    undefined, // typeArguments
    [
      ...(configExpression !== undefined ? [configExpression] : []),
      ...(contextToolsExpression !== undefined ? [contextToolsExpression] : []),
      generatorExpression,
    ],
  );

  return ts.setOriginalNode(iifeExpression, callExpression);
};

export { definePromptExpression };
