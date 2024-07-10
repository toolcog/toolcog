import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { throttle } from "./throttle.ts";

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "performance"],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

it("should immediately invoke the function if not throttled", async () => {
  const func = vi.fn().mockResolvedValue("success");
  const throttledFunc = throttle(func, 100);

  const promise = throttledFunc();
  expect(func).toHaveBeenCalledOnce();
  expect(await promise).toBe("success");
});

it("should invoke the function at most once per interval", async () => {
  const func = vi.fn().mockResolvedValue("success");
  const throttledFunc = throttle(func, 100);

  const promise1 = throttledFunc();
  const promise2 = throttledFunc();
  expect(func).toHaveBeenCalledTimes(1);
  expect(await promise1).toBe("success");

  await vi.advanceTimersByTimeAsync(100);
  expect(func).toHaveBeenCalledTimes(2);
  expect(await promise2).toBe("success");
});

it("should return the same promise for the same interval", async () => {
  const func = vi.fn().mockResolvedValue("success");
  const throttledFunc = throttle(func, 100);

  void throttledFunc();

  const promise1 = throttledFunc();
  const promise2 = throttledFunc();
  expect(promise1).toBe(promise2);

  await vi.advanceTimersByTimeAsync(100);
  expect(func).toHaveBeenCalledTimes(2);
});

it("should invoke the function with the latest arguments", async () => {
  const func = vi.fn().mockResolvedValue("success");
  const throttledFunc = throttle(func, 100);

  void throttledFunc("arg");
  const promise1 = throttledFunc("arg1");
  const promise2 = throttledFunc("arg2");

  await vi.advanceTimersByTimeAsync(100);
  expect(func).toHaveBeenCalledWith("arg2");
  expect(await promise1).toBe("success");
  expect(await promise2).toBe("success");
});

it("should handle errors thrown by the throttled function", async () => {
  const func = vi.fn().mockRejectedValue(new Error("failure"));
  const throttledFunc = throttle(func, 100);

  const promise = throttledFunc();
  expect(func).toHaveBeenCalledOnce();
  await expect(promise).rejects.toThrowError("failure");
});

it("should handle non-overlapping invocations", async () => {
  const func = vi.fn().mockResolvedValue("success");
  const throttledFunc = throttle(func, 100);

  const promise1 = throttledFunc();
  expect(func).toHaveBeenCalledTimes(1);
  expect(await promise1).toBe("success");

  await vi.advanceTimersByTimeAsync(100);

  const promise2 = throttledFunc();
  expect(func).toHaveBeenCalledTimes(2);
  expect(await promise2).toBe("success");
});

it("should handle interleaved invocations", async () => {
  const func = vi.fn().mockImplementation(async () => {
    return new Promise<string>((resolve) =>
      setTimeout(() => resolve("success"), 200),
    );
  });
  const throttledFunc = throttle(func, 100);

  const promise1 = throttledFunc();
  expect(func).toHaveBeenCalledOnce();

  // Concurrently trigger the second invocation; the throttle interval
  // won't begin until the first invocation completes.
  const promise2 = throttledFunc();
  await vi.advanceTimersByTimeAsync(100);

  // The second throttle interval would have elapsed
  // if the first invocation were not still running.
  expect(func).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(100);

  // The first invocation has finally completed
  // and the throttle interval has begun.
  expect(func).toHaveBeenCalledTimes(1);
  expect(await promise1).toBe("success");
  await vi.advanceTimersByTimeAsync(100);

  // The second invocation has begun.
  expect(func).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(200);

  // The second invocation has completed.
  expect(await promise2).toBe("success");
});
