import type ts from "typescript";

const getModuleExportType = (
  ts: typeof import("typescript"),
  host: ts.ModuleResolutionHost,
  program: ts.Program,
  checker: ts.TypeChecker,
  exportName: string,
  moduleName: string,
  containingFile: string,
): ts.Type | undefined => {
  const resolvedModule = ts.resolveModuleName(
    moduleName,
    containingFile,
    program.getCompilerOptions(),
    host,
  ).resolvedModule;
  if (resolvedModule === undefined) {
    return undefined;
  }

  const moduleSourceFile = program.getSourceFile(
    resolvedModule.resolvedFileName,
  );
  if (moduleSourceFile === undefined) {
    return undefined;
  }

  const moduleSymbol = checker.getSymbolAtLocation(moduleSourceFile);
  if (moduleSymbol === undefined) {
    return undefined;
  }

  const moduleExports = checker.getExportsOfModule(moduleSymbol);
  const exportSymbol = moduleExports.find(
    (moduleExport) => moduleExport.name === exportName,
  );
  if (exportSymbol === undefined) {
    return undefined;
  }

  const originalSymbol = checker.getAliasedSymbol(exportSymbol);
  const originalDeclaration = originalSymbol.declarations?.[0];
  const exportType = checker.getTypeAtLocation(originalDeclaration!);

  return exportType;
};

export { getModuleExportType };
