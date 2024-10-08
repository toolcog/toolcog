import { fileURLToPath } from "node:url";
import type ts from "typescript";
import { Diagnostics } from "../diagnostics.ts";
import { error } from "./errors.ts";

type ModuleExportSymbols<ExportNames extends string> = {
  [ExportName in ExportNames]?: ts.Symbol | undefined;
};

type ModuleExportDeclarations<ExportNames extends string> = {
  [ExportName in ExportNames]?: ts.Declaration | undefined;
};

type ModuleExportTypes<ExportNames extends string> = {
  [ExportName in ExportNames]?: ts.Type | undefined;
};

const resolveModuleExportSymbols = <ExportNames extends string>(
  ts: typeof import("typescript"),
  host: ts.ModuleResolutionHost,
  program: ts.Program,
  checker: ts.TypeChecker,
  addDiagnostic: ((diagnostic: ts.Diagnostic) => void) | undefined,
  exportNames: readonly [...ExportNames[]],
  moduleName: string,
  containingFile?: string,
): ModuleExportSymbols<ExportNames> => {
  const exportSymbols = Object.create(null) as ModuleExportSymbols<ExportNames>;

  if (containingFile === undefined) {
    containingFile = fileURLToPath(import.meta.url);
  }

  const resolvedModule = ts.resolveModuleName(
    moduleName,
    containingFile,
    program.getCompilerOptions(),
    host,
  ).resolvedModule;
  if (resolvedModule === undefined) {
    if (addDiagnostic !== undefined) {
      error(
        ts,
        addDiagnostic,
        undefined,
        Diagnostics.UnableToResolveModule,
        moduleName,
      );
    }
    return exportSymbols;
  }

  const moduleSourceFile = program.getSourceFile(
    resolvedModule.resolvedFileName,
  );
  if (moduleSourceFile === undefined) {
    if (addDiagnostic !== undefined) {
      error(
        ts,
        addDiagnostic,
        undefined,
        Diagnostics.CannotGetSourceFileForModule,
        resolvedModule.resolvedFileName,
        moduleName,
      );
    }
    return exportSymbols;
  }

  const moduleSymbol = checker.getSymbolAtLocation(moduleSourceFile);
  const moduleExports =
    moduleSymbol !== undefined ?
      checker.getExportsOfModule(moduleSymbol)
    : undefined;

  for (const exportName of exportNames) {
    const exportSymbol = moduleExports?.find(
      (moduleExport) => moduleExport.name === exportName,
    );
    if (exportSymbol === undefined) {
      if (addDiagnostic !== undefined) {
        error(
          ts,
          addDiagnostic,
          undefined,
          Diagnostics.ModuleHasNoExportedMember,
          moduleName,
          exportName,
        );
      }
      return exportSymbols;
    }

    exportSymbols[exportName] = exportSymbol;
  }

  return exportSymbols;
};

const resolveModuleExportDeclarations = <ExportNames extends string>(
  ts: typeof import("typescript"),
  host: ts.ModuleResolutionHost,
  program: ts.Program,
  checker: ts.TypeChecker,
  addDiagnostic: ((diagnostic: ts.Diagnostic) => void) | undefined,
  exportNames: readonly [...ExportNames[]],
  moduleName: string,
  containingFile?: string,
): ModuleExportDeclarations<ExportNames> => {
  const exportSymbols = resolveModuleExportSymbols(
    ts,
    host,
    program,
    checker,
    addDiagnostic,
    exportNames,
    moduleName,
    containingFile,
  );

  const exportDeclarations = Object.create(
    null,
  ) as ModuleExportDeclarations<ExportNames>;

  for (const exportName in exportSymbols) {
    const exportSymbol = exportSymbols[exportName]!;

    const originalSymbol = checker.getAliasedSymbol(exportSymbol);

    const originalDeclaration = originalSymbol.declarations?.[0];
    if (originalDeclaration === undefined) {
      if (addDiagnostic !== undefined) {
        error(
          ts,
          addDiagnostic,
          undefined,
          Diagnostics.CannotFindDeclarationForExportedMemberOfModule,
          exportName,
          moduleName,
        );
      }
      continue;
    }

    exportDeclarations[exportName] = originalDeclaration;
  }

  return exportDeclarations;
};

const resolveModuleExportTypes = <ExportNames extends string>(
  ts: typeof import("typescript"),
  host: ts.ModuleResolutionHost,
  program: ts.Program,
  checker: ts.TypeChecker,
  addDiagnostic: ((diagnostic: ts.Diagnostic) => void) | undefined,
  exportNames: readonly [...ExportNames[]],
  moduleName: string,
  containingFile?: string,
): ModuleExportTypes<ExportNames> => {
  const exportDeclarations = resolveModuleExportDeclarations(
    ts,
    host,
    program,
    checker,
    addDiagnostic,
    exportNames,
    moduleName,
    containingFile,
  );

  const exportTypes = Object.create(null) as ModuleExportTypes<ExportNames>;

  for (const exportName in exportDeclarations) {
    const exportDeclaration = exportDeclarations[exportName]!;

    const exportType = checker.getTypeAtLocation(exportDeclaration);

    exportTypes[exportName] = exportType;
  }

  return exportTypes;
};

export type {
  ModuleExportSymbols,
  ModuleExportDeclarations,
  ModuleExportTypes,
};
export {
  resolveModuleExportSymbols,
  resolveModuleExportDeclarations,
  resolveModuleExportTypes,
};
