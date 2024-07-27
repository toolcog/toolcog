import type ts from "typescript";
import type { Schema, SchemaDefinition } from "@toolcog/util/schema";
import { parseToolCommentForNode } from "./tool-comment.ts";
import { Diagnostics } from "./diagnostics.ts";
import { abort } from "./utils/errors.ts";

const typeToSchema = (
  ts: typeof import("typescript"),
  checker: ts.TypeChecker,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  type: ts.Type,
  description?: string | null,
  propertyDescriptions?: Record<string, string>,
  errorNode?: ts.Node,
): Schema => {
  if (description === undefined) {
    let typeDeclaration = type.getSymbol()?.declarations?.[0];
    if (typeDeclaration !== undefined) {
      description = parseToolCommentForNode(ts, typeDeclaration)?.description;
    }
    if (description === undefined) {
      typeDeclaration = type.getConstraint()?.getSymbol()?.declarations?.[0];
      if (typeDeclaration !== undefined) {
        description = parseToolCommentForNode(ts, typeDeclaration)?.description;
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
          parseToolCommentForNode(ts, propertyDeclaration)
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
        undefined,
        undefined,
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
