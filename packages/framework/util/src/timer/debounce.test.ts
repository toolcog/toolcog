import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { debounce } from "./debounce.ts";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it("should invoke the function after the specified interval", async () => {
  const func = vi.fn().mockResolvedValue("success");
  const debouncedFunc = debounce(func, 100);

  const promise = debouncedFunc();
  expect(func).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(100);

  expect(func).toHaveBeenCalledOnce();
  expect(await promise).toBe("success");
});

it("should delay the function call if invoked again before the interval", async () => {
  const func = vi.fn().mockResolvedValue("success");
  const debouncedFunc = debounce(func, 100);

  const promise1 = debouncedFunc();
  await vi.advanceTimersByTimeAsync(50);

  const promise2 = debouncedFunc();
  await vi.advanceTimersByTimeAsync(50);

  expect(func).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(50);

  expect(func).toHaveBeenCalledOnce();
  expect(await promise1).toBe("success");
  expect(await promise2).toBe("success");
});

it("should return the same promise for the same interval", async () => {
  const func = vi.fn().mockResolvedValue("success");
  const debouncedFunc = debounce(func, 100);

  const promise1 = debouncedFunc();
  const promise2 = debouncedFunc();
  expect(promise1).toBe(promise2);
  await vi.advanceTimersByTimeAsync(100);

  expect(func).toHaveBeenCalledOnce();
  expect(await promise1).toBe("success");
  expect(await promise2).toBe("success");
});

it("should invoke the function with the latest arguments", async () => {
  const func = vi.fn().mockResolvedValue("success");
  const debouncedFunc = debounce(func, 100);

  void debouncedFunc("arg1");
  await vi.advanceTimersByTimeAsync(50);

  const promise = debouncedFunc("arg2");
  await vi.advanceTimersByTimeAsync(100);

  expect(func).toHaveBeenCalledWith("arg2");
  expect(await promise).toBe("success");
});

it("should handle errors thrown by the debounced function", async () => {
  const func = vi.fn().mockRejectedValue(new Error("failure"));
  const debouncedFunc = debounce(func, 100);

  const promise = expect(debouncedFunc()).rejects.toThrowError("failure");
  await vi.advanceTimersByTimeAsync(100);

  expect(func).toHaveBeenCalledOnce();
  await promise;
});

it("should handle non-overlapping invocations", async () => {
  const func = vi.fn().mockResolvedValue("success");
  const debouncedFunc = debounce(func, 100);

  const promise1 = debouncedFunc();
  await vi.advanceTimersByTimeAsync(100);

  const promise2 = debouncedFunc();
  await vi.advanceTimersByTimeAsync(100);

  expect(func).toHaveBeenCalledTimes(2);
  expect(await promise1).toBe("success");
  expect(await promise2).toBe("success");
});

it("should handle interleaved invocations", async () => {
  const func = vi.fn().mockImplementation(async () => {
    return new Promise<string>((resolve) =>
      setTimeout(() => resolve("success"), 200),
    );
  });
  const debouncedFunc = debounce(func, 100);

  const promise1 = debouncedFunc();
  await vi.advanceTimersByTimeAsync(100);

  // The first invocation has begun.
  expect(func).toHaveBeenCalledTimes(1);

  // Concurrently trigger the second invocation; the debounce interval
  // won't begin until the first invocation completes.
  const promise2 = debouncedFunc();
  await vi.advanceTimersByTimeAsync(100);

  // A second debounce interval would have elapsed
  // if the first invocation were not still running.
  expect(func).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(100);

  // The first invocation has finally completed
  // and the second debounce interval has begun.
  expect(func).toHaveBeenCalledTimes(1);
  expect(await promise1).toBe("success");
  await vi.advanceTimersByTimeAsync(100);

  // The second invocation has begun.
  expect(func).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(200);

  // The second invocation has completed.
  expect(await promise2).toBe("success");
});
