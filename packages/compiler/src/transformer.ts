import { fileURLToPath } from "node:url";
import type ts from "typescript";
import typescript from "typescript";
import { Diagnostics } from "./diagnostics.ts";
import { transformGenerateExpression } from "./generate-expression.ts";
import {
  transformToolsExpression,
  transformToolsDeclarations,
} from "./tool-expression.ts";
import { error } from "./utils/errors.ts";
import { removeImportsOfType } from "./utils/imports.ts";
import {
  isFunctionCallExpression,
  isFunctionCallStatement,
} from "./utils/functions.ts";
import { getModuleExportType } from "./utils/modules.ts";

interface ToolcogTransformerConfig {
  keepIntrinsicImports?: boolean | undefined;
}

const toolcogTransformer = (
  ts: typeof import("typescript"),
  context: ts.TransformationContext,
  host: ts.ModuleResolutionHost,
  program: ts.Program,
  config: ToolcogTransformerConfig | undefined,
): ts.Transformer<ts.SourceFile> => {
  const factory = context.factory;
  const checker = program.getTypeChecker();
  const addDiagnostic = context.addDiagnostic;

  const containingFile = fileURLToPath(import.meta.url);

  const funcType = getModuleExportType(
    ts,
    host,
    program,
    checker,
    "ToolFunction",
    "@toolcog/core",
    containingFile,
  );
  if (funcType === undefined) {
    return transformerError(
      ts,
      addDiagnostic,
      undefined,
      Diagnostics.UnableToResolveType,
      "ToolFunction",
      "@toolcog/core",
    );
  }

  const toolType = getModuleExportType(
    ts,
    host,
    program,
    checker,
    "AnyTool",
    "@toolcog/core",
    containingFile,
  );
  if (toolType === undefined) {
    return transformerError(
      ts,
      addDiagnostic,
      undefined,
      Diagnostics.UnableToResolveType,
      "AnyTool",
      "@toolcog/core",
    );
  }

  const toolsType = getModuleExportType(
    ts,
    host,
    program,
    checker,
    "AnyTools",
    "@toolcog/core",
    containingFile,
  );
  if (toolsType === undefined) {
    return transformerError(
      ts,
      addDiagnostic,
      undefined,
      Diagnostics.UnableToResolveType,
      "AnyTools",
      "@toolcog/core",
    );
  }

  const useToolType = getModuleExportType(
    ts,
    host,
    program,
    checker,
    "UseTool",
    "@toolcog/core",
    containingFile,
  );
  if (useToolType === undefined) {
    return transformerError(
      ts,
      addDiagnostic,
      undefined,
      Diagnostics.UnableToResolveType,
      "UseTool",
      "@toolcog/core",
    );
  }

  const defineToolFunctionType = getModuleExportType(
    ts,
    host,
    program,
    checker,
    "defineTool",
    "@toolcog/core",
    containingFile,
  );
  if (defineToolFunctionType === undefined) {
    return transformerError(
      ts,
      addDiagnostic,
      undefined,
      Diagnostics.UnableToResolve,
      "defineTool",
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

  type ToolScope = Record<string, ts.Identifier | undefined>;
  let toolScope = Object.create(null) as ToolScope;

  const visit = (node: ts.Node): ts.Node | ts.Node[] | undefined => {
    // Manage the tool scope stack when entering/exiting a block.
    if (ts.isBlockScope(node, node.parent)) {
      toolScope = Object.create(toolScope) as ToolScope;
      try {
        return ts.visitEachChild(node, visit, context);
      } finally {
        toolScope = Object.getPrototypeOf(toolScope) as ToolScope;
      }
    }

    // Remove imports of compile-time-only intrinsics.
    if (ts.isImportDeclaration(node) && config?.keepIntrinsicImports !== true) {
      const importDeclaration = removeImportsOfType(
        ts,
        factory,
        checker,
        node,
        [defineToolFunctionType, useToolFunctionType],
      );
      if (importDeclaration === undefined) {
        return undefined;
      }
      node = importDeclaration;
    }

    // Manage implicit tool bindings.
    if (
      (ts.isImportClause(node) || ts.isImportSpecifier(node)) &&
      node.name !== undefined
    ) {
      // Check if the import binding declares an implicit tool.
      const importType = checker.getTypeAtLocation(node.name);
      if (
        // Check if the type of the import conforms to `UseTool`.
        checker.isTypeAssignableTo(importType, useToolType)
      ) {
        toolScope[node.name.text] = node.name;
      } else {
        toolScope[node.name.text] = undefined;
      }
    } else if (
      (ts.isVariableDeclaration(node) || ts.isBindingElement(node)) &&
      ts.isIdentifier(node.name)
    ) {
      let bindingName = node.name.text;
      if (ts.isGeneratedIdentifier(node.name)) {
        bindingName += "_" + node.name.emitNode.autoGenerate.id;
      }
      // Check if the variable binding declares an implicit tool.
      const bindingType = checker.getTypeAtLocation(node.name);
      if (checker.isTypeAssignableTo(bindingType, useToolType)) {
        toolScope[bindingName] = node.name;
      } else {
        toolScope[bindingName] = undefined;
      }
    } else if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
      // A function declaration can never declare an implicit tool.
      toolScope[node.name.text] = undefined;
    }

    if (isFunctionCallExpression(ts, checker, node, defineToolFunctionType)) {
      let bindingName: ts.BindingName | ts.PropertyName | undefined;
      if (
        ts.isVariableDeclaration(node.parent) ||
        ts.isPropertyAssignment(node.parent)
      ) {
        bindingName = node.parent.name;
      }
      node = transformToolsExpression(
        ts,
        factory,
        checker,
        addDiagnostic,
        node.arguments[0]!,
        funcType,
        toolType,
        toolsType,
        bindingName,
      )[0];
    }

    if (isFunctionCallExpression(ts, checker, node, useToolFunctionType)) {
      let bindingName: ts.BindingName | ts.PropertyName | undefined;
      if (
        ts.isVariableDeclaration(node.parent) ||
        ts.isPropertyAssignment(node.parent)
      ) {
        bindingName = node.parent.name;
      }
      node = transformToolsExpression(
        ts,
        factory,
        checker,
        addDiagnostic,
        node.arguments[0]!,
        funcType,
        toolType,
        toolsType,
        bindingName,
      )[0];
    }

    if (isFunctionCallStatement(ts, checker, node, useToolFunctionType)) {
      const toolDeclarations = transformToolsDeclarations(
        ts,
        factory,
        checker,
        addDiagnostic,
        node.expression.arguments[0]!,
        funcType,
        toolType,
        toolsType,
      )[1];
      return toolDeclarations.map((toolDeclaration) =>
        ts.visitEachChild(toolDeclaration, visit, context),
      );
    }

    if (isFunctionCallExpression(ts, checker, node, generateFunctionType)) {
      node = transformGenerateExpression(
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
    return toolcogTransformer(ts, context, host, program, config);
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
