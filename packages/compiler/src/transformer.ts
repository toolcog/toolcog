import ts from "typescript";
import type { ToolcogHost } from "./host.ts";
import { Diagnostics } from "./diagnostics.ts";
import {
  transformGenerateExpression,
  transformPromptExpression,
} from "./generative.ts";
import {
  transformUseToolExpression,
  transformUseToolStatement,
} from "./use-tool.ts";
import { error } from "./utils/errors.ts";
import {
  isFunctionCallExpression,
  isFunctionCallStatement,
} from "./utils/functions.ts";
import { getModuleExportType } from "./utils/modules.ts";

interface ToolcogTransformerConfig {}

const toolcogTransformer = (
  host: ToolcogHost,
): ts.Transformer<ts.SourceFile> => {
  let useToolType = getModuleExportType(host, "UseTool", "@toolcog/core", "");
  if (useToolType === undefined) {
    useToolType = getModuleExportType(host, "UseTool", "toolcog", "");
  }
  if (useToolType === undefined) {
    return transformerError(
      host,
      undefined,
      Diagnostics.UnableToResolveType,
      "UseTool",
      "@toolcog/core",
    );
  }

  let useToolFunctionType = getModuleExportType(
    host,
    "useTool",
    "@toolcog/core",
  );
  if (useToolFunctionType === undefined) {
    useToolFunctionType = getModuleExportType(host, "useTool", "toolcog");
  }
  if (useToolFunctionType === undefined) {
    return transformerError(
      host,
      undefined,
      Diagnostics.UnableToResolve,
      "useTool",
      "@toolcog/core",
    );
  }

  let generateFunctionType = getModuleExportType(
    host,
    "generate",
    "@toolcog/core",
  );
  if (generateFunctionType === undefined) {
    generateFunctionType = getModuleExportType(host, "generate", "toolcog");
  }
  if (generateFunctionType === undefined) {
    return transformerError(
      host,
      undefined,
      Diagnostics.UnableToResolve,
      "generate",
      "@toolcog/core",
    );
  }

  let promptFunctionType = getModuleExportType(host, "prompt", "@toolcog/core");
  if (promptFunctionType === undefined) {
    promptFunctionType = getModuleExportType(host, "prompt", "toolcog");
  }
  if (promptFunctionType === undefined) {
    return transformerError(
      host,
      undefined,
      Diagnostics.UnableToResolve,
      "prompt",
      "@toolcog/core",
    );
  }

  type ToolScope = Record<string, ts.Identifier>;
  let toolScope = Object.create(null) as ToolScope;

  const visit = (node: ts.Node): ts.Node | undefined => {
    if (host.ts.isBlockScope(node, node.parent)) {
      toolScope = Object.create(toolScope) as ToolScope;
      try {
        return host.ts.visitEachChild(node, visit, host.context);
      } finally {
        toolScope = Object.getPrototypeOf(toolScope) as ToolScope;
      }
    }

    if (isFunctionCallStatement(host, node, useToolFunctionType)) {
      const toolStatement = transformUseToolStatement(host, node);
      const toolDeclaration = toolStatement.declarationList.declarations[0]!;
      const toolName = host.ts.getNameOfDeclaration(toolDeclaration);
      if (toolName !== undefined && host.ts.isIdentifier(toolName)) {
        toolScope[toolName.escapedText as string] = toolName;
      }
      return toolStatement;
    } else if (
      host.ts.isVariableDeclaration(node) &&
      host.ts.isIdentifier(node.name)
    ) {
      const variableType = host.checker.getTypeAtLocation(node.name);
      if (host.checker.isTypeAssignableTo(variableType, useToolType)) {
        toolScope[node.name.escapedText as string] = node.name;
      }
    }

    if (isFunctionCallExpression(host, node, useToolFunctionType)) {
      const toolExpression = transformUseToolExpression(host, node);
      return host.ts.visitEachChild(toolExpression, visit, host.context);
    }

    if (isFunctionCallExpression(host, node, generateFunctionType)) {
      return transformGenerateExpression(host, node, toolScope);
    }

    if (isFunctionCallExpression(host, node, promptFunctionType)) {
      return transformPromptExpression(host, node, toolScope);
    }

    return host.ts.visitEachChild(node, visit, host.context);
  };

  return (sourceFile: ts.SourceFile): ts.SourceFile => {
    return host.ts.visitNode(sourceFile, visit) as ts.SourceFile;
  };
};

const toolcogTransformerFactory = (
  program: ts.Program,
  config?: ToolcogTransformerConfig,
  // import("ts-patch").TransformerExtras
  extras?: {
    readonly ts: typeof ts;

    readonly diagnostics: readonly ts.Diagnostic[];
    readonly addDiagnostic: (diagnostic: ts.Diagnostic) => number;
  },
  moduleResolutionHost?: ts.ModuleResolutionHost,
): ts.TransformerFactory<ts.SourceFile> => {
  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    const tsInstance = extras?.ts ?? ts;

    const host = {
      ts: tsInstance,
      factory: context.factory,
      program,
      checker: program.getTypeChecker(),
      context,
      moduleResolutionHost: moduleResolutionHost ?? tsInstance.sys,

      addDiagnostic: extras?.addDiagnostic ?? context.addDiagnostic,
    } as const satisfies ToolcogHost;

    return toolcogTransformer(host);
  };
};

const transformerError = (
  host: ToolcogHost,
  location: ts.Node | undefined,
  message: ts.DiagnosticMessage,
  ...args: ts.DiagnosticArguments
): ts.Transformer<ts.SourceFile> => {
  // Record the diagnostic.
  error(host, location, message, ...args);
  // Return an identity transformer.
  return (sourceFile: ts.SourceFile): ts.SourceFile => {
    return sourceFile;
  };
};

export type { ToolcogTransformerConfig };
export { toolcogTransformer, toolcogTransformerFactory };
