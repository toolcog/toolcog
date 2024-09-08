import type ts from "typescript";
import type { ModuleDef } from "@toolcog/runtime";
import { getNodeId } from "../node-id.ts";
import { defineIdiomsExpression } from "./define-idioms.ts";

const defineIndexExpression = (
  ts: typeof import("typescript"),
  host: ts.ModuleResolutionHost,
  program: ts.Program,
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  moduleDef: ModuleDef,
  idiomType: ts.Type,
  idiomsType: ts.Type,
  idiomResolverExpression: ts.Expression | undefined,
  embedderExpression: ts.Expression,
  indexerExpression: ts.Expression,
  callExpression: ts.CallExpression,
): ts.Expression => {
  const valuesExpression = callExpression.arguments[0]!;
  const indexerOptionsExpression = callExpression.arguments[1];

  const valuesType = checker.getTypeAtLocation(valuesExpression);

  const indexIdentifier = factory.createIdentifier("index");

  let indexId =
    getNodeId(ts, callExpression, {
      package: true,
      module: true,
      host,
      program,
    }) ?? "";

  if (
    indexId in moduleDef.indexes ||
    indexId.length === 0 ||
    indexId.endsWith(":")
  ) {
    const baseId = indexId;
    let conflictCount = 0;
    while (true) {
      indexId = baseId + "#" + conflictCount;
      if (!(indexId in moduleDef.indexes)) {
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

  // Define the indexerOptions parameter.

  let indexerOptionsParameterName: ts.Identifier | undefined;
  let indexerOptionsParameterDeclaration: ts.ParameterDeclaration | undefined;

  if (indexerOptionsExpression !== undefined) {
    indexerOptionsParameterName = factory.createIdentifier("indexerOptions");
    indexerOptionsParameterDeclaration = factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
      indexerOptionsParameterName,
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

  const indexInitCallExpression = factory.createCallExpression(
    indexerParameterName,
    undefined, // typeArguments
    [
      factory.createPropertyAccessExpression(indexIdentifier, "idioms"),
      factory.createObjectLiteralExpression(
        [
          factory.createPropertyAssignment(
            "id",
            factory.createPropertyAccessExpression(indexIdentifier, "id"),
          ),
          factory.createPropertyAssignment(
            "embedder",
            factory.createPropertyAccessExpression(indexIdentifier, "embedder"),
          ),
          ...(indexerOptionsParameterName !== undefined ?
            [factory.createSpreadAssignment(indexerOptionsParameterName)]
          : []),
        ],
        true, // multiLine
      ),
    ],
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
            indexInitCallExpression,
          ),
        ),
      ],
      true, // multiLine
    ),
    undefined, // elseStatement
  );

  const indexCallExpression = factory.createAwaitExpression(
    factory.createCallExpression(
      factory.createParenthesizedExpression(
        factory.createAwaitExpression(indexInitVariableName),
      ),
      undefined, // typeArguments
      [
        queryParameterName,
        indexerOptionsParameterName !== undefined ?
          factory.createObjectLiteralExpression(
            [
              factory.createSpreadAssignment(indexerOptionsParameterName),
              factory.createSpreadAssignment(optionsParameterName),
            ],
            true, // multiLine
          )
        : optionsParameterName,
      ],
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

  // Define the embedder property.

  const embedderAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(indexIdentifier, "embedder"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      indexerOptionsParameterName !== undefined ?
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(
            indexerOptionsParameterName,
            "embedder",
          ),
          factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
          embedderParameterName,
        )
      : embedderParameterName,
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
    host,
    program,
    factory,
    checker,
    addDiagnostic,
    moduleDef,
    idiomType,
    idiomsType,
    idiomResolverExpression,
    valuesExpression,
    valuesType,
    valuesExpression,
    idioms,
  );

  // Add the index to the module manifest.

  moduleDef.indexes[indexId] = { idioms };

  // Create and return an IIFE wrapper.

  const iifeExpression = factory.createCallExpression(
    factory.createArrowFunction(
      undefined, // modifiers,
      undefined, // typeParameters,
      [
        idiomsParameterDeclaration,
        ...(indexerOptionsParameterDeclaration !== undefined ?
          [indexerOptionsParameterDeclaration]
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
          embedderAssignment,
          idiomsAssignment,
          factory.createReturnStatement(indexIdentifier),
        ],
        true, // multiLine
      ),
    ),
    undefined, // typeArguments
    [
      idiomsArgument,
      ...(indexerOptionsExpression !== undefined ?
        [indexerOptionsExpression]
      : []),
      embedderExpression,
      indexerExpression,
    ],
  );

  return ts.setOriginalNode(iifeExpression, callExpression);
};

export { defineIndexExpression };
