import type { SchemaDefinition } from "./schema.ts";
import { isSubtype } from "./subtype.ts";
import { validate } from "./validate.ts";

const narrowSchema = (
  value: unknown,
  schema: SchemaDefinition,
): SchemaDefinition => {
  if (typeof schema === "boolean") {
    return schema;
  }

  if (schema.$ref !== undefined) {
    return schema;
  }

  if (schema.if !== undefined) {
    if (validate(value, schema.if)) {
      if (schema.then !== undefined) {
        return narrowSchema(value, schema.then);
      }
    } else {
      if (schema.else !== undefined) {
        return narrowSchema(value, schema.else);
      }
    }
  }

  if (schema.oneOf !== undefined) {
    const subschemas = narrowSchemas(value, schema.oneOf);
    if (subschemas.length === 1) {
      return narrowSchema(value, subschemas[0]!);
    }
    return {
      ...schema,
      oneOf: subschemas.map(narrowSchema.bind(undefined, value)),
    };
  }

  if (schema.anyOf !== undefined) {
    const subschemas = narrowSchemas(value, schema.anyOf);
    if (subschemas.length === 1) {
      const subschema = narrowSchema(value, subschemas[0]!);
      if (typeof subschema === "object" && schema.description !== undefined) {
        return {
          description: schema.description,
          ...subschema,
        };
      }
      return subschema;
    }
    return {
      ...schema,
      anyOf: subschemas.map(narrowSchema.bind(undefined, value)),
    };
  }

  return schema;
};

const narrowSchemas = (
  value: unknown,
  schemas: readonly SchemaDefinition[],
): readonly SchemaDefinition[] => {
  const validSchemas = schemas.filter((schema) => validate(value, schema));
  if (validSchemas.length <= 1) {
    return validSchemas;
  }

  // Look for a schema that is a subtype of every other valid schema.
  const bestSchemas = validSchemas.filter((candidateSchema) =>
    validSchemas.every(
      (otherSchema) =>
        candidateSchema === otherSchema ||
        isSubtype(candidateSchema, otherSchema),
    ),
  );
  return bestSchemas.length === 1 ? bestSchemas : validSchemas;
};

export { narrowSchema, narrowSchemas };
