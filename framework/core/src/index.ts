import type { EmbeddingModel, EmbeddingVector } from "./embedding.ts";
import type { EmbedderConfig, EmbedderOptions, Embedder } from "./embedder.ts";
import type { Idioms } from "./idiom.ts";

interface IndexConfig extends EmbedderConfig {
  limit?: number | undefined;
}

interface IndexOptions extends IndexConfig, EmbedderOptions {}

interface Index<T extends readonly unknown[]> {
  (
    query: string | EmbeddingVector,
    options?: IndexOptions,
  ): Promise<T[number][]>;

  readonly id: string;

  readonly model: EmbeddingModel;

  readonly idioms: Idioms<T>;

  readonly embedder: Embedder;
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
