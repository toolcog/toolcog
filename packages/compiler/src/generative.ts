import type ts from "typescript";
import type { Schema } from "@toolcog/util/schema";
import type { ToolcogHost } from "./host.ts";
import { parseDocCommentNode } from "./doc-comment.ts";
import { typeToSchema } from "./schema.ts";
import { valueToExpression } from "./utils/literals.ts";

const compileGenerativeOptions = (
  host: ToolcogHost,
  callExpression: ts.CallExpression,
  argsExpression: ts.Expression | undefined,
  optionsExpression: ts.Expression | undefined,
  toolScope: Record<string, ts.Identifier>,
): ts.ObjectLiteralExpression => {
  const docComment = parseDocCommentNode(host, callExpression);

  let parametersSchema: Schema | undefined;
  if (argsExpression !== undefined) {
    const argsType = host.checker.getTypeAtLocation(argsExpression);
    parametersSchema = typeToSchema(
      host,
      argsType,
      argsExpression,
      docComment?.params,
    );
  }

  const returnType = host.checker.getAwaitedType(
    host.checker.getTypeAtLocation(callExpression),
  );
  host.ts.Debug.assert(returnType !== undefined);

  const returnSchema = typeToSchema(host, returnType, callExpression);

  const toolExpressions: ts.Expression[] = [];
  for (const toolName in toolScope) {
    toolExpressions.push(toolScope[toolName]!);
  }

  const optionsLiterals: ts.ObjectLiteralElementLike[] = [];
  if (docComment?.description !== undefined) {
    optionsLiterals.push(
      host.factory.createPropertyAssignment(
        "instructions",
        host.factory.createStringLiteral(docComment.description),
      ),
    );
  }
  if (parametersSchema !== undefined) {
    optionsLiterals.push(
      host.factory.createPropertyAssignment(
        "parameters",
        valueToExpression(host, argsExpression!, parametersSchema),
      ),
    );
  }
  optionsLiterals.push(
    host.factory.createPropertyAssignment(
      "return",
      valueToExpression(host, callExpression, returnSchema),
    ),
  );
  if (toolExpressions.length !== 0) {
    if (optionsExpression !== undefined) {
      toolExpressions.unshift(
        host.factory.createSpreadElement(
          host.factory.createPropertyAccessChain(
            optionsExpression,
            host.factory.createToken(host.ts.SyntaxKind.QuestionDotToken),
            "tools",
          ),
        ),
      );
    }
    optionsLiterals.push(
      host.factory.createPropertyAssignment(
        "tools",
        host.factory.createArrayLiteralExpression(toolExpressions, true),
      ),
    );
  }
  if (optionsExpression !== undefined) {
    optionsLiterals.push(
      host.factory.createSpreadAssignment(optionsExpression),
    );
  }

  return host.ts.setOriginalNode(
    host.factory.createObjectLiteralExpression(optionsLiterals, true),
    optionsExpression,
  );
};

const transformGenerateExpression = (
  host: ToolcogHost,
  callExpression: ts.CallExpression,
  toolScope: Record<string, ts.Identifier>,
): ts.Expression => {
  const argsExpression = callExpression.arguments[0];
  const optionsExpression = callExpression.arguments[1];

  const optionsLiteral = compileGenerativeOptions(
    host,
    callExpression,
    argsExpression,
    optionsExpression,
    toolScope,
  );

  return host.factory.updateCallExpression(
    callExpression,
    callExpression.expression,
    callExpression.typeArguments,
    host.factory.createNodeArray([
      argsExpression ?? host.factory.createIdentifier("undefined"),
      optionsLiteral,
    ]),
  );
};

const transformPromptExpression = (
  host: ToolcogHost,
  callExpression: ts.CallExpression,
  toolScope: Record<string, ts.Identifier>,
): ts.Expression => {
  const messageExpression = callExpression.arguments[0];
  const argsExpression = callExpression.arguments[1];
  const optionsExpression = callExpression.arguments[2];

  const optionsLiteral = compileGenerativeOptions(
    host,
    callExpression,
    argsExpression,
    optionsExpression,
    toolScope,
  );

  return host.factory.updateCallExpression(
    callExpression,
    callExpression.expression,
    callExpression.typeArguments,
    host.factory.createNodeArray([
      messageExpression ?? host.factory.createIdentifier("undefined"),
      argsExpression ?? host.factory.createIdentifier("undefined"),
      optionsLiteral,
    ]),
  );
};

export { transformGenerateExpression, transformPromptExpression };
