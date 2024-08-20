import type { Queue } from "@toolcog/util/queue";
import { PriorityQueue } from "@toolcog/util/queue";
import type { EmitterOptions } from "@toolcog/util/emit";
import { Emitter } from "@toolcog/util/emit";
import type { TaskOptions, Task } from "./task.ts";
import type { RetryOptions } from "./retry.ts";
import { retry } from "./retry.ts";

interface DispatchOptions {
  /**
   * The execution priority of the task. Lower numeric values correspond to
   * higher priority tasks.
   *
   * @default 0
   */
  priority?: number | undefined;

  /**
   * The signal used to cancel execution of the task.
   */
  signal?: AbortSignal | null | undefined;

  retry?: RetryOptions | number | boolean | undefined;
}

interface DispatcherOptions extends EmitterOptions {
  /**
   * The maximum number of tasks that can be concurrently executing at any
   * given time. Used to limit the concurrency of task execution.
   *
   * @default Infinity
   */
  concurrency?: number | undefined;

  /**
   * The maximum number of tasks that can be executed in any given
   * `rateInterval`. Used to rate limit task execution. If `rateLimit`
   * is infinite, or if `rateInterval` is zero or infinite, then task
   * execution will not be rate limited.
   *
   * @default Infinity
   */
  rateLimit?: number | undefined;

  /**
   * The number of milliseconds in each rate limit interval.
   * If zero or infinite, then task execution will not be rate limited.
   *
   * @default 0
   */
  rateInterval?: number | undefined;

  /**
   * Whether to count pending tasks towards the `rateLimit` when entering
   * a new rate limit interval. Used to ensure that tasks started during
   * a previous interval are counted towards the rate limit of the next
   * interval if they haven't finished executing yet.
   *
   * @default false
   */
  pendingCarryover?: boolean | undefined;

  retry?: RetryOptions | number | boolean | undefined;

  /**
   * Whether to initialize the dispatcher in the paused state. Used to defer
   * executing tasks until {@link Dispatcher.resume} is called.
   *
   * @default false
   */
  paused?: boolean | undefined;

  /**
   * The function used to create the dispatcher's run queue.
   *
   * @default {@link PriorityQueue}
   */
  Queue?: (new <T>() => Queue<T>) | undefined;
}

type DispatcherEvents = {
  enqueue: [];
  execute: [];
  complete: [];
  finish: [];
  empty: [];
  idle: [];
  pause: [];
  resume: [];
  [Dispatcher.error]: [unknown];
};

class Dispatcher<
  EventTypes extends DispatcherEvents = DispatcherEvents,
> extends Emitter<EventTypes> {
  readonly #queue: Queue<() => Promise<void>>;

  readonly #concurrency: number;
  readonly #rateLimit: number;
  readonly #rateInterval: number;
  readonly #pendingCarryover: boolean;
  readonly #retryOptions: RetryOptions | number | boolean | undefined;

  get #rateLimited(): boolean {
    return this.#rateLimit !== Infinity && this.#rateInterval !== 0;
  }

  #pendingTasks: number;
  #executedTasks: number;
  #intervalDeadline: number;
  #intervalTimer: ReturnType<typeof setInterval> | undefined;
  #remainingTimer: ReturnType<typeof setTimeout> | undefined;

  #paused: boolean;
  #processing: boolean;

  constructor(options?: DispatcherOptions) {
    super(options);

    this.#queue = new (options?.Queue ?? PriorityQueue)<() => Promise<void>>();

    this.#concurrency = options?.concurrency ?? Infinity;
    this.#rateLimit = options?.rateLimit ?? Infinity;
    this.#rateInterval = options?.rateInterval ?? 0;
    this.#pendingCarryover = options?.pendingCarryover ?? false;
    this.#retryOptions = options?.retry;

    this.#pendingTasks = 0;
    this.#executedTasks = 0;
    this.#intervalDeadline = 0;
    this.#intervalTimer = undefined;
    this.#remainingTimer = undefined;

    this.#paused = options?.paused ?? false;
    this.#processing = false;
  }

  get size(): number {
    return this.#queue.size;
  }

  isEmpty(): boolean {
    return this.#queue.isEmpty();
  }

  enqueue<T>(task: Task<T>, options?: DispatchOptions): Promise<T> {
    const priority = options?.priority;
    const signal = options?.signal;

    let retryOptions = options?.retry ?? this.#retryOptions;
    if (retryOptions !== undefined) {
      if (typeof retryOptions === "number") {
        retryOptions = { retries: retryOptions };
      } else if (retryOptions === true) {
        retryOptions = {};
      } else if (retryOptions === false) {
        retryOptions = undefined;
      }
      if (retryOptions !== undefined) {
        task = (taskOptions: TaskOptions) => {
          return retry(task, {
            ...(retryOptions as RetryOptions),
            ...taskOptions,
          });
        };
      }
    }

    return new Promise<T>((resolve, reject: (reason?: unknown) => void) => {
      let abortListener: (() => void) | undefined;
      if (signal !== undefined && signal !== null) {
        signal.throwIfAborted();
        abortListener = () => reject(signal.reason);
        signal.addEventListener("abort", abortListener, { once: true });
      }

      const run = async () => {
        this.#executedTasks += 1;
        this.#pendingTasks += 1;
        try {
          this.emit("execute");
          const taskOptions = { priority, signal };
          await Promise.resolve(task(taskOptions)).then(resolve, reject);
          this.emit("complete");
        } catch (error) {
          reject(error);
          this.emit(Dispatcher.error, error);
        } finally {
          this.#pendingTasks -= 1;
          signal?.removeEventListener("abort", abortListener!);
          this.emit("finish");
          if (!this.#processing) {
            void this.#processNext();
          }
        }
      };

      this.#queue.enqueue(run, priority);

      this.emit("enqueue");

      void this.#processNext();
    });
  }

  enqueueAll<T>(
    tasks: readonly Task<T>[],
    options: DispatchOptions = {},
  ): Promise<T[]> {
    return Promise.all(tasks.map((task) => this.enqueue(task, options)));
  }

  get concurrency(): number {
    return this.#concurrency;
  }

  get paused(): boolean {
    return this.#paused;
  }

  pause(): void {
    if (this.#paused) {
      return;
    }

    this.#paused = true;
    if (this.#intervalTimer) {
      clearInterval(this.#intervalTimer);
      this.#intervalTimer = undefined;
    }

    this.emit("pause");
  }

  resume(): void {
    if (!this.#paused) {
      return;
    }

    this.#paused = false;
    this.#processQueue();

    this.emit("resume");
  }

  get pending(): number {
    return this.#pendingTasks;
  }

  async onAvailable(backlog: number): Promise<void> {
    if (this.#queue.size >= backlog) {
      for await (const _ of this.on("finish")) {
        if (this.#queue.size < backlog) {
          break;
        }
      }
    }
  }

  async onEmpty(): Promise<void> {
    if (!this.#queue.isEmpty()) {
      await this.once("empty");
    }
  }

  isIdle(): boolean {
    return this.#pendingTasks === 0 && this.#queue.isEmpty();
  }

  async onIdle(): Promise<void> {
    if (!this.isIdle()) {
      await this.once("idle");
    }
  }

  #processQueue(): void {
    if (this.#processing) {
      return;
    }

    this.#processing = true;
    try {
      while (this.#processNext() !== undefined) {
        // Task executed.
      }
    } finally {
      this.#processing = false;
    }
  }

  #processNext(): Promise<void> | undefined {
    if (this.#paused || this.#queue.isEmpty()) {
      if (
        this.#intervalTimer &&
        this.#pendingTasks === 0 &&
        this.#executedTasks === 0
      ) {
        clearInterval(this.#intervalTimer);
        this.#intervalTimer = undefined;
      }

      if (!this.#paused) {
        this.emit("empty");
        if (this.#pendingTasks === 0) {
          this.emit("idle");
        }
      }

      return undefined;
    }

    // Rate limit task execution, if enabled.
    if (!this.#intervalTimer && this.#rateLimited) {
      const currentTime = performance.now();
      const remainingTime = this.#intervalDeadline - currentTime;
      if (remainingTime <= 0) {
        // Begin a new rate limit interval.
        this.#executedTasks = this.#pendingCarryover ? this.#pendingTasks : 0;
        // Schedule the interval timer.
        this.#intervalDeadline = currentTime + this.#rateInterval;
        this.#intervalTimer = setInterval(this.#onInterval, this.#rateInterval);
      } else if (!this.#remainingTimer) {
        // Resume the interval timer when the current rate limit interval ends.
        this.#remainingTimer = setTimeout(this.#onInterval, remainingTime);
      }
    }

    // Check concurrency and rate limits.
    if (
      this.#pendingTasks >= this.#concurrency ||
      (this.#rateLimited && this.#executedTasks >= this.#rateLimit)
    ) {
      return undefined;
    }

    // Execute the next task.
    const run = this.#queue.dequeue()!;
    return run();
  }

  readonly #onInterval = (): void => {
    if (this.#remainingTimer) {
      clearTimeout(this.#remainingTimer);
      this.#remainingTimer = undefined;
    }

    // Begin a new rate limit interval.
    this.#executedTasks = this.#pendingCarryover ? this.#pendingTasks : 0;

    this.#processQueue();
  };
}

export type { DispatchOptions, DispatcherOptions, DispatcherEvents };
export { Dispatcher };
