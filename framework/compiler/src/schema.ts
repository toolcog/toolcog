import type ts from "typescript";
import type {
  SchemaDefinition,
  Schema,
  FunctionSchema,
} from "@toolcog/util/json";
import { abort } from "./utils/errors.ts";
import { Diagnostics } from "./diagnostics.ts";
import type { Comment } from "./comment.ts";
import { getCommentForNode, getComment } from "./comment.ts";

const typeToSchema = (
  ts: typeof import("typescript"),
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  type: ts.Type,
  description: string | null | undefined,
  propertyDescriptions: Record<string, string> | undefined,
  errorNode: ts.Node | undefined,
): Schema => {
  if (description === undefined) {
    let typeDeclaration = type.getSymbol()?.declarations?.[0];
    if (typeDeclaration !== undefined) {
      description = getCommentForNode(ts, typeDeclaration)?.description;
    }
    if (description === undefined) {
      typeDeclaration = type.getConstraint()?.getSymbol()?.declarations?.[0];
      if (typeDeclaration !== undefined) {
        description = getCommentForNode(ts, typeDeclaration)?.description;
      }
    }
  } else if (description === null) {
    description = undefined;
  }

  type = checker.getBaseConstraintOfType(type) ?? type;

  if ((type.flags & ts.TypeFlags.Void) !== 0) {
    return {
      type: "void",
      ...(description !== undefined ? { description } : undefined),
    } as unknown as Schema;
  }

  if ((type.flags & ts.TypeFlags.Undefined) !== 0) {
    return {
      type: "undefined",
      ...(description !== undefined ? { description } : undefined),
    } as unknown as Schema;
  }

  if ((type.flags & ts.TypeFlags.Null) !== 0) {
    return {
      type: "null",
      ...(description !== undefined ? { description } : undefined),
    };
  }

  if ((type.flags & ts.TypeFlags.Boolean) !== 0) {
    return {
      type: "boolean",
      ...(description !== undefined ? { description } : undefined),
    };
  }

  if ((type.flags & ts.TypeFlags.Number) !== 0) {
    return {
      type: "number",
      ...(description !== undefined ? { description } : undefined),
    };
  }

  if ((type.flags & ts.TypeFlags.String) !== 0) {
    return {
      type: "string",
      ...(description !== undefined ? { description } : undefined),
    };
  }

  if ((type.flags & ts.TypeFlags.BooleanLiteral) !== 0) {
    return {
      const: (type as ts.LiteralType & { intrinsicName: string }).intrinsicName,
      ...(description !== undefined ? { description } : undefined),
    };
  }

  if ((type.flags & ts.TypeFlags.NumberLiteral) !== 0) {
    return {
      const: (type as ts.NumberLiteralType).value,
      ...(description !== undefined ? { description } : undefined),
    };
  }

  if ((type.flags & ts.TypeFlags.StringLiteral) !== 0) {
    return {
      const: (type as ts.StringLiteralType).value,
      ...(description !== undefined ? { description } : undefined),
    };
  }

  if ((type.flags & ts.TypeFlags.EnumLiteral) !== 0) {
    const enumType = checker.getBaseTypeOfLiteralType(type);
    const enumSymbol = enumType.symbol;

    const enumDeclaration = enumSymbol.declarations?.[0];
    ts.Debug.assert(enumDeclaration !== undefined);
    ts.Debug.assert(ts.isEnumDeclaration(enumDeclaration));

    const memberSchemas: Schema[] = [];
    for (const memberDeclaration of enumDeclaration.members) {
      const memberType = checker.getTypeAtLocation(memberDeclaration);
      const memberComment = getComment(
        ts,
        checker,
        memberDeclaration,
        memberType,
      );
      const memberSchema = typeToSchema(
        ts,
        checker,
        addDiagnostic,
        memberType,
        memberComment?.description,
        undefined,
        errorNode,
      );
      memberSchemas.push(memberSchema);
    }

    return {
      anyOf: memberSchemas,
      ...(description !== undefined ? { description } : undefined),
    };
  }

  if ((type.flags & ts.TypeFlags.Object) !== 0) {
    const objectType = type as ts.ObjectType;
    if ((objectType.objectFlags & ts.ObjectFlags.Reference) !== 0) {
      const objectTypeSymbol = objectType.getSymbol();
      const typeName =
        objectTypeSymbol !== undefined ?
          checker.getFullyQualifiedName(objectTypeSymbol)
        : undefined;

      if (typeName === "Array") {
        return {
          type: "array",
          ...(description !== undefined ? { description } : undefined),
          items: typeToSchema(
            ts,
            checker,
            addDiagnostic,
            (objectType as ts.TypeReference).typeArguments![0]!,
            undefined,
            undefined,
            errorNode,
          ),
        };
      } else if (typeName === "Set") {
        return {
          type: "array",
          ...(description !== undefined ? { description } : undefined),
          items: typeToSchema(
            ts,
            checker,
            addDiagnostic,
            (objectType as ts.TypeReference).typeArguments![0]!,
            undefined,
            undefined,
            errorNode,
          ),
        };
      } else if (typeName === "Map") {
        return {
          type: "object",
          ...(description !== undefined ? { description } : undefined),
          additionalProperties: typeToSchema(
            ts,
            checker,
            addDiagnostic,
            (objectType as ts.TypeReference).typeArguments![1]!,
            undefined,
            undefined,
            errorNode,
          ),
        };
      }
    }

    const properties: { [key: string]: SchemaDefinition } = {};
    const required: string[] = [];

    const propertySymbols = checker.getPropertiesOfType(objectType);
    for (const propertySymbol of propertySymbols) {
      const propertyName = propertySymbol.getName();
      const propertyType = checker.getTypeOfSymbolAtLocation(
        propertySymbol,
        propertySymbol.valueDeclaration!,
      );

      const propertyDeclaration = propertySymbol.declarations?.[0];
      const propertyComment =
        propertyDeclaration !== undefined ?
          getComment(ts, checker, propertyDeclaration, propertyType)
        : undefined;
      const propertyDescription =
        propertyComment?.description ?? propertyDescriptions?.[propertyName];

      const propertySchema = typeToSchema(
        ts,
        checker,
        addDiagnostic,
        propertyType,
        propertyDescription,
        undefined,
        errorNode,
      );

      properties[propertyName] = propertySchema;
      if ((propertySymbol.flags & ts.SymbolFlags.Optional) === 0) {
        required.push(propertyName);
      }
    }

    return {
      type: "object",
      ...(description !== undefined ? { description } : undefined),
      properties,
      ...(required.length !== 0 ? { required } : undefined),
    };
  }

  if (
    (type.flags & ts.TypeFlags.Any) !== 0 ||
    (type.flags & ts.TypeFlags.Unknown) !== 0
  ) {
    return {
      type: [
        "null",
        "boolean",
        "number",
        "string",
        //"array",
        "object",
      ],
      ...(description !== undefined ? { description } : undefined),
    };
  }

  if (type.isUnion()) {
    const memberSchemas: Schema[] = [];
    for (const memberType of type.types) {
      const memberSchema = typeToSchema(
        ts,
        checker,
        addDiagnostic,
        memberType,
        undefined,
        undefined,
        errorNode,
      );
      if (memberSchema.type !== "undefined") {
        memberSchemas.push(memberSchema);
      }
    }
    if (memberSchemas.length === 1) {
      return {
        ...memberSchemas[0]!,
        ...(description !== undefined ? { description } : undefined),
      };
    }
    return {
      anyOf: memberSchemas,
      ...(description !== undefined ? { description } : undefined),
    };
  }

  if (type.isIntersection()) {
    const memberSchemas: Schema[] = [];
    for (const memberType of type.types) {
      const memberSchema = typeToSchema(
        ts,
        checker,
        addDiagnostic,
        memberType,
        undefined,
        undefined,
        errorNode,
      );
      memberSchemas.push(memberSchema);
    }
    return {
      allOf: memberSchemas,
      ...(description !== undefined ? { description } : undefined),
    };
  }

  return abort(
    ts,
    addDiagnostic,
    errorNode,
    Diagnostics.CannotDeriveSchemaForType,
    checker.typeToString(type),
  );
};

const signatureToSchema = (
  ts: typeof import("typescript"),
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  signature: ts.Signature,
  name: string | undefined,
  comment: Comment | undefined,
  errorNode: ts.Node | undefined,
): FunctionSchema => {
  const parameterSchemas: { [key: string]: SchemaDefinition } = {};
  const requiredParameters: string[] = [];

  for (const parameter of signature.parameters) {
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
      comment?.params[parameter.name],
      undefined,
      parameterDeclaration,
    );
    if (parameterSchema.description === undefined) {
      const description = comment?.params[parameter.name];
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
  if (signature.parameters.length !== 0) {
    parametersSchema = {
      type: "object",
      properties: parameterSchemas,
      ...(requiredParameters.length !== 0 ?
        { required: requiredParameters }
      : undefined),
    };
  }

  const returnType = checker.getAwaitedType(signature.getReturnType());
  ts.Debug.assert(returnType !== undefined);

  let returnSchema = typeToSchema(
    ts,
    checker,
    addDiagnostic,
    returnType,
    comment?.returns,
    undefined,
    errorNode,
  );
  if (returnSchema.description === undefined) {
    const description = comment?.returns;
    if (description !== undefined) {
      returnSchema = { ...returnSchema, description };
    }
  }

  return {
    ...(name !== undefined ? { name } : undefined),
    ...(comment?.description !== undefined ?
      { description: comment.description }
    : undefined),
    ...(parametersSchema !== undefined ?
      { parameters: parametersSchema }
    : undefined),
    returns: returnSchema,
  };
};

const callSiteToSchema = (
  ts: typeof import("typescript"),
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  argumentsExpression: ts.Expression | undefined,
  returnType: ts.Type | undefined,
  name: string | undefined,
  comment: Comment | undefined,
  errorNode: ts.Node | undefined,
): FunctionSchema => {
  let parametersSchema: Schema | undefined;
  if (argumentsExpression !== undefined) {
    const argumentsType = checker.getTypeAtLocation(argumentsExpression);
    parametersSchema = typeToSchema(
      ts,
      checker,
      addDiagnostic,
      argumentsType,
      null,
      comment?.params,
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
      comment?.returns,
      undefined,
      errorNode,
    );
  }

  return {
    ...(name !== undefined ? { name } : undefined),
    ...(comment?.description !== undefined ?
      { description: comment.description }
    : undefined),
    ...(parametersSchema !== undefined ?
      { parameters: parametersSchema }
    : undefined),
    ...(returnSchema !== undefined ? { return: returnSchema } : undefined),
  };
};

export { typeToSchema, signatureToSchema, callSiteToSchema };
