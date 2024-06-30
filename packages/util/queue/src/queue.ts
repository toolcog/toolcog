interface Queue<T> {
  get size(): number;

  isEmpty(): boolean;

  peek(): T | undefined;

  dequeue(): T | undefined;

  enqueue(value: T, priority?: number): void;
}

export type { Queue };
