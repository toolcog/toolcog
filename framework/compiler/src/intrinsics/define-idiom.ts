import type ts from "typescript";
import { error } from "../utils/errors.ts";
import { moveLeadingComments } from "../utils/comments.ts";
import { Diagnostics } from "../diagnostics.ts";
import { getComment } from "../comment.ts";
import { getNodeTypeId } from "../node-id.ts";
import type { ToolcogManifest } from "../manifest.ts";

const defineIdiomExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  getCommonSourceDirectory: (() => string) | undefined,
  manifest: ToolcogManifest,
  idiomType: ts.Type,
  embeddingsExpression: ts.Expression | undefined,
  idiomsExpression: ts.Expression | undefined,
  valueExpression: ts.Expression,
  valueType: ts.Type,
  errorNode: ts.Node,
  idiomIds?: string[],
): ts.Expression => {
  // Check for a previously compiled idiom.
  if (checker.isTypeAssignableTo(valueType, idiomType)) {
    return valueExpression;
  }

  // Unwrap `as` expressions.
  if (ts.isAsExpression(valueExpression)) {
    valueExpression = valueExpression.expression;
  }

  let idiomId =
    getNodeTypeId(ts, valueExpression, valueType, {
      package: true,
      module: true,
      getCommonSourceDirectory,
    }) ?? "";

  if (
    idiomId in manifest.idioms ||
    idiomId.length === 0 ||
    idiomId.endsWith(":")
  ) {
    const baseId = idiomId;
    let conflictCount = 0;
    while (true) {
      idiomId = baseId + "#" + conflictCount;
      if (!(idiomId in manifest.idioms)) {
        break;
      }
      conflictCount += 1;
    }
  }

  if (idiomIds !== undefined) {
    idiomIds.push(idiomId);
  }

  const idiomIdentifier = factory.createIdentifier("idiom");

  const comment = getComment(ts, checker, valueExpression, valueType);
  if (comment === undefined) {
    error(
      ts,
      addDiagnostic,
      errorNode,
      Diagnostics.CommentNeededToDefineEmbedding,
    );
  }

  // Define the value parameter.

  const valueParameterName = factory.createIdentifier("value");
  const valueParameterDeclaration = factory.createParameterDeclaration(
    undefined, // modifiers
    undefined, // dotDotDotToken
    valueParameterName,
    undefined, // questionToken
    undefined, // type
    undefined, // initializer
  );

  // Define the embeddings parameter.

  let embeddingsParameterName: ts.Identifier | undefined;
  let embeddingsParameterDeclaration: ts.ParameterDeclaration | undefined;

  if (embeddingsExpression !== undefined) {
    embeddingsParameterName = factory.createIdentifier("embeddings");
    embeddingsParameterDeclaration = factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
      embeddingsParameterName,
      undefined, // questionToken
      undefined, // type
      undefined, // initializer
    );
  }

  // Define the idioms parameter.

  let idiomsParameterName: ts.Identifier | undefined;
  let idiomsParameterDeclaration: ts.ParameterDeclaration | undefined;

  if (idiomsExpression !== undefined) {
    idiomsParameterName = factory.createIdentifier("idioms");
    idiomsParameterDeclaration = factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
      idiomsParameterName,
      undefined, // questionToken
      undefined, // type
      undefined, // initializer
    );
  }

  // Define the id property.

  const idAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(idiomIdentifier, "id"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      factory.createStringLiteral(idiomId),
    ),
  );

  // Define the value property.

  const valueAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(idiomIdentifier, "value"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      valueParameterName,
    ),
  );

  // Define the embeds property.

  const embeds = comment?.embeds ?? [];
  if (embeds.length === 0 && comment?.description !== undefined) {
    embeds.push(comment.description);
  }

  let embedsPropertyExpression: ts.Expression;
  if (idiomsParameterName !== undefined) {
    embedsPropertyExpression = factory.createPropertyAccessExpression(
      factory.createElementAccessExpression(
        idiomsParameterName,
        factory.createStringLiteral(idiomId),
      ),
      "embeds",
    );
  } else {
    embedsPropertyExpression = factory.createArrayLiteralExpression(
      embeds.map((embed) => factory.createStringLiteral(embed)),
      true, // multiLine
    );
  }

  const embedsAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(idiomIdentifier, "embeds"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      embedsPropertyExpression,
    ),
  );

  // Define the embeddings property.

  const embedParameterName = factory.createIdentifier("embed");
  const embedParameterDeclaration = factory.createParameterDeclaration(
    undefined, // modifiers
    undefined, // dotDotDotToken
    embedParameterName,
    undefined, // questionToken
    undefined, // type
    undefined, // initializer
  );

  let embedLookupExpression: ts.Expression;
  if (embeddingsParameterName !== undefined) {
    embedLookupExpression = factory.createElementAccessExpression(
      embeddingsParameterName,
      embedParameterName,
    );
  } else {
    embedLookupExpression = factory.createObjectLiteralExpression();
  }

  const embeddingMapperFunction = factory.createArrowFunction(
    undefined, // modifiers
    undefined, // typeParameters
    [embedParameterDeclaration],
    undefined, // type
    factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
    embedLookupExpression,
  );

  const embeddingsPropertyExpression = factory.createCallExpression(
    factory.createPropertyAccessExpression(
      factory.createPropertyAccessExpression(idiomIdentifier, "embeds"),
      "map",
    ),
    undefined, // typeArguments
    [embeddingMapperFunction],
  );

  const embeddingsAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(idiomIdentifier, "embeddings"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      embeddingsPropertyExpression,
    ),
  );

  // Define the idiom object.

  const idiomDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          idiomIdentifier,
          undefined, // exclamationToken
          undefined, // type
          factory.createObjectLiteralExpression(),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  // Add the idiom to the manifest.

  manifest.idioms[idiomId] = { embeds };

  // Create and return an IIFE wrapper.

  const iifeExpression = factory.createCallExpression(
    factory.createArrowFunction(
      undefined, // modifiers,
      undefined, // typeParameters,
      [
        valueParameterDeclaration,
        ...(embeddingsParameterDeclaration !== undefined ?
          [embeddingsParameterDeclaration]
        : []),
        ...(idiomsParameterDeclaration !== undefined ?
          [idiomsParameterDeclaration]
        : []),
      ],
      undefined, // type
      undefined, // equalsGreaterThanToken,
      factory.createBlock(
        [
          idiomDeclaration,
          idAssignment,
          valueAssignment,
          embedsAssignment,
          embeddingsAssignment,
          factory.createReturnStatement(idiomIdentifier),
        ],
        true, // multiLine
      ),
    ),
    undefined, // typeArguments
    [
      valueExpression,
      ...(embeddingsExpression !== undefined ? [embeddingsExpression] : []),
      ...(idiomsExpression !== undefined ? [idiomsExpression] : []),
    ],
  );

  moveLeadingComments(ts, valueExpression, iifeExpression);

  return ts.setOriginalNode(iifeExpression, valueExpression);
};

export { defineIdiomExpression };
