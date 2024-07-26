import type { Bindings } from "./bindings.ts";
import { scope } from "#scope";

class Snapshot {
  readonly #snapshot: Bindings | undefined;

  constructor() {
    this.#snapshot = scope.snapshot();
  }

  run<F extends (...args: any[]) => unknown>(
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> {
    return scope.run(this.#snapshot, func, ...args);
  }

  static wrap<F extends (...args: any[]) => unknown>(
    func: F,
  ): (this: ThisType<F>, ...args: Parameters<F>) => ReturnType<F> {
    return scope.wrap(func);
  }
}

export { Snapshot };
