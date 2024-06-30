import { Bindings } from "./bindings.ts";

interface Scope {
  current(): Bindings | undefined;

  snapshot(): Bindings | undefined;

  run<F extends (...args: any[]) => unknown>(
    frame: Bindings | undefined,
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F>;

  wrap<F extends (...args: any[]) => unknown>(
    func: F,
  ): (this: ThisType<F>, ...args: Parameters<F>) => ReturnType<F>;
}

export type { Scope };
