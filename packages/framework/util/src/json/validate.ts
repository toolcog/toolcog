import { deepEqual } from "@toolcog/util";
import type {
  SchemaTypeName,
  SchemaType,
  SchemaDefinition,
  Schema,
} from "./schema.ts";

const validate = (value: unknown, schema: SchemaDefinition): boolean => {
  if (typeof schema === "boolean") {
    return schema;
  }

  if (schema.$ref !== undefined) {
    throw new Error("$ref is not supported");
  }

  if (schema.type !== undefined) {
    if (!validateType(value, schema.type)) {
      return false;
    }
  }

  if (schema.enum !== undefined) {
    if (!validateEnum(value, schema.enum)) {
      return false;
    }
  }

  if (schema.const !== undefined) {
    if (!validateConst(value, schema.const)) {
      return false;
    }
  }

  if (
    schema.minimum !== undefined ||
    schema.exclusiveMaximum !== undefined ||
    schema.exclusiveMinimum !== undefined ||
    schema.maximum !== undefined ||
    schema.multipleOf !== undefined
  ) {
    if (!validateNumber(value, schema)) {
      return false;
    }
  }

  if (
    schema.pattern !== undefined ||
    schema.minLength !== undefined ||
    schema.maxLength !== undefined
  ) {
    if (!validateString(value, schema)) {
      return false;
    }
  }

  if (
    schema.items !== undefined ||
    schema.additionalItems !== undefined ||
    schema.uniqueItems !== undefined ||
    schema.contains !== undefined ||
    schema.minItems !== undefined ||
    schema.maxItems !== undefined
  ) {
    if (!validateArray(value, schema)) {
      return false;
    }
  }

  if (
    schema.properties !== undefined ||
    schema.additionalProperties !== undefined ||
    schema.patternProperties !== undefined ||
    schema.required !== undefined ||
    schema.minProperties !== undefined ||
    schema.maxProperties !== undefined
  ) {
    if (!validateObject(value, schema)) {
      return false;
    }
  }

  if (schema.allOf !== undefined) {
    for (const subschema of schema.allOf) {
      if (!validate(value, subschema)) {
        return false;
      }
    }
  }

  if (schema.anyOf !== undefined) {
    let valid = false;
    for (const subschema of schema.anyOf) {
      if (validate(value, subschema)) {
        valid = true;
        break;
      }
    }
    if (!valid) {
      return false;
    }
  }

  if (schema.oneOf !== undefined) {
    let validCount = 0;
    for (const subschema of schema.oneOf) {
      if (validate(value, subschema)) {
        validCount += 1;
      }
    }
    if (validCount !== 1) {
      return false;
    }
  }

  if (schema.not !== undefined) {
    if (validate(value, schema.not)) {
      return false;
    }
  }

  if (schema.if !== undefined) {
    if (validate(value, schema.if)) {
      if (schema.then !== undefined && !validate(value, schema.then)) {
        return false;
      }
    } else {
      if (schema.else !== undefined && !validate(value, schema.else)) {
        return false;
      }
    }
  }

  return true;
};

const validateType = (
  value: unknown,
  schemaType: readonly SchemaTypeName[] | SchemaTypeName,
): boolean => {
  const types =
    Array.isArray(schemaType) ?
      (schemaType as readonly SchemaTypeName[])
    : [schemaType as SchemaTypeName];

  for (const type of types) {
    if (typeMatches(value, type)) {
      return true;
    }
  }

  return false;
};

const typeMatches = (value: unknown, type: SchemaTypeName): boolean => {
  switch (type) {
    case "void":
      return value === undefined;
    case "undefined":
      return typeof value === "undefined";
    case "null":
      return value === null;
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number" && !isNaN(value);
    case "string":
      return typeof value === "string";
    case "array":
      return Array.isArray(value);
    case "object":
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
    default:
      return false;
  }
};

const validateEnum = (
  value: unknown,
  enumValues: readonly SchemaType[],
): boolean => {
  for (const enumValue of enumValues) {
    if (deepEqual(value, enumValue)) {
      return true;
    }
  }
  return false;
};

const validateConst = (value: unknown, constValue: SchemaType): boolean => {
  return deepEqual(value, constValue);
};

const validateNumber = (value: unknown, schema: Schema): boolean => {
  if (typeof value !== "number" || isNaN(value)) {
    return false;
  }

  if (schema.minimum !== undefined) {
    if (value < schema.minimum) {
      return false;
    }
  }

  if (schema.exclusiveMinimum !== undefined) {
    if (value <= schema.exclusiveMinimum) {
      return false;
    }
  }

  if (schema.exclusiveMaximum !== undefined) {
    if (value >= schema.exclusiveMaximum) {
      return false;
    }
  }

  if (schema.maximum !== undefined) {
    if (value > schema.maximum) {
      return false;
    }
  }

  if (schema.multipleOf !== undefined) {
    if ((value / schema.multipleOf) % 1 !== 0) {
      return false;
    }
  }

  return true;
};

const validateString = (value: unknown, schema: Schema): boolean => {
  if (typeof value !== "string") {
    return false;
  }

  if (schema.pattern !== undefined) {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) {
      return false;
    }
  }

  if (schema.minLength !== undefined) {
    if (value.length < schema.minLength) {
      return false;
    }
  }

  if (schema.maxLength !== undefined) {
    if (value.length > schema.maxLength) {
      return false;
    }
  }

  return true;
};

const validateArray = (value: unknown, schema: Schema): boolean => {
  if (!Array.isArray(value)) {
    return false;
  }

  if (schema.items !== undefined) {
    if (Array.isArray(schema.items)) {
      for (let i = 0; i < schema.items.length; i += 1) {
        const itemSchema = (schema.items as readonly SchemaDefinition[])[i]!;
        const itemValue = (value as unknown[])[i];
        if (!validate(itemValue, itemSchema)) {
          return false;
        }
      }
      if (schema.additionalItems !== undefined) {
        if (schema.additionalItems === false) {
          if (value.length > schema.items.length) {
            return false;
          }
        } else {
          const additionalSchema = schema.additionalItems;
          for (let i = schema.items.length; i < value.length; i += 1) {
            if (!validate(value[i], additionalSchema)) {
              return false;
            }
          }
        }
      }
    } else {
      const itemSchema = schema.items as SchemaDefinition;
      for (const item of value) {
        if (!validate(item, itemSchema)) {
          return false;
        }
      }
    }
  }

  if (schema.uniqueItems) {
    const uniqueItems = new Set();
    for (const item of value) {
      const itemKey = JSON.stringify(item);
      if (uniqueItems.has(itemKey)) {
        return false;
      }
      uniqueItems.add(itemKey);
    }
  }

  if (schema.contains !== undefined) {
    const containsSchema = schema.contains;
    let containsValid = false;
    for (const item of value) {
      if (validate(item, containsSchema)) {
        containsValid = true;
        break;
      }
    }
    if (!containsValid) {
      return false;
    }
  }

  if (schema.minItems !== undefined) {
    if (value.length < schema.minItems) {
      return false;
    }
  }

  if (schema.maxItems !== undefined) {
    if (value.length > schema.maxItems) {
      return false;
    }
  }

  return true;
};

const validateObject = (value: unknown, schema: Schema): boolean => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const keys = Object.keys(value);

  const propertyValidators: { [key: string]: SchemaDefinition } = {};
  if (schema.properties !== undefined) {
    Object.assign(propertyValidators, schema.properties);
  }

  const additionalProperties = schema.additionalProperties ?? true;

  if (schema.patternProperties !== undefined) {
    for (const pattern in schema.patternProperties) {
      const regex = new RegExp(pattern);
      for (const key of keys) {
        if (regex.test(key)) {
          propertyValidators[key] = schema.patternProperties[pattern]!;
        }
      }
    }
  }

  for (const key of keys) {
    const propertySchema = propertyValidators[key];
    if (propertySchema !== undefined) {
      if (
        !validate((value as Record<PropertyKey, unknown>)[key], propertySchema)
      ) {
        return false;
      }
    } else if (additionalProperties === false) {
      return false;
    } else if (typeof additionalProperties === "object") {
      if (
        !validate(
          (value as Record<PropertyKey, unknown>)[key],
          additionalProperties,
        )
      ) {
        return false;
      }
    }
  }

  if (schema.required !== undefined) {
    for (const requiredKey of schema.required) {
      if (!Object.prototype.hasOwnProperty.call(value, requiredKey)) {
        return false;
      }
    }
  }

  if (schema.minProperties !== undefined) {
    if (keys.length < schema.minProperties) {
      return false;
    }
  }

  if (schema.maxProperties !== undefined) {
    if (keys.length > schema.maxProperties) {
      return false;
    }
  }

  return true;
};

export { validate };
