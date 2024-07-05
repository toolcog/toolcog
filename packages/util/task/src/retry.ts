import type { Task } from "./task.ts";

interface RetryOptions {
  retries?: number | undefined;
  factor?: number | undefined;
  minTimeout?: number | undefined;
  maxTimeout?: number | undefined;
  jitter?: boolean | undefined;
  signal?: AbortSignal | undefined;
  onFailedAttempt?: ((reason: unknown) => void) | undefined;
  shouldRetry?: ((reason: unknown) => boolean) | undefined;
}

const retry = async <T>(
  task: Task<T>,
  options: RetryOptions = {},
): Promise<T> => {
  const {
    retries = 3,
    factor = 2,
    minTimeout = 1000,
    maxTimeout = 10000,
    jitter = true,
    signal,
    onFailedAttempt,
    shouldRetry,
  } = options;

  let attempt = 0;

  while (attempt <= retries) {
    signal?.throwIfAborted();

    try {
      return await task({ attempt, signal });
    } catch (error) {
      onFailedAttempt?.(error);

      if (attempt === retries || shouldRetry?.(error) === false) {
        throw error;
      }

      let timeout = minTimeout * factor ** attempt;
      if (jitter) {
        timeout *= 1 + Math.random();
      }
      timeout = Math.min(timeout, maxTimeout);

      await new Promise((resolve) => setTimeout(resolve, timeout));

      attempt += 1;
    }
  }

  throw new Error("Exceeded maximum retries");
};

export type { RetryOptions };
export { retry };
