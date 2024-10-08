import { describe, expect, it } from "vitest";
import type { SchemaTypeName, SchemaDefinition, Schema } from "./schema.ts";
import { validate } from "./validate.ts";

describe("type validation", () => {
  it("should validate undefined types", () => {
    const schema = { type: "undefined" } as const satisfies Schema;
    expect(validate(undefined, schema)).toBe(true);
    expect(validate(null, schema)).toBe(false);
  });

  it("should validate null types", () => {
    const schema = { type: "null" } as const satisfies Schema;
    expect(validate(null, schema)).toBe(true);
    expect(validate("not null", schema)).toBe(false);
  });

  it("should validate boolean types", () => {
    const schema = { type: "boolean" } as const satisfies Schema;
    expect(validate(true, schema)).toBe(true);
    expect(validate(false, schema)).toBe(true);
    expect(validate("true", schema)).toBe(false);
  });

  it("should validate integer types", () => {
    const schema = { type: "integer" } as const satisfies Schema;
    expect(validate(5, schema)).toBe(true);
    expect(validate(-3, schema)).toBe(true);
    expect(validate(3.14, schema)).toBe(false);
  });

  it("should validate number types", () => {
    const schema = { type: "number" } as const satisfies Schema;
    expect(validate(3.14, schema)).toBe(true);
    expect(validate(-2.71, schema)).toBe(true);
    expect(validate("3.14", schema)).toBe(false);
  });

  it("should validate string types", () => {
    const schema = { type: "string" } as const satisfies Schema;
    expect(validate("hello", schema)).toBe(true);
    expect(validate("", schema)).toBe(true);
    expect(validate(123, schema)).toBe(false);
  });

  it("should validate array types", () => {
    const schema = { type: "array" } as const satisfies Schema;
    expect(validate([], schema)).toBe(true);
    expect(validate([1, 2, 3], schema)).toBe(true);
    expect(validate({}, schema)).toBe(false);
  });

  it("should validate object types", () => {
    const schema = { type: "object" } as const satisfies Schema;
    expect(validate({}, schema)).toBe(true);
    expect(validate({ key: "value" }, schema)).toBe(true);
    expect(validate([], schema)).toBe(false);
  });

  it("should validate multiple types", () => {
    const schema = { type: ["string", "number"] } as const satisfies Schema;
    expect(validate("hello", schema)).toBe(true);
    expect(validate(42, schema)).toBe(true);
    expect(validate(true, schema)).toBe(false);
  });
});

describe("const validation", () => {
  it("should validate const values", () => {
    const schema = { const: "fixed value" } as const satisfies Schema;
    expect(validate("fixed value", schema)).toBe(true);
    expect(validate("other value", schema)).toBe(false);
  });
});

describe("enum validation", () => {
  it("should validate enum values", () => {
    const schema = { enum: [1, 2, 3] } as const satisfies Schema;
    expect(validate(1, schema)).toBe(true);
    expect(validate(4, schema)).toBe(false);
  });
});

describe("number validation", () => {
  it("should validate minimum constraints", () => {
    const schema = { type: "number", minimum: 5 } as const satisfies Schema;
    expect(validate(5, schema)).toBe(true);
    expect(validate(4.99, schema)).toBe(false);
  });

  it("should validate exclusiveMinimum constraints", () => {
    const schema = {
      type: "number",
      exclusiveMinimum: 5,
    } as const satisfies Schema;
    expect(validate(5.01, schema)).toBe(true);
    expect(validate(5, schema)).toBe(false);
  });

  it("should validate exclusiveMaximum constraints", () => {
    const schema = {
      type: "number",
      exclusiveMaximum: 10,
    } as const satisfies Schema;
    expect(validate(9.99, schema)).toBe(true);
    expect(validate(10, schema)).toBe(false);
  });

  it("should validate maximum constraints", () => {
    const schema = { type: "number", maximum: 10 } as const satisfies Schema;
    expect(validate(10, schema)).toBe(true);
    expect(validate(11, schema)).toBe(false);
  });

  it("should validate multipleOf constraints", () => {
    const schema = {
      type: "number",
      multipleOf: 2,
    } as const satisfies Schema;
    expect(validate(4, schema)).toBe(true);
    expect(validate(5, schema)).toBe(false);
  });
});

describe("string validation", () => {
  it("should validate minLength constraints", () => {
    const schema = {
      type: "string",
      minLength: 3,
    } as const satisfies Schema;
    expect(validate("hi", schema)).toBe(false);
    expect(validate("hello", schema)).toBe(true);
  });

  it("should validate maxLength constraints", () => {
    const schema = { type: "string", maxLength: 5 } as const satisfies Schema;
    expect(validate("hello", schema)).toBe(true);
    expect(validate("hello!", schema)).toBe(false);
  });

  it("should validate pattern constraints", () => {
    const schema = {
      type: "string",
      pattern: "^a.*z$",
    } as const satisfies Schema;
    expect(validate("abcz", schema)).toBe(true);
    expect(validate("abz", schema)).toBe(true);
    expect(validate("abczx", schema)).toBe(false); // Does not end with 'z'
    expect(validate("baz", schema)).toBe(false); // Does not start with 'a'
  });
});

describe("array validation", () => {
  it("should validate items constraints", () => {
    const schema = {
      type: "array",
      items: { type: "number" },
    } as const satisfies Schema;
    expect(validate([1, 2, 3], schema)).toBe(true);
    expect(validate([1, "2", 3], schema)).toBe(false);
  });

  it("should validate tuple items constraints", () => {
    const schema = {
      type: "array",
      prefixItems: [{ type: "number" }, { type: "string" }],
      items: false,
    } as const satisfies Schema;
    expect(validate([1, "two"], schema)).toBe(true);
    expect(validate([1, "two", 3], schema)).toBe(false);
  });

  it("should validate uniqueItem constraints", () => {
    const schema = {
      type: "array",
      uniqueItems: true,
    } as const satisfies Schema;
    expect(validate([1, 2, 3], schema)).toBe(true);
    expect(validate([1, 2, 1], schema)).toBe(false);
  });

  it("should validate contains constraints", () => {
    const schema = {
      type: "array",
      contains: { type: "number", minimum: 5 },
    } as const satisfies Schema;
    expect(validate([1, 2, 5], schema)).toBe(true);
    expect(validate([1, 2, 3], schema)).toBe(false);
  });

  it("should validate minItems constraints", () => {
    const schema = {
      type: "array",
      minItems: 2,
    } as const satisfies Schema;
    expect(validate([1], schema)).toBe(false);
    expect(validate([1, 2], schema)).toBe(true);
  });

  it("should validate maxItems constraints", () => {
    const schema = { type: "array", maxItems: 3 } as const satisfies Schema;
    expect(validate([1, 2, 3], schema)).toBe(true);
    expect(validate([1, 2, 3, 4], schema)).toBe(false);
  });
});

describe("object validation", () => {
  it("should validate properties constraints", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "integer" },
      },
    } as const satisfies Schema;
    expect(validate({ name: "Alice", age: 30 }, schema)).toBe(true);
    expect(validate({ name: "Bob", age: "30" }, schema)).toBe(false);
  });

  it("should validate additionalProperties constraints", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      additionalProperties: false,
    } as const satisfies Schema;
    expect(validate({ name: "Charlie" }, schema)).toBe(true);
    expect(validate({ name: "Dave", age: 40 }, schema)).toBe(false);
  });

  it("should validate patternProperties constraints", () => {
    const schema = {
      type: "object",
      patternProperties: {
        "^S_": { type: "string" },
        "^I_": { type: "integer" },
      },
    } as const satisfies Schema;
    expect(
      validate({ S_name: "Eve", I_age: 25, S_city: "Wonderland" }, schema),
    ).toBe(true);
    expect(validate({ S_name: "Eve", I_age: "25" }, schema)).toBe(false);
  });

  it("should validate required properties constraints", () => {
    const schema = {
      type: "object",
      required: ["a", "b"],
    } as const satisfies Schema;
    expect(validate({ a: 1, b: 2 }, schema)).toBe(true);
    expect(validate({ a: 1 }, schema)).toBe(false);
  });

  it("should validate minProperties constraints", () => {
    const schema = {
      type: "object",
      minProperties: 1,
    } as const satisfies Schema;
    expect(validate({}, schema)).toBe(false);
    expect(validate({ a: 1 }, schema)).toBe(true);
  });

  it("should validate maxProperties constraints", () => {
    const schema = {
      type: "object",
      maxProperties: 2,
    } as const satisfies Schema;
    expect(validate({ a: 1, b: 2 }, schema)).toBe(true);
    expect(validate({ a: 1, b: 2, c: 3 }, schema)).toBe(false);
  });
});

describe("logical validation", () => {
  it("should validate allOf operators", () => {
    const schema = {
      allOf: [{ type: "number" }, { minimum: 10 }, { maximum: 20 }],
    } as const satisfies Schema;
    expect(validate(15, schema)).toBe(true);
    expect(validate(25, schema)).toBe(false);
  });

  it("should validate anyOf operators", () => {
    const schema = {
      anyOf: [{ type: "string" }, { type: "number" }],
    } as const satisfies Schema;
    expect(validate("hello", schema)).toBe(true);
    expect(validate(42, schema)).toBe(true);
    expect(validate(true, schema)).toBe(false);
  });

  it("should validate oneOf operators", () => {
    const schema = {
      oneOf: [{ type: "number" }, { type: "integer" }],
    } as const satisfies Schema;
    expect(validate(3.14, schema)).toBe(true);
    expect(validate(5, schema)).toBe(false);
  });

  it("should validate not operators", () => {
    const schema = { not: { type: "string" } } as const satisfies Schema;
    expect(validate(123, schema)).toBe(true);
    expect(validate("not allowed", schema)).toBe(false);
  });

  it("should validate if-then-else operators", () => {
    const schema = {
      if: { type: "number" },
      then: { minimum: 0 },
      else: { type: "string" },
    } as const satisfies Schema;
    expect(validate(5, schema)).toBe(true);
    expect(validate(-3, schema)).toBe(false);
    expect(validate("hello", schema)).toBe(true);
    expect(validate(true, schema)).toBe(false);
  });
});

describe("complex schema validation", () => {
  it("should validate a complex user schema", () => {
    const userSchema = {
      type: "object",
      required: ["id", "name", "email"],
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        email: { type: "string", format: "email" },
        roles: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
        },
        metadata: {
          type: "object",
          additionalProperties: { type: "string" },
        },
      },
      additionalProperties: false,
    } as const satisfies Schema;

    const validUser = {
      id: 1,
      name: "Alice",
      email: "alice@example.com",
      roles: ["admin", "user"],
      metadata: { department: "IT" },
    };

    const invalidUser = {
      id: "1", // Invalid id type.
      name: "Bob",
      email: "bob@example.com",
      roles: [],
    };

    expect(validate(validUser, userSchema)).toBe(true);
    expect(validate(invalidUser, userSchema)).toBe(false);
  });

  it("should validate nested objects and arrays", () => {
    const schema = {
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            required: ["username", "preferences"],
            properties: {
              username: { type: "string" },
              preferences: {
                type: "object",
                properties: {
                  notifications: { type: "boolean" },
                  theme: { type: "string" },
                },
                required: ["notifications"],
              },
            },
          },
        },
      },
    } as const satisfies Schema;

    const validData = {
      users: [
        {
          username: "user1",
          preferences: { notifications: true, theme: "dark" },
        },
        {
          username: "user2",
          preferences: { notifications: false },
        },
      ],
    };

    const invalidData = {
      users: [
        {
          username: "user1",
          preferences: { theme: "light" },
        },
      ],
    };

    expect(validate(validData, schema)).toBe(true);
    expect(validate(invalidData, schema)).toBe(false);
  });
});

describe("edge cases", () => {
  it("should handle empty schemas (accept anything)", () => {
    const schema = {} as const satisfies Schema;
    expect(validate(null, schema)).toBe(true);
    expect(validate(123, schema)).toBe(true);
    expect(validate("string", schema)).toBe(true);
  });

  it("should handle `true` schemas (accept anything)", () => {
    const schema = true as const satisfies SchemaDefinition;
    expect(validate(null, schema)).toBe(true);
    expect(validate(123, schema)).toBe(true);
  });

  it("should handle `false` schemas (reject everything)", () => {
    const schema = false as const satisfies SchemaDefinition;
    expect(validate(null, schema)).toBe(false);
    expect(validate(123, schema)).toBe(false);
  });

  it("should reject invalid types in type validation", () => {
    const schema = {
      type: "unknown" as SchemaTypeName,
    } as const satisfies Schema;
    expect(validate(123, schema)).toBe(false);
  });
});
