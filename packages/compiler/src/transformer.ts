import { fileURLToPath } from "node:url";
import type ts from "typescript";
import typescript from "typescript";
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
  ts: typeof import("typescript"),
  context: ts.TransformationContext,
  host: ts.ModuleResolutionHost,
  program: ts.Program,
): ts.Transformer<ts.SourceFile> => {
  const factory = context.factory;
  const checker = program.getTypeChecker();
  const addDiagnostic = context.addDiagnostic;

  const containingFile = fileURLToPath(import.meta.url);

  const toolType = getModuleExportType(
    ts,
    host,
    program,
    checker,
    "Tool",
    "@toolcog/core",
    containingFile,
  );
  if (toolType === undefined) {
    return transformerError(
      ts,
      addDiagnostic,
      undefined,
      Diagnostics.UnableToResolveType,
      "Tool",
      "@toolcog/core",
    );
  }

  const useToolFunctionType = getModuleExportType(
    ts,
    host,
    program,
    checker,
    "useTool",
    "@toolcog/core",
    containingFile,
  );
  if (useToolFunctionType === undefined) {
    return transformerError(
      ts,
      addDiagnostic,
      undefined,
      Diagnostics.UnableToResolve,
      "useTool",
      "@toolcog/core",
    );
  }

  const generateFunctionType = getModuleExportType(
    ts,
    host,
    program,
    checker,
    "generate",
    "@toolcog/core",
    containingFile,
  );
  if (generateFunctionType === undefined) {
    return transformerError(
      ts,
      addDiagnostic,
      undefined,
      Diagnostics.UnableToResolve,
      "generate",
      "@toolcog/core",
    );
  }

  const promptFunctionType = getModuleExportType(
    ts,
    host,
    program,
    checker,
    "prompt",
    "@toolcog/core",
    containingFile,
  );
  if (promptFunctionType === undefined) {
    return transformerError(
      ts,
      addDiagnostic,
      undefined,
      Diagnostics.UnableToResolve,
      "prompt",
      "@toolcog/core",
    );
  }

  type ToolScope = Record<string, ts.Identifier>;
  let toolScope = Object.create(null) as ToolScope;

  const visit = (node: ts.Node): ts.Node | undefined => {
    if (ts.isBlockScope(node, node.parent)) {
      toolScope = Object.create(toolScope) as ToolScope;
      try {
        return ts.visitEachChild(node, visit, context);
      } finally {
        toolScope = Object.getPrototypeOf(toolScope) as ToolScope;
      }
    }

    if (isFunctionCallStatement(ts, checker, node, useToolFunctionType)) {
      const toolStatement = transformUseToolStatement(
        ts,
        factory,
        checker,
        addDiagnostic,
        useToolFunctionType,
        node,
      );
      const toolDeclaration = toolStatement.declarationList.declarations[0]!;
      const toolName = ts.getNameOfDeclaration(toolDeclaration);
      if (toolName !== undefined && ts.isIdentifier(toolName)) {
        toolScope[toolName.escapedText as string] = toolName;
      }
      return toolStatement;
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const variableType = checker.getTypeAtLocation(node.name);
      if (checker.isTypeAssignableTo(variableType, toolType)) {
        toolScope[node.name.escapedText as string] = node.name;
      }
    }

    if (isFunctionCallExpression(ts, checker, node, useToolFunctionType)) {
      const toolExpression = transformUseToolExpression(
        ts,
        factory,
        checker,
        addDiagnostic,
        useToolFunctionType,
        node,
      );
      return ts.visitEachChild(toolExpression, visit, context);
    }

    if (isFunctionCallExpression(ts, checker, node, generateFunctionType)) {
      return transformGenerateExpression(
        ts,
        factory,
        checker,
        addDiagnostic,
        node,
        toolScope,
      );
    }

    if (isFunctionCallExpression(ts, checker, node, promptFunctionType)) {
      return transformPromptExpression(
        ts,
        factory,
        checker,
        addDiagnostic,
        node,
        toolScope,
      );
    }

    return ts.visitEachChild(node, visit, context);
  };

  return (sourceFile: ts.SourceFile): ts.SourceFile => {
    return ts.visitNode(sourceFile, visit) as ts.SourceFile;
  };
};

const toolcogTransformerFactory = (
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
    if (
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      context.addDiagnostic === undefined &&
      extras?.addDiagnostic !== undefined
    ) {
      context.addDiagnostic = extras.addDiagnostic;
    }
    return toolcogTransformer(ts, context, host, program);
  };
};

const transformerError = (
  ts: typeof import("typescript"),
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  location: ts.Node | undefined,
  message: ts.DiagnosticMessage,
  ...args: ts.DiagnosticArguments
): ts.Transformer<ts.SourceFile> => {
  // Record the diagnostic.
  error(ts, addDiagnostic, location, message, ...args);
  // Return an identity transformer.
  return (sourceFile: ts.SourceFile): ts.SourceFile => {
    return sourceFile;
  };
};

export type { ToolcogTransformerConfig };
export { toolcogTransformer, toolcogTransformerFactory };
