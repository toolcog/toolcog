import { AsyncContext } from "@toolcog/util/async";

/**
 * Returns a debounced wrapper function that delays invoking `func` until
 * `interval` milliseconds have elapsed since the last time it was invoked.
 * The debounced wrapper function returns a `Promise` that resolves the next
 * time `func` is called. The wrapper function never calls `func` concurrently.
 */
const debounce = <F extends (...args: any[]) => unknown>(
  func: F,
  interval: number,
): {
  (...args: Parameters<F>): Promise<Awaited<ReturnType<F>>>;
  readonly bypass: F;
  readonly force: () => Promise<Awaited<ReturnType<F>> | undefined>;
  readonly cancel: () => void;
} => {
  let timeout: NodeJS.Timeout | undefined;
  let running: Promise<Awaited<ReturnType<F>>> | undefined;
  let pendingArgs: Parameters<F> | undefined;
  let pendingResult: Promise<Awaited<ReturnType<F>>> | undefined;
  let resolvePending: ((value: Awaited<ReturnType<F>>) => void) | undefined;
  let rejectPending: ((reason?: unknown) => void) | undefined;

  const callback = async (): Promise<void> => {
    // Capture the most recent invocation arguments and promise resolvers
    // so that they remain available across the coming await boundary.
    running = pendingResult!;
    const args = pendingArgs!;
    const resolve = resolvePending!;
    const reject = rejectPending!;

    // Immediately reset the debounce state to support concurrent debouncing
    // while the previous invocation asynchronously executes.
    timeout = undefined;
    pendingArgs = undefined as Parameters<F> | undefined;
    pendingResult = undefined;
    resolvePending = undefined;
    rejectPending = undefined;

    try {
      // Invoke the wrapped function and await its result.
      const result = await Promise.resolve(func(...args) as ReturnType<F>);
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      running = undefined;

      // Check if the debounced wrapper function was concurrently called.
      if (pendingArgs !== undefined) {
        // Resume debouncing the next invocation.
        timeout = setTimeout(callback, interval);
      }
    }
  };

  const wrapper = (...args: Parameters<F>): Promise<Awaited<ReturnType<F>>> => {
    // Record the latest invocation arguments.
    pendingArgs = args;

    if (pendingResult === undefined) {
      // Create a shared promise to resolve with the next invocation.
      pendingResult = new Promise((resolve, reject) => {
        resolvePending = resolve;
        rejectPending = reject;
      });
    }

    // Don't begin debouncing the next invocation until
    // the previous invocation completes.
    if (running === undefined) {
      if (timeout !== undefined) {
        // Cancel the previously set debounce timer.
        clearTimeout(timeout);
      }
      // Schedule a new debounce timer.
      timeout = setTimeout(callback, interval);
    }

    return pendingResult;
  };

  const force = (): Promise<Awaited<ReturnType<F>> | undefined> => {
    if (running !== undefined) {
      cancel();
      return running;
    }

    if (pendingResult !== undefined) {
      clearTimeout(timeout);
      const pending = pendingResult;
      void callback();
      return pending;
    }

    return Promise.resolve(undefined);
  };

  const cancel = (): void => {
    if (timeout !== undefined) {
      clearTimeout(timeout);
      timeout = undefined;
    }
    pendingArgs = undefined;
    pendingResult = undefined;
    resolvePending = undefined;
    rejectPending = undefined;
  };

  return Object.assign(AsyncContext.Snapshot.wrap(wrapper), {
    bypass: func,
    force,
    cancel,
  });
};

export { debounce };
