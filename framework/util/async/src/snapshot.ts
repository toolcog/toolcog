import type { Bindings } from "./bindings.ts";
import { snapshot, run, wrap } from "#scope";

class Snapshot {
  readonly #snapshot: Bindings | undefined;

  constructor() {
    this.#snapshot = snapshot();
  }

  run<F extends (...args: any[]) => unknown>(
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> {
    return run(this.#snapshot, func, ...args);
  }

  static wrap<F extends (...args: any[]) => unknown>(
    func: F,
  ): (this: ThisType<F>, ...args: Parameters<F>) => ReturnType<F> {
    return wrap(func);
  }
}

export { Snapshot };
