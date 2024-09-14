import type ts from "typescript";
import typescript from "typescript";
import type { Manifest } from "@toolcog/runtime";
import {
  resolveManifestFile,
  parseManifest,
  formatManifest,
  createManifest,
  createModuleDef,
} from "@toolcog/runtime";
import { isFunctionCallExpression } from "./utils/functions.ts";
import { resolveModuleExportTypes } from "./utils/modules.ts";
import type { ImportSymbols } from "./utils/imports.ts";
import {
  getImportSymbolsWithTypes,
  removeImportsWithTypes,
  insertNamedImport,
} from "./utils/imports.ts";
import { getNodeId } from "./node-id.ts";
import { defineIdiomExpression } from "./intrinsics/define-idiom.ts";
import { defineIdiomsExpression } from "./intrinsics/define-idioms.ts";
import { defineIndexExpression } from "./intrinsics/define-index.ts";
import { defineToolExpression } from "./intrinsics/define-tool.ts";
import { defineToolsExpression } from "./intrinsics/define-tools.ts";
import { definePromptExpression } from "./intrinsics/define-prompt.ts";
import { promptExpression } from "./intrinsics/prompt.ts";

interface ToolcogTransformerConfig {
  generatorImport?: [import: string, module: string] | undefined;
  embedderImport?: [import: string, module: string] | undefined;
  indexerImport?: [import: string, module: string] | undefined;
  idiomResolverImport?: [import: string, module: string] | undefined;
  contextToolsImport?: [import: string, module: string] | false | undefined;

  keepIntrinsicImports?: boolean | undefined;

  standalone?: boolean | undefined;

  manifestFile?: string | undefined;
}

const transformToolcog = (
  ts: typeof import("typescript"),
  context: ts.TransformationContext,
  host: ts.ModuleResolutionHost & { writeFile: ts.WriteFileCallback },
  program: ts.Program,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  config: ToolcogTransformerConfig | undefined,
): ts.Transformer<ts.SourceFile> => {
  const factory = context.factory;
  const checker = program.getTypeChecker();

  const [generatorImportName, generatorModuleName] =
    config?.generatorImport ?? ["generate", "@toolcog/runtime"];

  const [embedderImportName, embedderModuleName] = config?.embedderImport ?? [
    "embed",
    "@toolcog/runtime",
  ];

  const [indexerImportName, indexerModuleName] = config?.indexerImport ?? [
    "index",
    "@toolcog/runtime",
  ];

  const [idiomResolverImportName, idiomResolverModuleName] =
    config?.idiomResolverImport ?? ["resolveIdiom", "@toolcog/runtime"];

  const [contextToolsImportName, contextToolsModuleName] =
    config?.contextToolsImport === undefined ?
      ["currentTools", "@toolcog/runtime"]
    : config.contextToolsImport === false ? [undefined, undefined]
    : config.contextToolsImport;

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
      "defineIdiom",
      "defineIdioms",
      "defineIndex",
      "defineTool",
      "defineTools",
      "defineFunction",
      "prompt",
    ],
    "@toolcog/core",
  );

  const standalone = config?.standalone ?? false;

  const transformSourceFile = (sourceFile: ts.SourceFile): ts.SourceFile => {
    let generatorExpression: ts.ModuleExportName | undefined;
    let hasGeneratorImport = false as boolean;
    let needsGenerator = false as boolean;

    let embedderExpression: ts.ModuleExportName | undefined;
    let hasEmbedderImport = false as boolean;
    let needsEmbedder = false as boolean;

    let indexerExpression: ts.ModuleExportName | undefined;
    let hasIndexerImport = false as boolean;
    let needsIndexer = false as boolean;

    let idiomResolverExpression: ts.ModuleExportName | undefined;
    let hasIdiomResolverImport = false as boolean;
    let needsIdiomResolver = false as boolean;

    let contextToolsExpression: ts.ModuleExportName | undefined;
    let hasContextToolsImport = false as boolean;
    let needsContextTools = false as boolean;

    let intrinsicImports = Object.create(null) as ImportSymbols<
      | "defineIdiom"
      | "defineIdioms"
      | "defineIndex"
      | "defineTool"
      | "defineTools"
      | "defineFunction"
      | "prompt"
    >;

    // Preprocess import declarations.
    const preprocessImport = (node: ts.ImportDeclaration): void => {
      // Check for intrinsic imports.
      intrinsicImports = getImportSymbolsWithTypes(
        ts,
        checker,
        node,
        {
          defineIdiom: intrinsicTypes.defineIdiom,
          defineIdioms: intrinsicTypes.defineIdioms,
          defineIndex: intrinsicTypes.defineIndex,
          defineTool: intrinsicTypes.defineTool,
          defineTools: intrinsicTypes.defineTools,
          defineFunction: intrinsicTypes.defineFunction,
          prompt: intrinsicTypes.prompt,
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

        // Check for an idiom resolver import.
        if (node.moduleSpecifier.text === idiomResolverModuleName) {
          for (const element of node.importClause.namedBindings.elements) {
            if (element.name.text === idiomResolverImportName) {
              idiomResolverExpression = element.propertyName ?? element.name;
              hasIdiomResolverImport = true;
            }
          }
        }

        // Check for a context tools import.
        if (node.moduleSpecifier.text === contextToolsModuleName) {
          for (const element of node.importClause.namedBindings.elements) {
            if (element.name.text === contextToolsImportName) {
              contextToolsExpression = element.propertyName ?? element.name;
              hasContextToolsImport = true;
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

    if (idiomResolverExpression === undefined) {
      idiomResolverExpression = factory.createUniqueName(
        idiomResolverImportName,
        ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
          ts.GeneratedIdentifierFlags.Optimistic,
      );
    }

    if (
      contextToolsExpression === undefined &&
      contextToolsImportName !== undefined &&
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      contextToolsModuleName !== undefined
    ) {
      contextToolsExpression = factory.createUniqueName(
        contextToolsImportName,
        ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
          ts.GeneratedIdentifierFlags.Optimistic,
      );
    }

    // Initialize the manifest.
    const manifestFile = resolveManifestFile(
      ts,
      program.getCompilerOptions(),
      program.getCommonSourceDirectory,
      config?.manifestFile,
    );
    let manifest: Manifest;
    if (manifestFile !== undefined && host.fileExists(manifestFile)) {
      manifest = parseManifest(host.readFile(manifestFile)!);
    } else {
      manifest = createManifest();
    }

    const moduleId = getNodeId(ts, sourceFile, {
      package: true,
      module: true,
      host,
      program,
    })!;
    const moduleDef = createModuleDef();
    manifest.modules[moduleId] = moduleDef;

    // Transform the source file.
    const transformNode = (node: ts.Node): ts.Node => {
      // Transform `defineIdiom` intrinsics.
      if (
        intrinsicTypes.AnyIdiom !== undefined &&
        intrinsicTypes.defineIdiom !== undefined &&
        isFunctionCallExpression(ts, checker, node, intrinsicTypes.defineIdiom)
      ) {
        needsIdiomResolver = true;
        const valueExpression = node.arguments[0]!;
        node = defineIdiomExpression(
          ts,
          host,
          program,
          factory,
          checker,
          addDiagnostic,
          moduleDef,
          intrinsicTypes.AnyIdiom,
          idiomResolverExpression,
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
        needsIdiomResolver = true;
        const valuesExpression = node.arguments[0]!;
        node = defineIdiomsExpression(
          ts,
          host,
          program,
          factory,
          checker,
          addDiagnostic,
          moduleDef,
          intrinsicTypes.AnyIdiom,
          intrinsicTypes.AnyIdioms,
          idiomResolverExpression,
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
        needsIdiomResolver = true;
        node = defineIndexExpression(
          ts,
          host,
          program,
          factory,
          checker,
          addDiagnostic,
          moduleDef,
          intrinsicTypes.AnyIdiom,
          intrinsicTypes.AnyIdioms,
          idiomResolverExpression,
          embedderExpression!,
          indexerExpression!,
          node,
        );
      }

      // Transform `defineTool` intrinsics.
      if (
        intrinsicTypes.AnyTool !== undefined &&
        intrinsicTypes.defineTool !== undefined &&
        isFunctionCallExpression(ts, checker, node, intrinsicTypes.defineTool)
      ) {
        const funcExpression = node.arguments[0]!;
        node = defineToolExpression(
          ts,
          host,
          program,
          factory,
          checker,
          addDiagnostic,
          moduleDef,
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
          host,
          program,
          factory,
          checker,
          addDiagnostic,
          moduleDef,
          intrinsicTypes.AnyTool,
          intrinsicTypes.AnyTools,
          funcsExpression,
          checker.getTypeAtLocation(funcsExpression),
          funcsExpression,
        );
      }

      // Transform `defineFunction` intrinsics.
      if (
        intrinsicTypes.defineFunction !== undefined &&
        isFunctionCallExpression(
          ts,
          checker,
          node,
          intrinsicTypes.defineFunction,
        )
      ) {
        needsGenerator = true;
        needsContextTools = true;
        node = definePromptExpression(
          ts,
          host,
          program,
          factory,
          checker,
          addDiagnostic,
          moduleDef,
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
          host,
          program,
          factory,
          checker,
          addDiagnostic,
          moduleDef,
          generatorExpression!,
          contextToolsExpression,
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
        intrinsicTypes.defineIdiom,
        intrinsicTypes.defineIdioms,
        intrinsicTypes.defineIndex,
        intrinsicTypes.defineTool,
        intrinsicTypes.defineTools,
        intrinsicTypes.defineFunction,
        intrinsicTypes.prompt,
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

    // Inject idiom resolver import, if needed.
    if (!hasIdiomResolverImport && needsIdiomResolver && !standalone) {
      sourceFile = insertNamedImport(
        ts,
        factory,
        sourceFile,
        factory.createIdentifier(idiomResolverImportName),
        idiomResolverExpression,
        idiomResolverModuleName,
      );
    }

    // Inject context tools import, if needed.
    if (
      !hasContextToolsImport &&
      needsContextTools &&
      contextToolsImportName !== undefined &&
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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

    // Update the manifest file.
    if (!standalone && manifestFile !== undefined) {
      context.onEmitNode(ts.EmitHint.SourceFile, sourceFile, () => {
        host.writeFile(manifestFile, formatManifest(manifest), false);
      });
    }

    return sourceFile;
  };

  return transformSourceFile;
};

const toolcogTransformer = (
  program: ts.Program,
  config?: ToolcogTransformerConfig,
  extras?: {
    // import("ts-patch").TransformerExtras
    readonly ts: typeof import("typescript");
    readonly addDiagnostic: (diagnostic: ts.Diagnostic) => number;
  },
  host?: ts.ModuleResolutionHost & { writeFile?: ts.WriteFileCallback },
): ts.TransformerFactory<ts.SourceFile> => {
  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    const ts = extras?.ts ?? typescript;
    if (host === undefined) {
      host = ts.sys;
    }
    if (host.writeFile === undefined) {
      host = {
        ...host,
        writeFile: ts.sys.writeFile,
      };
    }

    const addDiagnostic = (extras?.addDiagnostic ?? context.addDiagnostic) as (
      diagnostic: ts.Diagnostic,
    ) => void;

    return transformToolcog(
      ts,
      context,
      host as ts.ModuleResolutionHost & { writeFile: ts.WriteFileCallback },
      program,
      addDiagnostic,
      config,
    );
  };
};

export type { ToolcogTransformerConfig };
export { transformToolcog, toolcogTransformer };
