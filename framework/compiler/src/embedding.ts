import type ts from "typescript";
import { error } from "./utils/errors.ts";
import { Diagnostics } from "./diagnostics.ts";
import { getComment } from "./comment.ts";
import { getNodeId } from "./node-id.ts";

const transformEmbeddingIntrinsic = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  getCommonSourceDirectory: (() => string) | undefined,
  embedsType: ts.Type,
  embeddingModelExpression: ts.Expression,
  embeddingStoreExpression: ts.Expression,
  embeddingCacheExpression: ts.Expression,
  callExpression: ts.CallExpression,
): ts.Expression => {
  const createEmbeddingFunction = (): ts.ArrowFunction => {
    const queryParameterName = factory.createIdentifier("query");

    const queryParameterDeclaration = factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
      queryParameterName,
      undefined, // questionToken
      undefined, // type
      undefined, // initializer
    );

    const countParameterName = factory.createIdentifier("count");

    const countParameterDeclaration = factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
      countParameterName,
      factory.createToken(ts.SyntaxKind.QuestionToken),
      undefined, // type
      undefined, // initializer
    );

    const optionsParameterName = factory.createIdentifier("options");

    const optionsParameterDeclaration = factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
      optionsParameterName,
      factory.createToken(ts.SyntaxKind.QuestionToken),
      undefined, // type
      undefined, // initializer
    );

    const argumentsNormalizationStatement = factory.createIfStatement(
      factory.createBinaryExpression(
        factory.createBinaryExpression(
          countParameterName,
          factory.createToken(ts.SyntaxKind.ExclamationEqualsEqualsToken),
          factory.createVoidExpression(factory.createNumericLiteral(0)),
        ),
        factory.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
        factory.createBinaryExpression(
          factory.createTypeOfExpression(countParameterName),
          factory.createToken(ts.SyntaxKind.ExclamationEqualsEqualsToken),
          factory.createStringLiteral("number"),
        ),
      ),
      factory.createBlock(
        [
          factory.createExpressionStatement(
            factory.createBinaryExpression(
              optionsParameterName,
              factory.createToken(ts.SyntaxKind.EqualsToken),
              countParameterName,
            ),
          ),
          factory.createExpressionStatement(
            factory.createBinaryExpression(
              countParameterName,
              factory.createToken(ts.SyntaxKind.EqualsToken),
              factory.createVoidExpression(factory.createNumericLiteral(0)),
            ),
          ),
        ],
        true, // multiLine
      ),
      undefined, // elseStatement
    );

    const indexVariableName = factory.createIdentifier("index");

    const indexVariableDeclaration = factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            indexVariableName,
            undefined, // exclamationToken
            undefined, // type
            factory.createPropertyAccessExpression(
              embeddingIdentifier,
              "index",
            ),
          ),
        ],
        ts.NodeFlags.Let,
      ),
    );

    const indexVariableInitialization = factory.createIfStatement(
      factory.createBinaryExpression(
        indexVariableName,
        factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
        factory.createNull(),
      ),
      factory.createBlock(
        [
          factory.createExpressionStatement(
            factory.createBinaryExpression(
              indexVariableName,
              factory.createToken(ts.SyntaxKind.EqualsToken),
              factory.createAwaitExpression(
                factory.createCallExpression(
                  embeddingStoreParameterName,
                  undefined, // typeArguments
                  [
                    factory.createPropertyAccessExpression(
                      embeddingIdentifier,
                      "embeds",
                    ),
                    factory.createObjectLiteralExpression(
                      [
                        factory.createSpreadAssignment(optionsParameterName),
                        factory.createPropertyAssignment(
                          factory.createIdentifier("model"),
                          defaultModelVariableName,
                        ),
                        factory.createPropertyAssignment(
                          factory.createIdentifier("embeddingModel"),
                          embeddingModelParameterName,
                        ),
                        factory.createPropertyAssignment(
                          factory.createIdentifier("embeddingCache"),
                          embeddingCacheParameterName,
                        ),
                      ],
                      true, // multiLine
                    ),
                  ],
                ),
              ),
            ),
          ),
          factory.createExpressionStatement(
            factory.createBinaryExpression(
              factory.createPropertyAccessExpression(
                embeddingIdentifier,
                "index",
              ),
              factory.createToken(ts.SyntaxKind.EqualsToken),
              indexVariableName,
            ),
          ),
        ],
        true, // multiLine
      ),
      undefined, // elseStatement
    );

    const nearestVariableName = factory.createIdentifier("nearest");

    const nearestVariableDeclaration = factory.createVariableStatement(
      undefined, // modifiers
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            nearestVariableName,
            undefined, // exclamationToken
            undefined, // type
            factory.createAwaitExpression(
              factory.createCallExpression(
                indexVariableName,
                undefined, // typeArguments
                [
                  queryParameterName,
                  factory.createBinaryExpression(
                    countParameterName,
                    factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
                    factory.createNumericLiteral(1),
                  ),
                  factory.createObjectLiteralExpression(
                    [
                      factory.createSpreadAssignment(optionsParameterName),
                      factory.createPropertyAssignment(
                        factory.createIdentifier("model"),
                        defaultModelVariableName,
                      ),
                    ],
                    true, // multiLine
                  ),
                ],
              ),
            ),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );

    const returnStatement = factory.createReturnStatement(
      factory.createConditionalExpression(
        factory.createBinaryExpression(
          countParameterName,
          factory.createToken(ts.SyntaxKind.ExclamationEqualsEqualsToken),
          factory.createVoidExpression(factory.createNumericLiteral(0)),
        ),
        undefined, // questionToken
        nearestVariableName,
        undefined, // colonToken
        factory.createElementAccessExpression(
          nearestVariableName,
          factory.createNumericLiteral(0),
        ),
      ),
    );

    return factory.createArrowFunction(
      [factory.createToken(ts.SyntaxKind.AsyncKeyword)],
      undefined, // typeParameters
      [
        queryParameterDeclaration,
        countParameterDeclaration,
        optionsParameterDeclaration,
      ],
      undefined, // type
      undefined, // equalsGreaterThanToken
      factory.createBlock(
        [
          argumentsNormalizationStatement,
          indexVariableDeclaration,
          indexVariableInitialization,
          nearestVariableDeclaration,
          returnStatement,
        ],
        true, // multiLine
      ),
    );
  };

  const transformEmbedsArray = (
    expression: ts.Expression,
    expressionType: ts.Type,
    errorNode: ts.Node,
    toolElements: ts.Expression[] = [],
  ): ts.Expression => {
    if (ts.isArrayLiteralExpression(expression)) {
      // Transform embeds array literal.
      for (const element of expression.elements) {
        toolElements.push(transformEmbeds(element, undefined, errorNode));
      }
      return factory.updateArrayLiteralExpression(expression, toolElements);
    }

    if (!checker.isTupleType(expressionType)) {
      // Can't transform homogeneously-typed array.
      error(
        ts,
        addDiagnostic,
        errorNode,
        Diagnostics.CannotTransformHomogeneousArray,
        checker.typeToString(expressionType),
      );
      return factory.createArrayLiteralExpression([]);
    }

    // Transform embeds array expression.
    for (const property of expressionType.getApparentProperties()) {
      const index = parseInt(property.name);
      if (!isFinite(index)) {
        continue;
      }
      toolElements.push(
        transformEmbeds(
          factory.createElementAccessExpression(expression, index),
          checker.getTypeOfSymbolAtLocation(property, expression),
          errorNode,
        ),
      );
    }
    return factory.createArrayLiteralExpression(toolElements, true);
  };

  const transformEmbed = (
    expression: ts.Expression,
    expressionType: ts.Type,
    errorNode: ts.Node,
  ): ts.Expression => {
    const embedDeclaration =
      expressionType.getSymbol()?.declarations?.[0] ?? expression;

    const embedId = getNodeId(ts, embedDeclaration, {
      package: true,
      module: true,
      getCommonSourceDirectory,
    });

    const comment = getComment(ts, checker, expression, expressionType);

    if (comment === undefined) {
      error(
        ts,
        addDiagnostic,
        errorNode,
        Diagnostics.CommentNeededToGenerateEmbedding,
      );
    }

    const idExpression =
      embedId !== undefined ?
        factory.createStringLiteral(embedId)
      : factory.createVoidExpression(factory.createNumericLiteral(0));

    const intents = comment?.intents ?? [];
    if (intents.length === 0 && comment?.description !== undefined) {
      intents.push(comment.description);
    }

    const intentsExpression = factory.createArrayLiteralExpression(
      intents.map((intent) => factory.createStringLiteral(intent)),
      true, // multiLine
    );

    const embedExpression = factory.createObjectLiteralExpression(
      [
        factory.createPropertyAssignment("id", idExpression),
        factory.createPropertyAssignment("value", expression),
        factory.createPropertyAssignment("intents", intentsExpression),
      ],
      true, // multiLine
    );

    return ts.setOriginalNode(embedExpression, expression);
  };

  const transformEmbeds = (
    expression: ts.Expression,
    expressionType: ts.Type | undefined,
    errorNode: ts.Node | undefined,
  ): ts.Expression => {
    if (expressionType === undefined) {
      expressionType = checker.getTypeAtLocation(expression);
    }

    if (errorNode === undefined) {
      errorNode = expression;
    }

    if (checker.isTypeAssignableTo(expressionType, embedsType)) {
      // Return previously compiled embeds.
      return expression;
    }

    if (ts.isAsExpression(expression)) {
      // Unwrap `as` expression.
      expression = expression.expression;
    }

    if (checker.isArrayLikeType(expressionType)) {
      // Recursively transform embeds array.
      return transformEmbedsArray(expression, expressionType, errorNode);
    }

    // Transform individual embed.
    return transformEmbed(expression, expressionType, errorNode);
  };

  const expression = callExpression.arguments[0]!;

  const propsExpression = callExpression.arguments[1];

  const embeddingIdentifier = factory.createIdentifier("embedding");

  // Define the embedding model parameter.

  const embeddingModelParameterName =
    factory.createIdentifier("embeddingModel");

  const embeddingModelParameterDeclaration = factory.createParameterDeclaration(
    undefined, // modifiers
    undefined, // dotDotDotToken
    embeddingModelParameterName,
    undefined, // questionToken
    undefined, // type
    undefined, // initializer
  );

  // Define the embedding store parameter.

  const embeddingStoreParameterName =
    factory.createIdentifier("embeddingStore");

  const embeddingStoreParameterDeclaration = factory.createParameterDeclaration(
    undefined, // modifiers
    undefined, // dotDotDotToken
    embeddingStoreParameterName,
    undefined, // questionToken
    undefined, // type
    undefined, // initializer
  );

  // Define the embedding cache parameter.

  const embeddingCacheParameterName =
    factory.createIdentifier("embeddingCache");

  const embeddingCacheParameterDeclaration = factory.createParameterDeclaration(
    undefined, // modifiers
    undefined, // dotDotDotToken
    embeddingCacheParameterName,
    undefined, // questionToken
    undefined, // type
    undefined, // initializer
  );

  // Define the destructured props parameter.

  let modelIdentifier: ts.Identifier | undefined;
  let dimensionsIdentifier: ts.Identifier | undefined;
  let propsIdentifier: ts.Identifier | undefined;

  let propsParameterDeclaration: ts.ParameterDeclaration | undefined;

  if (propsExpression !== undefined) {
    modelIdentifier = factory.createIdentifier("model");
    dimensionsIdentifier = factory.createIdentifier("dimensions");
    propsIdentifier = factory.createIdentifier("props");

    propsParameterDeclaration = factory.createParameterDeclaration(
      undefined, // modifiers
      undefined, // dotDotDotToken
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
          dimensionsIdentifier,
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
      factory.createObjectLiteralExpression(undefined, false),
    );
  }

  // Define the default model variable.

  const defaultModelVariableName = factory.createIdentifier("defaultModel");

  let defaultModelExpression: ts.Expression;
  if (modelIdentifier !== undefined) {
    defaultModelExpression = factory.createBinaryExpression(
      modelIdentifier,
      factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
      factory.createPropertyAccessExpression(
        embeddingCacheParameterName,
        "defaultModel",
      ),
    );
  } else {
    defaultModelExpression = factory.createPropertyAccessExpression(
      embeddingCacheParameterName,
      "defaultModel",
    );
  }

  const defaultModelVariableDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          defaultModelVariableName,
          undefined, // exclamationToken
          undefined, // type
          defaultModelExpression,
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  // Define the embeds property.

  const embedsExpression = transformEmbeds(
    expression,
    undefined,
    callExpression,
  );

  const embedsAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(embeddingIdentifier, "embeds"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      embedsExpression,
    ),
  );

  // Define the index property.

  const indexAssignment = factory.createExpressionStatement(
    factory.createBinaryExpression(
      factory.createPropertyAccessExpression(embeddingIdentifier, "index"),
      factory.createToken(ts.SyntaxKind.EqualsToken),
      factory.createNull(),
    ),
  );
  // Define the embedding function implementation.

  const embeddingFunction = createEmbeddingFunction();

  const embeddingFunctionDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          embeddingIdentifier,
          undefined, // exclamationToken
          undefined, // type
          embeddingFunction,
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  // Create and return an IIFE wrapper to hold props.

  const iifeExpression = factory.createCallExpression(
    factory.createArrowFunction(
      undefined, // modifiers,
      undefined, // typeParameters,
      [
        embeddingModelParameterDeclaration,
        embeddingStoreParameterDeclaration,
        embeddingCacheParameterDeclaration,
        ...(propsParameterDeclaration !== undefined ?
          [propsParameterDeclaration]
        : []),
      ],
      undefined, // type
      undefined, // equalsGreaterThanToken,
      factory.createBlock(
        [
          defaultModelVariableDeclaration,
          embeddingFunctionDeclaration,
          embedsAssignment,
          indexAssignment,
          factory.createReturnStatement(embeddingIdentifier),
        ],
        true, // multiLine
      ),
    ),
    undefined, // typeArguments
    [
      embeddingModelExpression,
      embeddingStoreExpression,
      embeddingCacheExpression,
      ...(propsExpression !== undefined ? [propsExpression] : []),
    ],
  );

  return ts.setOriginalNode(iifeExpression, callExpression);
};

export { transformEmbeddingIntrinsic };
