import type ts from "typescript";
import type {
  SchemaType,
  SchemaDefinition,
  Schema,
  FunctionSchema,
} from "@toolcog/util/json";
import { abort } from "./utils/errors.ts";
import { expressionToValue } from "./utils/literals.ts";
import { Diagnostics } from "./diagnostics.ts";
import type { Comment } from "./comment.ts";
import { getCommentForNode, getComment } from "./comment.ts";

const typeToSchema = (
  ts: typeof import("typescript"),
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  type: ts.Type,
  comment: Comment | undefined,
  title: string | null | undefined,
  description: string | null | undefined,
  errorNode: ts.Node | undefined,
): Schema => {
  if (title === undefined) {
    let typeSymbol = type.getSymbol();
    if (typeSymbol !== undefined) {
      title = typeSymbol.getName();
    }
    if (title === undefined) {
      typeSymbol = type.getConstraint()?.getSymbol();
      if (typeSymbol !== undefined) {
        title = typeSymbol.getName();
      }
    }
  }
  if (title === null) {
    title = undefined;
  }

  if (comment === undefined) {
    let typeDeclaration = type.getSymbol()?.declarations?.[0];
    if (typeDeclaration !== undefined) {
      comment = getCommentForNode(ts, typeDeclaration);
    }
    if (comment === undefined) {
      typeDeclaration = type.getConstraint()?.getSymbol()?.declarations?.[0];
      if (typeDeclaration !== undefined) {
        comment = getCommentForNode(ts, typeDeclaration);
      }
    }
    if (description === undefined) {
      description = comment?.description;
    }
  }
  if (description === null) {
    description = undefined;
  }

  type = checker.getBaseConstraintOfType(type) ?? type;

  if ((type.flags & ts.TypeFlags.Void) !== 0) {
    if (description === undefined && comment?.constants !== undefined) {
      description = comment.constants.void;
    }
    return {
      ...(description !== undefined ? { description } : undefined),
      type: "void",
    } as unknown as Schema;
  }

  if ((type.flags & ts.TypeFlags.Undefined) !== 0) {
    if (description === undefined && comment?.constants !== undefined) {
      description = comment.constants.undefined;
    }
    return {
      ...(description !== undefined ? { description } : undefined),
      type: "undefined",
    } as unknown as Schema;
  }

  if ((type.flags & ts.TypeFlags.Null) !== 0) {
    if (description === undefined && comment?.constants !== undefined) {
      description = comment.constants.null;
    }
    return {
      ...(description !== undefined ? { description } : undefined),
      type: "null",
    };
  }

  if ((type.flags & ts.TypeFlags.BooleanLiteral) !== 0) {
    const value = (type as ts.IntrinsicType).intrinsicName === "true";
    if (description === undefined && comment?.constants !== undefined) {
      description = comment.constants[String(value)];
    }
    return {
      ...(description !== undefined ? { description } : undefined),
      const: value,
    };
  }

  if ((type.flags & ts.TypeFlags.NumberLiteral) !== 0) {
    const value = (type as ts.NumberLiteralType).value;
    if (description === undefined && comment?.constants !== undefined) {
      description = comment.constants[String(value)];
    }
    return {
      ...(description !== undefined ? { description } : undefined),
      const: value,
    };
  }

  if ((type.flags & ts.TypeFlags.StringLiteral) !== 0) {
    const value = (type as ts.StringLiteralType).value;
    if (description === undefined && comment?.constants !== undefined) {
      description = comment.constants[value];
    }
    return {
      ...(description !== undefined ? { description } : undefined),
      const: value,
    };
  }

  if ((type.flags & ts.TypeFlags.Boolean) !== 0) {
    return {
      ...(description !== undefined ? { description } : undefined),
      type: "boolean",
    };
  }

  if ((type.flags & ts.TypeFlags.Number) !== 0) {
    return {
      ...(description !== undefined ? { description } : undefined),
      type: "number",
    };
  }

  if ((type.flags & ts.TypeFlags.String) !== 0) {
    return {
      ...(description !== undefined ? { description } : undefined),
      type: "string",
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
        memberComment,
        undefined,
        memberComment?.description,
        errorNode,
      );
      memberSchemas.push(memberSchema);
    }

    return {
      ...(title !== undefined ? { title } : undefined),
      ...(description !== undefined ? { description } : undefined),
      anyOf: memberSchemas,
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
          ...(description !== undefined ? { description } : undefined),
          type: "array",
          items: typeToSchema(
            ts,
            checker,
            addDiagnostic,
            (objectType as ts.TypeReference).typeArguments![0]!,
            undefined,
            undefined,
            undefined,
            errorNode,
          ),
        };
      } else if (typeName === "Set") {
        return {
          ...(description !== undefined ? { description } : undefined),
          type: "array",
          items: typeToSchema(
            ts,
            checker,
            addDiagnostic,
            (objectType as ts.TypeReference).typeArguments![0]!,
            undefined,
            undefined,
            undefined,
            errorNode,
          ),
        };
      } else if (typeName === "Map") {
        return {
          ...(description !== undefined ? { description } : undefined),
          type: "object",
          additionalProperties: typeToSchema(
            ts,
            checker,
            addDiagnostic,
            (objectType as ts.TypeReference).typeArguments![1]!,
            undefined,
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
        propertyComment?.description ?? comment?.params[propertyName];

      let propertySchema = typeToSchema(
        ts,
        checker,
        addDiagnostic,
        propertyType,
        propertyComment,
        undefined,
        propertyDescription,
        errorNode,
      );
      if (propertyComment?.tags.default !== undefined) {
        let propertyDefault: unknown;
        try {
          propertyDefault = JSON.parse(propertyComment.tags.default);
        } catch {
          propertyDefault = propertyComment.tags.default;
        }
        propertySchema = {
          ...propertySchema,
          default: propertyDefault as SchemaType,
        };
      }

      properties[propertyName] = propertySchema;
      if ((propertySymbol.flags & ts.SymbolFlags.Optional) === 0) {
        required.push(propertyName);
      }
    }

    return {
      ...(title !== undefined ? { title } : undefined),
      ...(description !== undefined ? { description } : undefined),
      type: "object",
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
        comment,
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
        ...(title !== undefined ? { title } : undefined),
        ...(description !== undefined ? { description } : undefined),
        ...memberSchemas[0]!,
      };
    }
    return {
      ...(title !== undefined ? { title } : undefined),
      ...(description !== undefined ? { description } : undefined),
      anyOf: memberSchemas,
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
        comment,
        undefined,
        undefined,
        errorNode,
      );
      memberSchemas.push(memberSchema);
    }
    return {
      ...(title !== undefined ? { title } : undefined),
      ...(description !== undefined ? { description } : undefined),
      allOf: memberSchemas,
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
    const parameterDeclaration =
      parameter.valueDeclaration as ts.ParameterDeclaration;
    const parameterType = checker.getTypeOfSymbolAtLocation(
      parameter,
      parameterDeclaration,
    );
    let parameterSchema = typeToSchema(
      ts,
      checker,
      addDiagnostic,
      parameterType,
      comment,
      undefined,
      comment?.params[parameter.name],
      parameterDeclaration,
    );
    if (parameterDeclaration.initializer !== undefined) {
      try {
        parameterSchema = {
          ...parameterSchema,
          default: expressionToValue(
            ts,
            parameterDeclaration.initializer,
          ) as SchemaType,
        };
      } catch {
        // nop
      }
    }
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
    comment,
    undefined,
    comment?.returns,
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
      comment,
      undefined,
      null,
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
      comment,
      undefined,
      comment?.returns,
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
