import { expect, it } from "vitest";
import { Bindings } from "./bindings.ts";
import { Variable } from "./variable.ts";

it("should initially have no variables", () => {
  const bindings = new Bindings();
  const variable1 = new Variable<number>();
  const variable2 = new Variable<string>();

  expect(bindings.has(variable1)).toBe(false);
  expect(bindings.has(variable2)).toBe(false);
});

it("should set and get variables", () => {
  const bindings = new Bindings();
  const variable1 = new Variable<number>();
  const variable2 = new Variable<string>();

  bindings.set(variable1, 42);
  bindings.set(variable2, "hello");

  expect(bindings.get(variable1)).toBe(42);
  expect(bindings.get(variable2)).toBe("hello");
});

it("should overwrite existing variable values", () => {
  const bindings = new Bindings();
  const variable = new Variable<number>();

  bindings.set(variable, 42);
  bindings.set(variable, 84);
  expect(bindings.get(variable)).toBe(84);
});

it("should delete variables", () => {
  const bindings = new Bindings();
  const variable = new Variable<number>();

  bindings.set(variable, 42);
  bindings.delete(variable);

  expect(bindings.has(variable)).toBe(false);
  expect(bindings.get(variable)).toBeUndefined();
});

it("should handle aliasing with copy-on-write-semantics", () => {
  const bindings1 = new Bindings();
  const variable1 = new Variable<number>();
  const variable2 = new Variable<string>();

  bindings1.set(variable1, 42);
  const bindings2 = bindings1.branch();

  bindings2.set(variable1, 84);
  expect(bindings2.get(variable1)).toBe(84);
  expect(bindings1.get(variable1)).toBe(42);

  bindings1.set(variable2, "hello");
  expect(bindings1.get(variable2)).toBe("hello");
  expect(bindings2.get(variable2)).toBeUndefined();
});

it("should delete variables in aliased branches without affecting the original", () => {
  const bindings1 = new Bindings();
  const variable = new Variable<number>();

  bindings1.set(variable, 42);
  const bindings2 = bindings1.branch();

  bindings2.delete(variable);
  expect(bindings2.has(variable)).toBe(false);
  expect(bindings1.has(variable)).toBe(true);
});

it("should correctly dealias branched bindings", () => {
  const bindings1 = new Bindings();
  const variable = new Variable<number>();

  bindings1.set(variable, 42);
  const bindings2 = bindings1.branch();
  expect(bindings2.get(variable)).toBe(42);

  bindings2.set(variable, 84);
  expect(bindings2.get(variable)).toBe(84);
  expect(bindings1.get(variable)).toBe(42);

  const bindings3 = bindings1.branch();
  bindings1.delete(variable);
  expect(bindings3.get(variable)).toBe(42);
  expect(bindings2.get(variable)).toBe(84);
  expect(bindings1.get(variable)).toBeUndefined();
});

it("should handle multiple branches correctly", () => {
  const bindings1 = new Bindings();
  const variable = new Variable<number>();

  bindings1.set(variable, 42);
  const bindings2 = bindings1.branch();
  const bindings3 = bindings2.branch();

  bindings2.set(variable, 84);
  bindings3.set(variable, 126);
  expect(bindings1.get(variable)).toBe(42);
  expect(bindings2.get(variable)).toBe(84);
  expect(bindings3.get(variable)).toBe(126);
});
