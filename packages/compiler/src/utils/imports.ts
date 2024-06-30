import type ts from "typescript";
import type { ToolcogHost } from "../host.ts";

const isImportDeclarationFromModule = (
  host: ToolcogHost,
  node: ts.Node,
  moduleName: string,
): node is ts.ImportDeclaration => {
  return (
    host.ts.isImportDeclaration(node) &&
    host.ts.isStringLiteral(node.moduleSpecifier) &&
    node.moduleSpecifier.text === moduleName
  );
};

const filterNamedImportDeclaration = (
  host: ToolcogHost,
  node: ts.ImportDeclaration,
  predicate: (element: ts.ImportSpecifier) => boolean,
): ts.ImportDeclaration | undefined => {
  if (
    !host.ts.isImportDeclaration(node) ||
    node.importClause?.namedBindings === undefined ||
    !host.ts.isNamedImports(node.importClause.namedBindings)
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

  return host.factory.updateImportDeclaration(
    node,
    node.modifiers,
    host.factory.updateImportClause(
      node.importClause,
      node.importClause.isTypeOnly,
      node.importClause.name,
      host.factory.updateNamedImports(
        node.importClause.namedBindings,
        newImportSpecifiers,
      ),
    ),
    node.moduleSpecifier,
    node.attributes,
  );
};

export { isImportDeclarationFromModule, filterNamedImportDeclaration };
