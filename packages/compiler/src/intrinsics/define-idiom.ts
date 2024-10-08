import type ts from "typescript";
import type { ModuleDef } from "@toolcog/runtime";
import { error } from "../utils/errors.ts";
import { moveLeadingComments } from "../utils/comments.ts";
import { Diagnostics } from "../diagnostics.ts";
import type { Comment } from "../comment.ts";
import { getComment } from "../comment.ts";
import { getNodeTypeId } from "../node-id.ts";

const defineIdiomStatements = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  moduleDef: ModuleDef,
  idiomResolverExpression: ts.Expression | undefined,
  idiomId: string,
  idiomIdentifier: ts.Identifier,
  comment: Comment | undefined,
): [
  embeddingsVariableDeclaration: ts.Statement,
  embedsAssignment: ts.Statement,
] => {
  // Define the embeddings variable.

  const phrases = comment?.idioms ?? [];
  if (phrases.length === 0 && comment?.description !== undefined) {
    phrases.push(comment.description);
  }

  const embeddingsObjectLiteral = factory.createObjectLiteralExpression(
    phrases.map((text) => {
      return factory.createPropertyAssignment(
        factory.createStringLiteral(text),
        factory.createObjectLiteralExpression(),
      );
    }),
    true, // multiLine
  );

  const embeddingsVariableName = factory.createIdentifier("embeddings");
  const embeddingsVariableDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          embeddingsVariableName,
          undefined, // exclamationToken
          undefined, // type
          embeddingsObjectLiteral,
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  // Define the embeds property.

  let embeddingsExpression: ts.Expression;
  if (idiomResolverExpression !== undefined) {
    embeddingsExpression = factory.createBinaryExpression(
      factory.createCallExpression(
        idiomResolverExpression,
        undefined, // typeArguments
        [
          factory.createPropertyAccessExpression(idiomIdentifier, "id"),
          factory.createPropertyAccessExpression(idiomIdentifier, "value"),
        ],
      ),
      factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
      embeddingsVariableName,
    );
  } else {
    embeddingsExpression = embeddingsVariableName;
  }

  const embedsFunction = factory.createArrowFunction(
    undefined, // modifiers
    undefined, // typeParameters
    [], // parameters
    undefined, // type
    undefined, // equalsGreaterThanToken
    embeddingsExpression,
  );

  const embedsAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(idiomIdentifier, "embeds"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      embedsFunction,
    ),
  );

  // Add the idiom to the module manifest.

  moduleDef.idioms[idiomId] = { phrases };

  // Return embeddings statements.

  return [embeddingsVariableDeclaration, embedsAssignment];
};

const defineIdiomExpression = (
  ts: typeof import("typescript"),
  host: ts.ModuleResolutionHost,
  program: ts.Program,
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  packageId: string | boolean,
  moduleId: string | boolean,
  moduleDef: ModuleDef,
  idiomType: ts.Type,
  idiomResolverExpression: ts.Expression | undefined,
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
      package: packageId,
      module: moduleId,
      host,
      program,
    }) ?? "";

  if (
    idiomId in moduleDef.idioms ||
    idiomId.length === 0 ||
    idiomId.endsWith(":")
  ) {
    const baseId = idiomId;
    let conflictCount = 0;
    while (true) {
      idiomId = baseId + "#" + conflictCount;
      if (!(idiomId in moduleDef.idioms)) {
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

  // Define the idiom resolver parameter.

  let idiomResolverParameterName: ts.Identifier | undefined;
  let idiomResolverParameterDeclaration: ts.ParameterDeclaration | undefined;

  if (idiomResolverExpression !== undefined) {
    idiomResolverParameterName = factory.createIdentifier("idiomResolver");
    idiomResolverParameterDeclaration = factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
      idiomResolverParameterName,
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

  // Define embeddings statements.

  const [embeddingsVariableDeclaration, embedsAssignment] =
    defineIdiomStatements(
      ts,
      factory,
      moduleDef,
      idiomResolverParameterName,
      idiomId,
      idiomIdentifier,
      comment,
    );

  // Create and return an IIFE wrapper.

  const iifeExpression = factory.createCallExpression(
    factory.createArrowFunction(
      undefined, // modifiers,
      undefined, // typeParameters,
      [
        valueParameterDeclaration,
        ...(idiomResolverParameterDeclaration !== undefined ?
          [idiomResolverParameterDeclaration]
        : []),
      ],
      undefined, // type
      undefined, // equalsGreaterThanToken,
      factory.createBlock(
        [
          embeddingsVariableDeclaration,
          idiomDeclaration,
          idAssignment,
          valueAssignment,
          embedsAssignment,
          factory.createReturnStatement(idiomIdentifier),
        ],
        true, // multiLine
      ),
    ),
    undefined, // typeArguments
    [
      valueExpression,
      ...(idiomResolverExpression !== undefined ?
        [idiomResolverExpression]
      : []),
    ],
  );

  moveLeadingComments(ts, valueExpression, iifeExpression);

  return ts.setOriginalNode(iifeExpression, valueExpression);
};

export { defineIdiomStatements, defineIdiomExpression };
