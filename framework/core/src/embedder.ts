import type {
  EmbeddingModel,
  EmbeddingConfig,
  EmbeddingOptions,
  EmbeddingVector,
} from "./embedding.ts";

/**
 * Options for configuring an {@link Embedder} function.
 *
 * Note that additional model-specific configuration may be available
 * depending on the particular plugins you use. Embedding plugins augment
 * the {@link EmbeddingConfig} interface, which this interface extends.
 */
interface EmbedderConfig extends EmbeddingConfig {
  /**
   * The default model the embedder should use.
   */
  model?: EmbeddingModel | undefined;
}

/**
 * Options for controlling an {@link Embedder} call.
 *
 * Note that additional model-specific options may be available
 * depending on the particular plugins you use. Embedding plugins augment
 * the {@link EmbeddingOptions} interfaces, which this interface extends.
 */
interface EmbedderOptions extends EmbeddingOptions {
  /**
   * The model the embedder should use to generate embedding vectors.
   */
  model?: EmbeddingModel | undefined;

  /**
   * An abort signal that can be used to cancel the embedder call.
   */
  signal?: AbortSignal | undefined;
}

/**
 * The return type of an {@link Embedder} call. If the argument is a single
 * string, a single embedding vector is returned. If the argument is an array
 * of strings, an array of embedding vectors is returned.
 */
type EmbedderResult<
  T extends string | readonly string[] = string | readonly string[],
> =
  T extends string ? EmbeddingVector
  : T extends readonly string[] ? EmbeddingVector[]
  : T extends string | readonly string[] ? EmbeddingVector | EmbeddingVector[]
  : never;

/**
 * A function that returns an {@link EmbeddingVector} for each provided string.
 * If the `embeds` argument is a single string, then a single embedding vector
 * is returned. If the `embeds` argument is an array of strings, then an array
 * of embedding vectors is returned.
 */
interface Embedder {
  <T extends string | readonly string[]>(
    embeds: T,
    options?: EmbedderOptions,
  ): Promise<EmbedderResult<T>>;
}

export type { EmbedderConfig, EmbedderOptions, EmbedderResult, Embedder };
