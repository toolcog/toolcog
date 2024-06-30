import ts from "typescript";

const findTopLevelBindings = (node: ts.Node, bindings: string[]): void => {
  const visitVariableBinding = (node: ts.BindingName): void => {
    if (ts.isIdentifier(node)) {
      bindings.push(node.text);
    } else if (ts.isArrayBindingPattern(node)) {
      for (const element of node.elements) {
        if (ts.isBindingElement(element)) {
          visitVariableBinding(element.name);
        }
      }
    } else if (ts.isObjectBindingPattern(node)) {
      for (const element of node.elements) {
        visitVariableBinding(element.name);
      }
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && node.importClause !== undefined) {
      // Collect import bindings.
      if (node.importClause.name !== undefined) {
        // Add default import binding.
        bindings.push(node.importClause.name.text);
      }
      if (node.importClause.namedBindings !== undefined) {
        if (ts.isNamespaceImport(node.importClause.namedBindings)) {
          // Add namespace import binding.
          bindings.push(node.importClause.namedBindings.name.text);
        } else if (ts.isNamedImports(node.importClause.namedBindings)) {
          for (const element of node.importClause.namedBindings.elements) {
            // Add named import binding.
            bindings.push(element.name.text);
          }
        }
      }
      return;
    }

    if (ts.isVariableDeclaration(node)) {
      // Collect variable bindings.
      visitVariableBinding(node.name);
      return;
    }

    if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
      // Add function binding.
      bindings.push(node.name.text);
      return;
    }

    // Don't descend into nested block scopes.
    if (!ts.isSourceFile(node) && ts.isBlockScope(node, node.parent)) {
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(node);
  return;
};

const transformTopLevelAwait = (
  factory: ts.NodeFactory,
  statements: readonly ts.Statement[],
): ts.Statement => {
  const bindings: string[] = [];

  // Find all top-level bindings.
  for (const statement of statements) {
    findTopLevelBindings(statement, bindings);
  }

  // Wrap in an async IIFE that executes all statements and returns
  // an object containing all declared bindings.
  return factory.createExpressionStatement(
    factory.createCallExpression(
      factory.createFunctionExpression(
        [factory.createToken(ts.SyntaxKind.AsyncKeyword)], // modifiers
        undefined, // asteriskToken
        undefined, // name
        undefined, // typeParameters
        [], // parameters
        undefined, // type
        factory.createBlock(
          [
            ...statements,
            factory.createReturnStatement(
              factory.createObjectLiteralExpression(
                bindings.map((binding: string): ts.ObjectLiteralElementLike => {
                  return factory.createShorthandPropertyAssignment(binding);
                }),
                true,
              ),
            ),
          ],
          true,
        ),
      ),
      undefined,
      [],
    ),
  );
};

export { transformTopLevelAwait };
