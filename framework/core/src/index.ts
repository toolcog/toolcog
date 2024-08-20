import type { EmbeddingModel, EmbeddingVector } from "./embedding.ts";
import type { EmbedderConfig, EmbedderOptions, Embedder } from "./embedder.ts";
import type { Idioms } from "./idiom.ts";

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
   */
  (
    query: string | EmbeddingVector,
    options?: IndexOptions,
  ): Promise<T[number][]>;

  readonly id: string | undefined;

  readonly model: EmbeddingModel | undefined;

  readonly embedder: Embedder | undefined;

  readonly idioms: Idioms<T>;
}

const defineIndex: {
  <const T extends readonly unknown[]>(
    values: readonly [...T],
    config?: IndexConfig,
  ): Index<T>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <const T extends readonly unknown[]>(
    values: readonly [...T],
    config?: IndexConfig,
  ): Index<T> => {
    throw new Error("Uncompiled index");
  },
  {
    brand: Symbol("toolcog.defineIndex"),
  } as const,
) as typeof defineIndex;

export type { IndexConfig, IndexOptions, Index };
export { defineIndex };
