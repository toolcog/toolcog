import ts from "typescript";

const findTopLevelBindings = (
  checker: ts.TypeChecker,
  node: ts.Node,
  bindings: Record<string, ts.Type>,
): void => {
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportClause(node) ||
        ts.isImportSpecifier(node) ||
        ts.isVariableDeclaration(node) ||
        ts.isBindingElement(node) ||
        ts.isFunctionDeclaration(node)) &&
      node.name !== undefined &&
      ts.isIdentifier(node.name)
    ) {
      bindings[node.name.text] = checker.getTypeAtLocation(node.name);
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
  checker: ts.TypeChecker,
  statements: readonly ts.Statement[],
  bindings: Record<string, ts.Type> = {},
): ts.Statement => {
  // Find all top-level bindings.
  for (const statement of statements) {
    findTopLevelBindings(checker, statement, bindings);
  }

  // Wrap in an async IIFE that executes all statements and returns
  // an object containing all declared bindings.
  return factory.createExpressionStatement(
    factory.createCallExpression(
      factory.createArrowFunction(
        [factory.createToken(ts.SyntaxKind.AsyncKeyword)],
        undefined, // typeParameters
        [], // parameters
        undefined, // type
        undefined, // equalsGreaterThanToken
        factory.createBlock(
          [
            ...statements,
            factory.createReturnStatement(
              factory.createObjectLiteralExpression(
                Object.keys(bindings).map((binding) =>
                  factory.createShorthandPropertyAssignment(binding),
                ),
                true, // multiLine
              ),
            ),
          ],
          true, // multiLine
        ),
      ),
      undefined, // typeArguments
      [], // arguments
    ),
  );
};

export { transformTopLevelAwait };
