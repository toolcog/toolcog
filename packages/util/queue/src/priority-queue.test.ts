import { expect, it } from "vitest";
import { PriorityQueue } from "./priority-queue.ts";

it("should enqueue and dequeue elements in priority order", () => {
  const queue = new PriorityQueue();

  queue.enqueue("a", 3);
  queue.enqueue("b", 1);
  queue.enqueue("c", 2);

  expect(queue.dequeue()).toBe("b");
  expect(queue.dequeue()).toBe("c");
  expect(queue.dequeue()).toBe("a");
});

it("dequeueing an empty queue should return undefined", () => {
  const queue = new PriorityQueue();
  expect(queue.dequeue()).toBe(undefined);
});

it("should return the correct size of the queue", () => {
  const queue = new PriorityQueue();
  expect(queue.size).toBe(0);

  queue.enqueue("a", 1);
  expect(queue.size).toBe(1);
  queue.enqueue("b", 2);
  expect(queue.size).toBe(2);

  queue.dequeue();
  expect(queue.size).toBe(1);
  queue.dequeue();
  expect(queue.size).toBe(0);
});

it("should correctly identify if the queue is empty", () => {
  const queue = new PriorityQueue();
  expect(queue.isEmpty()).toBe(true);

  queue.enqueue("a", 1);
  expect(queue.isEmpty()).toBe(false);

  queue.dequeue();
  expect(queue.isEmpty()).toBe(true);
});

it("should peek at the highest priority element without removing it", () => {
  const queue = new PriorityQueue();
  queue.enqueue("a", 2);
  queue.enqueue("b", 1);

  expect(queue.peek()).toBe("b");
  expect(queue.size).toBe(2);

  queue.dequeue();
  expect(queue.peek()).toBe("a");
  expect(queue.size).toBe(1);
});

it("should maintain priority order after multiple operations", () => {
  const queue = new PriorityQueue();

  queue.enqueue("a", 1);
  queue.enqueue("b", 2);
  queue.enqueue("c", 3);

  expect(queue.dequeue()).toBe("a");

  queue.enqueue("d", 0);

  expect(queue.dequeue()).toBe("d");
  expect(queue.dequeue()).toBe("b");
  expect(queue.dequeue()).toBe("c");
});

it("should correctly handle elements with the same priority", () => {
  const queue = new PriorityQueue();

  queue.enqueue("a", 1);
  queue.enqueue("b", 1);
  queue.enqueue("c", 1);

  expect(queue.dequeue()).toBe("a");
  expect(queue.dequeue()).toBe("b");
  expect(queue.dequeue()).toBe("c");
});
