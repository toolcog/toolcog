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

const insertNamedImport = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  sourceFile: ts.SourceFile,
  propertyName: ts.Identifier | undefined,
  name: ts.ModuleExportName,
  moduleSpecifier: string,
): ts.SourceFile => {
  ts.Debug.assert(ts.isIdentifier(name));

  let index: number;
  for (index = 0; index < sourceFile.statements.length; index += 1) {
    const statement = sourceFile.statements[index]!;
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      (statement.moduleSpecifier.text.startsWith(".") &&
        !moduleSpecifier.startsWith("."))
    ) {
      break;
    }

    if (statement.moduleSpecifier.text !== moduleSpecifier) {
      continue;
    }

    let importClause = statement.importClause;

    let namedBindings = importClause?.namedBindings;
    if (namedBindings !== undefined && !ts.isNamedImports(namedBindings)) {
      continue;
    }

    let elements: ts.ImportSpecifier[];
    if (namedBindings?.elements !== undefined) {
      for (const element of namedBindings.elements) {
        if (
          element.propertyName?.text === propertyName?.text &&
          element.name.text === name.text
        ) {
          return sourceFile;
        }
      }
      elements = [...namedBindings.elements];
    } else {
      elements = [];
    }
    elements.push(factory.createImportSpecifier(false, propertyName, name));

    if (namedBindings !== undefined) {
      namedBindings = factory.updateNamedImports(namedBindings, elements);
    } else {
      namedBindings = factory.createNamedImports(elements);
    }

    if (importClause !== undefined) {
      importClause = factory.updateImportClause(
        importClause,
        false, // isTypeOnly
        importClause.name,
        namedBindings,
      );
    } else {
      importClause = factory.createImportClause(
        false, // isTypeOnly
        undefined, // name
        namedBindings,
      );
    }

    return factory.updateSourceFile(sourceFile, [
      ...sourceFile.statements.slice(0, index),
      factory.updateImportDeclaration(
        statement,
        statement.modifiers,
        importClause,
        statement.moduleSpecifier,
        statement.attributes, // attributes
      ),
      ...sourceFile.statements.slice(index + 1),
    ]);
  }

  return factory.updateSourceFile(sourceFile, [
    ...sourceFile.statements.slice(0, index),
    factory.createImportDeclaration(
      undefined, // modifiers
      factory.createImportClause(
        false, // isTypeOnly
        undefined, // name
        factory.createNamedImports([
          factory.createImportSpecifier(false, propertyName, name),
        ]),
      ),
      factory.createStringLiteral(moduleSpecifier),
      undefined, // attributes
    ),
    ...sourceFile.statements.slice(index),
  ]);
};

export type { ImportTypes, ImportSymbols };
export { getImportSymbolsWithTypes, removeImportsWithTypes, insertNamedImport };
