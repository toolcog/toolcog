import { AsyncLocalStorage } from "node:async_hooks";
import { Bindings } from "./bindings.ts";

const asyncLocalStorage = new AsyncLocalStorage<Bindings | undefined>();

const current = (): Bindings | undefined => {
  return asyncLocalStorage.getStore();
};

const snapshot = (): Bindings | undefined => {
  return asyncLocalStorage.getStore()?.branch();
};

const run = <F extends (...args: any[]) => unknown>(
  frame: Bindings | undefined,
  func: F,
  ...args: Parameters<F>
): ReturnType<F> => {
  return asyncLocalStorage.run(frame, func, ...args) as ReturnType<F>;
};

const wrap = <F extends (...args: any[]) => unknown>(
  func: F,
): ((this: ThisType<F>, ...args: Parameters<F>) => ReturnType<F>) => {
  const frame = snapshot();
  return function (this: ThisType<F>, ...args: Parameters<F>): ReturnType<F> {
    return asyncLocalStorage.run(frame, () => {
      return func.call(this, ...args) as ReturnType<F>;
    });
  };
};

export { current, snapshot, run, wrap };
