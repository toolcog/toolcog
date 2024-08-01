import type ts from "typescript";
import typescript from "typescript";
import { isFunctionCallExpression } from "./utils/functions.ts";
import { resolveModuleExportTypes } from "./utils/modules.ts";
import type { ImportSymbols } from "./utils/imports.ts";
import {
  getImportSymbolsWithTypes,
  removeImportsWithTypes,
} from "./utils/imports.ts";
import { transformToolingIntrinsic } from "./tooling.ts";
import { transformGenerativeIntrinsic } from "./generative.ts";
import { transformGenerateIntrinsic } from "./generate.ts";
import { transformEmbeddingIntrinsic } from "./embedding.ts";

interface ToolcogConfig {
  generativeModelImportName?: string | undefined;
  generativeModelImportSpecifier?: string | undefined;

  embeddingModelImportName?: string | undefined;
  embeddingModelImportSpecifier?: string | undefined;

  embeddingStoreImportName?: string | undefined;
  embeddingStoreImportSpecifier?: string | undefined;

  contextToolsImportName?: string | undefined;
  contextToolsImportSpecifier?: string | undefined;

  embeddingCacheImportName?: string | undefined;
  embeddingCacheImportSpecifier?: string | undefined;
  embeddingCacheGlobalName?: string | undefined;

  defaultEmbeddingModel?: string | undefined;

  keepIntrinsicImports?: boolean | undefined;
}

const transformToolcog = (
  ts: typeof import("typescript"),
  context: ts.TransformationContext,
  host: ts.ModuleResolutionHost,
  program: ts.Program,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  config: ToolcogConfig | undefined,
): ts.Transformer<ts.SourceFile> => {
  const factory = context.factory;
  const checker = program.getTypeChecker();

  const generativeModelImportName =
    config?.generativeModelImportName ?? "generativeModel";
  const generativeModelImportSpecifier =
    config?.generativeModelImportSpecifier ?? "@toolcog/runtime";
  let generativeModelExpression: ts.Identifier | undefined;
  let hasGenerativeModelImport: boolean;
  let needsGenerativeModel: boolean;

  const embeddingModelImportName =
    config?.embeddingModelImportName ?? "embeddingModel";
  const embeddingModelImportSpecifier =
    config?.embeddingModelImportSpecifier ?? "@toolcog/runtime";
  let embeddingModelExpression: ts.Identifier | undefined;
  let hasEmbeddingModelImport: boolean = false;
  let needsEmbeddingModel: boolean = false;

  const embeddingStoreImportName =
    config?.embeddingStoreImportName ?? "embeddingStore";
  const embeddingStoreImportSpecifier =
    config?.embeddingStoreImportSpecifier ?? "@toolcog/runtime";
  let embeddingStoreExpression: ts.Identifier | undefined;
  let hasEmbeddingStoreImport: boolean = false;
  let needsEmbeddingStore: boolean = false;

  const contextToolsImportName = config?.contextToolsImportName;
  const contextToolsImportSpecifier = config?.contextToolsImportSpecifier;
  let contextToolsExpression: ts.Identifier | undefined;
  let hasContextToolsImport: boolean = false;
  let needsContextTools: boolean = false;

  const embeddingCacheImportName = config?.embeddingCacheImportName;
  const embeddingCacheImportSpecifier = config?.embeddingCacheImportSpecifier;
  const embeddingCacheGlobalName = config?.embeddingCacheGlobalName;
  let embeddingCacheExpression: ts.Identifier | undefined;
  let hasEmbeddingCacheImport: boolean = false;
  let needsEmbeddingCache: boolean = false;

  const defaultEmbeddingModel =
    config?.defaultEmbeddingModel ?? "text-embedding-3-small";

  const intrinsicTypes = resolveModuleExportTypes(
    ts,
    host,
    program,
    checker,
    addDiagnostic,
    ["AnyTools", "AnyEmbeds", "tooling", "generative", "generate", "embedding"],
    "@toolcog/core",
  );
  let intrinsicImports:
    | ImportSymbols<"tooling" | "generative" | "generate" | "embedding">
    | undefined;

  const transformer = (sourceFile: ts.SourceFile): ts.SourceFile => {
    resetState();

    // Preprocess import declarations.
    sourceFile = ts.visitEachChild(sourceFile, preprocessNode, context);

    // Short-circuit the transformation if the current source file
    // doesn't import any toolcog intrinsic functions.
    if (!hasIntrinsicImports()) {
      return sourceFile;
    }

    // Initialize intrinsic context.
    initializeIntrinsics();

    // Transform the source file.
    sourceFile = ts.visitNode(sourceFile, processNode) as ts.SourceFile;

    // Postprocess import declarations.
    sourceFile = ts.visitEachChild(sourceFile, postprocessNode, context);

    // Inject imports.
    sourceFile = injectImports(sourceFile);

    // Inject the embedding cache.
    sourceFile = injectEmbeddingsCacheVariable(sourceFile);

    return sourceFile;
  };

  const resetState = (): void => {
    generativeModelExpression = undefined as ts.Identifier | undefined;
    hasGenerativeModelImport = false as boolean;
    needsGenerativeModel = false as boolean;

    embeddingModelExpression = undefined as ts.Identifier | undefined;
    hasEmbeddingModelImport = false as boolean;
    needsEmbeddingModel = false as boolean;

    embeddingStoreExpression = undefined as ts.Identifier | undefined;
    hasEmbeddingStoreImport = false as boolean;
    needsEmbeddingStore = false as boolean;

    contextToolsExpression = undefined as ts.Identifier | undefined;
    hasContextToolsImport = false as boolean;
    needsContextTools = false as boolean;

    embeddingCacheExpression = undefined as ts.Identifier | undefined;
    hasEmbeddingCacheImport = false as boolean;
    needsEmbeddingCache = false as boolean;

    intrinsicImports = Object.create(null) as ImportSymbols<
      "tooling" | "generative" | "generate" | "embedding"
    >;
  };

  const initializeIntrinsics = (): void => {
    if (generativeModelExpression === undefined) {
      generativeModelExpression = factory.createUniqueName(
        generativeModelImportName,
        ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
          ts.GeneratedIdentifierFlags.Optimistic,
      );
    }

    if (embeddingModelExpression === undefined) {
      embeddingModelExpression = factory.createUniqueName(
        embeddingModelImportName,
        ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
          ts.GeneratedIdentifierFlags.Optimistic,
      );
    }

    if (embeddingStoreExpression === undefined) {
      embeddingStoreExpression = factory.createUniqueName(
        embeddingStoreImportName,
        ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
          ts.GeneratedIdentifierFlags.Optimistic,
      );
    }

    if (
      contextToolsExpression === undefined &&
      contextToolsImportName !== undefined &&
      contextToolsImportSpecifier !== undefined
    ) {
      contextToolsExpression = factory.createUniqueName(
        contextToolsImportName,
        ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
          ts.GeneratedIdentifierFlags.Optimistic,
      );
    }

    if (embeddingCacheExpression === undefined) {
      if (embeddingCacheGlobalName !== undefined) {
        embeddingCacheExpression = factory.createIdentifier(
          embeddingCacheGlobalName,
        );
      } else {
        embeddingCacheExpression = factory.createUniqueName(
          embeddingCacheImportName ?? "embeddingCache",
          ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
            ts.GeneratedIdentifierFlags.Optimistic,
        );
      }
    }
  };

  const hasIntrinsicImports = (): boolean => {
    for (const key in intrinsicImports) {
      if (
        intrinsicImports[key as keyof typeof intrinsicImports] !== undefined
      ) {
        return true;
      }
    }
    return false;
  };

  const preprocessNode = (node: ts.Node): ts.Node | undefined => {
    switch (node.kind) {
      case ts.SyntaxKind.ImportDeclaration:
        return preprocessImportDeclaration(node as ts.ImportDeclaration);
      default:
        return node;
    }
  };

  /**
   * Analyzes import declarations prior to the main transformation.
   */
  const preprocessImportDeclaration = (
    node: ts.ImportDeclaration,
  ): ts.ImportDeclaration | undefined => {
    // Check for intrinsic imports.
    intrinsicImports = getImportSymbolsWithTypes(
      ts,
      checker,
      node,
      {
        tooling: intrinsicTypes.tooling,
        generative: intrinsicTypes.generative,
        generate: intrinsicTypes.generate,
        embedding: intrinsicTypes.embedding,
      },
      intrinsicImports,
    );

    if (
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      // Check for a generative model import.
      if (node.moduleSpecifier.text === generativeModelImportSpecifier) {
        for (const element of node.importClause.namedBindings.elements) {
          if (element.name.text === generativeModelImportName) {
            generativeModelExpression = element.propertyName ?? element.name;
            hasGenerativeModelImport = true;
          }
        }
      }

      // Check for an embedding model import.
      if (node.moduleSpecifier.text === embeddingModelImportSpecifier) {
        for (const element of node.importClause.namedBindings.elements) {
          if (element.name.text === embeddingModelImportName) {
            embeddingModelExpression = element.propertyName ?? element.name;
            hasEmbeddingModelImport = true;
          }
        }
      }

      // Check for an embedding store import.
      if (node.moduleSpecifier.text === embeddingStoreImportSpecifier) {
        for (const element of node.importClause.namedBindings.elements) {
          if (element.name.text === embeddingStoreImportName) {
            embeddingStoreExpression = element.propertyName ?? element.name;
            hasEmbeddingStoreImport = true;
          }
        }
      }

      // Check for a context tools import.
      if (node.moduleSpecifier.text === contextToolsImportSpecifier) {
        for (const element of node.importClause.namedBindings.elements) {
          if (element.name.text === contextToolsImportName) {
            contextToolsExpression = element.propertyName ?? element.name;
            hasContextToolsImport = true;
          }
        }
      }

      // Check for an embedding cache import.
      if (node.moduleSpecifier.text === embeddingCacheImportSpecifier) {
        for (const element of node.importClause.namedBindings.elements) {
          if (element.name.text === embeddingCacheImportName) {
            embeddingCacheExpression = element.propertyName ?? element.name;
            hasEmbeddingCacheImport = true;
          }
        }
      }
    }

    return node;
  };

  /**
   * Transforms toolcog intrinsic function calls.
   */
  const processNode = (node: ts.Node): ts.Node => {
    // Transform intrinsic `tooling` calls.
    if (
      intrinsicTypes.AnyTools !== undefined &&
      intrinsicTypes.tooling !== undefined &&
      isFunctionCallExpression(ts, checker, node, intrinsicTypes.tooling)
    ) {
      node = transformToolingIntrinsic(
        ts,
        factory,
        checker,
        addDiagnostic,
        program.getCommonSourceDirectory,
        intrinsicTypes.AnyTools,
        node,
      );
    }

    // Transform intrinsic `generative` calls.
    if (
      intrinsicTypes.generative !== undefined &&
      isFunctionCallExpression(ts, checker, node, intrinsicTypes.generative)
    ) {
      needsGenerativeModel = true;
      needsContextTools = true;
      node = transformGenerativeIntrinsic(
        ts,
        factory,
        checker,
        addDiagnostic,
        program.getCommonSourceDirectory,
        generativeModelExpression!,
        contextToolsExpression,
        node,
      );
    }

    // Transform intrinsic `generate` calls.
    if (
      intrinsicTypes.generate !== undefined &&
      isFunctionCallExpression(ts, checker, node, intrinsicTypes.generate)
    ) {
      needsGenerativeModel = true;
      needsContextTools = true;
      node = transformGenerateIntrinsic(
        ts,
        factory,
        checker,
        addDiagnostic,
        program.getCommonSourceDirectory,
        generativeModelExpression!,
        contextToolsExpression,
        node,
      );
    }

    // Transform intrinsic `embedding` calls.
    if (
      intrinsicTypes.AnyEmbeds !== undefined &&
      intrinsicTypes.embedding !== undefined &&
      isFunctionCallExpression(ts, checker, node, intrinsicTypes.embedding)
    ) {
      needsEmbeddingModel = true;
      needsEmbeddingStore = true;
      needsEmbeddingCache = true;
      node = transformEmbeddingIntrinsic(
        ts,
        factory,
        checker,
        addDiagnostic,
        program.getCommonSourceDirectory,
        intrinsicTypes.AnyEmbeds,
        embeddingModelExpression!,
        embeddingStoreExpression!,
        embeddingCacheExpression!,
        node,
      );
    }

    // Recursively transform child nodes.
    return ts.visitEachChild(node, processNode, context);
  };

  /**
   * Updates import declarations after the main transformation.
   */
  const postprocessNode = (node: ts.Node): ts.Node | undefined => {
    if (
      !ts.isImportDeclaration(node) ||
      config?.keepIntrinsicImports === true
    ) {
      return node;
    }

    // Remove intrinsic imports.
    return removeImportsWithTypes(ts, factory, checker, node, [
      intrinsicTypes.tooling,
      intrinsicTypes.generative,
      intrinsicTypes.generate,
      intrinsicTypes.embedding,
    ]);
  };

  /**
   * Injects necessary imports after the main transformation.
   */
  const injectImports = (sourceFile: ts.SourceFile): ts.SourceFile => {
    const importDeclarations: ts.ImportDeclaration[] = [];

    // Inject generative model import, if necessary.
    if (!hasGenerativeModelImport && needsGenerativeModel) {
      importDeclarations.push(
        factory.createImportDeclaration(
          undefined, // modifiers
          factory.createImportClause(
            false, // isTypeOnly
            undefined, // name
            factory.createNamedImports([
              factory.createImportSpecifier(
                false, // isTypeOnly
                factory.createIdentifier(generativeModelImportName),
                generativeModelExpression!,
              ),
            ]),
          ),
          factory.createStringLiteral(generativeModelImportSpecifier),
          undefined, // attributes
        ),
      );
    }

    // Inject embedding model import, if necessary.
    if (!hasEmbeddingModelImport && needsEmbeddingModel) {
      importDeclarations.push(
        factory.createImportDeclaration(
          undefined, // modifiers
          factory.createImportClause(
            false, // isTypeOnly
            undefined, // name
            factory.createNamedImports([
              factory.createImportSpecifier(
                false, // isTypeOnly
                factory.createIdentifier(embeddingModelImportName),
                embeddingModelExpression!,
              ),
            ]),
          ),
          factory.createStringLiteral(embeddingModelImportSpecifier),
          undefined, // attributes
        ),
      );
    }

    // Inject embedding store import, if necessary.
    if (!hasEmbeddingStoreImport && needsEmbeddingStore) {
      importDeclarations.push(
        factory.createImportDeclaration(
          undefined, // modifiers
          factory.createImportClause(
            false, // isTypeOnly
            undefined, // name
            factory.createNamedImports([
              factory.createImportSpecifier(
                false, // isTypeOnly
                factory.createIdentifier(embeddingStoreImportName),
                embeddingStoreExpression!,
              ),
            ]),
          ),
          factory.createStringLiteral(embeddingStoreImportSpecifier),
          undefined, // attributes
        ),
      );
    }

    // Inject context tools import, if necessary.
    if (
      !hasContextToolsImport &&
      needsContextTools &&
      contextToolsImportName !== undefined &&
      contextToolsImportSpecifier !== undefined
    ) {
      importDeclarations.push(
        factory.createImportDeclaration(
          undefined, // modifiers
          factory.createImportClause(
            false, // isTypeOnly
            undefined, // name
            factory.createNamedImports([
              factory.createImportSpecifier(
                false, // isTypeOnly
                factory.createIdentifier(contextToolsImportName),
                contextToolsExpression!,
              ),
            ]),
          ),
          factory.createStringLiteral(contextToolsImportSpecifier),
          undefined, // attributes
        ),
      );
    }

    // Inject embedding cache import, if necessary.
    if (
      !hasEmbeddingCacheImport &&
      needsEmbeddingCache &&
      embeddingCacheGlobalName === undefined &&
      embeddingCacheImportName !== undefined &&
      embeddingCacheImportSpecifier !== undefined
    ) {
      importDeclarations.push(
        factory.createImportDeclaration(
          undefined, // modifiers
          factory.createImportClause(
            false, // isTypeOnly
            undefined, // name
            factory.createNamedImports([
              factory.createImportSpecifier(
                false, // isTypeOnly
                factory.createIdentifier(embeddingCacheImportName),
                embeddingCacheExpression!,
              ),
            ]),
          ),
          factory.createStringLiteral(embeddingCacheImportSpecifier),
          undefined, // attributes
        ),
      );
    }

    if (importDeclarations.length !== 0) {
      const statements = [...sourceFile.statements];
      const insertIndex = sourceFile.statements.findIndex((statement) => {
        return (
          !ts.isImportDeclaration(statement) ||
          !ts.isStringLiteral(statement.moduleSpecifier) ||
          statement.moduleSpecifier.text.startsWith(".")
        );
      });
      if (insertIndex >= 0) {
        statements.splice(insertIndex, 0, ...importDeclarations);
      } else {
        statements.push(...importDeclarations);
      }
      sourceFile = factory.updateSourceFile(sourceFile, statements);
    }

    return sourceFile;
  };

  /**
   * Injects an embeddings cache variable after the main transformation.
   */
  const injectEmbeddingsCacheVariable = (
    sourceFile: ts.SourceFile,
  ): ts.SourceFile => {
    if (
      !needsEmbeddingCache ||
      embeddingCacheImportName !== undefined ||
      embeddingCacheImportSpecifier !== undefined ||
      embeddingCacheGlobalName !== undefined
    ) {
      return sourceFile;
    }

    const embeddingsCacheDeclaration = factory.createVariableStatement(
      undefined, // modifiers
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            embeddingCacheExpression!,
            undefined, // exclamationToken
            undefined, // type
            factory.createObjectLiteralExpression(
              [
                factory.createPropertyAssignment(
                  factory.createIdentifier("defaultModel"),
                  factory.createStringLiteral(defaultEmbeddingModel),
                ),
              ],
              true, // multiLine
            ),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );

    const statements = [...sourceFile.statements];
    const insertIndex = sourceFile.statements.findIndex((statement) => {
      return !ts.isImportDeclaration(statement);
    });
    if (insertIndex >= 0) {
      statements.splice(insertIndex, 0, embeddingsCacheDeclaration);
    } else {
      statements.push(embeddingsCacheDeclaration);
    }

    return factory.updateSourceFile(sourceFile, statements);
  };

  return transformer;
};

const toolcogTransformer = (
  program: ts.Program,
  config?: ToolcogConfig,
  // import("ts-patch").TransformerExtras
  extras?: {
    readonly ts: typeof import("typescript");
    readonly addDiagnostic: (diagnostic: ts.Diagnostic) => number;
  },
  host?: ts.ModuleResolutionHost,
): ts.TransformerFactory<ts.SourceFile> => {
  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    const ts = extras?.ts ?? typescript;
    if (host === undefined) {
      host = ts.sys;
    }

    const addDiagnostic = (extras?.addDiagnostic ?? context.addDiagnostic) as (
      diagnostic: ts.Diagnostic,
    ) => void;

    return transformToolcog(ts, context, host, program, addDiagnostic, config);
  };
};

export type { ToolcogConfig };
export { transformToolcog, toolcogTransformer };
