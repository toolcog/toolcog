import type { EmbeddingDistance } from "./embedding.ts";
import type { Embedder } from "./embedder.ts";
import type { Idioms } from "./idiom.ts";
import type { IndexConfig, IndexOptions, Index } from "./index.ts";

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

export type { IndexerConfig, IndexerOptions, Indexer };
