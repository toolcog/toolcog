// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmitListener<Args extends any[] = any[]> = (
  ...args: Args
) => void | PromiseLike<void>;

interface EmitListenerOptions {
  once?: boolean | undefined;
}

interface EmitAsyncOptions {
  signal?: AbortSignal | undefined;
}

type EmitEvents<
  Event extends string | symbol = string | symbol,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Args extends any[] = any[],
> = Record<Event, Args>;

interface Emit<Events extends EmitEvents = EmitEvents> {
  addListener<Event extends keyof Events>(
    event: Event,
    listener: EmitListener<Events[Event]>,
    options?: EmitListenerOptions,
  ): this;

  removeListener<Event extends keyof Events>(
    event: Event,
    listener: EmitListener<Events[Event]>,
    options?: EmitListenerOptions,
  ): this;

  on<Event extends keyof Events>(
    event: Event,
    options?: EmitAsyncOptions,
  ): AsyncIterableIterator<Events[Event]>;

  once<Event extends keyof Events>(
    event: Event,
    options?: EmitAsyncOptions,
  ): Promise<Events[Event]>;
}

export type {
  EmitListener,
  EmitListenerOptions,
  EmitAsyncOptions,
  EmitEvents,
  Emit,
};
