import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TaskOptions, Task } from "./task.ts";
import { Dispatcher } from "./dispatcher.ts";

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "performance",
    ],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

it("should execute tasks up to the concurrency limit", async () => {
  const dispatcher = new Dispatcher({ concurrency: 2 });
  const task = vi.fn(createTask(1000, "done"));

  void dispatcher.enqueue(task);
  void dispatcher.enqueue(task);
  void dispatcher.enqueue(task);
  expect(task).toHaveBeenCalledTimes(2);

  await vi.advanceTimersByTimeAsync(1000);
  expect(task).toHaveBeenCalledTimes(3);
});

it("should rate limit task execution", async () => {
  const dispatcher = new Dispatcher({ rateLimit: 2, rateInterval: 1000 });
  const task = vi.fn(createTask(1000, "done"));

  void dispatcher.enqueue(task);
  void dispatcher.enqueue(task);
  void dispatcher.enqueue(task);
  void dispatcher.enqueue(task);
  expect(task).toHaveBeenCalledTimes(2);

  await vi.advanceTimersByTimeAsync(500);
  expect(task).toHaveBeenCalledTimes(2);

  await vi.advanceTimersByTimeAsync(500);
  expect(task).toHaveBeenCalledTimes(4);
});

it("should pause and resume task execution", async () => {
  const dispatcher = new Dispatcher({ concurrency: 2 });
  const task = vi.fn(createTask(1000, "done"));

  void dispatcher.enqueue(task);
  void dispatcher.enqueue(task);
  void dispatcher.enqueue(task);
  expect(task).toHaveBeenCalledTimes(2);

  dispatcher.pause();
  void dispatcher.enqueue(task);
  expect(task).toHaveBeenCalledTimes(2);

  await vi.advanceTimersByTimeAsync(1000);
  expect(task).toHaveBeenCalledTimes(2);

  dispatcher.resume();
  expect(task).toHaveBeenCalledTimes(4);
});

it("should correctly handle task cancellation", async () => {
  const dispatcher = new Dispatcher();
  const task = vi.fn(createTask(1000, "done"));

  const controller = new AbortController();
  const promise = dispatcher.enqueue(task, { signal: controller.signal });

  controller.abort(new Error("aborted"));
  await expect(promise).rejects.toThrowError("aborted");
});

it("should correctly handle task prioritization", () => {
  const dispatcher = new Dispatcher({ paused: true });
  const task1 = vi.fn(createTask(1000, "done"));
  const task2 = vi.fn(createTask(1000, "done"));

  void dispatcher.enqueue(task1, { priority: 1 });
  void dispatcher.enqueue(task2, { priority: 0 });

  dispatcher.resume();
  expect(task2.mock.invocationCallOrder[0]!).toBeLessThan(
    task1.mock.invocationCallOrder[0]!,
  );
});

it("should not exceed the rate limit when tasks carryover", async () => {
  const dispatcher = new Dispatcher({
    concurrency: 2,
    rateLimit: 2,
    rateInterval: 1000,
    pendingCarryover: true,
  });
  const task = vi.fn(createTask(1000, "done"));

  void dispatcher.enqueue(task);
  void dispatcher.enqueue(task);
  void dispatcher.enqueue(task);
  void dispatcher.enqueue(task);
  expect(task).toHaveBeenCalledTimes(2);

  await vi.advanceTimersByTimeAsync(1000);
  expect(task).toHaveBeenCalledTimes(2);

  await vi.advanceTimersByTimeAsync(1000);
  expect(task).toHaveBeenCalledTimes(4);
});

it("should clear timers when paused", async () => {
  const dispatcher = new Dispatcher({
    concurrency: 2,
    rateLimit: 2,
    rateInterval: 1000,
  });
  const task = vi.fn(createTask(1000, "done"));

  void dispatcher.enqueue(task);
  void dispatcher.enqueue(task);
  void dispatcher.enqueue(task);
  void dispatcher.enqueue(task);
  expect(task).toHaveBeenCalledTimes(2);

  dispatcher.pause();
  await vi.advanceTimersByTimeAsync(1500);

  expect(task).toHaveBeenCalledTimes(2);
  dispatcher.resume();

  await vi.advanceTimersByTimeAsync(500);
  expect(task).toHaveBeenCalledTimes(4);
});

it("should report the correct size and empty status of the queue", () => {
  const dispatcher = new Dispatcher({ paused: true });
  const task = vi.fn(createTask(1000, "done"));

  expect(dispatcher.size).toBe(0);
  expect(dispatcher.isEmpty()).toBe(true);

  void dispatcher.enqueue(task);
  expect(dispatcher.size).toBe(1);
  expect(dispatcher.isEmpty()).toBe(false);

  dispatcher.resume();
  expect(dispatcher.size).toBe(0);
  expect(dispatcher.isEmpty()).toBe(true);
});

const createTask = <T>(duration: number, value: T): Task<T> => {
  return ({ signal }: TaskOptions): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new Error("aborted")));
      setTimeout(() => resolve(value), duration);
    });
  };
};
