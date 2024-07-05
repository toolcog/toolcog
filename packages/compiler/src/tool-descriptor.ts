import type ts from "typescript";
import type { Schema, SchemaDefinition } from "@toolcog/util/schema";
import type { FunctionDescriptor } from "@toolcog/core";
import { Diagnostics } from "./diagnostics.ts";
import { typeToSchema } from "./schema.ts";
import { getDocComment } from "./doc-comment.ts";
import { error, abort } from "./utils/errors.ts";
import { valueToExpression } from "./utils/literals.ts";

const getToolDescriptor = (
  ts: typeof import("typescript"),
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  node: ts.Node,
): FunctionDescriptor => {
  const docComment = getDocComment(ts, checker, node);
  if (docComment === undefined) {
    error(ts, addDiagnostic, node, Diagnostics.MissingToolComment);
  }

  let toolName: string;
  let toolDeclaration: ts.Declaration | undefined;
  if (ts.isIdentifier(node)) {
    const symbol = checker.getSymbolAtLocation(node);
    ts.Debug.assert(symbol !== undefined);
    const declaration = symbol.declarations?.[0];
    ts.Debug.assert(declaration !== undefined);
    toolName = node.text;
    toolDeclaration = declaration;
  } else if (ts.isDeclarationStatement(node)) {
    const declarationName = ts.getNameOfDeclaration(node);
    if (
      declarationName === undefined ||
      (!ts.isIdentifier(declarationName) &&
        !ts.isPrivateIdentifier(declarationName))
    ) {
      return abort(
        ts,
        addDiagnostic,
        node,
        Diagnostics.UnableToDetermineToolName,
      );
    }
    toolName = ts.idText(declarationName);
    toolDeclaration = node;
  } else {
    return abort(
      ts,
      addDiagnostic,
      node,
      Diagnostics.UnsupportedToolExpression,
    );
  }

  const functionType = checker.getTypeAtLocation(toolDeclaration);
  const [functionSignature] = functionType.getCallSignatures();
  ts.Debug.assert(functionSignature !== undefined);

  const parameterSchemas: { [key: string]: SchemaDefinition } = {};
  const requiredParameters: string[] = [];

  for (const parameter of functionSignature.parameters) {
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
      !ts.isParameter(parameterDeclaration) ||
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

  const returnType = checker.getAwaitedType(functionSignature.getReturnType());
  ts.Debug.assert(returnType !== undefined);

  let returnSchema = typeToSchema(
    ts,
    checker,
    addDiagnostic,
    returnType,
    toolDeclaration,
  );
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
  ts: typeof import("typescript"),
  factory: ts.NodeFactory,
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  node: ts.Node,
): ts.Expression => {
  const descriptor = getToolDescriptor(ts, checker, addDiagnostic, node);

  const propertyLiterals: ts.ObjectLiteralElementLike[] = [];
  propertyLiterals.push(
    factory.createPropertyAssignment(
      "type",
      factory.createStringLiteral("function"),
    ),
  );
  propertyLiterals.push(
    factory.createPropertyAssignment(
      "function",
      valueToExpression(ts, factory, node, descriptor),
    ),
  );
  propertyLiterals.push(
    factory.createPropertyAssignment(
      "callable",
      factory.createIdentifier(descriptor.name),
    ),
  );

  return factory.createObjectLiteralExpression(propertyLiterals, true);
};

export { getToolDescriptor, getToolDescriptorExpression };
