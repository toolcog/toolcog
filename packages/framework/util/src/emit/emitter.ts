import type {
  EmitListener,
  EmitListenerOptions,
  EmitAsyncOptions,
  EmitEvents,
  Emit,
} from "./emit.ts";
import { FifoQueue } from "@toolcog/util/queue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class EmitNode<Args extends any[] = any[]> {
  readonly listener: EmitListener<Args>;
  readonly once: boolean;
  prev: EmitNode<Args>;
  next: EmitNode<Args>;

  constructor(listener: EmitListener<Args>, once: boolean) {
    this.listener = listener;
    this.once = once;
    this.prev = this;
    this.next = this;
  }
}

interface EmitterOptions {
  captureRejections?: boolean | undefined;
}

class Emitter<Events extends EmitEvents = EmitEvents> implements Emit<Events> {
  static readonly error: unique symbol = Symbol("Emitter.error");
  static readonly errorMonitor: unique symbol = Symbol("Emitter.errorMonitor");

  #events: Map<keyof Events, EmitNode> | undefined;
  readonly #captureRejections: boolean;

  constructor(options?: EmitterOptions) {
    this.#events = undefined;
    this.#captureRejections = options?.captureRejections ?? false;
  }

  addListener<Event extends keyof Events>(
    event: Event,
    listener: EmitListener<Events[Event]>,
    options?: EmitListenerOptions,
  ): this {
    const once = options !== undefined && options.once === true;
    this.#insertNode(event, new EmitNode(listener, once));
    return this;
  }

  removeListener<Event extends keyof Events>(
    event: Event,
    listener: EmitListener<Events[Event]>,
    options?: EmitListenerOptions,
  ): this {
    let node: EmitNode<Events[Event]> | undefined = this.#events?.get(event);
    if (node !== undefined) {
      do {
        if (
          node.listener === listener &&
          (options?.once === undefined || options.once === node.once)
        ) {
          this.#removeNode(event, node);
          break;
        }
        node = node.next;
      } while (node !== this.#events!.get(event));
    }
    return this;
  }

  on<Event extends keyof Events>(
    event: Event,
    options?: EmitAsyncOptions,
  ): AsyncIterableIterator<Events[Event]> {
    const signal = options?.signal;

    let abortListener: (() => void) | undefined;
    if (signal !== undefined) {
      signal.throwIfAborted();
      abortListener = () => {
        if (resolveNext !== undefined) {
          resolveNext({ done: true, value: undefined });
        } else {
          state = 1; // abort
        }
      };
      signal.addEventListener("abort", abortListener, { once: true });
    }

    let errorListener: ((error: unknown) => void) | undefined;
    if (event !== "error") {
      errorListener = (error: unknown) => {
        if (rejectNext !== undefined) {
          rejectNext(error);
        } else {
          state = 2; // error
          reason = error;
        }
      };
      (this as Emitter<{ [Emitter.errorMonitor]: [unknown] }>).addListener(
        Emitter.errorMonitor,
        errorListener,
        { once: true },
      );
    }

    const queue = new FifoQueue<Events[Event]>();
    let state = 0; // 0: ready; 1: abort; 2: error;
    let reason: unknown;

    let resolveNext:
      | ((result: IteratorResult<Events[Event]>) => void)
      | undefined;
    let rejectNext: ((error: unknown) => void) | undefined;

    const listener = (...args: Events[Event]) => {
      if (resolveNext !== undefined) {
        resolveNext({ done: false, value: args });
      } else {
        queue.enqueue(args);
      }
    };
    this.addListener(event, listener);

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const emitter = this;
    return (async function* () {
      try {
        while (true) {
          if (state === 1) {
            // abort
            return;
          } else if (state === 2) {
            // error
            throw reason;
          }

          let next = queue.dequeue();
          if (next === undefined) {
            const result = await new Promise<IteratorResult<Events[Event]>>(
              (resolve, reject) => {
                resolveNext = resolve;
                rejectNext = reject;
              },
            );
            resolveNext = undefined;
            rejectNext = undefined;

            if (result.done === true) {
              break;
            }
            next = result.value;
          }
          yield next;
        }
      } finally {
        emitter.removeListener(event, listener);
        if (errorListener !== undefined) {
          (
            emitter as Emitter<{ [Emitter.errorMonitor]: [unknown] }>
          ).removeListener(Emitter.errorMonitor, errorListener);
        }
        signal?.removeEventListener("abort", abortListener!);
      }
    })();
  }

  once<Event extends keyof Events>(
    event: Event,
    options?: EmitAsyncOptions,
  ): Promise<Events[Event]> {
    const signal = options?.signal;

    return new Promise<Events[Event]>((resolve, reject) => {
      let abortListener: (() => void) | undefined;
      if (signal !== undefined) {
        signal.throwIfAborted();
        abortListener = () => {
          reject(signal.reason);
          this.removeListener(event, listener);
          if (errorListener !== undefined) {
            (
              this as Emitter<{ [Emitter.errorMonitor]: [unknown] }>
            ).removeListener(Emitter.errorMonitor, errorListener);
          }
        };
        signal.addEventListener("abort", abortListener, { once: true });
      }

      let errorListener: ((error: unknown) => void) | undefined;
      if (event !== "error") {
        errorListener = (error: unknown) => {
          reject(error);
          this.removeListener(event, listener);
          signal?.removeEventListener("abort", abortListener!);
        };
        (this as Emitter<{ [Emitter.errorMonitor]: [unknown] }>).addListener(
          Emitter.errorMonitor,
          errorListener,
          { once: true },
        );
      }

      const listener = (...args: Events[Event]) => {
        resolve(args);
        if (errorListener !== undefined) {
          (
            this as Emitter<{ [Emitter.errorMonitor]: [unknown] }>
          ).removeListener(Emitter.errorMonitor, errorListener);
        }
        signal?.removeEventListener("abort", abortListener!);
      };
      this.addListener(event, listener, { once: true });
    });
  }

  emit<Event extends keyof Events>(
    event: Event,
    ...args: Events[Event]
  ): boolean {
    const head: EmitNode<Events[Event]> | undefined = this.#events?.get(event);
    if (head === undefined) {
      if (event === Emitter.error) {
        throw args[0];
      }
      return false;
    }

    if (event === Emitter.error) {
      (this as Emitter<{ [Emitter.errorMonitor]: Events[Event] }>).emit(
        Emitter.errorMonitor,
        ...args,
      );
    }

    let node = head;
    do {
      const next = node.next;
      if (node.once) {
        this.#removeNode(event, node);
      }

      const result = node.listener.call(
        this,
        ...args,
      ) as PromiseLike<void> | null | void;

      if (
        this.#captureRejections &&
        result !== null &&
        typeof result === "object" &&
        typeof result.then === "function"
      ) {
        result.then(undefined, (error: unknown) => {
          (this as Emitter<{ [Emitter.error]: [unknown] }>).emit(
            Emitter.error,
            error,
          );
        });
      }

      node = next;
    } while (node !== head);
    return true;
  }

  events(): IterableIterator<keyof Events> {
    return this.#events?.keys() ?? [][Symbol.iterator]();
  }

  *listeners<Event extends keyof Events>(
    event: Event,
  ): IterableIterator<EmitListener<Events[Event]>> {
    const head: EmitNode<Events[Event]> | undefined = this.#events?.get(event);
    if (head !== undefined) {
      let node = head;
      do {
        yield node.listener;
        node = node.next;
      } while (node !== head);
    }
  }

  #insertNode<Event extends keyof Events>(
    event: Event,
    node: EmitNode<Events[Event]>,
  ): void {
    if (this.#events === undefined) {
      this.#events = new Map();
    }
    const head: EmitNode<Events[Event]> | undefined = this.#events.get(event);
    if (head === undefined) {
      this.#events.set(event, node);
    } else {
      const foot = head.prev;
      foot.next = node;
      node.prev = foot;
      node.next = head;
      head.prev = node;
    }
  }

  #removeNode<Event extends keyof Events>(
    event: Event,
    node: EmitNode<Events[Event]>,
  ): void {
    if (node.next === node) {
      this.#events!.delete(event);
    } else {
      node.prev.next = node.next;
      node.next.prev = node.prev;
      if (node === this.#events!.get(event)) {
        this.#events!.set(event, node.next);
      }
    }
  }
}

export type { EmitterOptions };
export { Emitter };
