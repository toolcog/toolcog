import type ts from "typescript";

type ImportTypes<ImportKeys extends string> = {
  [ImportKey in ImportKeys]?: ts.Type | undefined;
};

type ImportSymbols<ImportKeys extends string> = {
  [ImportKey in ImportKeys]?: ts.Symbol | undefined;
};

const getImportSymbolsWithTypes = <ImportKeys extends string>(
  ts: typeof import("typescript"),
  checker: ts.TypeChecker,
  importDeclaration: ts.ImportDeclaration,
  importTypes: Readonly<ImportTypes<ImportKeys>>,
  importSymbols?: ImportSymbols<ImportKeys>,
): ImportSymbols<ImportKeys> => {
  if (importSymbols === undefined) {
    importSymbols = Object.create(null) as ImportSymbols<ImportKeys>;
  }

  const importClause = importDeclaration.importClause;
  if (importClause === undefined) {
    return importSymbols;
  }

  for (const importKey in importTypes) {
    const importType = importTypes[importKey];
    if (importType === undefined) {
      continue;
    }

    if (importClause.name !== undefined) {
      const nameType = checker.getTypeAtLocation(importClause.name);
      if (
        (nameType.flags & ts.TypeFlags.Any) === 0 &&
        checker.isTypeAssignableTo(nameType, importType)
      ) {
        const importSymbol = checker.getSymbolAtLocation(importClause.name);
        importSymbols[importKey] = importSymbol;
      }
    }

    if (
      importClause.namedBindings !== undefined &&
      ts.isNamedImports(importClause.namedBindings)
    ) {
      for (const element of importClause.namedBindings.elements) {
        const elementType = checker.getTypeAtLocation(element.name);
        if (
          (elementType.flags & ts.TypeFlags.Any) === 0 &&
          checker.isTypeAssignableTo(elementType, importType)
        ) {
          const importSymbol = checker.getSymbolAtLocation(element.name);
          importSymbols[importKey] = importSymbol;
        }
      }
    }
  }

  return importSymbols;
};

const removeImportsWithTypes = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  importDeclaration: ts.ImportDeclaration,
  importTypes: readonly (ts.Type | undefined)[],
): ts.ImportDeclaration | undefined => {
  let importClause = importDeclaration.importClause;
  if (importClause === undefined) {
    return importDeclaration;
  }

  if (importClause.name !== undefined) {
    const nameType = checker.getTypeAtLocation(importClause.name);
    if (
      (nameType.flags & ts.TypeFlags.Any) === 0 &&
      importTypes.some((importType) => {
        return (
          importType !== undefined &&
          checker.isTypeAssignableTo(nameType, importType)
        );
      })
    ) {
      importClause = factory.updateImportClause(
        importClause,
        importClause.isTypeOnly,
        undefined, // name
        importClause.namedBindings,
      );
    }
  }

  if (
    importClause.namedBindings !== undefined &&
    ts.isNamedImports(importClause.namedBindings)
  ) {
    let elements: ts.ImportSpecifier[] | undefined;
    for (let i = 0; i < importClause.namedBindings.elements.length; i += 1) {
      const element = importClause.namedBindings.elements[i]!;
      const elementType = checker.getTypeAtLocation(element);
      if (
        (elementType.flags & ts.TypeFlags.Any) === 0 &&
        importTypes.some((importType) => {
          return (
            importType !== undefined &&
            checker.isTypeAssignableTo(elementType, importType)
          );
        })
      ) {
        if (elements === undefined) {
          elements = importClause.namedBindings.elements.slice(0, i);
        }
      } else if (elements !== undefined) {
        elements.push(element);
      }
    }
    if (elements !== undefined) {
      importClause = factory.updateImportClause(
        importClause,
        importClause.isTypeOnly,
        importClause.name,
        elements.length !== 0 ?
          factory.createNamedImports(elements)
        : undefined,
      );
    }
  }

  if (importClause === importDeclaration.importClause) {
    return importDeclaration;
  } else if (
    importClause.name === undefined &&
    importClause.namedBindings === undefined
  ) {
    return undefined;
  }

  return factory.updateImportDeclaration(
    importDeclaration,
    importDeclaration.modifiers,
    importClause,
    importDeclaration.moduleSpecifier,
    importDeclaration.attributes,
  );
};

export type { ImportTypes, ImportSymbols };
export { getImportSymbolsWithTypes, removeImportsWithTypes };
