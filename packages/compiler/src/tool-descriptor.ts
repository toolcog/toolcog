import type ts from "typescript";
import type { Schema, SchemaDefinition } from "@toolcog/util/schema";
import type { FunctionDescriptor } from "@toolcog/core";
import type { ToolcogHost } from "./host.ts";
import { Diagnostics } from "./diagnostics.ts";
import { typeToSchema } from "./schema.ts";
import { getDocComment } from "./doc-comment.ts";
import { error, abort } from "./utils/errors.ts";
import { getErasedType } from "./utils/erasure.ts";
import { valueToExpression } from "./utils/literals.ts";

const getToolDescriptor = (
  host: ToolcogHost,
  node: ts.Node,
): FunctionDescriptor => {
  const docComment = getDocComment(host, node);
  if (docComment === undefined) {
    error(host, node, Diagnostics.MissingToolComment);
  }

  let toolName: string;
  let toolDeclaration: ts.Declaration | undefined;
  if (host.ts.isIdentifier(node)) {
    const symbol = host.checker.getSymbolAtLocation(node);
    host.ts.Debug.assert(symbol !== undefined);
    const declaration = symbol.declarations?.[0];
    host.ts.Debug.assert(declaration !== undefined);
    toolName = node.text;
    toolDeclaration = declaration;
  } else if (host.ts.isDeclarationStatement(node)) {
    const declarationName = host.ts.getNameOfDeclaration(node);
    if (
      declarationName === undefined ||
      (!host.ts.isIdentifier(declarationName) &&
        !host.ts.isPrivateIdentifier(declarationName))
    ) {
      return abort(host, node, Diagnostics.UnableToDetermineToolName);
    }
    toolName = host.ts.idText(declarationName);
    toolDeclaration = node;
  } else {
    return abort(host, node, Diagnostics.UnsupportedToolExpression);
  }

  const functionType = host.checker.getTypeAtLocation(toolDeclaration);
  const [functionSignature] = functionType.getCallSignatures();
  host.ts.Debug.assert(functionSignature !== undefined);

  const parameterSchemas: { [key: string]: SchemaDefinition } = {};
  const requiredParameters: string[] = [];

  for (const parameter of functionSignature.parameters) {
    const parameterDeclaration = parameter.valueDeclaration!;
    const parameterType = host.checker.getTypeOfSymbolAtLocation(
      parameter,
      parameterDeclaration,
    );
    const erasedParameterType = getErasedType(host, parameterType);
    let parameterSchema = typeToSchema(
      host,
      erasedParameterType,
      parameterDeclaration,
    );
    if (parameterSchema.description === undefined) {
      const description = docComment?.params.get(parameter.name);
      if (description !== undefined) {
        parameterSchema = { ...parameterSchema, description };
      }
    }

    parameterSchemas[parameter.name] = parameterSchema;
    if (
      !host.ts.isParameter(parameterDeclaration) ||
      (parameterDeclaration.questionToken === undefined &&
        parameterDeclaration.initializer === undefined)
    ) {
      requiredParameters.push(parameter.name);
    }
  }

  let parametersSchema: Schema | undefined;
  if (functionSignature.parameters.length !== 0) {
    parametersSchema = {
      type: "object",
      properties: parameterSchemas,
      ...(requiredParameters.length !== 0 ?
        { required: requiredParameters }
      : undefined),
    };
  }

  const returnType = host.checker.getAwaitedType(
    functionSignature.getReturnType(),
  );
  host.ts.Debug.assert(returnType !== undefined);

  let returnSchema = typeToSchema(host, returnType, toolDeclaration);
  if (returnSchema.description === undefined) {
    const description = docComment?.returns;
    if (description !== undefined) {
      returnSchema = { ...returnSchema, description };
    }
  }

  return {
    name: toolName,
    ...(docComment?.description !== undefined ?
      { description: docComment.description }
    : undefined),
    ...(parametersSchema !== undefined ?
      { parameters: parametersSchema }
    : undefined),
    return: returnSchema,
  };
};

const getToolDescriptorExpression = (
  host: ToolcogHost,
  node: ts.Node,
): ts.Expression => {
  const descriptor = getToolDescriptor(host, node);

  const propertyLiterals: ts.ObjectLiteralElementLike[] = [];
  propertyLiterals.push(
    host.factory.createPropertyAssignment(
      "type",
      host.factory.createStringLiteral("function"),
    ),
  );
  propertyLiterals.push(
    host.factory.createPropertyAssignment(
      "function",
      valueToExpression(host, node, descriptor),
    ),
  );
  propertyLiterals.push(
    host.factory.createPropertyAssignment(
      "callable",
      host.factory.createIdentifier(descriptor.name),
    ),
  );

  return host.factory.createObjectLiteralExpression(propertyLiterals, true);
};

export { getToolDescriptor, getToolDescriptorExpression };
