import { expect, it } from "vitest";
import type { Schema } from "./schema.ts";
import { narrowSchema } from "./narrow.ts";

it("should return the narrowest subschema when exactly one matches", () => {
  const schema = {
    anyOf: [{ type: "string" }, { type: "number", minimum: 10 }],
  } as const satisfies Schema;
  expect(narrowSchema(15, schema)).toBe(schema.anyOf[1]);
});

it("should return the most specific subschema when multiple match", () => {
  const schema = {
    anyOf: [{ type: "number" }, { minimum: 0 }],
  } as const satisfies Schema;
  expect(narrowSchema(5, schema)).toBe(schema.anyOf[0]);
});

it("should filter out non-matching schemas", () => {
  const schema = {
    anyOf: [{ type: "string" }, { type: "array" }],
  } as const satisfies Schema;
  expect(narrowSchema(42, schema)).toEqual({ anyOf: [] });
});
