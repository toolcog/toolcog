import { expect, it } from "vitest";
import { Variable } from "./variable.ts";

it("should get its default value if not set", () => {
  const variable1 = new Variable<number>({ defaultValue: 0 });
  const variable2 = new Variable<string>({ defaultValue: "" });

  expect(variable1.get()).toBe(0);
  expect(variable2.get()).toBe("");
});

it("should get and set values during a synchronous run", () => {
  const variable = new Variable<number>({ defaultValue: 0 });

  variable.run(42, () => {
    expect(variable.get()).toBe(42);
  });

  expect(variable.get()).toBe(0);
});

it("should preserve values across async boundaries", async () => {
  const variable = new Variable<number>({ defaultValue: 0 });

  await variable.run(42, async () => {
    expect(variable.get()).toBe(42);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(variable.get()).toBe(42);
  });

  expect(variable.get()).toBe(0);
});

it("should preserve values across timeouts", async () => {
  const variable = new Variable<number>({ defaultValue: 0 });

  await variable.run(42, async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(variable.get()).toBe(42);
  });

  expect(variable.get()).toBe(0);
});

it("should handle nested synchronous runs", () => {
  const variable = new Variable<number>({ defaultValue: 0 });

  variable.run(42, () => {
    expect(variable.get()).toBe(42);

    variable.run(84, () => {
      expect(variable.get()).toBe(84);
    });

    expect(variable.get()).toBe(42);
  });

  expect(variable.get()).toBe(0);
});

it("should handle nested async runs", async () => {
  const variable = new Variable<number>({ defaultValue: 0 });

  await variable.run(42, async () => {
    expect(variable.get()).toBe(42);

    await variable.run(84, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(variable.get()).toBe(84);
    });

    expect(variable.get()).toBe(42);
  });

  expect(variable.get()).toBe(0);
});

it("should maintain state across concurrent runs", async () => {
  const variable = new Variable<number>({ defaultValue: 0 });

  await Promise.all([
    variable.run(42, async () => {
      expect(variable.get()).toBe(42);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(variable.get()).toBe(42);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(variable.get()).toBe(42);
    }),
    variable.run(84, async () => {
      expect(variable.get()).toBe(84);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(variable.get()).toBe(84);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(variable.get()).toBe(84);
    }),
  ]);

  expect(variable.get()).toBe(0);
});

it("should isolate changes in concurrent runs", async () => {
  const variable = new Variable<number>({ defaultValue: 0 });

  await Promise.all([
    variable.run(42, async () => {
      expect(variable.get()).toBe(42);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(variable.get()).toBe(42);
      void variable.run(21, async () => {
        expect(variable.get()).toBe(21);
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(variable.get()).toBe(21);
      });
      expect(variable.get()).toBe(42);
    }),
    variable.run(84, async () => {
      expect(variable.get()).toBe(84);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(variable.get()).toBe(84);
    }),
  ]);
});
