import type ts from "typescript";
import type { Schema } from "@toolcog/util/schema";
import { parseDocCommentNode } from "./doc-comment.ts";
import { typeToSchema } from "./schema.ts";
import { valueToExpression } from "./utils/literals.ts";

const compileGenerativeOptions = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  callExpression: ts.CallExpression,
  argsExpression: ts.Expression | undefined,
  optionsExpression: ts.Expression | undefined,
  toolScope: Record<string, ts.Identifier>,
): ts.ObjectLiteralExpression => {
  const docComment = parseDocCommentNode(ts, callExpression);

  let parametersSchema: Schema | undefined;
  if (argsExpression !== undefined) {
    const argsType = checker.getTypeAtLocation(argsExpression);
    parametersSchema = typeToSchema(
      ts,
      checker,
      addDiagnostic,
      argsType,
      argsExpression,
      docComment?.params,
    );
  }

  const returnType = checker.getAwaitedType(
    checker.getTypeAtLocation(callExpression),
  );
  ts.Debug.assert(returnType !== undefined);

  const returnSchema = typeToSchema(
    ts,
    checker,
    addDiagnostic,
    returnType,
    callExpression,
  );

  const toolExpressions: ts.Expression[] = [];
  for (const toolName in toolScope) {
    toolExpressions.push(toolScope[toolName]!);
  }

  const optionsLiterals: ts.ObjectLiteralElementLike[] = [];
  if (docComment?.description !== undefined) {
    optionsLiterals.push(
      factory.createPropertyAssignment(
        "instructions",
        factory.createStringLiteral(docComment.description),
      ),
    );
  }
  if (parametersSchema !== undefined) {
    optionsLiterals.push(
      factory.createPropertyAssignment(
        "parameters",
        valueToExpression(ts, factory, argsExpression!, parametersSchema),
      ),
    );
  }
  optionsLiterals.push(
    factory.createPropertyAssignment(
      "return",
      valueToExpression(ts, factory, callExpression, returnSchema),
    ),
  );
  if (toolExpressions.length !== 0) {
    if (optionsExpression !== undefined) {
      toolExpressions.unshift(
        factory.createSpreadElement(
          factory.createPropertyAccessChain(
            optionsExpression,
            factory.createToken(ts.SyntaxKind.QuestionDotToken),
            "tools",
          ),
        ),
      );
    }
    optionsLiterals.push(
      factory.createPropertyAssignment(
        "tools",
        factory.createArrayLiteralExpression(toolExpressions, true),
      ),
    );
  }
  if (optionsExpression !== undefined) {
    optionsLiterals.push(factory.createSpreadAssignment(optionsExpression));
  }

  return ts.setOriginalNode(
    factory.createObjectLiteralExpression(optionsLiterals, true),
    optionsExpression,
  );
};

const transformGenerateExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  callExpression: ts.CallExpression,
  toolScope: Record<string, ts.Identifier>,
): ts.Expression => {
  const argsExpression = callExpression.arguments[0];
  const optionsExpression = callExpression.arguments[1];

  const optionsLiteral = compileGenerativeOptions(
    ts,
    factory,
    checker,
    addDiagnostic,
    callExpression,
    argsExpression,
    optionsExpression,
    toolScope,
  );

  return factory.updateCallExpression(
    callExpression,
    callExpression.expression,
    callExpression.typeArguments,
    factory.createNodeArray([
      argsExpression ?? factory.createIdentifier("undefined"),
      optionsLiteral,
    ]),
  );
};

const transformPromptExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  callExpression: ts.CallExpression,
  toolScope: Record<string, ts.Identifier>,
): ts.Expression => {
  const messageExpression = callExpression.arguments[0];
  const argsExpression = callExpression.arguments[1];
  const optionsExpression = callExpression.arguments[2];

  const optionsLiteral = compileGenerativeOptions(
    ts,
    factory,
    checker,
    addDiagnostic,
    callExpression,
    argsExpression,
    optionsExpression,
    toolScope,
  );

  return factory.updateCallExpression(
    callExpression,
    callExpression.expression,
    callExpression.typeArguments,
    factory.createNodeArray([
      messageExpression ?? factory.createIdentifier("undefined"),
      argsExpression ?? factory.createIdentifier("undefined"),
      optionsLiteral,
    ]),
  );
};

export { transformGenerateExpression, transformPromptExpression };
