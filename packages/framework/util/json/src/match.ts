import type { SchemaDefinition, Schema } from "./schema.ts";
import { isSubschema } from "./subschema.ts";
import { validate } from "./validate.ts";

const matchSchema: {
  (value: unknown, schema: Schema): Schema | undefined;
  (value: unknown, schema: SchemaDefinition): SchemaDefinition | undefined;
} = ((
  value: unknown,
  schema: SchemaDefinition,
): SchemaDefinition | undefined => {
  if (typeof schema === "boolean") {
    return schema ? schema : undefined;
  }

  if (schema.$ref !== undefined) {
    throw new Error("$ref is not supported");
  }

  if (schema.not !== undefined) {
    if (validate(value, schema.not)) {
      return undefined;
    }
  }

  if (schema.if !== undefined) {
    if (validate(value, schema.if)) {
      if (schema.then !== undefined) {
        return matchSchema(value, schema.then);
      }
    } else {
      if (schema.else !== undefined) {
        return matchSchema(value, schema.else);
      }
    }
  }

  if (schema.allOf !== undefined) {
    for (const subschema of schema.allOf) {
      if (!validate(value, subschema)) {
        return undefined;
      }
    }
    return schema;
  }

  if (schema.oneOf !== undefined) {
    const matchingSchemas = matchSchemas(value, schema.oneOf);
    if (matchingSchemas.length === 1) {
      return matchSchema(value, matchingSchemas[0]!);
    } else if (matchingSchemas.length > 1) {
      return schema;
    }
    return undefined;
  }

  if (schema.anyOf !== undefined) {
    const matchingSchemas = matchSchemas(value, schema.anyOf);
    if (matchingSchemas.length === 1) {
      const subschema = matchSchema(value, matchingSchemas[0]!);
      return schema.description === undefined || isSpecific(subschema) ?
          subschema
        : schema;
    } else if (matchingSchemas.length > 1) {
      return schema;
    }
    return undefined;
  }

  if (validate(value, schema)) {
    return schema;
  }

  return undefined;
}) as typeof matchSchema;

const matchSchemas: {
  (value: unknown, schemas: readonly Schema[]): Schema[];
  (value: unknown, schemas: readonly SchemaDefinition[]): SchemaDefinition[];
} = ((
  value: unknown,
  schemas: readonly SchemaDefinition[],
): SchemaDefinition[] => {
  const matchingSchemas = schemas.filter((schema) => validate(value, schema));
  if (matchingSchemas.length === 0) {
    return [];
  } else if (matchingSchemas.length === 1) {
    return matchingSchemas;
  }

  // Find any schemas that are subtypes of all other matching schemas.
  const bestSchemas = matchingSchemas.filter((candidateSchema) =>
    matchingSchemas.every(
      (otherSchema) =>
        candidateSchema === otherSchema ||
        isSubschema(candidateSchema, otherSchema),
    ),
  );
  return bestSchemas.length === 1 ? bestSchemas : matchingSchemas;
}) as typeof matchSchemas;

const isSpecific = (schema: SchemaDefinition | undefined): boolean => {
  if (schema === undefined || typeof schema === "boolean") {
    return false;
  } else if (schema.description !== undefined) {
    return true;
  } else if (schema.const !== undefined) {
    return false;
  }
  switch (schema.type) {
    case "void":
    case "undefined":
    case "null":
    case "boolean":
    case "integer":
    case "number":
    case "string":
      return false;
    default:
      return true;
  }
};

export { matchSchema, matchSchemas };
