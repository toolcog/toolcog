import { Bindings } from "./bindings.ts";

let bindings: Bindings | undefined;

const current = (): Bindings | undefined => {
  return bindings;
};

const snapshot = (): Bindings | undefined => {
  return bindings?.branch();
};

const run = <F extends (...args: any[]) => unknown>(
  frame: Bindings | undefined,
  func: F,
  ...args: Parameters<F>
): ReturnType<F> => {
  const previous = bindings;
  bindings = frame;
  try {
    return func(...args) as ReturnType<F>;
  } finally {
    bindings = previous;
  }
};

const wrap = <F extends (...args: any[]) => unknown>(
  func: F,
): ((this: ThisType<F>, ...args: Parameters<F>) => ReturnType<F>) => {
  const frame = snapshot();
  return function (this: ThisType<F>, ...args: Parameters<F>): ReturnType<F> {
    const previous = bindings;
    bindings = frame;
    try {
      return func.call(this, ...args) as ReturnType<F>;
    } finally {
      bindings = previous;
    }
  };
};

// Monkey-patch

const originalThen = Promise.prototype.then;
Promise.prototype.then = function <T, T1, T2>(
  this: Promise<T>,
  onFulfilled?: ((value: T) => T1 | PromiseLike<T1>) | null,
  onRejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
): Promise<T1 | T2> {
  if (typeof onFulfilled === "function") {
    onFulfilled = wrap(onFulfilled);
  }
  if (typeof onRejected === "function") {
    onRejected = wrap(onRejected);
  }
  return originalThen.call(this, onFulfilled, onRejected) as Promise<T1 | T2>;
};

const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((
  callback: (...args: any[]) => void,
  timeout?: number,
  ...args: unknown[]
): ReturnType<typeof globalThis.setTimeout> => {
  return originalSetTimeout(wrap(callback), timeout, ...args);
}) as typeof globalThis.setTimeout;

const originalSetInterval = globalThis.setInterval;
globalThis.setInterval = ((
  callback: (...args: any[]) => void,
  timeout?: number,
  ...args: unknown[]
): ReturnType<typeof globalThis.setInterval> => {
  return originalSetInterval(wrap(callback), timeout, ...args);
}) as typeof globalThis.setInterval;

export { current, snapshot, run, wrap };
