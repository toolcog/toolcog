import type ts from "typescript";
import type { Schema } from "@toolcog/util/schema";
import { parseDocCommentNode } from "./doc-comment.ts";
import { typeToSchema } from "./type-to-schema.ts";
import { valueToExpression } from "./utils/literals.ts";

const transformGenerateExpression = (
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  callExpression: ts.CallExpression,
  toolScope: Record<string, ts.Identifier | undefined>,
): ts.Expression => {
  const callSignature = checker.getResolvedSignature(callExpression);
  ts.Debug.assert(callSignature !== undefined);

  let instructionsExpression: ts.Expression | undefined;
  let argsExpression: ts.Expression | undefined;
  let optionsExpression: ts.Expression | undefined;
  if (callSignature.parameters.length === 3) {
    instructionsExpression = callExpression.arguments[0];
    argsExpression = callExpression.arguments[1];
    optionsExpression = callExpression.arguments[2];
  } else {
    argsExpression = callExpression.arguments[0];
    optionsExpression = callExpression.arguments[1];
  }

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
    const toolExpression = toolScope[toolName];
    if (toolExpression !== undefined) {
      toolExpressions.push(toolExpression);
    }
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

  const optionsLiteral = ts.setOriginalNode(
    factory.createObjectLiteralExpression(optionsLiterals, true),
    optionsExpression,
  );

  const argumentsArray: ts.Expression[] = [];
  if (instructionsExpression !== undefined) {
    argumentsArray.push(instructionsExpression);
  }
  argumentsArray.push(argsExpression ?? factory.createIdentifier("undefined"));
  argumentsArray.push(optionsLiteral);

  return factory.updateCallExpression(
    callExpression,
    callExpression.expression,
    callExpression.typeArguments,
    factory.createNodeArray(argumentsArray),
  );
};

export { transformGenerateExpression };
