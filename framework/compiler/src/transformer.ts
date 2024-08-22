import type ts from "typescript";
import typescript from "typescript";
import { isFunctionCallExpression } from "./utils/functions.ts";
import { resolveModuleExportTypes } from "./utils/modules.ts";
import type { ImportSymbols } from "./utils/imports.ts";
import {
  getImportSymbolsWithTypes,
  removeImportsWithTypes,
  insertNamedImport,
} from "./utils/imports.ts";
import { resolveToolcogConfigFile, readToolcogConfig } from "./config.ts";
import {
  resolveToolcogManifest,
  formatToolcogManifest,
  createToolcogManifest,
} from "./manifest.ts";
import { resolveToolcogModule } from "./module.ts";
import { defineToolExpression } from "./intrinsics/define-tool.ts";
import { defineToolsExpression } from "./intrinsics/define-tools.ts";
import { definePromptExpression } from "./intrinsics/define-prompt.ts";
import { promptExpression } from "./intrinsics/prompt.ts";
import { defineEmbeddingExpression } from "./intrinsics/define-embedding.ts";
import { defineIdiomExpression } from "./intrinsics/define-idiom.ts";
import { defineIdiomsExpression } from "./intrinsics/define-idioms.ts";
import { defineIndexExpression } from "./intrinsics/define-index.ts";

interface ToolcogTransformerConfig {
  generatorImportName?: string | undefined;
  generatorModuleName?: string | undefined;

  embedderImportName?: string | undefined;
  embedderModuleName?: string | undefined;

  indexerImportName?: string | undefined;
  indexerModuleName?: string | undefined;

  contextToolsImportName?: string | undefined;
  contextToolsModuleName?: string | undefined;

  embeddingModel?: string | undefined;
  embeddingModels?: string[] | undefined;

  standalone?: boolean | undefined;

  keepIntrinsicImports?: boolean | undefined;
}

const defaultEmbeddingModel = "text-embedding-3-small";

const transformToolcog = (
  ts: typeof import("typescript"),
  context: ts.TransformationContext,
  host: ts.ModuleResolutionHost,
  program: ts.Program,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  config: ToolcogTransformerConfig | undefined,
): ts.Transformer<ts.SourceFile> => {
  const factory = context.factory;
  const checker = program.getTypeChecker();

  const generatorImportName = config?.generatorImportName ?? "generate";
  const generatorModuleName = config?.generatorModuleName ?? "@toolcog/runtime";

  const embedderImportName = config?.embedderImportName ?? "embed";
  const embedderModuleName = config?.embedderModuleName ?? "@toolcog/runtime";

  const indexerImportName = config?.indexerImportName ?? "index";
  const indexerModuleName = config?.indexerModuleName ?? "@toolcog/runtime";

  const contextToolsImportName = config?.contextToolsImportName;
  const contextToolsModuleName = config?.contextToolsModuleName;

  const embeddingsImportName = "embeddings";
  const idiomsImportName = "idioms";

  const standalone = config?.standalone ?? false;

  const keepIntrinsicImports = config?.keepIntrinsicImports ?? false;

  const intrinsicTypes = resolveModuleExportTypes(
    ts,
    host,
    program,
    checker,
    addDiagnostic,
    [
      "AnyTool",
      "AnyTools",
      "AnyIdiom",
      "AnyIdioms",
      "defineTool",
      "defineTools",
      "definePrompt",
      "prompt",
      "defineEmbedding",
      "defineIdiom",
      "defineIdioms",
      "defineIndex",
    ],
    "@toolcog/core",
  );

  const transformSourceFile = (sourceFile: ts.SourceFile): ts.SourceFile => {
    let generatorExpression: ts.Identifier | undefined;
    let hasGeneratorImport = false as boolean;
    let needsGenerator = false as boolean;

    let embedderExpression: ts.Identifier | undefined;
    let hasEmbedderImport = false as boolean;
    let needsEmbedder = false as boolean;

    let indexerExpression: ts.Identifier | undefined;
    let hasIndexerImport = false as boolean;
    let needsIndexer = false as boolean;

    let contextToolsExpression: ts.Identifier | undefined;
    let hasContextToolsImport = false as boolean;
    let needsContextTools = false as boolean;

    let embeddingsExpression: ts.Identifier | undefined;
    let hasEmbeddingsImport = false as boolean;
    let needsEmbeddings = false as boolean;

    let idiomsExpression: ts.Identifier | undefined;
    let hasIdiomsImport = false as boolean;
    let needsIdioms = false as boolean;

    let manifestFileName: string | undefined;
    let manifestModuleName: string | undefined;

    if (!standalone) {
      manifestFileName = resolveToolcogManifest(ts, program, sourceFile);
      manifestModuleName = resolveToolcogModule(ts, program, sourceFile);
    }

    let intrinsicImports = Object.create(null) as ImportSymbols<
      | "defineTool"
      | "defineTools"
      | "definePrompt"
      | "prompt"
      | "defineEmbedding"
      | "defineIdiom"
      | "defineIdioms"
      | "defineIndex"
    >;

    // Preprocess import declarations.
    const preprocessImport = (node: ts.ImportDeclaration): void => {
      // Check for intrinsic imports.
      intrinsicImports = getImportSymbolsWithTypes(
        ts,
        checker,
        node,
        {
          defineTool: intrinsicTypes.defineTool,
          defineTools: intrinsicTypes.defineTools,
          definePrompt: intrinsicTypes.definePrompt,
          prompt: intrinsicTypes.prompt,
          defineEmbedding: intrinsicTypes.defineEmbedding,
          defineIdiom: intrinsicTypes.defineIdiom,
          defineIdioms: intrinsicTypes.defineIdioms,
        },
        intrinsicImports,
      );

      if (
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.importClause?.namedBindings !== undefined &&
        ts.isNamedImports(node.importClause.namedBindings)
      ) {
        // Check for a generator import.
        if (node.moduleSpecifier.text === generatorModuleName) {
          for (const element of node.importClause.namedBindings.elements) {
            if (element.name.text === generatorImportName) {
              generatorExpression = element.propertyName ?? element.name;
              hasGeneratorImport = true;
            }
          }
        }

        // Check for an embedder import.
        if (node.moduleSpecifier.text === embedderModuleName) {
          for (const element of node.importClause.namedBindings.elements) {
            if (element.name.text === embedderImportName) {
              embedderExpression = element.propertyName ?? element.name;
              hasEmbedderImport = true;
            }
          }
        }

        // Check for an indexer import.
        if (node.moduleSpecifier.text === indexerModuleName) {
          for (const element of node.importClause.namedBindings.elements) {
            if (element.name.text === indexerImportName) {
              indexerExpression = element.propertyName ?? element.name;
              hasIndexerImport = true;
            }
          }
        }

        // Check for a context defineTools import.
        if (node.moduleSpecifier.text === contextToolsModuleName) {
          for (const element of node.importClause.namedBindings.elements) {
            if (element.name.text === contextToolsImportName) {
              contextToolsExpression = element.propertyName ?? element.name;
              hasContextToolsImport = true;
            }
          }
        }

        // Check for manifest imports.
        if (node.moduleSpecifier.text === manifestModuleName) {
          for (const element of node.importClause.namedBindings.elements) {
            if (element.name.text === embeddingsImportName) {
              embeddingsExpression = element.propertyName ?? element.name;
              hasEmbeddingsImport = true;
            } else if (element.name.text === idiomsImportName) {
              idiomsExpression = element.propertyName ?? element.name;
              hasIdiomsImport = true;
            }
          }
        }
      }
    };
    const preprocessNode = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node)) {
        preprocessImport(node);
      }
    };
    ts.forEachChild(sourceFile, preprocessNode);

    // Short-circuit the transformation if the current source file
    // doesn't import any toolcog intrinsic functions.
    let hasIntrinsicImports = false;
    for (const key in intrinsicImports) {
      if (
        intrinsicImports[key as keyof typeof intrinsicImports] !== undefined
      ) {
        hasIntrinsicImports = true;
        break;
      }
    }
    if (!hasIntrinsicImports) {
      return sourceFile;
    }

    // Load toolcog config file.

    const toolcogConfigFile = resolveToolcogConfigFile(sourceFile);
    const toolcogConfig = readToolcogConfig(ts, toolcogConfigFile);

    const embeddingModel =
      toolcogConfig?.embedder?.model ??
      config?.embeddingModel ??
      defaultEmbeddingModel;
    const embeddingModels = config?.embeddingModels ?? [];
    if (!embeddingModels.includes(embeddingModel)) {
      embeddingModels.unshift(embeddingModel);
    }

    // Generate intrinsic import names.

    if (generatorExpression === undefined) {
      generatorExpression = factory.createUniqueName(
        generatorImportName,
        ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
          ts.GeneratedIdentifierFlags.Optimistic,
      );
    }

    if (embedderExpression === undefined) {
      embedderExpression = factory.createUniqueName(
        embedderImportName,
        ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
          ts.GeneratedIdentifierFlags.Optimistic,
      );
    }

    if (indexerExpression === undefined) {
      indexerExpression = factory.createUniqueName(
        indexerImportName,
        ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
          ts.GeneratedIdentifierFlags.Optimistic,
      );
    }

    if (
      contextToolsExpression === undefined &&
      contextToolsImportName !== undefined &&
      contextToolsModuleName !== undefined
    ) {
      contextToolsExpression = factory.createUniqueName(
        contextToolsImportName,
        ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
          ts.GeneratedIdentifierFlags.Optimistic,
      );
    }

    if (embeddingsExpression === undefined && !standalone) {
      embeddingsExpression = factory.createUniqueName(
        embeddingsImportName,
        ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
          ts.GeneratedIdentifierFlags.Optimistic,
      );
    }

    if (idiomsExpression === undefined && !standalone) {
      idiomsExpression = factory.createUniqueName(
        idiomsImportName,
        ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
          ts.GeneratedIdentifierFlags.Optimistic,
      );
    }

    // Initialize the manifest.

    const manifest = createToolcogManifest(manifestModuleName);
    manifest.embeddingModel = embeddingModel;
    manifest.embeddingModels = embeddingModels;

    // Transform the source file.

    const transformNode = (node: ts.Node): ts.Node => {
      // Transform `defineTool` intrinsics.
      if (
        intrinsicTypes.AnyTool !== undefined &&
        intrinsicTypes.defineTool !== undefined &&
        isFunctionCallExpression(ts, checker, node, intrinsicTypes.defineTool)
      ) {
        const funcExpression = node.arguments[0]!;
        node = defineToolExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          program.getCommonSourceDirectory,
          manifest,
          intrinsicTypes.AnyTool,
          funcExpression,
          checker.getTypeAtLocation(funcExpression),
          funcExpression,
        );
      }

      // Transform `defineTools` intrinsics.
      if (
        intrinsicTypes.AnyTool !== undefined &&
        intrinsicTypes.AnyTools !== undefined &&
        intrinsicTypes.defineTools !== undefined &&
        isFunctionCallExpression(ts, checker, node, intrinsicTypes.defineTools)
      ) {
        const funcsExpression = node.arguments[0]!;
        node = defineToolsExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          program.getCommonSourceDirectory,
          manifest,
          intrinsicTypes.AnyTool,
          intrinsicTypes.AnyTools,
          funcsExpression,
          checker.getTypeAtLocation(funcsExpression),
          funcsExpression,
        );
      }

      // Transform `definePrompt` intrinsics.
      if (
        intrinsicTypes.definePrompt !== undefined &&
        isFunctionCallExpression(ts, checker, node, intrinsicTypes.definePrompt)
      ) {
        needsGenerator = true;
        needsContextTools = true;
        node = definePromptExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          program.getCommonSourceDirectory,
          manifest,
          generatorExpression!,
          contextToolsExpression,
          node,
        );
      }

      // Transform `prompt` intrinsics.
      if (
        intrinsicTypes.prompt !== undefined &&
        isFunctionCallExpression(ts, checker, node, intrinsicTypes.prompt)
      ) {
        needsGenerator = true;
        needsContextTools = true;
        node = promptExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          program.getCommonSourceDirectory,
          generatorExpression!,
          contextToolsExpression,
          node,
        );
      }

      // Transform `defineEmbedding` intrinsics.
      if (
        intrinsicTypes.defineEmbedding !== undefined &&
        isFunctionCallExpression(
          ts,
          checker,
          node,
          intrinsicTypes.defineEmbedding,
        )
      ) {
        needsEmbedder ||= standalone || !ts.isStringLiteral(node.arguments[0]!);
        needsEmbeddings = true;
        node = defineEmbeddingExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          program.getCommonSourceDirectory,
          manifest,
          embeddingsExpression,
          embedderExpression!,
          node,
        );
      }

      // Transform `defineIdiom` intrinsics.
      if (
        intrinsicTypes.AnyIdiom !== undefined &&
        intrinsicTypes.defineIdiom !== undefined &&
        isFunctionCallExpression(ts, checker, node, intrinsicTypes.defineIdiom)
      ) {
        needsEmbeddings = true;
        needsIdioms = true;
        const valueExpression = node.arguments[0]!;
        node = defineIdiomExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          program.getCommonSourceDirectory,
          manifest,
          intrinsicTypes.AnyIdiom,
          embeddingsExpression,
          idiomsExpression,
          valueExpression,
          checker.getTypeAtLocation(valueExpression),
          valueExpression,
        );
      }

      // Transform `defineIdioms` intrinsics.
      if (
        intrinsicTypes.AnyIdiom !== undefined &&
        intrinsicTypes.AnyIdioms !== undefined &&
        intrinsicTypes.defineIdioms !== undefined &&
        isFunctionCallExpression(ts, checker, node, intrinsicTypes.defineIdioms)
      ) {
        needsEmbeddings = true;
        needsIdioms = true;
        const valuesExpression = node.arguments[0]!;
        node = defineIdiomsExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          program.getCommonSourceDirectory,
          manifest,
          intrinsicTypes.AnyIdiom,
          intrinsicTypes.AnyIdioms,
          embeddingsExpression,
          idiomsExpression,
          valuesExpression,
          checker.getTypeAtLocation(valuesExpression),
          valuesExpression,
        );
      }

      // Transform `defineIndex` intrinsics.
      if (
        intrinsicTypes.AnyIdiom !== undefined &&
        intrinsicTypes.AnyIdioms !== undefined &&
        intrinsicTypes.defineIndex !== undefined &&
        isFunctionCallExpression(ts, checker, node, intrinsicTypes.defineIndex)
      ) {
        needsEmbedder = true;
        needsIndexer = true;
        needsEmbeddings = true;
        needsIdioms = true;
        node = defineIndexExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          program.getCommonSourceDirectory,
          manifest,
          intrinsicTypes.AnyIdiom,
          intrinsicTypes.AnyIdioms,
          embeddingsExpression,
          idiomsExpression,
          embedderExpression!,
          indexerExpression!,
          node,
        );
      }

      // Recursively transform child nodes.
      return ts.visitEachChild(node, transformNode, context);
    };
    sourceFile = ts.visitNode(sourceFile, transformNode) as ts.SourceFile;

    // Postprocess import declarations.
    const postprocessNode = (node: ts.Node): ts.Node | undefined => {
      if (!ts.isImportDeclaration(node) || keepIntrinsicImports) {
        return node;
      }

      // Remove intrinsic imports.
      return removeImportsWithTypes(ts, factory, checker, node, [
        intrinsicTypes.defineTool,
        intrinsicTypes.defineTools,
        intrinsicTypes.definePrompt,
        intrinsicTypes.prompt,
        intrinsicTypes.defineEmbedding,
        intrinsicTypes.defineIdiom,
        intrinsicTypes.defineIdioms,
        intrinsicTypes.defineIndex,
      ]);
    };
    sourceFile = ts.visitEachChild(sourceFile, postprocessNode, context);

    // Inject generator import, if needed.
    if (!hasGeneratorImport && needsGenerator) {
      sourceFile = insertNamedImport(
        ts,
        factory,
        sourceFile,
        factory.createIdentifier(generatorImportName),
        generatorExpression,
        generatorModuleName,
      );
    }

    // Inject embedder import, if needed.
    if (!hasEmbedderImport && needsEmbedder) {
      sourceFile = insertNamedImport(
        ts,
        factory,
        sourceFile,
        factory.createIdentifier(embedderImportName),
        embedderExpression,
        embedderModuleName,
      );
    }

    // Inject indexer import, if needed.
    if (!hasIndexerImport && needsIndexer) {
      sourceFile = insertNamedImport(
        ts,
        factory,
        sourceFile,
        factory.createIdentifier(indexerImportName),
        indexerExpression,
        indexerModuleName,
      );
    }

    // Inject context defineTools import, if needed.
    if (
      !hasContextToolsImport &&
      needsContextTools &&
      contextToolsImportName !== undefined &&
      contextToolsModuleName !== undefined
    ) {
      sourceFile = insertNamedImport(
        ts,
        factory,
        sourceFile,
        factory.createIdentifier(contextToolsImportName),
        contextToolsExpression!,
        contextToolsModuleName,
      );
    }

    // Inject embeddings import, if needed.
    if (!hasEmbeddingsImport && needsEmbeddings && !standalone) {
      sourceFile = insertNamedImport(
        ts,
        factory,
        sourceFile,
        factory.createIdentifier(embeddingsImportName),
        embeddingsExpression!,
        manifestModuleName!,
      );
    }

    // Inject idioms import, if needed.
    if (!hasIdiomsImport && needsIdioms && !standalone) {
      sourceFile = insertNamedImport(
        ts,
        factory,
        sourceFile,
        factory.createIdentifier(idiomsImportName),
        idiomsExpression!,
        manifestModuleName!,
      );
    }

    // Emit the manifest file.
    if (!standalone) {
      context.onEmitNode(ts.EmitHint.SourceFile, sourceFile, () => {
        program.writeFile(
          manifestFileName!,
          formatToolcogManifest(manifest),
          false, // writeByteOrderMark
          undefined, // onError
          [sourceFile],
        );
      });
    }

    return sourceFile;
  };

  return transformSourceFile;
};

const toolcogTransformer = (
  program: ts.Program,
  config?: ToolcogTransformerConfig,
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

export type { ToolcogTransformerConfig };
export { transformToolcog, toolcogTransformer };
