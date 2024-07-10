import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Task } from "./task.ts";
import { retry } from "./retry.ts";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it("should resolve on the first attempt if the task succeeds", async () => {
  const task: Task = vi.fn().mockResolvedValue("success");

  const result = await retry(task);
  expect(result).toBe("success");
  expect(task).toHaveBeenCalledTimes(1);
});

it("should retry failed tasks", async () => {
  const task: Task = vi
    .fn()
    .mockRejectedValueOnce(new Error("failure"))
    .mockResolvedValueOnce("success");
  const options = { retries: 1 };

  const promise = retry(task, options);
  await vi.runAllTimersAsync();

  const result = await promise;
  expect(result).toBe("success");
  expect(task).toHaveBeenCalledTimes(2);
});

it("should fail after the maximum number of retries", async () => {
  const task: Task = vi.fn().mockRejectedValue(new Error("failure"));
  const options = { retries: 3 };

  const promise = expect(retry(task, options)).rejects.toThrowError("failure");
  await vi.runAllTimersAsync();

  await promise;
  expect(task).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
});

it("should call onFailedAttempt after each failed", async () => {
  const task: Task = vi.fn().mockRejectedValue(new Error("failure"));
  const onFailedAttempt = vi.fn();
  const options = { retries: 1, onFailedAttempt };

  const promise = expect(retry(task, options)).rejects.toThrowError("failure");
  await vi.runAllTimersAsync();

  await promise;
  expect(task).toHaveBeenCalledTimes(2);
  expect(onFailedAttempt).toHaveBeenCalledTimes(2);
});

it("should respect the shouldRetry predicate", async () => {
  const task: Task = vi.fn().mockRejectedValue(new Error("failure"));
  const shouldRetry = vi.fn().mockReturnValue(false);
  const options = { retries: 2, shouldRetry };

  const promise = expect(retry(task, options)).rejects.toThrowError("failure");
  await vi.runAllTimersAsync();

  await promise;
  expect(task).toHaveBeenCalledTimes(1);
  expect(shouldRetry).toHaveBeenCalledTimes(1);
});

it("should abort when the signal is aborted", async () => {
  const task: Task = vi.fn().mockRejectedValue(new Error("failure"));
  const controller = new AbortController();
  const options = { retries: 2, signal: controller.signal };

  const promise = expect(retry(task, options)).rejects.toThrowError("aborted");
  controller.abort(new Error("aborted"));
  await vi.runAllTimersAsync();

  await promise;
  expect(task).toHaveBeenCalledTimes(1);
});
