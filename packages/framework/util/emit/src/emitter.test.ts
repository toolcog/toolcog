import type { Mock } from "vitest";
import { expect, it, vi } from "vitest";
import { Emitter } from "./emitter.ts";

it("should add listeners and emit events", () => {
  const emitter = new Emitter<{ test: [number, string] }>();
  const listener = vi.fn();

  emitter.addListener("test", listener);
  emitter.emit("test", 42, "hello");

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith(42, "hello");
});

it("should add once listeners and automatically remove after emit", () => {
  const emitter = new Emitter<{ test: [number, string] }>();
  const listener = vi.fn();

  emitter.addListener("test", listener, { once: true });

  emitter.emit("test", 42, "hello");
  emitter.emit("test", 42, "hello");
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith(42, "hello");
});

it("should handle multiple listeners for the same event", () => {
  const emitter = new Emitter<{ test: [number, string] }>();
  const listener1 = vi.fn();
  const listener2 = vi.fn();

  emitter.addListener("test", listener1);
  emitter.addListener("test", listener2);

  emitter.emit("test", 42, "hello");
  expect(listener1).toHaveBeenCalledTimes(1);
  expect(listener2).toHaveBeenCalledTimes(1);
});

it("should handle adding and removing the same listener multiple times", () => {
  const emitter = new Emitter<{ test: [number, string] }>();
  const listener = vi.fn();

  emitter.addListener("test", listener);
  emitter.addListener("test", listener);

  emitter.emit("test", 42, "hello");
  expect(listener).toHaveBeenCalledTimes(2);

  emitter.removeListener("test", listener);

  emitter.emit("test", 42, "hello");
  expect(listener).toHaveBeenCalledTimes(3);
});

it("should handle events with no listeners", () => {
  const emitter = new Emitter<{ test: [number, string] }>();

  const result = emitter.emit("test", 42, "hello");
  expect(result).toBe(false);
});

it("should remove listeners", () => {
  const emitter = new Emitter<{ test: [number, string] }>();
  const listener = vi.fn();

  emitter.addListener("test", listener);
  emitter.removeListener("test", listener);

  emitter.emit("test", 42, "hello");
  expect(listener).not.toHaveBeenCalled();
});

it("should remove the first of several listeners", () => {
  const emitter = new Emitter<{ test: [number, string] }>();
  const listener1 = vi.fn();
  const listener2 = vi.fn();

  emitter.addListener("test", listener1);
  emitter.addListener("test", listener2);
  emitter.removeListener("test", listener1);

  emitter.emit("test", 42, "hello");
  expect(listener1).not.toHaveBeenCalled();
  expect(listener2).toHaveBeenCalledTimes(1);
});

it("should remove the last of several listeners", () => {
  const emitter = new Emitter<{ test: [number, string] }>();
  const listener1 = vi.fn();
  const listener2 = vi.fn();

  emitter.addListener("test", listener1);
  emitter.addListener("test", listener2);
  emitter.removeListener("test", listener2);

  emitter.emit("test", 42, "hello");
  expect(listener1).toHaveBeenCalledTimes(1);
  expect(listener2).not.toHaveBeenCalled();
});

it("should remove one of several listeners", () => {
  const emitter = new Emitter<{ test: [number, string] }>();
  const listener1 = vi.fn();
  const listener2 = vi.fn();
  const listener3 = vi.fn();

  emitter.addListener("test", listener1);
  emitter.addListener("test", listener2);
  emitter.addListener("test", listener3);
  emitter.removeListener("test", listener2);

  emitter.emit("test", 42, "hello");
  expect(listener1).toHaveBeenCalledTimes(1);
  expect(listener2).not.toHaveBeenCalled();
  expect(listener3).toHaveBeenCalledTimes(1);
});

it("should propagate listener errors", () => {
  const emitter = new Emitter<{ test: [number, string] }>();
  const listener = vi.fn(() => {
    throw new Error("failure");
  });

  emitter.addListener("test", listener);

  expect(() => emitter.emit("test", 42, "hello")).toThrowError("failure");
});

it("should capture rejections when enabled", async () => {
  const emitter = new Emitter<{
    [Emitter.error]: [Error];
    test: [number, string];
  }>({ captureRejections: true });
  let errorListener: Mock | undefined;
  const listener = vi.fn().mockRejectedValue(new Error("failure"));

  const promise = new Promise<void>((resolve) => {
    errorListener = vi.fn(resolve);
    emitter.addListener(Emitter.error, errorListener);
  });
  emitter.addListener("test", listener);

  emitter.emit("test", 42, "hello");
  await promise;
  expect(errorListener).toHaveBeenCalledWith(new Error("failure"));
});

it("should async iterate on events", async () => {
  const emitter = new Emitter<{ test: [number, string] }>();

  const iterator = emitter.on("test");

  emitter.emit("test", 1, "a");
  const result1 = await iterator.next();
  expect(result1.done).toBe(false);
  expect(result1.value).toEqual([1, "a"]);

  const promise2 = iterator.next();
  emitter.emit("test", 2, "b");
  const result2 = await promise2;
  expect(result2.done).toBe(false);
  expect(result2.value).toEqual([2, "b"]);

  await iterator.return!();
});

it("should await once events", async () => {
  const emitter = new Emitter<{ test: [number, string] }>();

  const promise = emitter.once("test");

  emitter.emit("test", 1, "a");
  const result = await promise;
  expect(result).toEqual([1, "a"]);
});

it("should abort async iterators", async () => {
  const emitter = new Emitter<{ test: [number, string] }>();
  const controller = new AbortController();

  const iterator = emitter.on("test", { signal: controller.signal });

  emitter.emit("test", 1, "a");
  const result1 = await iterator.next();
  expect(result1.done).toBe(false);
  expect(result1.value).toEqual([1, "a"]);

  controller.abort(new Error("aborted"));
  const result2 = await iterator.next();
  expect(result2.done).toBe(true);
});

it("should abort async iterators while waiting", async () => {
  const emitter = new Emitter<{ test: [number, string] }>();
  const controller = new AbortController();

  const iterator = emitter.on("test", { signal: controller.signal });

  emitter.emit("test", 1, "a");
  const result1 = await iterator.next();
  expect(result1.done).toBe(false);
  expect(result1.value).toEqual([1, "a"]);

  const promise2 = iterator.next();
  controller.abort(new Error("aborted"));
  const result2 = await promise2;
  expect(result2.done).toBe(true);
});

it("should abort once promises", async () => {
  const emitter = new Emitter<{ test: [number, string] }>();
  const controller = new AbortController();

  const promise = emitter.once("test", { signal: controller.signal });

  controller.abort(new Error("aborted"));
  await expect(promise).rejects.toThrowError("aborted");
});

it("should interrupt async iterators on error emit", async () => {
  const emitter = new Emitter<{
    [Emitter.error]: [Error];
    test: [number, string];
  }>();
  const controller = new AbortController();
  const errorListener = vi.fn();

  emitter.addListener(Emitter.error, errorListener);
  const iterator = emitter.on("test", { signal: controller.signal });

  emitter.emit("test", 1, "a");
  const result1 = await iterator.next();
  expect(result1.done).toBe(false);
  expect(result1.value).toEqual([1, "a"]);

  emitter.emit(Emitter.error, new Error("failure"));
  await expect(iterator.next()).rejects.toThrowError("failure");

  emitter.emit("test", 2, "b");
  const result2 = await iterator.next();
  expect(result2.done).toBe(true);
});

it("should interrupt async iterators on error emit while waiting", async () => {
  const emitter = new Emitter<{
    [Emitter.error]: [Error];
    test: [number, string];
  }>();
  const controller = new AbortController();
  const errorListener = vi.fn();

  emitter.addListener(Emitter.error, errorListener);
  const iterator = emitter.on("test", { signal: controller.signal });

  emitter.emit("test", 1, "a");
  const result1 = await iterator.next();
  expect(result1.done).toBe(false);
  expect(result1.value).toEqual([1, "a"]);

  const promise2 = iterator.next();
  emitter.emit(Emitter.error, new Error("failure"));
  await expect(promise2).rejects.toThrowError("failure");

  emitter.emit("test", 2, "b");
  const result2 = await iterator.next();
  expect(result2.done).toBe(true);
});

it("should reject once promises on error emit", async () => {
  const emitter = new Emitter<{
    [Emitter.error]: [Error];
    test: [number, string];
  }>();
  const errorListener = vi.fn();

  emitter.addListener(Emitter.error, errorListener);
  const promise = emitter.once("test");

  emitter.emit(Emitter.error, new Error("failure"));
  await expect(promise).rejects.toThrowError("failure");
});

it("should throw on error emit if no error listeners", () => {
  const emitter = new Emitter<{ [Emitter.error]: [Error] }>();

  expect(() => {
    emitter.emit(Emitter.error, new Error("failure"));
  }).toThrowError("failure");
});

it("should not throw on error emit if at least one error listener", () => {
  const emitter = new Emitter<{ [Emitter.error]: [Error] }>();
  const listener = vi.fn();

  emitter.addListener(Emitter.error, listener);

  expect(emitter.emit(Emitter.error, new Error("failure")));
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith(new Error("failure"));
});

it("should iterate over events", () => {
  const emitter = new Emitter<{
    test1: [number, string];
    test2: [boolean];
  }>();

  emitter.addListener("test1", () => void 0);
  emitter.addListener("test2", () => void 0);

  const events = [...emitter.events()];
  expect(events.length).toBe(2);
  expect(events).toContain("test1");
  expect(events).toContain("test2");
});

it("should iterate over listeners", () => {
  const emitter = new Emitter<{ test: [number, string] }>();
  const listener1 = vi.fn();
  const listener2 = vi.fn();

  emitter.addListener("test", listener1);
  emitter.addListener("test", listener2);

  const listeners = [...emitter.listeners("test")];
  expect(listeners).toEqual([listener1, listener2]);
});
