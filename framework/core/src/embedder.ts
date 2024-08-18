import type {
  EmbeddingModel,
  EmbeddingConfig,
  EmbeddingVector,
} from "./embedding.ts";

interface EmbedderConfig extends EmbeddingConfig {
  model?: EmbeddingModel | undefined;
}

interface EmbedderOptions extends EmbedderConfig {
  signal?: AbortSignal | undefined;
}

type EmbedderResult<
  T extends string | readonly string[] = string | readonly string[],
> =
  T extends string ? EmbeddingVector
  : T extends readonly string[] ? EmbeddingVector[]
  : T extends string | readonly string[] ? EmbeddingVector | EmbeddingVector[]
  : never;

interface Embedder {
  <T extends string | readonly string[]>(
    embeds: T,
    options?: EmbedderOptions,
  ): Promise<EmbedderResult<T>>;
}

export type { EmbedderConfig, EmbedderOptions, EmbedderResult, Embedder };
