import { Bindings } from "./bindings.ts";
import { scope } from "#scope";

interface VariableOptions<T> {
  name?: string | undefined;
  defaultValue?: T | undefined;
}

class Variable<T> {
  readonly #name: string;
  readonly #defaultValue: T | undefined;

  constructor(options?: VariableOptions<T>) {
    this.#name = options?.name ?? "";
    this.#defaultValue = options?.defaultValue;
  }

  get name(): string {
    return this.#name;
  }

  get(): T | undefined {
    const frame = scope.current();
    if (frame?.has(this) === true) {
      return frame.get(this);
    } else {
      return this.#defaultValue;
    }
  }

  run<F extends (...args: any[]) => unknown>(
    value: T,
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> {
    let frame = scope.current();
    if (frame !== undefined) {
      frame = frame.branch();
    } else {
      frame = new Bindings();
    }
    frame.set(this, value);
    return scope.run(frame, func, ...args);
  }
}

export type { VariableOptions };
export { Variable };
