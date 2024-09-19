import { describe, it, expect } from "vitest";
import type { SchemaDefinition, Schema } from "./schema.ts";
import { isSubtype } from "./subtype.ts";

describe("type subtyping", () => {
  it("should return true when types are the same", () => {
    const subschema = { type: "number" } as const satisfies Schema;
    const superSchema = { type: "number" } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return true when subschema type is a subset of superSchema type", () => {
    const subschema = { type: "integer" } as const satisfies Schema;
    const superSchema = { type: "number" } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema type is not a subset of superSchema type", () => {
    const subschema = { type: "number" } as const satisfies Schema;
    const superSchema = { type: "integer" } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should handle multiple types in subschema and superSchema", () => {
    const subschema = { type: ["integer", "string"] } as const satisfies Schema;
    const superSchema = {
      type: ["number", "string", "boolean"],
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema has types not present in superSchema", () => {
    const subschema = {
      type: ["integer", "string", "boolean"],
    } as const satisfies Schema;
    const superSchema = {
      type: ["number", "string"],
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when superSchema type is undefined", () => {
    const subschema = { type: "string" } as const satisfies Schema;
    const superSchema = {} as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema type is undefined and superSchema type is defined", () => {
    const subschema = {} as const satisfies Schema;
    const superSchema = { type: "string" } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });
});

describe("enum and const subtyping", () => {
  it("should return true when subschema enum is a subset of superSchema enum", () => {
    const subschema = { enum: [1, 2] } as const satisfies Schema;
    const superSchema = { enum: [1, 2, 3] } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema enum is not a subset of superSchema enum", () => {
    const subschema = { enum: [1, 4] } as const satisfies Schema;
    const superSchema = { enum: [1, 2, 3] } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when subschema const equals superSchema const", () => {
    const subschema = { const: "value" } as const satisfies Schema;
    const superSchema = { const: "value" } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema const does not equal superSchema const", () => {
    const subschema = { const: "value1" } as const satisfies Schema;
    const superSchema = { const: "value2" } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when subschema const is in superSchema enum", () => {
    const subschema = { const: 2 } as const satisfies Schema;
    const superSchema = { enum: [1, 2, 3] } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema const is not in superSchema enum", () => {
    const subschema = { const: 4 } as const satisfies Schema;
    const superSchema = { enum: [1, 2, 3] } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when superSchema enum is undefined", () => {
    const subschema = { enum: [1, 2] } as const satisfies Schema;
    const superSchema = {} as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });
});

describe("numeric constraint subtyping", () => {
  it("should return true when subschema minimum is greater than superSchema minimum", () => {
    const subschema = { type: "number", minimum: 5 } as const satisfies Schema;
    const superSchema = {
      type: "number",
      minimum: 0,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema minimum is less than superSchema minimum", () => {
    const subschema = { type: "number", minimum: 0 } as const satisfies Schema;
    const superSchema = {
      type: "number",
      minimum: 5,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when subschema maximum is less than superSchema maximum", () => {
    const subschema = { type: "number", maximum: 10 } as const satisfies Schema;
    const superSchema = {
      type: "number",
      maximum: 15,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema maximum is greater than superSchema maximum", () => {
    const subschema = { type: "number", maximum: 20 } as const satisfies Schema;
    const superSchema = {
      type: "number",
      maximum: 15,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when subschema multipleOf is a multiple of superSchema multipleOf", () => {
    const subschema = {
      type: "number",
      multipleOf: 4,
    } as const satisfies Schema;
    const superSchema = {
      type: "number",
      multipleOf: 2,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema multipleOf is not a multiple of superSchema multipleOf", () => {
    const subschema = {
      type: "number",
      multipleOf: 3,
    } as const satisfies Schema;
    const superSchema = {
      type: "number",
      multipleOf: 2,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });
});

describe("string constraint subtyping", () => {
  it("should return true when subschema minLength is greater than superSchema minLength", () => {
    const subschema = {
      type: "string",
      minLength: 5,
    } as const satisfies Schema;
    const superSchema = {
      type: "string",
      minLength: 3,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema minLength is less than superSchema minLength", () => {
    const subschema = {
      type: "string",
      minLength: 2,
    } as const satisfies Schema;
    const superSchema = {
      type: "string",
      minLength: 3,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when subschema maxLength is less than superSchema maxLength", () => {
    const subschema = {
      type: "string",
      maxLength: 5,
    } as const satisfies Schema;
    const superSchema = {
      type: "string",
      maxLength: 10,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema maxLength is greater than superSchema maxLength", () => {
    const subschema = {
      type: "string",
      maxLength: 15,
    } as const satisfies Schema;
    const superSchema = {
      type: "string",
      maxLength: 10,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when subschema pattern equals superSchema pattern", () => {
    const subschema = {
      type: "string",
      pattern: "^abc$",
    } as const satisfies Schema;
    const superSchema = {
      type: "string",
      pattern: "^abc$",
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema pattern does not equal superSchema pattern", () => {
    const subschema = {
      type: "string",
      pattern: "^abc$",
    } as const satisfies Schema;
    const superSchema = {
      type: "string",
      pattern: "^abcd$",
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when superSchema pattern is undefined", () => {
    const subschema = {
      type: "string",
      pattern: "^abc$",
    } as const satisfies Schema;
    const superSchema = { type: "string" } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });
});

describe("array constraint subtyping", () => {
  it("should return true when subschema minItems is greater than superSchema minItems", () => {
    const subschema = { type: "array", minItems: 3 } as const satisfies Schema;
    const superSchema = {
      type: "array",
      minItems: 2,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema minItems is less than superSchema minItems", () => {
    const subschema = { type: "array", minItems: 1 } as const satisfies Schema;
    const superSchema = {
      type: "array",
      minItems: 2,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when subschema maxItems is less than superSchema maxItems", () => {
    const subschema = { type: "array", maxItems: 5 } as const satisfies Schema;
    const superSchema = {
      type: "array",
      maxItems: 10,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema maxItems is greater than superSchema maxItems", () => {
    const subschema = { type: "array", maxItems: 15 } as const satisfies Schema;
    const superSchema = {
      type: "array",
      maxItems: 10,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when subschema items is a subtype of superSchema items", () => {
    const subschema = {
      type: "array",
      items: { type: "integer" },
    } as const satisfies Schema;
    const superSchema = {
      type: "array",
      items: { type: "number" },
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema items is not a subtype of superSchema items", () => {
    const subschema = {
      type: "array",
      items: { type: "number" },
    } as const satisfies Schema;
    const superSchema = {
      type: "array",
      items: { type: "integer" },
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when subschema additionalItems is false and superSchema additionalItems is true", () => {
    const subschema = {
      type: "array",
      items: [{ type: "string" }],
      additionalItems: false,
    } as const satisfies Schema;
    const superSchema = {
      type: "array",
      items: [{ type: "string" }],
      additionalItems: true,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema additionalItems is true and superSchema additionalItems is false", () => {
    const subschema = {
      type: "array",
      items: [{ type: "string" }],
      additionalItems: true,
    } as const satisfies Schema;
    const superSchema = {
      type: "array",
      items: [{ type: "string" }],
      additionalItems: false,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });
});

describe("object constraint subtyping", () => {
  it("should return true when subschema required includes superSchema required", () => {
    const subschema = {
      type: "object",
      required: ["a", "b", "c"],
    } as const satisfies Schema;
    const superSchema = {
      type: "object",
      required: ["a", "b"],
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema required does not include superSchema required", () => {
    const subschema = {
      type: "object",
      required: ["a", "b"],
    } as const satisfies Schema;
    const superSchema = {
      type: "object",
      required: ["a", "b", "c"],
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when subschema properties are subtypes of superSchema properties", () => {
    const subschema = {
      type: "object",
      properties: {
        age: { type: "integer", minimum: 18 },
      },
    } as const satisfies Schema;
    const superSchema = {
      type: "object",
      properties: {
        age: { type: "number", minimum: 0 },
      },
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema properties are not subtypes of superSchema properties", () => {
    const subschema = {
      type: "object",
      properties: {
        age: { type: "number", minimum: 0 },
      },
    } as const satisfies Schema;
    const superSchema = {
      type: "object",
      properties: {
        age: { type: "integer", minimum: 18 },
      },
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when subschema additionalProperties is false and superSchema additionalProperties is true", () => {
    const subschema = {
      type: "object",
      properties: { name: { type: "string" } },
      additionalProperties: false,
    } as const satisfies Schema;
    const superSchema = {
      type: "object",
      properties: { name: { type: "string" } },
      additionalProperties: true,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema additionalProperties is true and superSchema additionalProperties is false", () => {
    const subschema = {
      type: "object",
      properties: { name: { type: "string" } },
      additionalProperties: true,
    } as const satisfies Schema;
    const superSchema = {
      type: "object",
      properties: { name: { type: "string" } },
      additionalProperties: false,
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });
});

describe("logical constraint subtyping", () => {
  it("should return false when subschema allOf is not a subtype of superSchema allOf", () => {
    const subschema = {
      allOf: [{ type: "integer" }, { minimum: 10 }],
    } as const satisfies Schema;
    const superSchema = {
      allOf: [{ type: "number" }, { minimum: 0 }],
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return false when subschema allOf is not a subtype of superSchema allOf", () => {
    const subschema = {
      allOf: [{ type: "integer" }, { minimum: 10 }],
    } as const satisfies Schema;
    const superSchema = {
      allOf: [{ type: "number" }, { minimum: 0 }],
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when subschema anyOf is a subtype of superSchema anyOf", () => {
    const subschema = {
      anyOf: [{ type: "integer" }, { type: "string" }],
    } as const satisfies Schema;
    const superSchema = {
      anyOf: [{ type: "number" }, { type: "string" }, { type: "boolean" }],
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema anyOf is not a subtype of superSchema anyOf", () => {
    const subschema = {
      anyOf: [{ type: "integer" }, { type: "boolean" }],
    } as const satisfies Schema;
    const superSchema = {
      anyOf: [{ type: "number" }, { type: "string" }],
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return false when subschema not is not a subtype of superSchema not", () => {
    const subschema = { not: { type: "string" } } as const satisfies Schema;
    const superSchema = {
      not: { type: ["string", "boolean"] },
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return false when subschema not is not a subtype of superSchema not", () => {
    const subschema = { not: { type: "number" } } as const satisfies Schema;
    const superSchema = {
      not: { type: ["string", "boolean"] },
    } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });
});

describe("boolean schema definition subtyping", () => {
  it("should return true when both schemas are true", () => {
    const subschema = true as const satisfies SchemaDefinition;
    const superSchema = true as const satisfies SchemaDefinition;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema is true and superSchema is false", () => {
    const subschema = true as const satisfies SchemaDefinition;
    const superSchema = false as const satisfies SchemaDefinition;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when subschema is false (subtype of any schema)", () => {
    const subschema = false as const satisfies SchemaDefinition;
    const superSchema = true as const satisfies SchemaDefinition;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return true when subschema is false and superSchema is false", () => {
    const subschema = false as const satisfies SchemaDefinition;
    const superSchema = false as const satisfies SchemaDefinition;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });

  it("should return false when subschema is true and superSchema is an object schema", () => {
    const subschema = true as const satisfies SchemaDefinition;
    const superSchema = { type: "string" } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(false);
  });

  it("should return true when subschema is false and superSchema is an object schema", () => {
    const subschema = false as const satisfies SchemaDefinition;
    const superSchema = { type: "string" } as const satisfies Schema;
    expect(isSubtype(subschema, superSchema)).toBe(true);
  });
});
