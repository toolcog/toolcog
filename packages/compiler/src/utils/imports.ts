import type ts from "typescript";

const removeImportsOfType = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  node: ts.ImportDeclaration,
  importTypes: readonly ts.Type[],
): ts.ImportDeclaration | undefined => {
  let importClause = node.importClause;
  if (importClause === undefined || importClause.isTypeOnly) {
    return node;
  }

  if (importClause.name !== undefined) {
    const nameType = checker.getTypeAtLocation(importClause.name);
    if (
      (nameType.flags & ts.TypeFlags.Any) === 0 &&
      importTypes.some((importType) =>
        checker.isTypeAssignableTo(nameType, importType),
      )
    ) {
      importClause = factory.updateImportClause(
        importClause,
        importClause.isTypeOnly,
        undefined,
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
        importTypes.some((importType) =>
          checker.isTypeAssignableTo(elementType, importType),
        )
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

  if (importClause === node.importClause) {
    return node;
  } else if (
    importClause.name === undefined &&
    importClause.namedBindings === undefined
  ) {
    return undefined;
  }

  return factory.updateImportDeclaration(
    node,
    node.modifiers,
    importClause,
    node.moduleSpecifier,
    node.attributes,
  );
};

export { removeImportsOfType };
