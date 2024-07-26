import { fileURLToPath } from "node:url";
import type ts from "typescript";
import typescript from "typescript";
import { Diagnostics } from "./diagnostics.ts";
import { transformToolExpression } from "./transform-tool.ts";
import { transformImplementExpression } from "./transform-implement.ts";
import { transformGenerateExpression } from "./transform-generate.ts";
import { error } from "./utils/errors.ts";
import { removeImportsOfType } from "./utils/imports.ts";
import {
  isFunctionCallExpression,
  isFunctionCallStatement,
} from "./utils/functions.ts";
import { getModuleExportType } from "./utils/modules.ts";

interface ToolcogTransformerConfig {
  runtimeModule?: string | undefined;
  generativeModelFunction?: string | undefined;

  keepIntrinsicImports?: boolean | undefined;
}

const toolcogTransformer = (
  ts: typeof import("typescript"),
  context: ts.TransformationContext,
  host: ts.ModuleResolutionHost,
  program: ts.Program,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  config: ToolcogTransformerConfig | undefined,
): ts.Transformer<ts.SourceFile> => {
  const factory = context.factory;
  const checker = program.getTypeChecker();
  const containingFile = fileURLToPath(import.meta.url);

  const runtimeModule = config?.runtimeModule ?? "@toolcog/runtime";
  const generativeModelFunction =
    config?.generativeModelFunction ?? "generativeModel";

  // Resolve intrinsic types.

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
    "UseAnyTool",
    "@toolcog/core",
    containingFile,
  );
  if (useToolType === undefined) {
    return transformerError(
      ts,
      addDiagnostic,
      undefined,
      Diagnostics.UnableToResolveType,
      "UseAnyTool",
      "@toolcog/core",
    );
  }

  const useToolsType = getModuleExportType(
    ts,
    host,
    program,
    checker,
    "UseAnyTools",
    "@toolcog/core",
    containingFile,
  );
  if (useToolsType === undefined) {
    return transformerError(
      ts,
      addDiagnostic,
      undefined,
      Diagnostics.UnableToResolveType,
      "UseAnyTools",
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

  const implementFunctionType = getModuleExportType(
    ts,
    host,
    program,
    checker,
    "implement",
    "@toolcog/core",
    containingFile,
  );
  if (implementFunctionType === undefined) {
    return transformerError(
      ts,
      addDiagnostic,
      undefined,
      Diagnostics.UnableToResolve,
      "implement",
      "@toolcog/core",
    );
  }

  return (sourceFile: ts.SourceFile): ts.SourceFile => {
    let generativeModelExpression = factory.createUniqueName(
      generativeModelFunction,
      ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
        ts.GeneratedIdentifierFlags.Optimistic |
        ts.GeneratedIdentifierFlags.AllowNameSubstitution,
    );
    let hasGenerativeModelImport = false as boolean;
    let needsGenerativeModelImport = false as boolean;

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

      // Remove imports of compile-time intrinsics.
      if (
        ts.isImportDeclaration(node) &&
        config?.keepIntrinsicImports !== true
      ) {
        const importDeclaration = removeImportsOfType(
          ts,
          factory,
          checker,
          node,
          [
            defineToolFunctionType,
            useToolFunctionType,
            generateFunctionType,
            implementFunctionType,
          ],
        );
        if (importDeclaration === undefined) {
          return undefined;
        }
        node = importDeclaration;
      }

      // Check for existing runtime imports.
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === runtimeModule &&
        node.importClause?.namedBindings !== undefined &&
        ts.isNamedImports(node.importClause.namedBindings)
      ) {
        for (const element of node.importClause.namedBindings.elements) {
          if (element.name.text === generativeModelFunction) {
            generativeModelExpression = element.propertyName ?? element.name;
            hasGenerativeModelImport = true;
          }
        }
      }

      // Manage implicit tool bindings.
      if (
        (ts.isImportClause(node) || ts.isImportSpecifier(node)) &&
        node.name !== undefined
      ) {
        // Check if the import declares an implicit tool.
        const importType = checker.getTypeAtLocation(node.name);
        toolScope[node.name.text] =
          checker.isTypeAssignableTo(importType, useToolsType) ?
            node.name
          : undefined;
      } else if (
        (ts.isVariableDeclaration(node) || ts.isBindingElement(node)) &&
        ts.isIdentifier(node.name)
      ) {
        let bindingName = node.name.text;
        if (ts.isGeneratedIdentifier(node.name)) {
          bindingName += "_" + node.name.emitNode.autoGenerate.id;
        }
        // Check if the variable declares an implicit tool.
        const bindingType = checker.getTypeAtLocation(node.name);
        toolScope[bindingName] =
          checker.isTypeAssignableTo(bindingType, useToolsType) ?
            node.name
          : undefined;
      } else if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
        // A function declaration can never declare an implicit tool.
        toolScope[node.name.text] = undefined;
      }

      // Transform `defineTool` call expressions.
      if (isFunctionCallExpression(ts, checker, node, defineToolFunctionType)) {
        const bindingName =
          (
            ts.isVariableDeclaration(node.parent) ||
            ts.isPropertyAssignment(node.parent)
          ) ?
            node.parent.name
          : undefined;

        node = transformToolExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          node.arguments[0]!,
          toolsType,
          bindingName,
        );
      }

      // Transform `useTool` calls.
      if (isFunctionCallExpression(ts, checker, node, useToolFunctionType)) {
        const bindingName =
          (
            ts.isVariableDeclaration(node.parent) ||
            ts.isPropertyAssignment(node.parent)
          ) ?
            node.parent.name
          : undefined;

        node = transformToolExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          node.arguments[0]!,
          toolsType,
          bindingName,
        );
      }

      // Assign `useTool` statements to variables.
      if (isFunctionCallStatement(ts, checker, node, useToolFunctionType)) {
        let toolName: string | undefined;
        if (ts.isIdentifier(node.expression.arguments[0]!)) {
          toolName = node.expression.arguments[0].text;
        } else {
          const declarationName = ts.getNameOfDeclaration(node.expression);
          toolName =
            declarationName !== undefined && ts.isIdentifier(declarationName) ?
              declarationName.text
            : undefined;
        }

        const expressionType = checker.getTypeAtLocation(node.expression);
        if (checker.isTypeAssignableTo(expressionType, useToolType)) {
          if (toolName !== undefined) {
            toolName += "Tool";
          } else {
            toolName = "tool";
          }
        } else {
          if (toolName !== undefined) {
            toolName += "Toolkit";
          } else {
            toolName = "toolkit";
          }
        }

        node = factory.createVariableStatement(
          undefined, // modifiers
          factory.createVariableDeclarationList(
            [
              factory.createVariableDeclaration(
                factory.createUniqueName(
                  toolName,
                  ts.GeneratedIdentifierFlags.ReservedInNestedScopes |
                    ts.GeneratedIdentifierFlags.Optimistic |
                    ts.GeneratedIdentifierFlags.AllowNameSubstitution,
                ),
                undefined, // exclamationToken
                undefined, // type
                node.expression,
              ),
            ],
            ts.NodeFlags.Const,
          ),
        );
      }

      // Transform `generate` calls.
      if (isFunctionCallExpression(ts, checker, node, generateFunctionType)) {
        needsGenerativeModelImport = true;
        const bindingName =
          (
            ts.isVariableDeclaration(node.parent) ||
            ts.isPropertyAssignment(node.parent)
          ) ?
            node.parent.name
          : undefined;

        node = transformGenerateExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          generativeModelExpression,
          node,
          toolScope,
          bindingName,
        );
      }

      // Transform `implement` calls.
      if (isFunctionCallExpression(ts, checker, node, implementFunctionType)) {
        needsGenerativeModelImport = true;
        const bindingName =
          (
            ts.isVariableDeclaration(node.parent) ||
            ts.isPropertyAssignment(node.parent)
          ) ?
            node.parent.name
          : undefined;

        node = transformImplementExpression(
          ts,
          factory,
          checker,
          addDiagnostic,
          generativeModelExpression,
          node,
          toolScope,
          bindingName,
        );
      }

      // Recursively transform child nodes.
      return ts.visitEachChild(node, visit, context);
    };

    // Transform top-level statements.
    sourceFile = ts.visitNode(sourceFile, visit) as ts.SourceFile;

    // Inject necessary runtime imports.
    if (!hasGenerativeModelImport && needsGenerativeModelImport) {
      sourceFile = factory.updateSourceFile(sourceFile, [
        factory.createImportDeclaration(
          undefined, // modifiers
          factory.createImportClause(
            false, // isTypeOnly
            undefined, // name
            factory.createNamedImports([
              factory.createImportSpecifier(
                false, // isTypeOnly
                factory.createIdentifier(generativeModelFunction),
                generativeModelExpression,
              ),
            ]),
          ),
          factory.createStringLiteral(runtimeModule),
          undefined, // attributes
        ),
        ...sourceFile.statements,
      ]);
    }

    return sourceFile;
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
    const addDiagnostic = extras?.addDiagnostic ?? context.addDiagnostic!;
    return toolcogTransformer(
      ts,
      context,
      host,
      program,
      addDiagnostic,
      config,
    );
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
