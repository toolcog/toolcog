import type { Queue } from "./queue.ts";

class PriorityNode<T> {
  readonly value: T;
  readonly priority: number;
  readonly sequence: number;

  constructor(value: T, priority: number, sequence: number) {
    this.value = value;
    this.priority = priority;
    this.sequence = sequence;
  }

  precedes(that: PriorityNode<T>): boolean {
    return (
      this.priority < that.priority ||
      (this.priority === that.priority && this.sequence < that.sequence)
    );
  }
}

class PriorityQueue<T> implements Queue<T> {
  readonly #heap: PriorityNode<T>[];
  #sequence: number;

  constructor() {
    this.#heap = [];
    this.#sequence = 0;
  }

  get size(): number {
    return this.#heap.length;
  }

  isEmpty(): boolean {
    return this.#heap.length === 0;
  }

  peek(): T | undefined {
    return this.#heap.length !== 0 ? this.#heap[0]!.value : undefined;
  }

  dequeue(): T | undefined {
    if (this.#heap.length === 0) {
      return undefined;
    }

    if (this.#heap.length === 1) {
      return this.#heap.pop()!.value;
    }

    const rootValue = this.#heap[0]!.value;
    this.#heap[0] = this.#heap.pop()!;
    this.#bubbleDown();

    return rootValue;
  }

  enqueue(value: T, priority: number = 0): void {
    const node = new PriorityNode(value, priority, (this.#sequence += 1));
    this.#heap.push(node);
    this.#bubbleUp();
  }

  #bubbleDown() {
    // Move the root element down to its correct position.
    let index = 0;
    while (2 * index + 1 < this.#heap.length) {
      const leftIndex = 2 * index + 1;
      const rightIndex = 2 * index + 2;

      // Choose the smaller of the two children.
      const childIndex =
        (
          rightIndex < this.#heap.length &&
          this.#heap[rightIndex]!.precedes(this.#heap[leftIndex]!)
        ) ?
          rightIndex
        : leftIndex;

      if (this.#heap[index]!.precedes(this.#heap[childIndex]!)) {
        break; // the heap property is satisfied.
      }

      // Swap the element with its smaller child.
      [this.#heap[index], this.#heap[childIndex]] = [
        this.#heap[childIndex]!,
        this.#heap[index]!,
      ];
      index = childIndex;
    }
  }

  #bubbleUp() {
    // Move the last element up to its correct position.
    let index = this.#heap.length - 1;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);

      if (!this.#heap[index]!.precedes(this.#heap[parentIndex]!)) {
        break; // the heap property is satisfied.
      }

      // Swap the element with its parent.
      [this.#heap[index], this.#heap[parentIndex]] = [
        this.#heap[parentIndex]!,
        this.#heap[index]!,
      ];
      index = parentIndex;
    }
  }
}

export { PriorityQueue };
