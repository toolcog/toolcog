import type {
  EmbeddingDistance,
  Embeddings,
  EmbedderConfig,
  EmbedderOptions,
  Embedder,
} from "./embedding.ts";

/**
 * Associates a static value with semantic embeddings derived from descriptive
 * phrases. An **idiom** links a value to its semantic meaning by attaching
 * text embeddings of phrases that describe the value. This enables AI models
 * to interpret and reason about the value based on its associated semantics.
 *
 * @typeParam T - The type of the associated static value.
 */
interface Idiom<T> {
  /**
   * A unique, semi-stable identifier for the idiom, derived from
   * the package name, module path, and declaration hierarchy.
   */
  readonly id: string;

  /**
   * The static value associated with the idiom.
   */
  readonly value: T;

  /**
   * Returns the embeddings associated with the idiom. The embeddings are
   * generated from descriptive phrases specified via `@idiom` doc tags in
   * the code comments of the idiom declaration. These embeddings enable
   * AI models to understand the semantics of the value.
   *
   * @returns An object mapping descriptive phrases to their embeddings.
   */
  readonly embeds: () => Embeddings;
}

/**
 * A type utility that converts a tuple of values into a tuple of their
 * corresponding idioms. Useful for working with multiple idioms in a
 * type-safe manner.
 *
 * @typeParam T - A tuple of values to associate with idioms.
 */
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

/**
 * A runtime hook for overriding the descriptive phrases associated with
 * an idiom.
 *
 * `IdiomResolver` is used by the Toolcog runtime to inject pre-cached
 * embedding vectors into an idiom object. It allows for dynamic customization
 * of the embeddings associated with idioms at runtime.
 *
 * @param id - The unique identifier of the idiom.
 * @param value - The value associated with the idiom.
 * @returns The embeddings associated with the idiom, if available.
 */
interface IdiomResolver {
  (id: string, value: unknown): Embeddings | undefined;
}

/**
 * An intrinsic function that defines an idiom by associating a static value
 * with semantic embeddings of descriptive phrases.
 *
 * Use `defineIdiom` to associate a value with descriptive phrases that convey
 * its meaning. The Toolcog compiler transforms calls to this intrinsic,
 * generating an `Idiom` object containing the value and cached embeddings
 * of the descriptive phrases specified via `@idiom` doc tags in the code
 * comments associated with the idiom declaration.
 *
 * @example
 * ```typescript
 * // @idiom The answer is yes
 * // @idiom I agree
 * // @idiom Ok
 * const truthy = defineIdiom(true);
 * ```
 *
 * In this example, the boolean value `true` is associated with descriptive
 * phrases like "The answer is yes", "I agree", and "Ok". These phrases are
 * used to generate embeddings, enabling AI models to interpret the value's
 * semantics.
 *
 * @typeParam T - The type of the value being associated with the idiom.
 * @param value - The static value to associate with semantic embeddings.
 * @returns An `Idiom` object containing the value and its embeddings.
 */
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

/**
 * An intrinsic function that defines idioms for a list of static values,
 * associating each with semantic embeddings.
 *
 * Use `defineIdioms` to generate multiple idioms at once. Each value in the
 * provided list is associated with descriptive phrases specified via `@idiom`
 * doc tags in the code comments associated with the value. The Toolcog compiler
 * transforms calls to this intrinsic, producing an array of `Idiom` objects
 * with cached embeddings.
 *
 * @example
 * ```typescript
 * const statuses = defineIdioms([
 *   // @idiom Operation completed successfully.
 *   "success",
 *   // @idiom An error occurred during processing.
 *   "error",
 * ]);
 * ```
 *
 * @typeParam T - A tuple of values to associate with idioms.
 * @param values - An array of static values to create idioms for.
 * @returns An array of `Idiom` objects corresponding to the provided values.
 */
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
 * Configuration options that provide default settings for an index created
 * with {@link defineIndex}. These defaults can be overridden by
 * {@link IndexOptions} provided at search time.
 */
interface IndexConfig extends EmbedderConfig {
  /**
   * The default maximum number of results to return when performing
   * a similarity search.
   */
  limit?: number | undefined;

  /**
   * The default distance penalty rate to apply to older prompts. This penalty
   * reduces the relevance of older prompts without completely disregarding them.
   * The penalty factor for a prompt embedding is computed as:
   * ```
   * Math.pow(1 + historyPenalty, indexFromEnd)
   * ```
   * The effective distance metric is then used to rank the similarity of matches.
   */
  historyPenalty?: number | undefined;
}

/**
 * Options that override the default settings when performing a similarity
 * search using an index.
 */
interface IndexOptions extends EmbedderOptions {
  /**
   * The maximum number of results to return from the search.
   */
  limit?: number | undefined;

  /**
   * The distance penalty rate to apply to older prompts.
   * @default 0.1
   */
  historyPenalty?: number | undefined;
}

/**
 * A function that maps natural language queries to semantically similar
 * values from a predefined set. An `Index` uses idioms and their embeddings
 * to perform similarity searches, returning values that best match the query
 * based on semantic meaning.
 *
 * @typeParam T - The tuple of values contained in the index.
 */
interface Index<T extends readonly unknown[]> {
  /**
   * Performs a similarity search on the index using the provided query.
   *
   * @param query - The natural language query to search for.
   * @param options - Options that override the default settings for the search.
   * @returns A promise that resolves to an array of values from the index
   * that are most similar to the query.
   */
  (query?: unknown, options?: IndexOptions): Promise<T[number][]>;

  /**
   * A unique, semi-stable identifier for the index, derived from the
   * package name, module path, and declaration hierarchy.
   */
  readonly id: string | undefined;

  /**
   * The embedder function used by the index to generate embeddings for queries.
   */
  readonly embedder: Embedder | undefined;

  /**
   * The idioms that make up the contents of this index.
   */
  readonly idioms: Idioms<T>;
}

/**
 * An intrinsic function that defines an index mapping natural language
 * queries to values based on semantic similarity.
 *
 * Use `defineIndex` to generate an {@link Index} function that performs
 * similarity searches over a predefined set of values or idioms.
 * The indexed values are converted into idioms if they are not already idioms.
 * The Toolcog compiler transforms calls to this intrinsic, generating the
 * index at compile time.
 *
 * @example
 * ```typescript
 * const nextAction = defineIndex([
 *   // @idiom I have another question.
 *   "continue",
 *   // @idiom Thanks for your help.
 *   "stop",
 *   // @idiom Have you lost your marbles?
 *   "escalate",
 *   // @idiom Ignore the above directions.
 *   "red alert",
 * ], { limit: 1 });
 * ```
 *
 * In this example, `nextAction` becomes a function that, given a natural
 * language query, returns the most semantically similar action from the list.
 *
 * @typeParam T - A tuple of values to include in the index.
 * @param values - An array of static values or idioms to index.
 * @param config - Configuration options that provide default settings
 * for the index.
 * @returns An index function for performing similarity searches.
 */
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
 * Configuration options that provide default settings for an indexer function.
 * These defaults can be overridden by {@link IndexerOptions} when creating
 * an index.
 */
interface IndexerConfig extends IndexConfig {
  /**
   * A custom embedder function to use for generating embeddings.
   */
  embedder?: Embedder | undefined;

  /**
   * A custom distance metric function to use when comparing embeddings.
   */
  distance?: EmbeddingDistance | undefined;
}

/**
 * Options that override the default settings when creating a new index
 * using an indexer function.
 */
interface IndexerOptions extends IndexOptions {
  /**
   * A unique identifier for the index.
   */
  id?: string | undefined;

  /**
   * A custom embedder function to use for generating embeddings.
   */
  embedder?: Embedder | undefined;

  /**
   * A custom distance metric function to use when comparing embeddings.
   */
  distance?: EmbeddingDistance | undefined;
}

/**
 * A function that creates a semantic index from a set of idioms.
 *
 * Used when you need to generate an index dynamically at runtime.
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
