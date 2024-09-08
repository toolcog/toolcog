import type {
  EmbeddingDistance,
  Embeddings,
  EmbedderConfig,
  EmbedderOptions,
  Embedder,
} from "./embedding.ts";

/**
 * A collection of embeddings associated with a value.
 */
interface Idiom<T> {
  (): Embeddings;

  readonly id: string;

  readonly value: T;
}

type Idioms<T extends readonly unknown[]> =
  T extends readonly [] ? readonly []
  : T extends readonly [infer Elem] ? readonly [Idiom<Elem>]
  : T extends readonly [infer Head, ...infer Tail] ?
    readonly [Idiom<Head>, ...Idioms<Tail>]
  : T extends readonly [...infer Body, infer Foot] ?
    readonly [...Idioms<Body>, Idiom<Foot>]
  : T extends readonly (infer Elem)[] ? readonly Idiom<Elem>[]
  : never;

/** @internal */
type AnyIdiom = Idiom<unknown>;

/** @internal */
type AnyIdioms = Idioms<readonly unknown[]>;

interface IdiomResolver {
  (id: string, value: unknown): Embeddings | undefined;
}

const defineIdiom: {
  <const T>(value: T): Idiom<T>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <const T>(value: T): Idiom<T> => {
    throw new Error("Uncompiled idiom");
  },
  {
    brand: Symbol("toolcog.defineIdiom"),
  } as const,
) as typeof defineIdiom;

const defineIdioms: {
  <const T extends readonly unknown[]>(values: readonly [...T]): Idioms<T>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <const T extends readonly unknown[]>(values: readonly [...T]): Idioms<T> => {
    throw new Error("Uncompiled idioms");
  },
  {
    brand: Symbol("toolcog.defineIdioms"),
  } as const,
) as typeof defineIdioms;

/**
 * Options for configuring an {@link Index} function.
 */
interface IndexConfig extends EmbedderConfig {
  limit?: number | undefined;
}

/**
 * Options for controlling an {@link Index} call.
 */
interface IndexOptions extends EmbedderOptions {
  limit?: number | undefined;
}

/**
 * A similarity search index.
 */
interface Index<T extends readonly unknown[]> {
  /**
   * Returns the indexed values that are most similar to the given `query`.
   * The `query` will be converted into an `EmbeddingVector`, if it isn't
   * already one.
   */
  (query?: unknown, options?: IndexOptions): Promise<T[number][]>;

  readonly id: string | undefined;

  readonly embedder: Embedder | undefined;

  readonly idioms: Idioms<T>;
}

const defineIndex: {
  <const T extends readonly unknown[]>(
    values: readonly [...T] | Idioms<T>,
    config?: IndexConfig,
  ): Index<T>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <const T extends readonly unknown[]>(
    values: readonly [...T] | Idioms<T>,
    config?: IndexConfig,
  ): Index<T> => {
    throw new Error("Uncompiled index");
  },
  {
    brand: Symbol("toolcog.defineIndex"),
  } as const,
) as typeof defineIndex;

/**
 * Options for configuring an {@link Indexer} function.
 */
interface IndexerConfig extends IndexConfig {
  embedder?: Embedder | undefined;

  distance?: EmbeddingDistance | undefined;
}

/**
 * Options for controlling an {@link Indexer} call.
 */
interface IndexerOptions extends IndexOptions {
  id?: string | undefined;

  embedder?: Embedder | undefined;

  distance?: EmbeddingDistance | undefined;
}

/**
 * A function that returns a similarity {@link Index} for a set of idioms.
 */
interface Indexer {
  <T extends readonly unknown[]>(
    idioms: Idioms<T>,
    options?: IndexerOptions,
  ): Promise<Index<T>>;
}

export type {
  Idiom,
  Idioms,
  AnyIdiom,
  AnyIdioms,
  IdiomResolver,
  IndexConfig,
  IndexOptions,
  Index,
  IndexerConfig,
  IndexerOptions,
  Indexer,
};
export { defineIdiom, defineIdioms, defineIndex };
