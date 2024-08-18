import { expect, it } from "vitest";
import { Variable } from "./variable.ts";
import { Snapshot } from "./snapshot.ts";

it("should capture and restore variables in a synchronous context", () => {
  const variable = new Variable<number>({ defaultValue: 0 });

  variable.run(42, () => {
    expect(variable.get()).toEqual(42);
    const snapshot = new Snapshot();
    expect(variable.get()).toEqual(42);

    variable.run(84, () => {
      expect(variable.get()).toEqual(84);

      snapshot.run(() => {
        expect(variable.get()).toEqual(42);
      });

      expect(variable.get()).toEqual(84);
    });

    expect(variable.get()).toEqual(42);
  });
});

it("should capture and restore variables in an async context", async () => {
  const variable = new Variable<number>({ defaultValue: 0 });

  await variable.run(42, async () => {
    expect(variable.get()).toEqual(42);
    const snapshot = new Snapshot();
    expect(variable.get()).toEqual(42);

    await variable.run(84, async () => {
      expect(variable.get()).toEqual(84);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(variable.get()).toEqual(84);

      const promise = snapshot.run(async () => {
        expect(variable.get()).toEqual(42);
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(variable.get()).toEqual(42);
      });

      expect(variable.get()).toEqual(84);

      await promise;
    });

    expect(variable.get()).toEqual(42);
  });
});
