import { expect, it } from "vitest";
import type { Schema } from "./schema.ts";
import { matchSchema } from "./match.ts";

it("should return the matching subschema when exactly one matches", () => {
  const schema = {
    anyOf: [{ type: "string" }, { type: "number", minimum: 10 }],
  } as const satisfies Schema;
  expect(matchSchema(15, schema)).toBe(schema.anyOf[1]);
});

it("should return the most specific subschema when multiple match", () => {
  const schema = {
    anyOf: [{ type: "number" }, { minimum: 0 }],
  } as const satisfies Schema;
  expect(matchSchema(5, schema)).toBe(schema.anyOf[0]);
});

it("should return undefined when no subschemas match", () => {
  const schema = {
    anyOf: [{ type: "string" }, { type: "array" }],
  } as const satisfies Schema;
  expect(matchSchema(42, schema)).toBeUndefined();
});
