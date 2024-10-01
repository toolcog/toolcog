import { expect, it } from "vitest";
import { FifoQueue } from "./fifo-queue.ts";

it("should enqueue and dequeue elements in fifo order", () => {
  const queue = new FifoQueue();

  queue.enqueue("a");
  queue.enqueue("b");
  queue.enqueue("c");

  expect(queue.dequeue()).toBe("a");
  expect(queue.dequeue()).toBe("b");
  expect(queue.dequeue()).toBe("c");
});

it("dequeueing an empty queue should return undefined", () => {
  const queue = new FifoQueue();
  expect(queue.dequeue()).toBe(undefined);
});

it("should return the correct size of the queue", () => {
  const queue = new FifoQueue();
  expect(queue.size).toBe(0);

  queue.enqueue("a");
  expect(queue.size).toBe(1);
  queue.enqueue("b");
  expect(queue.size).toBe(2);

  queue.dequeue();
  expect(queue.size).toBe(1);
  queue.dequeue();
  expect(queue.size).toBe(0);
});

it("should correctly identify if the queue is empty", () => {
  const queue = new FifoQueue();
  expect(queue.isEmpty()).toBe(true);

  queue.enqueue("a");
  expect(queue.isEmpty()).toBe(false);

  queue.dequeue();
  expect(queue.isEmpty()).toBe(true);
});

it("should peek at the head element without removing it", () => {
  const queue = new FifoQueue();
  queue.enqueue("a");
  queue.enqueue("b");

  expect(queue.peek()).toBe("a");
  expect(queue.size).toBe(2);

  queue.dequeue();
  expect(queue.peek()).toBe("b");
  expect(queue.size).toBe(1);
});

it("should maintain fifo order after multiple operations", () => {
  const queue = new FifoQueue();

  queue.enqueue("a");
  queue.enqueue("b");
  queue.dequeue();

  queue.enqueue("c");
  queue.enqueue("d");
  queue.dequeue();
  queue.dequeue();

  expect(queue.size).toBe(1);
  expect(queue.peek()).toBe("d");
});
