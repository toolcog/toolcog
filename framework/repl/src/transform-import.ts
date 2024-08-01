import ts from "typescript";

const transformImportDeclaration = (
  factory: ts.NodeFactory,
  node: ts.ImportDeclaration,
): ts.Statement | undefined => {
  const importClause = node.importClause;

  if (importClause?.isTypeOnly === true) {
    // Omit type-only imports.
    return undefined;
  }

  // Transform the module specifier into a single awaited import call.
  const awaitedImportCall = factory.createAwaitExpression(
    factory.createCallExpression(
      factory.createIdentifier("import"),
      undefined, // typeArguments
      [node.moduleSpecifier],
    ),
  );

  if (importClause === undefined) {
    // Transform an unbound import declaration into a bare awaited import call.
    return ts.setOriginalNode(
      factory.createExpressionStatement(awaitedImportCall),
      node,
    );
  }

  // Collect all import bindings.
  const nameBindings: ts.BindingElement[] = [];
  let namespaceName: ts.Identifier | undefined;

  if (importClause.name !== undefined) {
    // Capture the default import binding.
    nameBindings.push(
      factory.createBindingElement(
        undefined, // dotDotDotToken
        factory.createIdentifier("default"),
        importClause.name,
        undefined, // initializer
      ),
    );
  }

  const namedBindings = importClause.namedBindings;
  if (namedBindings !== undefined) {
    if (ts.isNamedImports(namedBindings)) {
      // Capture named import bindings.
      for (const element of namedBindings.elements) {
        if (element.isTypeOnly) {
          // Filter out type-only import specifiers.
          continue;
        }
        nameBindings.push(
          factory.createBindingElement(
            undefined, // dotDotDotToken
            element.propertyName,
            element.name,
            undefined, // initializer
          ),
        );
      }
    } else if (ts.isNamespaceImport(namedBindings)) {
      // Capture the namespace import name.
      namespaceName = namedBindings.name;
    }
  }

  const variableDeclarations: ts.VariableDeclaration[] = [];

  if (namespaceName !== undefined) {
    // Assign the awaited import call to the namespace variable.
    variableDeclarations.push(
      factory.createVariableDeclaration(
        namespaceName,
        undefined, // exclamationToken
        undefined, // type
        awaitedImportCall,
      ),
    );
  }

  // Assign the namespace variable or the awaited import to a destructuring
  // object binding pattern containing all import bindings.
  variableDeclarations.push(
    factory.createVariableDeclaration(
      factory.createObjectBindingPattern(nameBindings),
      undefined, // exclamationToken
      undefined, // type
      namespaceName ?? awaitedImportCall,
    ),
  );

  // Return a single variable statement containing all import specifiers.
  return ts.setOriginalNode(
    factory.createVariableStatement(
      undefined, // modifiers
      factory.createVariableDeclarationList(
        variableDeclarations,
        ts.NodeFlags.Const,
      ),
    ),
    node,
  );
};

export { transformImportDeclaration };
