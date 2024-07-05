import type ts from "typescript";

const isImportDeclarationFromModule = (
  ts: typeof import("typescript"),
  node: ts.Node,
  moduleName: string,
): node is ts.ImportDeclaration => {
  return (
    ts.isImportDeclaration(node) &&
    ts.isStringLiteral(node.moduleSpecifier) &&
    node.moduleSpecifier.text === moduleName
  );
};

const filterNamedImportDeclaration = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  node: ts.ImportDeclaration,
  predicate: (element: ts.ImportSpecifier) => boolean,
): ts.ImportDeclaration | undefined => {
  if (
    !ts.isImportDeclaration(node) ||
    node.importClause?.namedBindings === undefined ||
    !ts.isNamedImports(node.importClause.namedBindings)
  ) {
    return node;
  }

  let changed = false;
  const newImportSpecifiers: ts.ImportSpecifier[] = [];
  for (const element of node.importClause.namedBindings.elements) {
    if (predicate(element)) {
      newImportSpecifiers.push(element);
    } else {
      changed = true;
    }
  }

  if (!changed) {
    return node;
  } else if (newImportSpecifiers.length === 0) {
    return undefined;
  }

  return factory.updateImportDeclaration(
    node,
    node.modifiers,
    factory.updateImportClause(
      node.importClause,
      node.importClause.isTypeOnly,
      node.importClause.name,
      factory.updateNamedImports(
        node.importClause.namedBindings,
        newImportSpecifiers,
      ),
    ),
    node.moduleSpecifier,
    node.attributes,
  );
};

export { isImportDeclarationFromModule, filterNamedImportDeclaration };
