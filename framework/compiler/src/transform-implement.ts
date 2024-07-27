import type ts from "typescript";
import { getToolComment } from "./tool-comment.ts";
import { getToolDescriptorForSignature } from "./tool-descriptor.ts";
import { valueToExpression } from "./utils/literals.ts";

const transformImplementExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  generativeModelExpression: ts.Expression,
  callExpression: ts.CallExpression,
  toolScope: Record<string, ts.Identifier | undefined>,
  bindingName?: ts.DeclarationName,
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

  const generativeFunctionIdentifier = factory.createUniqueName(
    bindingName !== undefined && ts.isIdentifier(bindingName) ?
      bindingName.text + "Function"
    : "generativeFunction",
    ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
      ts.GeneratedIdentifierFlags.Optimistic |
      ts.GeneratedIdentifierFlags.AllowNameSubstitution,
  );

  const toolComment = getToolComment(ts, checker, callExpression);

  // Define and destructure the `props` parameter.

  let defaultsIdentifier: ts.Identifier | undefined;
  let propsIdentifier: ts.Identifier | undefined;

  let propsParameterDeclaration: ts.ParameterDeclaration | undefined;

  const propsExpression = callExpression.arguments[0];
  if (propsExpression !== undefined) {
    defaultsIdentifier = factory.createUniqueName(
      "defaultArguments",
      ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
        ts.GeneratedIdentifierFlags.Optimistic |
        ts.GeneratedIdentifierFlags.AllowNameSubstitution,
    );

    propsIdentifier = factory.createUniqueName(
      "props",
      ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
        ts.GeneratedIdentifierFlags.Optimistic |
        ts.GeneratedIdentifierFlags.AllowNameSubstitution,
    );

    propsParameterDeclaration = factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
      factory.createObjectBindingPattern([
        factory.createBindingElement(
          undefined, // dotDotDotToken
          "defaults",
          defaultsIdentifier,
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
      factory.createObjectLiteralExpression([], false),
    );
  }

  // Define the generative function's parameters and argument assignments.

  let variadic = false;
  const parameterDeclarations: ts.ParameterDeclaration[] = [];
  const argumentAssignments: ts.ObjectLiteralElementLike[] = [];

  for (const parameterDeclaration of signatureDeclaration.parameters) {
    ts.Debug.assert(ts.isIdentifier(parameterDeclaration.name));

    if (parameterDeclaration.dotDotDotToken !== undefined) {
      variadic = true;
    }

    let parameterInitializer: ts.Expression | undefined;
    if (
      defaultsIdentifier !== undefined &&
      parameterDeclaration.questionToken !== undefined
    ) {
      parameterInitializer = factory.createPropertyAccessChain(
        defaultsIdentifier,
        factory.createToken(ts.SyntaxKind.QuestionDotToken),
        parameterDeclaration.name,
      );
    }

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

    let argumentElement: ts.ObjectLiteralElementLike;
    if (parameterDeclaration.dotDotDotToken === undefined) {
      // Assign ordinal arguments to named properties.
      argumentElement = factory.createShorthandPropertyAssignment(
        parameterDeclaration.name,
      );
    } else {
      // Spread variadic arguments into an array and assign to named property.
      argumentElement = factory.createPropertyAssignment(
        parameterDeclaration.name,
        factory.createArrayLiteralExpression(
          [factory.createSpreadElement(parameterDeclaration.name)],
          false, // multiLine
        ),
      );
    }
    argumentAssignments.push(argumentElement);
  }

  // Define the generative function's `options` parameter.

  let optionsParameterName: ts.Identifier | undefined;
  if (!variadic) {
    optionsParameterName = factory.createUniqueName(
      "options",
      ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
        ts.GeneratedIdentifierFlags.Optimistic |
        ts.GeneratedIdentifierFlags.AllowNameSubstitution,
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

  // Define `options` argument assignments

  const optionsAssignments: ts.ObjectLiteralElementLike[] = [
    factory.createPropertyAssignment(
      "instructions",
      factory.createPropertyAccessExpression(
        generativeFunctionIdentifier,
        "instructions",
      ),
    ),

    factory.createPropertyAssignment(
      "descriptor",
      factory.createPropertyAccessExpression(
        generativeFunctionIdentifier,
        "descriptor",
      ),
    ),

    factory.createPropertyAssignment(
      "tools",
      factory.createPropertyAccessExpression(
        generativeFunctionIdentifier,
        "tools",
      ),
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
    generativeModelExpression,
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
          generativeFunctionIdentifier,
          undefined, // exclamationToken
          undefined, // type
          generativeFunction,
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  // Define the `instructions` property.

  const instructions = toolComment?.tags.instructions;

  const instructionsAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(
        generativeFunctionIdentifier,
        "instructions",
      ),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      instructions !== undefined ?
        factory.createStringLiteral(instructions)
      : factory.createIdentifier("undefined"),
    ),
  );

  // Define the `descriptor` property.

  const toolDescriptor = getToolDescriptorForSignature(
    ts,
    checker,
    addDiagnostic,
    functionSignature,
    bindingName,
    toolComment,
    callExpression,
  );

  const descriptorAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(
        generativeFunctionIdentifier,
        "descriptor",
      ),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      valueToExpression(ts, factory, toolDescriptor, callExpression),
    ),
  );

  // Define the `tools` property.

  const toolExpressions: ts.Expression[] = [];
  for (const toolName in toolScope) {
    const toolExpression = toolScope[toolName];
    if (toolExpression !== undefined) {
      toolExpressions.push(toolExpression);
    }
  }

  const toolsAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(
        generativeFunctionIdentifier,
        "tools",
      ),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      factory.createArrayLiteralExpression(toolExpressions, true),
    ),
  );

  // Create and return an IIFE wrapper.

  const iifeExpression = factory.createCallExpression(
    factory.createArrowFunction(
      undefined, // modifiers,
      undefined, // typeParameters,
      propsParameterDeclaration !== undefined ?
        [propsParameterDeclaration]
      : [],
      undefined, // type
      undefined, // equalsGreaterThanToken,
      factory.createBlock(
        [
          generativeFunctionDeclaration,
          instructionsAssignment,
          descriptorAssignment,
          toolsAssignment,
          factory.createReturnStatement(generativeFunctionIdentifier),
        ],
        true,
      ),
    ),
    undefined, // typeArguments
    propsExpression !== undefined ? [propsExpression] : undefined,
  );

  return ts.setOriginalNode(iifeExpression, callExpression);
};

export { transformImplementExpression };
