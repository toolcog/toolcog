import type { Variable } from "./variable.ts";

/**
 * A mapping from variables to their values with copy-on-write semantics
 * when aliased.
 */
class Bindings {
  #variables: Map<Variable<unknown>, unknown>;
  #aliased: boolean;

  constructor(variables?: Map<Variable<unknown>, unknown>, aliased?: boolean) {
    this.#variables = variables ?? new Map<Variable<unknown>, unknown>();
    this.#aliased = aliased ?? false;
  }

  has(variable: Variable<unknown>): boolean {
    return this.#variables.has(variable);
  }

  get<T>(variable: Variable<T>): T | undefined {
    return this.#variables.get(variable) as T | undefined;
  }

  set<T>(variable: Variable<T>, value: T | undefined): this {
    this.#dealias();
    this.#variables.set(variable, value);
    return this;
  }

  delete(variable: Variable<unknown>): boolean {
    this.#dealias();
    return this.#variables.delete(variable);
  }

  branch(): Bindings {
    this.#aliased = true;
    return new Bindings(this.#variables, true);
  }

  #dealias(): void {
    if (this.#aliased) {
      this.#variables = new Map(this.#variables);
      this.#aliased = false;
    }
  }
}

export { Bindings };
