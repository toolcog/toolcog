import type ts from "typescript";
import { getNodeId } from "../node-id.ts";
import type { ToolcogManifest } from "../manifest.ts";
import { defineIdiomsExpression } from "./define-idioms.ts";

const defineIndexExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  getCommonSourceDirectory: (() => string) | undefined,
  manifest: ToolcogManifest,
  idiomType: ts.Type,
  idiomsType: ts.Type,
  embeddingsExpression: ts.Expression | undefined,
  idiomsExpression: ts.Expression | undefined,
  embedderExpression: ts.Expression,
  indexerExpression: ts.Expression,
  callExpression: ts.CallExpression,
): ts.Expression => {
  ts.Debug.assert(manifest.embeddingModel !== undefined);

  const valuesExpression = callExpression.arguments[0]!;
  const configExpression = callExpression.arguments[1];

  const valuesType = checker.getTypeAtLocation(valuesExpression);

  const indexIdentifier = factory.createIdentifier("index");

  let indexId =
    getNodeId(ts, callExpression, {
      package: true,
      module: true,
      getCommonSourceDirectory,
    }) ?? "";

  if (
    indexId in manifest.indexes ||
    indexId.length === 0 ||
    indexId.endsWith(":")
  ) {
    const baseId = indexId;
    let conflictCount = 0;
    while (true) {
      indexId = baseId + "#" + conflictCount;
      if (!(indexId in manifest.indexes)) {
        break;
      }
      conflictCount += 1;
    }
  }

  // Define the idioms parameter.

  const idiomsParameterName = factory.createIdentifier("idioms");
  const idiomsParameterDeclaration = factory.createParameterDeclaration(
    undefined, // modifiers
    undefined, // dotDotDotToken
    idiomsParameterName,
    undefined, // questionToken
    undefined, // type
    undefined, // initializer
  );

  // Define the config parameter.

  let configParameterName: ts.Identifier | undefined;
  let configParameterDeclaration: ts.ParameterDeclaration | undefined;

  if (configExpression !== undefined) {
    configParameterName = factory.createIdentifier("config");
    configParameterDeclaration = factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
      configParameterName,
      undefined, // questionToken
      undefined, // type
      undefined, // initializer
    );
  }

  // Define the embedder parameter.

  const embedderParameterName = factory.createIdentifier("embedder");
  const embedderParameterDeclaration = factory.createParameterDeclaration(
    undefined, // modifiers
    undefined, // dotDotDotToken
    embedderParameterName,
    undefined, // questionToken
    undefined, // type
    undefined, // initializer
  );

  // Define the indexer parameter.

  const indexerParameterName = factory.createIdentifier("indexer");
  const indexerParameterDeclaration = factory.createParameterDeclaration(
    undefined, // modifiers
    undefined, // dotDotDotToken
    indexerParameterName,
    undefined, // questionToken
    undefined, // type
    undefined, // initializer
  );

  // Define the indexInit variable

  const indexInitVariableName = factory.createIdentifier("indexInit");
  const indexInitVariableDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          indexInitVariableName,
          undefined, // exclamationToken
          undefined, // type
          factory.createNull(),
        ),
      ],
      ts.NodeFlags.Let,
    ),
  );

  // Define the index function implementation.

  const queryParameterName = factory.createIdentifier("query");
  const queryParameterDeclaration = factory.createParameterDeclaration(
    undefined, // modifiers
    undefined, // dotDotDotToken
    queryParameterName,
    undefined, // questionToken
    undefined, // type
    undefined, // initializer
  );

  const optionsParameterName = factory.createIdentifier("options");
  const optionsParameterDeclaration = factory.createParameterDeclaration(
    undefined, // modifiers
    undefined, // dotDotDotToken
    optionsParameterName,
    undefined, // questionToken
    undefined, // type
    undefined, // initializer
  );

  const indexerPropsExpression = factory.createObjectLiteralExpression(
    [
      ...(configParameterName !== undefined ?
        [factory.createSpreadAssignment(configParameterName)]
      : []),
      factory.createSpreadAssignment(indexIdentifier),
    ],
    false, // multiLine
  );

  const indexInitCondition = factory.createIfStatement(
    factory.createBinaryExpression(
      indexInitVariableName,
      factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
      factory.createNull(),
    ),
    factory.createBlock(
      [
        factory.createExpressionStatement(
          factory.createBinaryExpression(
            indexInitVariableName,
            factory.createToken(ts.SyntaxKind.EqualsToken),
            factory.createCallExpression(
              indexerParameterName,
              undefined, // typeArguments
              [indexerPropsExpression],
            ),
          ),
        ),
      ],
      true, // multiLine
    ),
    undefined, // elseStatement
  );

  let indexOptionsExpression: ts.Expression | undefined;
  if (configParameterName !== undefined) {
    indexOptionsExpression = factory.createObjectLiteralExpression(
      [
        factory.createSpreadAssignment(configParameterName),
        factory.createSpreadAssignment(optionsParameterName),
      ],
      false, // multiLine
    );
  } else {
    indexOptionsExpression = optionsParameterName;
  }

  const indexCallExpression = factory.createAwaitExpression(
    factory.createCallExpression(
      factory.createParenthesizedExpression(
        factory.createAwaitExpression(indexInitVariableName),
      ),
      undefined, // typeArguments
      [queryParameterName, indexOptionsExpression],
    ),
  );

  const indexFunction = factory.createArrowFunction(
    [factory.createToken(ts.SyntaxKind.AsyncKeyword)],
    undefined, // typeParameters
    [queryParameterDeclaration, optionsParameterDeclaration],
    undefined, // type
    undefined, // equalsGreaterThanToken
    factory.createBlock(
      [indexInitCondition, factory.createReturnStatement(indexCallExpression)],
      true, // multiLine
    ),
  );

  const indexFunctionDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          indexIdentifier,
          undefined, // exclamationToken
          undefined, // type
          indexFunction,
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  // Define the id property.

  const idAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(indexIdentifier, "id"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      factory.createStringLiteral(indexId),
    ),
  );

  // Define the model property.

  const modelAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(indexIdentifier, "model"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      factory.createStringLiteral(manifest.embeddingModel),
    ),
  );

  // Define the idioms property.

  const idiomsAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(indexIdentifier, "idioms"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      idiomsParameterName,
    ),
  );

  // Transform the idioms argument.

  const idioms: string[] = [];

  const idiomsArgument = defineIdiomsExpression(
    ts,
    factory,
    checker,
    addDiagnostic,
    getCommonSourceDirectory,
    manifest,
    idiomType,
    idiomsType,
    embeddingsExpression,
    idiomsExpression,
    valuesExpression,
    valuesType,
    valuesExpression,
    idioms,
  );

  // Add the index to the manifest.

  manifest.indexes[indexId] = { idioms };

  // Define the embedder property.

  const embedderAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(indexIdentifier, "embedder"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      embedderParameterName,
    ),
  );

  // Create and return an IIFE wrapper.

  const iifeExpression = factory.createCallExpression(
    factory.createArrowFunction(
      undefined, // modifiers,
      undefined, // typeParameters,
      [
        idiomsParameterDeclaration,
        ...(configParameterDeclaration !== undefined ?
          [configParameterDeclaration]
        : []),
        embedderParameterDeclaration,
        indexerParameterDeclaration,
      ],
      undefined, // type
      undefined, // equalsGreaterThanToken,
      factory.createBlock(
        [
          indexInitVariableDeclaration,
          indexFunctionDeclaration,
          idAssignment,
          modelAssignment,
          idiomsAssignment,
          embedderAssignment,
          factory.createReturnStatement(indexIdentifier),
        ],
        true, // multiLine
      ),
    ),
    undefined, // typeArguments
    [
      idiomsArgument,
      ...(configExpression !== undefined ? [configExpression] : []),
      embedderExpression,
      indexerExpression,
    ],
  );

  return ts.setOriginalNode(iifeExpression, callExpression);
};

export { defineIndexExpression };
