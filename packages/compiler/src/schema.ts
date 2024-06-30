import type ts from "typescript";
import type { Schema, SchemaDefinition } from "@toolcog/util/schema";
import type { ToolcogHost } from "./host.ts";
import { parseDocCommentNode } from "./doc-comment.ts";
import { Diagnostics } from "./diagnostics.ts";
import { abort } from "./utils/errors.ts";

const typeToSchema = (
  host: ToolcogHost,
  type: ts.Type,
  errorNode?: ts.Node,
  propertyComments?: Map<string, string>,
): Schema => {
  const typeSymbol = type.getSymbol();
  const typeDeclaration = typeSymbol?.declarations?.[0];
  const typeComment =
    typeDeclaration !== undefined ?
      parseDocCommentNode(host, typeDeclaration, { expansive: false })
    : undefined;
  const typeDescription =
    typeComment?.description !== undefined ?
      { description: typeComment.description }
    : undefined;

  if (type.isUnion()) {
    const variantSchemas: Schema[] = [];
    for (const variantType of type.types) {
      const variantSchema = typeToSchema(host, variantType, errorNode);
      if (variantSchema.type !== "undefined") {
        variantSchemas.push(variantSchema);
      }
    }
    if (variantSchemas.length === 1) {
      return variantSchemas[0]!;
    }
    return {
      anyOf: variantSchemas,
    };
  }

  if (type.isIntersection()) {
    const variantSchemas: Schema[] = [];
    for (const variantType of type.types) {
      const variantSchema = typeToSchema(host, variantType, errorNode);
      variantSchemas.push(variantSchema);
    }
    return {
      allOf: variantSchemas,
    };
  }

  if ((type.flags & host.ts.TypeFlags.Undefined) !== 0) {
    return {
      type: "undefined",
      ...typeDescription,
    } as unknown as Schema;
  }

  if ((type.flags & host.ts.TypeFlags.Null) !== 0) {
    return {
      type: "null",
      ...typeDescription,
    };
  }

  if ((type.flags & host.ts.TypeFlags.Boolean) !== 0) {
    return {
      type: "boolean",
      ...typeDescription,
    };
  }

  if ((type.flags & host.ts.TypeFlags.Number) !== 0) {
    return {
      type: "number",
      ...typeDescription,
    };
  }

  if ((type.flags & host.ts.TypeFlags.String) !== 0) {
    return {
      type: "string",
      ...typeDescription,
    };
  }

  if ((type.flags & host.ts.TypeFlags.BooleanLiteral) !== 0) {
    return {
      const: (type as ts.LiteralType & { intrinsicName: string }).intrinsicName,
      ...typeDescription,
    };
  }

  if ((type.flags & host.ts.TypeFlags.NumberLiteral) !== 0) {
    return {
      const: (type as ts.NumberLiteralType).value,
      ...typeDescription,
    };
  }

  if ((type.flags & host.ts.TypeFlags.StringLiteral) !== 0) {
    return {
      const: (type as ts.StringLiteralType).value,
      ...typeDescription,
    };
  }

  if ((type.flags & host.ts.TypeFlags.EnumLiteral) !== 0) {
    // TODO
  }

  if ((type.flags & host.ts.TypeFlags.Object) !== 0) {
    const objectType = type as ts.ObjectType;
    if ((objectType.objectFlags & host.ts.ObjectFlags.Reference) !== 0) {
      const typeSymbol = objectType.getSymbol();
      const typeName =
        typeSymbol !== undefined ?
          host.checker.getFullyQualifiedName(typeSymbol)
        : undefined;

      if (typeName === "Array") {
        return {
          type: "array",
          ...typeDescription,
          items: typeToSchema(
            host,
            (objectType as ts.TypeReference).typeArguments![0]!,
            errorNode,
          ),
        };
      } else if (typeName === "Set") {
        return {
          type: "array",
          ...typeDescription,
          items: typeToSchema(
            host,
            (objectType as ts.TypeReference).typeArguments![0]!,
            errorNode,
          ),
        };
      } else if (typeName === "Map") {
        return {
          type: "object",
          ...typeDescription,
          additionalProperties: typeToSchema(
            host,
            (objectType as ts.TypeReference).typeArguments![1]!,
            errorNode,
          ),
        };
      }
    }

    const properties: { [key: string]: SchemaDefinition } = {};
    const required: string[] = [];

    const propertySymbols = host.checker.getPropertiesOfType(objectType);
    for (const propertySymbol of propertySymbols) {
      const propertyName = propertySymbol.getName();
      const propertyType = host.checker.getTypeOfSymbolAtLocation(
        propertySymbol,
        propertySymbol.valueDeclaration!,
      );

      const propertyDeclaration = propertySymbol.declarations?.[0];
      const propertyComment =
        propertyDeclaration !== undefined ?
          parseDocCommentNode(host, propertyDeclaration, { expansive: false })
        : undefined;
      const propertyDescription =
        propertyComment?.description ?? propertyComments?.get(propertyName);

      const propertySchema = {
        ...typeToSchema(host, propertyType, errorNode),
        ...(propertyDescription !== undefined ?
          { description: propertyDescription }
        : undefined),
      };

      properties[propertyName] = propertySchema;
      if ((propertySymbol.flags & host.ts.SymbolFlags.Optional) === 0) {
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
    (type.flags & host.ts.TypeFlags.Any) !== 0 ||
    (type.flags & host.ts.TypeFlags.Unknown) !== 0
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

  return abort(
    host,
    errorNode,
    Diagnostics.UnableToConstructSchemaForType,
    host.checker.typeToString(type),
  );
};

export { typeToSchema };
