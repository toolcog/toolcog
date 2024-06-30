import type { Queue } from "./queue.ts";

class FifoNode<T> {
  readonly value: T;
  next: FifoNode<T> | null;

  constructor(value: T, next: FifoNode<T> | null = null) {
    this.value = value;
    this.next = next;
  }
}

class FifoQueue<T> implements Queue<T> {
  #head: FifoNode<T> | null;
  #foot: FifoNode<T> | null;
  #size: number;

  constructor() {
    this.#head = null;
    this.#foot = null;
    this.#size = 0;
  }

  get size(): number {
    return this.#size;
  }

  isEmpty(): boolean {
    return this.#size === 0;
  }

  peek(): T | undefined {
    return this.#head?.value;
  }

  dequeue(): T | undefined {
    if (this.#head === null) {
      return undefined;
    }

    const value = this.#head.value;

    this.#head = this.#head.next;
    if (this.#head === null) {
      this.#foot = null;
    }

    this.#size -= 1;
    return value;
  }

  enqueue(value: T): void {
    const node = new FifoNode(value);

    if (this.#foot !== null) {
      this.#foot.next = node;
    }
    this.#foot = node;

    if (this.#head === null) {
      this.#head = node;
    }

    this.#size += 1;
  }
}

export { FifoQueue };
