import type ts from "typescript";
import type { Schema, SchemaDefinition } from "@toolcog/util/schema";
import type { ToolDescriptor } from "@toolcog/core";
import { Diagnostics } from "./diagnostics.ts";
import { typeToSchema } from "./type-to-schema.ts";
import type { ToolComment } from "./tool-comment.ts";
import { getToolComment } from "./tool-comment.ts";
import { error, abort } from "./utils/errors.ts";

const getToolDescriptorForCall = (
  ts: typeof import("typescript"),
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  argumentsExpression: ts.Expression | undefined,
  returnType: ts.Type | undefined,
  toolName?: ts.DeclarationName | ts.PropertyName | undefined,
  toolComment?: ToolComment,
  errorNode?: ts.Node,
): ToolDescriptor => {
  let parametersSchema: Schema | undefined;
  if (argumentsExpression !== undefined) {
    const argumentsType = checker.getTypeAtLocation(argumentsExpression);
    parametersSchema = typeToSchema(
      ts,
      checker,
      addDiagnostic,
      argumentsType,
      null,
      toolComment?.params,
      argumentsExpression,
    );
  }

  let returnSchema: Schema | undefined;
  if (returnType !== undefined) {
    returnSchema = typeToSchema(
      ts,
      checker,
      addDiagnostic,
      returnType,
      toolComment?.returns,
      undefined,
      errorNode,
    );
  }

  return {
    ...(toolName !== undefined && ts.isIdentifier(toolName) ?
      { name: toolName.text }
    : undefined),
    ...(toolComment?.description !== undefined ?
      { description: toolComment.description }
    : undefined),
    ...(parametersSchema !== undefined ?
      { parameters: parametersSchema }
    : undefined),
    ...(returnSchema !== undefined ? { return: returnSchema } : undefined),
  };
};

const getToolDescriptorForSignature = (
  ts: typeof import("typescript"),
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  toolSignature: ts.Signature,
  toolName?: ts.DeclarationName | ts.PropertyName,
  toolComment?: ToolComment,
  errorNode?: ts.Node,
): ToolDescriptor => {
  if (toolComment === undefined) {
    error(ts, addDiagnostic, errorNode, Diagnostics.MissingToolComment);
  }

  const parameterSchemas: { [key: string]: SchemaDefinition } = {};
  const requiredParameters: string[] = [];

  for (const parameter of toolSignature.parameters) {
    const parameterDeclaration = parameter.valueDeclaration!;
    const parameterType = checker.getTypeOfSymbolAtLocation(
      parameter,
      parameterDeclaration,
    );
    let parameterSchema = typeToSchema(
      ts,
      checker,
      addDiagnostic,
      parameterType,
      toolComment?.params[parameter.name],
      undefined,
      parameterDeclaration,
    );
    if (parameterSchema.description === undefined) {
      const description = toolComment?.params[parameter.name];
      if (description !== undefined) {
        parameterSchema = { ...parameterSchema, description };
      }
    }

    parameterSchemas[parameter.name] = parameterSchema;
    if (
      !ts.isParameter(parameterDeclaration) ||
      (parameterDeclaration.questionToken === undefined &&
        parameterDeclaration.initializer === undefined)
    ) {
      requiredParameters.push(parameter.name);
    }
  }

  let parametersSchema: Schema | undefined;
  if (toolSignature.parameters.length !== 0) {
    parametersSchema = {
      type: "object",
      properties: parameterSchemas,
      ...(requiredParameters.length !== 0 ?
        { required: requiredParameters }
      : undefined),
    };
  }

  const returnType = checker.getAwaitedType(toolSignature.getReturnType());
  ts.Debug.assert(returnType !== undefined);

  let returnSchema = typeToSchema(
    ts,
    checker,
    addDiagnostic,
    returnType,
    toolComment?.returns,
    undefined,
    errorNode,
  );
  if (returnSchema.description === undefined) {
    const description = toolComment?.returns;
    if (description !== undefined) {
      returnSchema = { ...returnSchema, description };
    }
  }

  return {
    ...(toolName !== undefined && ts.isIdentifier(toolName) ?
      { name: toolName.text }
    : undefined),
    ...(toolComment?.description !== undefined ?
      { description: toolComment.description }
    : undefined),
    ...(parametersSchema !== undefined ?
      { parameters: parametersSchema }
    : undefined),
    return: returnSchema,
  };
};

const getToolDescriptorForNode = (
  ts: typeof import("typescript"),
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  node: ts.Node,
  toolName?: ts.DeclarationName | ts.PropertyName,
): ToolDescriptor => {
  let toolDeclaration: ts.Declaration | undefined;
  if (ts.isIdentifier(node)) {
    const symbol = checker.getSymbolAtLocation(node);
    ts.Debug.assert(symbol !== undefined);
    const declaration = symbol.declarations?.[0];
    ts.Debug.assert(declaration !== undefined);
    if (toolName === undefined) {
      toolName = node;
    }
    toolDeclaration = declaration;
  } else if (
    ts.isDeclarationStatement(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node)
  ) {
    if (toolName === undefined) {
      toolName = ts.getNameOfDeclaration(node);
    }
    toolDeclaration = node;
  } else {
    return abort(
      ts,
      addDiagnostic,
      node,
      Diagnostics.UnableToStaticallyAnalyzeSyntax,
      ts.SyntaxKind[node.kind],
    );
  }

  const functionType = checker.getTypeAtLocation(toolDeclaration);
  const functionSignature = functionType.getCallSignatures()[0];
  ts.Debug.assert(functionSignature !== undefined);

  const toolComment = getToolComment(ts, checker, node);

  return getToolDescriptorForSignature(
    ts,
    checker,
    addDiagnostic,
    functionSignature,
    toolName,
    toolComment,
    node,
  );
};

export {
  getToolDescriptorForCall,
  getToolDescriptorForSignature,
  getToolDescriptorForNode,
};
