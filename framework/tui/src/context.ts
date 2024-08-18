import { AsyncContext } from "@toolcog/util/async";
import type { View } from "./view.ts";

type Slot<T> =
  | {
      readonly initialized: false;
      get(): T | undefined;
      set(value: T): void;
    }
  | {
      readonly initialized: true;
      get(): T;
      set(value: T): void;
    };

class Context {
  readonly #view: View;
  readonly #update: () => void;

  readonly #slots: unknown[];
  readonly #effects: (() => void)[];
  readonly #cleanups: ((() => void) | undefined)[];

  #batching: boolean;
  #triggered: boolean;
  #hookCount: number;

  constructor(view: View, update: () => void) {
    this.#view = view;
    this.#update = update;

    this.#slots = [];
    this.#effects = [];
    this.#cleanups = [];

    this.#batching = false;
    this.#triggered = false;
    this.#hookCount = 0;
  }

  get view(): View {
    return this.#view;
  }

  reset(): void {
    this.#hookCount = 0;
  }

  update(): void {
    if (this.#batching) {
      this.#triggered = true;
    } else {
      this.#update();
    }
  }

  batch<F extends (...args: any[]) => unknown>(
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> {
    this.#batching = true;
    this.#triggered = false as boolean;
    try {
      return func(...args) as ReturnType<F>;
    } finally {
      if (this.#triggered) {
        this.#update();
        this.#triggered = false;
      }
      this.#batching = false;
    }
  }

  enqueue(effect: (view: View) => (() => void) | void): void {
    const slotId = this.#hookCount;

    this.#effects.push(() => {
      this.#cleanups[slotId]?.();

      const cleanup = effect(this.#view) as (() => void) | undefined;
      if (cleanup !== undefined && typeof cleanup !== "function") {
        throw new Error("useEffect must return void or a cleanup function");
      }

      this.#cleanups[slotId] = cleanup;
    });
  }

  runEffects(): void {
    this.batch(() => {
      for (const effect of this.#effects) {
        effect();
      }
      this.#effects.length = 0;
    });
  }

  runCleanups(): void {
    for (const cleanup of this.#cleanups) {
      cleanup?.();
    }
  }

  useSlot<T, R>(hook: (slot: Slot<T>) => R): R {
    const slotId = this.#hookCount;

    const slot: Slot<T> = {
      initialized: slotId in this.#slots,
      get: (): T => {
        return this.#slots[slotId] as T;
      },
      set: (value: T): void => {
        this.#slots[slotId] = value;
      },
    };

    const result = hook(slot);

    this.#hookCount += 1;

    return result;
  }

  static #global: Context | null = null;

  static global(): Context | null {
    return this.#global;
  }

  static setGlobal(context: Context | null): void {
    this.#global = context;
  }

  static readonly #current = new AsyncContext.Variable<Context>({
    name: "tui.context",
  });

  static current(): Context {
    const context = Context.#current.get();
    if (context === undefined) {
      throw new Error("No view context");
    }
    return context;
  }

  static get(): Context | null {
    return Context.#current.get() ?? null;
  }

  static run<F extends (...args: any[]) => unknown>(
    context: Context,
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> {
    return Context.#current.run(context, func, ...args);
  }
}

const update = (): void => {
  Context.current().update();
};

const batch = <F extends (...args: any[]) => unknown>(
  func: F,
  ...args: Parameters<F>
): ReturnType<F> => {
  return Context.current().batch(func, ...args);
};

const batched = <F extends (...args: any[]) => unknown>(
  func: F,
): ((...args: Parameters<F>) => ReturnType<F>) => {
  return AsyncContext.Snapshot.wrap((...args: Parameters<F>): ReturnType<F> => {
    return batch(func, ...args);
  });
};

const enqueue = (effect: (view: View) => (() => void) | void): void => {
  Context.current().enqueue(effect);
};

const useSlot = <T, R>(hook: (slot: Slot<T>) => R): R => {
  return Context.current().useSlot(hook);
};

const useView = (): View => {
  return Context.current().view;
};

export type { Slot };
export { Context, update, batch, batched, enqueue, useSlot, useView };
