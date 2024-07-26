import { AsyncContext } from "@toolcog/util/async";

/**
 * Returns a throttled wrapper function that invokes `func` at most once
 * every `interval` milliseconds. The throttled wrapper function returns
 * a `Promise` that resolves the next time `func` is called. The wrapper
 * function never calls `func` concurrently.
 */
const throttle = <F extends (...args: any[]) => unknown>(
  func: F,
  interval: number,
): {
  (...args: Parameters<F>): Promise<Awaited<ReturnType<F>>>;
  readonly bypass: F;
  readonly force: () => Promise<Awaited<ReturnType<F>> | undefined>;
  readonly cancel: () => void;
} => {
  let timeout: NodeJS.Timeout | undefined;
  let timestamp: number | undefined;
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

    // Immediately reset the throttle state to support concurrent throttling
    // while the previous invocation asynchronously executes.
    timeout = undefined;
    timestamp = performance.now();
    pendingArgs = undefined;
    pendingResult = undefined as Promise<Awaited<ReturnType<F>>> | undefined;
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

      // Check if the throttled wrapper function was concurrently called.
      if (pendingResult !== undefined) {
        // Resume throttling the next invocation.
        const now = performance.now();
        if (timestamp + interval <= now) {
          // No invocation in the last `interval` milliseconds;
          // begin the next invocation on the next tick.
          // Mark as `running` to prevent concurrent scheduling.
          running = pendingResult;
          // This is not a throttle timer, so it's not assigned to `timeout`.
          setTimeout(callback, 0);
        } else {
          // No existing `timeout` can be defined because scheduling
          // is disabled while running.
          //assert(timeout === undefined);

          // Schedule the throttle timer.
          timeout = setTimeout(callback, timestamp + interval - now);
        }
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

    // Don't begin throttling the next invocation until
    // the previous invocation completes.
    if (running === undefined) {
      const now = performance.now();
      if (timestamp === undefined || timestamp + interval <= now) {
        // No invocation in the last `interval` milliseconds;
        // immediately begin the next invocation.
        if (timeout !== undefined) {
          // The throttle interval has elapsed, but the callback hasn't run yet;
          // cancel the throttle timer in favor of immediate invocation.
          clearTimeout(timeout);
        }
        // Capture the pending result promise before it gets reset.
        const pending = pendingResult;
        void callback();
        return pending;
      } else if (timeout === undefined) {
        // Schedule the throttle timer for the next invocation.
        timeout = setTimeout(callback, timestamp + interval - now);
      }
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

export { throttle };
