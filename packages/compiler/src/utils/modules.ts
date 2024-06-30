import type ts from "typescript";
import type { ToolcogHost } from "../host.ts";

const getModuleExportType = (
  host: ToolcogHost,
  exportName: string,
  moduleName: string,
  containingFile: string = "",
): ts.Type | undefined => {
  const resolvedModule = host.ts.resolveModuleName(
    moduleName,
    containingFile,
    host.program.getCompilerOptions(),
    host.moduleResolutionHost,
  ).resolvedModule;
  if (resolvedModule === undefined) {
    return undefined;
  }

  const moduleSourceFile = host.program.getSourceFile(
    resolvedModule.resolvedFileName,
  );
  if (moduleSourceFile === undefined) {
    return undefined;
  }

  const moduleSymbol = host.checker.getSymbolAtLocation(moduleSourceFile);
  if (moduleSymbol === undefined) {
    return undefined;
  }

  const moduleExports = host.checker.getExportsOfModule(moduleSymbol);
  const exportSymbol = moduleExports.find(
    (moduleExport) => moduleExport.name === exportName,
  );
  if (exportSymbol === undefined) {
    return undefined;
  }

  const originalSymbol = host.checker.getAliasedSymbol(exportSymbol);
  const originalDeclaration = originalSymbol.declarations?.[0];
  const exportType = host.checker.getTypeAtLocation(originalDeclaration!);

  return exportType;
};

export { getModuleExportType };
