import ts from "typescript";

const collectBindings = (node: ts.Node, bindings: string[]): void => {
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
      bindings.push(node.name.text);
    }

    // Don't descend into nested block scopes.
    if (!ts.isSourceFile(node) && ts.isBlockScope(node, node.parent)) {
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(node);
};

const transformTopLevelAwait = (
  factory: ts.NodeFactory,
  statements: readonly ts.Statement[],
): ts.Statement => {
  // Collect all top-level bindings.
  const bindings: string[] = [];
  for (const statement of statements) {
    collectBindings(statement, bindings);
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
                bindings.map((binding) =>
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
