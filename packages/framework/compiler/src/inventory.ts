import type ts from "typescript";
import type { Embedding, Embeddings } from "@toolcog/core";
import { encodeEmbeddingVector } from "@toolcog/core";
import type { IdiomInventory, Inventory } from "@toolcog/runtime";

const inventoryModuleName = "toolcog-inventory.js";

const createInventoryModule = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  inventory: Inventory,
): ts.SourceFile => {
  // Define the decode vector function.
  const decodeVectorFunctionName = factory.createIdentifier("decodeVector");
  const decodeVectorFunctionDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          decodeVectorFunctionName,
          undefined, // exclamationToken
          undefined, // type
          createDecodeVectorFunction(ts, factory),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  // Define the embedding models property.
  const embeddingModelsAssignment = factory.createPropertyAssignment(
    "embeddingModels",
    factory.createArrayLiteralExpression(
      inventory.embeddingModels.map((embeddingModel) => {
        return factory.createStringLiteral(embeddingModel);
      }),
    ),
  );

  // Define the idioms property.
  const idiomsAssignment = factory.createPropertyAssignment(
    "idioms",
    factory.createObjectLiteralExpression(
      Object.entries(inventory.idioms).map(([idiomId, idiomInventory]) => {
        return factory.createPropertyAssignment(
          factory.createStringLiteral(idiomId),
          createIdiomInventoryExpression(
            ts,
            factory,
            idiomInventory,
            decodeVectorFunctionName,
          ),
        );
      }),
      true, // multiLine
    ),
  );

  // Define the inventory variable.
  const inventoryVariableName = factory.createIdentifier("inventory");
  const inventoryVariableDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          inventoryVariableName,
          undefined, // exclamationToken
          undefined, // type
          factory.createObjectLiteralExpression(
            [embeddingModelsAssignment, idiomsAssignment],
            true, // multiLine
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  // Define module exports.
  const exportDeclaration = factory.createExportDeclaration(
    undefined, // modifiers
    false, // isTypeOnly
    factory.createNamedExports([
      factory.createExportSpecifier(false, undefined, inventoryVariableName),
      factory.createExportSpecifier(false, inventoryVariableName, "default"),
    ]),
    undefined, // moduleSpecifier
    undefined, // attributes
  );

  // Create and return a new source file.
  return factory.createSourceFile(
    [
      decodeVectorFunctionDeclaration,
      inventoryVariableDeclaration,
      exportDeclaration,
    ],
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );
};

const createIdiomInventoryExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  idiomInventory: IdiomInventory,
  decodeVectorFunction: ts.Expression,
): ts.Expression => {
  return factory.createObjectLiteralExpression(
    [
      factory.createPropertyAssignment(
        "embeddings",
        createEmbeddingsExpression(
          ts,
          factory,
          idiomInventory.embeddings,
          decodeVectorFunction,
        ),
      ),
    ],
    true, // multiLine
  );
};

const createEmbeddingsExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  embeddings: Embeddings,
  decodeVectorFunction: ts.Expression,
): ts.Expression => {
  return factory.createObjectLiteralExpression(
    Object.entries(embeddings).map(([text, embedding]) => {
      return factory.createPropertyAssignment(
        factory.createStringLiteral(text),
        createEmbeddingExpression(ts, factory, embedding, decodeVectorFunction),
      );
    }),
    true, // multiLine
  );
};

const createEmbeddingExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  embedding: Embedding,
  decodeVectorFunction: ts.Expression,
): ts.Expression => {
  return factory.createObjectLiteralExpression(
    Object.entries(embedding).map(([model, vector]) => {
      return factory.createPropertyAssignment(
        factory.createStringLiteral(model),
        factory.createCallExpression(
          decodeVectorFunction,
          undefined, // typeArguments
          [
            factory.createStringLiteral(
              encodeEmbeddingVector(vector!).toString("base64"),
            ),
          ],
        ),
      );
    }),
    true, // multiLine
  );
};

const createDecodeVectorFunction = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
): ts.ArrowFunction => {
  const embeddingParameterName = factory.createIdentifier("embedding");

  const embeddingParameterDeclaration = factory.createParameterDeclaration(
    undefined, // modifiers
    undefined, // dotDotDotToken
    embeddingParameterName,
    undefined, // questionToken
    undefined, // type
    undefined, // initializer
  );

  const bufferVariableName = factory.createIdentifier("buffer");

  const bufferVariableDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          bufferVariableName,
          undefined, // exclamationToken
          undefined, // type
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier("Buffer"),
              "from",
            ),
            undefined, // typeArguments
            [embeddingParameterName, factory.createStringLiteral("base64")],
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  const float32ArrayExpression = factory.createNewExpression(
    factory.createIdentifier("Float32Array"),
    undefined, // typeArguments
    [
      factory.createPropertyAccessExpression(bufferVariableName, "buffer"),
      factory.createPropertyAccessExpression(bufferVariableName, "byteOffset"),
      factory.createBinaryExpression(
        factory.createPropertyAccessExpression(
          bufferVariableName,
          "byteLength",
        ),
        factory.createToken(ts.SyntaxKind.SlashToken),
        factory.createNumericLiteral(4),
      ),
    ],
  );

  return factory.createArrowFunction(
    undefined, // modifiers
    undefined, // typeParameters
    [embeddingParameterDeclaration],
    undefined, // type
    undefined, // equalsGreaterThanToken
    factory.createBlock(
      [
        bufferVariableDeclaration,
        factory.createReturnStatement(float32ArrayExpression),
      ],
      true, // multiLine
    ),
  );
};

const inventoryDeclarationsModuleName = "toolcog-inventory.d.ts";

const createInventoryDeclarationsModule = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  moduleName: string,
): ts.SourceFile => {
  const inventoryTypeName = factory.createIdentifier("Inventory");
  const inventoryImportDeclaration = factory.createImportDeclaration(
    undefined, // modifiers
    factory.createImportClause(
      false, // isTypeOnly
      undefined, // name
      factory.createNamedImports([
        factory.createImportSpecifier(
          false, // isTypeOnly
          undefined, // propertyName
          inventoryTypeName,
        ),
      ]),
    ),
    factory.createStringLiteral("@toolcog/runtime"),
    undefined, // attributes
  );

  const inventoryVariableName = factory.createIdentifier("inventory");
  const inventoryVariableDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          inventoryVariableName,
          undefined, // exclamationToken
          factory.createTypeReferenceNode(
            inventoryTypeName,
            undefined, // typeArguments
          ),
          undefined, // initializer
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  const exportDeclaration = factory.createExportDeclaration(
    undefined, // modifiers
    false, // isTypeOnly
    factory.createNamedExports([
      factory.createExportSpecifier(false, undefined, inventoryVariableName),
      factory.createExportSpecifier(false, inventoryVariableName, "default"),
    ]),
    undefined, // moduleSpecifier
    undefined, // attributes
  );

  const moduleDeclaration = factory.createModuleDeclaration(
    [factory.createToken(ts.SyntaxKind.DeclareKeyword)],
    factory.createStringLiteral(moduleName),
    factory.createModuleBlock([
      inventoryVariableDeclaration,
      exportDeclaration,
    ]),
    ts.NodeFlags.None,
  );

  return factory.createSourceFile(
    [inventoryImportDeclaration, moduleDeclaration],
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );
};

export {
  inventoryModuleName,
  createInventoryModule,
  inventoryDeclarationsModuleName,
  createInventoryDeclarationsModule,
};
