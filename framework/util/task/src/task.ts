interface TaskOptions {
  /**
   * A signal to cancel the execution of the task.
   */
  signal?: AbortSignal | null | undefined;

  /**
   * The number of times the task has been retried.
   */
  attempt?: number | undefined;
}

type Task<T = unknown> = (options: TaskOptions) => T | PromiseLike<T>;

export type { TaskOptions, Task };
