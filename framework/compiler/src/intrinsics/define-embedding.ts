import type ts from "typescript";
import { moveLeadingComments } from "../utils/comments.ts";
import type { ToolcogManifest } from "../manifest.ts";

const defineEmbeddingExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  getCommonSourceDirectory: (() => string) | undefined,
  manifest: ToolcogManifest,
  embeddingsExpression: ts.Expression | undefined,
  embedderExpression: ts.Expression,
  callExpression: ts.CallExpression,
): ts.Expression => {
  ts.Debug.assert(manifest.embeddingModel !== undefined);

  const embedsExpression = callExpression.arguments[0]!;

  const optionsExpression = callExpression.arguments[1];

  // Forward to the configured embedder in the unspecialized case.

  const embedderCallExpression = factory.createCallExpression(
    embedderExpression,
    undefined, // typeArguments
    callExpression.arguments,
  );

  if (!ts.isStringLiteral(embedsExpression)) {
    moveLeadingComments(ts, callExpression, embedderCallExpression);
    return ts.setOriginalNode(embedderCallExpression, callExpression);
  }

  // Define the embeds parameter.

  const embedsParameterName = factory.createIdentifier("embeds");
  const embedsParameterDeclaration = factory.createParameterDeclaration(
    undefined, // modifiers
    undefined, // dotDotDotToken
    embedsParameterName,
    undefined, // questionToken
    undefined, // type
    undefined, // initializer
  );

  // Define the options parameter.

  let optionsParameterName: ts.Identifier | undefined;
  let optionsParameterDeclaration: ts.ParameterDeclaration | undefined;
  if (optionsExpression !== undefined) {
    optionsParameterName = factory.createIdentifier("options");
    optionsParameterDeclaration = factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
      optionsParameterName,
      undefined, // questionToken
      undefined, // type
      undefined, // initializer
    );
  }

  // Define the embeddings parameter.

  const embeddingsParameterName = factory.createIdentifier("embeddings");
  const embeddingsParameterDeclaration = factory.createParameterDeclaration(
    undefined, // modifiers
    undefined, // dotDotDotToken
    embeddingsParameterName,
    undefined, // questionToken
    undefined, // type
    undefined, // initializer
  );

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

  // Define the model variable.

  let modelExpression: ts.Expression | undefined;
  if (optionsExpression !== undefined) {
    modelExpression = factory.createBinaryExpression(
      factory.createPropertyAccessChain(
        optionsExpression,
        factory.createToken(ts.SyntaxKind.QuestionDotToken),
        "model",
      ),
      factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
      factory.createStringLiteral(manifest.embeddingModel),
    );
  } else {
    modelExpression = factory.createStringLiteral(manifest.embeddingModel);
  }

  const modelVariableName = factory.createIdentifier("model");
  const modelVariableDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          modelVariableName,
          undefined, // exclamationToken
          undefined, // type
          modelExpression,
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  // Define the embedding variable.

  const embeddingVariableName = factory.createIdentifier("embedding");
  const embeddingVariableDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          embeddingVariableName,
          undefined, // exclamationToken
          undefined, // type
          factory.createElementAccessExpression(
            embeddingsParameterName,
            embedsParameterName,
          ),
        ),
      ],
      embeddingsExpression !== undefined ?
        ts.NodeFlags.Const
      : ts.NodeFlags.Let,
    ),
  );

  let embeddingVariableInit: ts.Statement | undefined;
  if (embeddingsExpression === undefined) {
    embeddingVariableInit = factory.createIfStatement(
      factory.createBinaryExpression(
        embeddingVariableName,
        factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
        factory.createVoidZero(),
      ),
      factory.createBlock(
        [
          factory.createExpressionStatement(
            factory.createBinaryExpression(
              embeddingVariableName,
              factory.createToken(ts.SyntaxKind.EqualsToken),
              factory.createObjectLiteralExpression(),
            ),
          ),
          factory.createExpressionStatement(
            factory.createBinaryExpression(
              factory.createElementAccessExpression(
                embeddingsParameterName,
                embedsParameterName,
              ),
              factory.createToken(ts.SyntaxKind.EqualsToken),
              embeddingVariableName,
            ),
          ),
        ],
        true, // multiLine
      ),
      undefined, // elseStatement
    );
  }

  // Define the vector variable.

  const vectorVariableName = factory.createIdentifier("vector");
  const vectorVariableDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          vectorVariableName,
          undefined, // exclamationToken
          undefined, // type
          factory.createElementAccessExpression(
            embeddingVariableName,
            modelVariableName,
          ),
        ),
      ],
      ts.NodeFlags.Let,
    ),
  );

  const vectorVariableInit = factory.createIfStatement(
    factory.createBinaryExpression(
      vectorVariableName,
      factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
      factory.createVoidZero(),
    ),
    factory.createBlock(
      [
        factory.createExpressionStatement(
          factory.createBinaryExpression(
            vectorVariableName,
            factory.createToken(ts.SyntaxKind.EqualsToken),
            factory.createAwaitExpression(embedderCallExpression),
          ),
        ),
        factory.createExpressionStatement(
          factory.createBinaryExpression(
            factory.createElementAccessExpression(
              embeddingVariableName,
              modelVariableName,
            ),
            factory.createToken(ts.SyntaxKind.EqualsToken),
            vectorVariableName,
          ),
        ),
      ],
      true, // multiLine
    ),
    undefined, // elseStatement
  );

  // Add the embed to the manifest.
  manifest.embeds.push(embedsExpression.text);

  // Create and return an IIFE wrapper.

  const iifeExpression = factory.createCallExpression(
    factory.createArrowFunction(
      [factory.createToken(ts.SyntaxKind.AsyncKeyword)],
      undefined, // typeParameters,
      [
        embedsParameterDeclaration,
        ...(optionsParameterDeclaration !== undefined ?
          [optionsParameterDeclaration]
        : []),
        embeddingsParameterDeclaration,
        embedderParameterDeclaration,
      ],
      undefined, // type
      undefined, // equalsGreaterThanToken,
      factory.createBlock(
        [
          modelVariableDeclaration,
          embeddingVariableDeclaration,
          ...(embeddingVariableInit !== undefined ?
            [embeddingVariableInit]
          : []),
          vectorVariableDeclaration,
          vectorVariableInit,
          factory.createReturnStatement(vectorVariableName),
        ],
        true, // multiLine
      ),
    ),
    undefined, // typeArguments
    [
      embedsExpression,
      ...(optionsExpression !== undefined ? [optionsExpression] : []),
      ...(embeddingsExpression !== undefined ?
        [embeddingsExpression]
      : [factory.createObjectLiteralExpression()]),
      embedderExpression,
    ],
  );

  moveLeadingComments(ts, callExpression, iifeExpression);

  return ts.setOriginalNode(iifeExpression, callExpression);
};

export { defineEmbeddingExpression };
