class LruNode<K, V> {
  readonly key: K;
  value: V;
  prev: LruNode<K, V> | null;
  next: LruNode<K, V> | null;

  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

class LruCache<K, V> {
  readonly #capacity: number;
  readonly #map: Map<K, LruNode<K, V>>;
  #head: LruNode<K, V> | null;
  #foot: LruNode<K, V> | null;

  constructor(capacity: number) {
    this.#capacity = capacity;
    this.#map = new Map();
    this.#head = null;
    this.#foot = null;
  }

  get capacity(): number {
    return this.#capacity;
  }

  get(key: K): V | undefined {
    const node = this.#map.get(key);
    if (node === undefined) {
      return undefined;
    }
    this.#moveToFront(node);
    return node.value;
  }

  set(key: K, value: V): void {
    let node = this.#map.get(key);
    if (node !== undefined) {
      node.value = value;
      this.#moveToFront(node);
      return;
    }

    node = new LruNode<K, V>(key, value);
    if (this.#map.size >= this.#capacity) {
      this.#evict();
    }
    this.#addToFront(node);
    this.#map.set(key, node);
  }

  delete(key: K): boolean {
    const node = this.#map.get(key);
    if (node === undefined) {
      return false;
    }
    this.#map.delete(key);
    this.#removeNode(node);
    return true;
  }

  clear(): void {
    this.#map.clear();
    this.#head = null;
    this.#foot = null;
  }

  #addToFront(node: LruNode<K, V>): void {
    node.next = this.#head;
    node.prev = null;
    if (this.#head !== null) {
      this.#head.prev = node;
    }
    this.#head = node;
    if (this.#foot === null) {
      this.#foot = node;
    }
  }

  #removeNode(node: LruNode<K, V>): void {
    if (node.prev !== null) {
      node.prev.next = node.next;
    }
    if (node.next !== null) {
      node.next.prev = node.prev;
    }
    if (node === this.#head) {
      this.#head = node.next;
    }
    if (node === this.#foot) {
      this.#foot = node.prev;
    }
  }

  #moveToFront(node: LruNode<K, V>): void {
    if (node === this.#head) {
      return;
    }
    this.#removeNode(node);
    this.#addToFront(node);
  }

  #evict(): void {
    const node = this.#foot;
    if (node === null) {
      return;
    }
    this.#map.delete(node.key);
    this.#removeNode(node);
  }
}

export { LruCache };
