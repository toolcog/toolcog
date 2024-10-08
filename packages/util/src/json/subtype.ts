import { deepEqual } from "@toolcog/util";
import type { SchemaTypeName, SchemaDefinition, Schema } from "./schema.ts";

const isSubtype = (
  subschema: SchemaDefinition,
  superSchema: SchemaDefinition,
): boolean => {
  if (typeof subschema === "boolean") {
    if (typeof superSchema === "boolean") {
      // `false` is subtype of `false` and `true`.
      // `true` is subtype of `true` only.
      return !subschema || superSchema;
    } else {
      // `subschema` is a boolean, `superSchema` is an object.
      // `false` (rejects all values) is a subtype of any schema.
      // `true` (accepts all values) is only a subtype of `true` schemas.
      return !subschema;
    }
  } else if (typeof superSchema === "boolean") {
    // `subschema` is an object, `superSchema` is a boolean.
    // Any schema is subtype of `true`.
    // No schema is subtype of `false`.
    return superSchema;
  }

  if (subschema.$ref !== undefined || superSchema.$ref !== undefined) {
    throw new Error("$ref is not supported");
  }

  if (subschema.not !== undefined) {
    if (superSchema.not !== undefined) {
      // For `subschema` to be a subtype of `superSchema`,
      // `superSchema.not` must be a subtype of `subschema.not`.
      return isSubtype(superSchema.not, subschema.not);
    } else {
      // `subschema` rejects certain values that `superSchema` may accept.
      return true;
    }
  }

  if (superSchema.not !== undefined) {
    // For `subschema` to be a subtype of `superSchema`,
    // `subschema` must not accept any values that `superSchema` rejects.
    if (!areDisjoint(subschema, superSchema.not)) {
      return false;
    }
  }

  if (subschema.allOf !== undefined) {
    // All `subschemas` in `subschema.allOf` must be subtypes of `superSchema`.
    return subschema.allOf.every((subSubschema) =>
      isSubtype(subSubschema, superSchema),
    );
  }

  if (superSchema.allOf !== undefined) {
    // `subschema` must be a subtype of all `subschemas` in `superSchema.allOf`.
    return superSchema.allOf.every((subSuperSchema) =>
      isSubtype(subschema, subSuperSchema),
    );
  }

  if (subschema.anyOf !== undefined) {
    // Each `subschema` in `subschema.anyOf` must be a subtype of `superSchema`.
    return subschema.anyOf.every((subSubschema) =>
      isSubtype(subSubschema, superSchema),
    );
  }

  if (superSchema.anyOf !== undefined) {
    // `subschema` must be a subtype of at least one subschema in
    // `superSchema.anyOf`.
    return superSchema.anyOf.some((subSuperSchema) =>
      isSubtype(subschema, subSuperSchema),
    );
  }

  if (subschema.oneOf !== undefined) {
    // Each `subschema` in `subschema.oneOf` must be a subtype of `superSchema`.
    return subschema.oneOf.every((subSubschema) =>
      isSubtype(subSubschema, superSchema),
    );
  }

  if (superSchema.oneOf !== undefined) {
    // `subschema` must be a subtype of at least one subschema in
    // `superSchema.oneOf`.
    return superSchema.oneOf.some((subSuperSchema) =>
      isSubtype(subschema, subSuperSchema),
    );
  }

  if (subschema.type !== undefined && superSchema.type !== undefined) {
    if (!isTypeSubtype(subschema.type, superSchema.type)) {
      return false;
    }
  } else if (superSchema.type !== undefined) {
    // `subschema.type` is undefined, but `superSchema.type` is defined;
    // `subschema` accepts any type, so it cannot be a subtype of a schema
    // that restricts types.
    return false;
  }

  if (subschema.enum !== undefined) {
    if (superSchema.enum !== undefined) {
      // All values in `subschema.enum` must be in `superSchema.enum`.
      if (
        !subschema.enum.every((valueA) =>
          superSchema.enum!.some((valueB) => deepEqual(valueA, valueB)),
        )
      ) {
        return false;
      }
    } else if (superSchema.const !== undefined) {
      // All values in `subschema.enum` must equal `superSchema.const`.
      if (
        !subschema.enum.every((valueA) => deepEqual(valueA, superSchema.const))
      ) {
        return false;
      }
    } else {
      // `subschema.enum` is more restrictive.
    }
  }

  if (subschema.const !== undefined) {
    if (superSchema.const !== undefined) {
      // All const values must be equal.
      if (!deepEqual(subschema.const, superSchema.const)) {
        return false;
      }
    } else if (superSchema.enum !== undefined) {
      // `superSchema.enum` must contain `subschema.const`.
      if (
        !superSchema.enum.some((valueB) => deepEqual(subschema.const, valueB))
      ) {
        return false;
      }
    } else {
      // `subschema.const` is more restrictive.
    }
  }

  if (isNumericType(subschema.type)) {
    if (!compareNumericConstraints(subschema, superSchema)) {
      return false;
    }
  }

  if (isStringType(subschema.type)) {
    if (!compareStringConstraints(subschema, superSchema)) {
      return false;
    }
  }

  if (isArrayType(subschema.type)) {
    if (!compareArrayConstraints(subschema, superSchema)) {
      return false;
    }
  }

  if (isObjectType(subschema.type)) {
    if (!compareObjectConstraints(subschema, superSchema)) {
      return false;
    }
  }

  return true;
};

const isTypeSubtype = (
  subTypes: readonly SchemaTypeName[] | SchemaTypeName,
  superTypes: readonly SchemaTypeName[] | SchemaTypeName,
): boolean => {
  if (!Array.isArray(subTypes)) {
    subTypes = [subTypes as SchemaTypeName];
  }
  if (!Array.isArray(superTypes)) {
    superTypes = [superTypes as SchemaTypeName];
  }
  return subTypes.every((subType) =>
    superTypes.some(
      (superType) =>
        subType === superType ||
        (subType === "integer" && superType === "number"),
    ),
  );
};

const isNumericType = (
  type: readonly SchemaTypeName[] | SchemaTypeName | undefined,
): boolean => {
  return (
    type !== undefined &&
    (type === "integer" ||
      type === "number" ||
      (Array.isArray(type) &&
        type.some((type) => type === "integer" || type === "number")))
  );
};

const compareNumericConstraints = (
  subschema: Schema,
  superSchema: Schema,
): boolean => {
  if (
    subschema.minimum !== undefined &&
    (superSchema.minimum === undefined ||
      subschema.minimum < superSchema.minimum)
  ) {
    return false;
  }

  if (
    subschema.exclusiveMinimum !== undefined &&
    (superSchema.exclusiveMinimum === undefined ||
      subschema.exclusiveMinimum < superSchema.exclusiveMinimum)
  ) {
    return false;
  }

  if (
    subschema.exclusiveMaximum !== undefined &&
    (superSchema.exclusiveMaximum === undefined ||
      subschema.exclusiveMaximum > superSchema.exclusiveMaximum)
  ) {
    return false;
  }

  if (
    subschema.maximum !== undefined &&
    (superSchema.maximum === undefined ||
      subschema.maximum > superSchema.maximum)
  ) {
    return false;
  }

  if (
    subschema.multipleOf !== undefined &&
    (superSchema.multipleOf === undefined ||
      subschema.multipleOf % superSchema.multipleOf !== 0)
  ) {
    return false;
  }

  return true;
};

const isStringType = (
  type: readonly SchemaTypeName[] | SchemaTypeName | undefined,
): boolean => {
  return (
    type !== undefined &&
    (type === "string" || (Array.isArray(type) && type.includes("string")))
  );
};

const compareStringConstraints = (
  subschema: Schema,
  superSchema: Schema,
): boolean => {
  if (subschema.pattern !== undefined) {
    if (superSchema.pattern === undefined) {
      // `subschema` is more restrictive.
    } else {
      if (subschema.pattern !== superSchema.pattern) {
        return false;
      }
    }
  }

  if (
    subschema.minLength !== undefined &&
    (superSchema.minLength === undefined ||
      subschema.minLength < superSchema.minLength)
  ) {
    return false;
  }

  if (
    subschema.maxLength !== undefined &&
    (superSchema.maxLength === undefined ||
      subschema.maxLength > superSchema.maxLength)
  ) {
    return false;
  }

  return true;
};

const isArrayType = (
  type: readonly SchemaTypeName[] | SchemaTypeName | undefined,
): boolean => {
  return (
    type !== undefined &&
    (type === "array" || (Array.isArray(type) && type.includes("array")))
  );
};

const compareArrayConstraints = (
  subschema: Schema,
  superSchema: Schema,
): boolean => {
  if (subschema.prefixItems !== undefined) {
    if (superSchema.prefixItems === undefined) {
      // `subschema` is more restrictive.
    } else {
      if (subschema.prefixItems.length !== superSchema.prefixItems.length) {
        return false;
      }
      for (let i = 0; i < subschema.prefixItems.length; i += 1) {
        if (
          !isSubtype(subschema.prefixItems[i]!, superSchema.prefixItems[i]!)
        ) {
          return false;
        }
      }
    }
  }

  if (subschema.items !== undefined) {
    if (superSchema.items === undefined) {
      // `superSchema` allows any additional items;
      // `subschema` may be more restrictive.
    } else if (superSchema.items === false) {
      if (subschema.items !== false) {
        // `subschema` allows any additional items, but `superSchema` does not.
        return false;
      }
    } else if (typeof superSchema.items === "object") {
      if (subschema.items === false) {
        // `subschema` is more restrictive.
      } else if (typeof subschema.items === "object") {
        if (!isSubtype(subschema.items, superSchema.items)) {
          return false;
        }
      } else {
        // `subschema.items` is `true` (allows any additional items);
        // `superSchema.items` is an object (restricts additional items).
        return false;
      }
    }
  } else if (superSchema.items !== undefined) {
    if (superSchema.items === false) {
      // `subschema` allows any additional items;
      // `superSchema` does not allow additional items.
      return false;
    } else if (typeof superSchema.items === "object") {
      // `subschema` allows any additional items, but `superSchema` restricts them.
      return false;
    }
  }

  if (subschema.uniqueItems === true && superSchema.uniqueItems !== true) {
    return false;
  }

  if (
    subschema.minItems !== undefined &&
    (superSchema.minItems === undefined ||
      subschema.minItems < superSchema.minItems)
  ) {
    return false;
  }

  if (
    subschema.maxItems !== undefined &&
    (superSchema.maxItems === undefined ||
      subschema.maxItems > superSchema.maxItems)
  ) {
    return false;
  }

  return true;
};

const isObjectType = (
  type: readonly SchemaTypeName[] | SchemaTypeName | undefined,
): boolean => {
  return (
    type !== undefined &&
    (type === "object" || (Array.isArray(type) && type.includes("object")))
  );
};

const compareObjectConstraints = (
  subschema: Schema,
  superSchema: Schema,
): boolean => {
  if (superSchema.properties !== undefined) {
    if (subschema.properties === undefined) {
      // `subschema` does not define properties that `superSchema` does;
      // since `subschema` is less restrictive, it cannot be a subtype.
      return false;
    } else {
      for (const key in superSchema.properties) {
        const superProperty = superSchema.properties[key]!;
        const subProperty = subschema.properties[key];
        if (subProperty === undefined) {
          if (superSchema.required?.includes(key)) {
            return false; // `subschema` is missing a required property.
          }
        } else if (!isSubtype(subProperty, superProperty)) {
          return false;
        }
      }
    }
  }

  if (subschema.additionalProperties !== undefined) {
    if (superSchema.additionalProperties === undefined) {
      // `superSchema` allows any additional properties;
      // `subschema` may be more restrictive, so it's a subtype.
    } else if (superSchema.additionalProperties === false) {
      if (subschema.additionalProperties !== false) {
        // `subschema` allows additional properties that `superSchema` does not.
        return false;
      }
    } else if (typeof superSchema.additionalProperties === "object") {
      if (subschema.additionalProperties === false) {
        // `subschema` is more restrictive.
      } else if (typeof subschema.additionalProperties === "object") {
        if (
          !isSubtype(
            subschema.additionalProperties,
            superSchema.additionalProperties,
          )
        ) {
          return false;
        }
      } else {
        // `subschema` allows any additional properties,
        // but `superSchema` restricts them, so `subschema` cannot be a subtype.
        return false;
      }
    }
  } else if (superSchema.additionalProperties !== undefined) {
    if (
      superSchema.additionalProperties === false ||
      typeof superSchema.additionalProperties === "object"
    ) {
      // `subschema` allows any additional properties,
      // but `superSchema` restricts them, so `subschema` cannot be a subtype.
      return false;
    }
  }

  if (superSchema.required !== undefined) {
    if (subschema.required === undefined) {
      // `subschema` does not require properties that `superSchema` requires;
      // `subschema` is less restrictive, so it cannot be a subtype.
      return false;
    } else {
      // All required properties in `superSchema` must be in `subschema`.
      const missingRequiredProps = superSchema.required.filter(
        (property) => !subschema.required!.includes(property),
      );
      if (missingRequiredProps.length !== 0) {
        // `subschema` is missing required properties from `superSchema`.
        return false;
      }
    }
  }

  return true;
};

const areDisjoint = (
  subschema: SchemaDefinition,
  superSchema: SchemaDefinition,
): boolean => {
  // Assume schemas are disjoint if they don't have overlapping types.
  // If there is no intersection between the types, consider them disjoint.
  const subTypes = getTypes(subschema);
  const superTypes = getTypes(superSchema);
  return !subTypes.some((type) => superTypes.includes(type));
};

const getTypes = (schema: SchemaDefinition): readonly SchemaTypeName[] => {
  if (typeof schema === "boolean" || schema.type === undefined) {
    return [];
  }
  return Array.isArray(schema.type) ?
      (schema.type as readonly SchemaTypeName[])
    : [schema.type as SchemaTypeName];
};

export { isSubtype };
