import type ts from "typescript";
import type { Schema, SchemaDefinition } from "@toolcog/util/schema";
import { parseDocCommentNode } from "./doc-comment.ts";
import { Diagnostics } from "./diagnostics.ts";
import { abort } from "./utils/errors.ts";

const getSymbolDescription = (
  ts: typeof import("typescript"),
  symbol: ts.Symbol | undefined,
): { description: string } | undefined => {
  const declaration = symbol?.declarations?.[0];
  const comment =
    declaration !== undefined ?
      parseDocCommentNode(ts, declaration, { expansive: false })
    : undefined;
  return comment?.description !== undefined ?
      { description: comment.description }
    : undefined;
};

const getTypeDescription = (
  ts: typeof import("typescript"),
  type: ts.Type | undefined,
): { description: string } | undefined => {
  let typeDescription = getSymbolDescription(ts, type?.getSymbol());

  if (type !== undefined && typeDescription === undefined) {
    const constraintType = type.getConstraint();
    typeDescription = getSymbolDescription(ts, constraintType?.getSymbol());
  }

  return typeDescription;
};

const typeToSchema = (
  ts: typeof import("typescript"),
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  type: ts.Type,
  errorNode?: ts.Node,
  propertyComments?: Map<string, string>,
): Schema => {
  const typeDescription = getTypeDescription(ts, type);

  type = checker.getBaseConstraintOfType(type) ?? type;

  if ((type.flags & ts.TypeFlags.Void) !== 0) {
    return {
      type: "void",
      ...typeDescription,
    } as unknown as Schema;
  }

  if ((type.flags & ts.TypeFlags.Undefined) !== 0) {
    return {
      type: "undefined",
      ...typeDescription,
    } as unknown as Schema;
  }

  if ((type.flags & ts.TypeFlags.Null) !== 0) {
    return {
      type: "null",
      ...typeDescription,
    };
  }

  if ((type.flags & ts.TypeFlags.Boolean) !== 0) {
    return {
      type: "boolean",
      ...typeDescription,
    };
  }

  if ((type.flags & ts.TypeFlags.Number) !== 0) {
    return {
      type: "number",
      ...typeDescription,
    };
  }

  if ((type.flags & ts.TypeFlags.String) !== 0) {
    return {
      type: "string",
      ...typeDescription,
    };
  }

  if ((type.flags & ts.TypeFlags.BooleanLiteral) !== 0) {
    return {
      const: (type as ts.LiteralType & { intrinsicName: string }).intrinsicName,
      ...typeDescription,
    };
  }

  if ((type.flags & ts.TypeFlags.NumberLiteral) !== 0) {
    return {
      const: (type as ts.NumberLiteralType).value,
      ...typeDescription,
    };
  }

  if ((type.flags & ts.TypeFlags.StringLiteral) !== 0) {
    return {
      const: (type as ts.StringLiteralType).value,
      ...typeDescription,
    };
  }

  if ((type.flags & ts.TypeFlags.EnumLiteral) !== 0) {
    // TODO
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
          ...typeDescription,
          items: typeToSchema(
            ts,
            checker,
            addDiagnostic,
            (objectType as ts.TypeReference).typeArguments![0]!,
            errorNode,
          ),
        };
      } else if (typeName === "Set") {
        return {
          type: "array",
          ...typeDescription,
          items: typeToSchema(
            ts,
            checker,
            addDiagnostic,
            (objectType as ts.TypeReference).typeArguments![0]!,
            errorNode,
          ),
        };
      } else if (typeName === "Map") {
        return {
          type: "object",
          ...typeDescription,
          additionalProperties: typeToSchema(
            ts,
            checker,
            addDiagnostic,
            (objectType as ts.TypeReference).typeArguments![1]!,
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
          parseDocCommentNode(ts, propertyDeclaration, {
            expansive: false,
          })
        : undefined;
      const propertyDescription =
        propertyComment?.description ?? propertyComments?.get(propertyName);

      const propertySchema = {
        ...typeToSchema(ts, checker, addDiagnostic, propertyType, errorNode),
        ...(propertyDescription !== undefined ?
          { description: propertyDescription }
        : undefined),
      };

      properties[propertyName] = propertySchema;
      if ((propertySymbol.flags & ts.SymbolFlags.Optional) === 0) {
        required.push(propertyName);
      }
    }

    return {
      type: "object",
      ...typeDescription,
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
        errorNode,
      );
      if (memberSchema.type !== "undefined") {
        memberSchemas.push(memberSchema);
      }
    }
    if (memberSchemas.length === 1) {
      return memberSchemas[0]!;
    }
    return {
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
        errorNode,
      );
      memberSchemas.push(memberSchema);
    }
    return {
      allOf: memberSchemas,
    };
  }

  return abort(
    ts,
    addDiagnostic,
    errorNode,
    Diagnostics.UnableToConstructSchemaForType,
    checker.typeToString(type),
  );
};

export { typeToSchema };
