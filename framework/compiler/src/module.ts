import { parse as parsePath, format as formatPath } from "node:path";
import type ts from "typescript";
import { embedder } from "@toolcog/runtime";
import type { ToolcogCache } from "./cache.ts";
import { createToolcogCache } from "./cache.ts";
import type { ToolcogManifest } from "./manifest.ts";

const toolcogModuleTag = "toolcog";

const toolcogModuleRegex = new RegExp(`\\.${toolcogModuleTag}\\.m?js$`);

const isToolcogModuleFile = (fileName: string): boolean => {
  return toolcogModuleRegex.test(fileName);
};

const resolveToolcogModule = (
  ts: typeof import("typescript"),
  program: ts.Program,
  sourceFile: ts.SourceFile,
): string | undefined => {
  const outputFileName = ts.getOutputJSFileNameWorker(
    sourceFile.fileName,
    program.getCompilerOptions(),
    false, // ignoreCase
    program.getCommonSourceDirectory,
  );
  const packageJson = sourceFile.packageJsonScope?.contents.packageJsonContent;
  const outputExt = packageJson?.type === "module" ? ".js" : ".mjs";
  const { name: outputName } = parsePath(outputFileName);
  return formatPath({
    dir: ".",
    name: outputName + "." + toolcogModuleTag,
    ext: outputExt,
  });
};

const unresolveToolcogModule = (modulePath: string): string => {
  const {
    dir: moduleDir,
    base: moduleBase,
    ext: moduleExt,
  } = parsePath(modulePath);
  return formatPath({
    dir: moduleDir,
    name: moduleBase.replace(toolcogModuleRegex, ""),
    ext: moduleExt === ".mjs" ? ".mts" : ".ts",
  });
};

const generateToolcogModule = async (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  manifest: ToolcogManifest,
  cache: ToolcogCache | undefined,
): Promise<ts.SourceFile | undefined> => {
  ts.Debug.assert(manifest.embeddingModels !== undefined);

  if (Object.keys(manifest.idioms).length === 0) {
    // Nothing to generate.
    return undefined;
  }

  if (cache === undefined) {
    cache = createToolcogCache();
  }

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

  // Prepare the embeddings cache.

  const embeds = new Set<string>();

  for (const embed of manifest.embeds) {
    embeds.add(embed);
  }

  for (const idiomId in manifest.idioms) {
    const idiomManifest = manifest.idioms[idiomId]!;
    for (const embed of idiomManifest.embeds) {
      embeds.add(embed);
    }
  }

  const uncachedEmbeds = Object.fromEntries(
    manifest.embeddingModels.map((embeddingModel) => {
      return [embeddingModel, new Set<string>()];
    }),
  );

  for (const embed of embeds) {
    let embeddingCache = cache.embeddings[embed];
    if (embeddingCache === undefined) {
      embeddingCache = {};
      cache.embeddings[embed] = embeddingCache;
    }

    for (const embeddingModel of manifest.embeddingModels) {
      if (embeddingCache[embeddingModel] === undefined) {
        uncachedEmbeds[embeddingModel]!.add(embed);
      }
    }
  }

  // Fetch uncached embeddings.

  for (const embeddingModel in uncachedEmbeds) {
    if (uncachedEmbeds[embeddingModel]!.size === 0) {
      continue;
    }

    const embeds = [...uncachedEmbeds[embeddingModel]!];
    const vectors = await embedder(embeds, { model: embeddingModel });

    for (let i = 0; i < embeds.length; i += 1) {
      cache.embeddings[embeds[i]!]![embeddingModel] = vectors[i]!;
    }
  }

  // Define the embeddings variable.

  const embeddingsAssignments: ts.ObjectLiteralElementLike[] = [];

  for (const embed of embeds) {
    const embeddingCache = cache.embeddings[embed]!;

    const embeddingModelAssignments: ts.ObjectLiteralElementLike[] = [];

    for (const embeddingModel of manifest.embeddingModels) {
      const vector = embeddingCache[embeddingModel]!;
      const embedding = Buffer.from(vector.buffer).toString("base64");

      const embeddingModelAssignment = factory.createCallExpression(
        decodeVectorFunctionName,
        undefined, // typeArguments
        [factory.createStringLiteral(embedding)],
      );

      embeddingModelAssignments.push(
        factory.createPropertyAssignment(
          factory.createStringLiteral(embeddingModel),
          embeddingModelAssignment,
        ),
      );
    }

    embeddingsAssignments.push(
      factory.createPropertyAssignment(
        factory.createStringLiteral(embed),
        factory.createObjectLiteralExpression(
          embeddingModelAssignments,
          true, // multiLine
        ),
      ),
    );
  }

  const embeddingsVariableName = factory.createIdentifier("embeddings");

  const embeddingsVariableDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          embeddingsVariableName,
          undefined, // exclamationToken
          undefined, // type
          factory.createObjectLiteralExpression(embeddingsAssignments, true),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  // Define the idioms variable.

  const idiomsAssignments: ts.ObjectLiteralElementLike[] = [];

  for (const idiomId in manifest.idioms) {
    const idiomManifest = manifest.idioms[idiomId]!;

    const embedsExpression = factory.createArrayLiteralExpression(
      idiomManifest.embeds.map((embed) => factory.createStringLiteral(embed)),
      true, // multiLine
    );

    idiomsAssignments.push(
      factory.createPropertyAssignment(
        factory.createStringLiteral(idiomId),
        factory.createObjectLiteralExpression(
          [factory.createPropertyAssignment("embeds", embedsExpression)],
          true, // multiLine
        ),
      ),
    );
  }

  const idiomsVariableName = factory.createIdentifier("idioms");

  const idiomsVariableDeclaration = factory.createVariableStatement(
    undefined, // modifiers
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          idiomsVariableName,
          undefined, // exclamationToken
          undefined, // type
          factory.createObjectLiteralExpression(idiomsAssignments, true),
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
      factory.createExportSpecifier(
        false, // isTypeOnly
        undefined, // propertyName,
        embeddingsVariableName,
      ),
      factory.createExportSpecifier(
        false, // isTypeOnly
        undefined, // propertyName,
        idiomsVariableName,
      ),
    ]),
    undefined, // moduleSpecifier
    undefined, // attributes
  );

  // Create and return a new source file.

  return factory.createSourceFile(
    [
      decodeVectorFunctionDeclaration,
      embeddingsVariableDeclaration,
      idiomsVariableDeclaration,
      exportDeclaration,
    ],
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
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

export {
  isToolcogModuleFile,
  resolveToolcogModule,
  unresolveToolcogModule,
  generateToolcogModule,
};
