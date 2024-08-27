import type { EmbeddingModel, EmbeddingVector } from "./embedding.ts";

/**
 * Options for configuring an {@link Embedder} function.
 *
 * Note that embedder plugins may augment this type with additional options.
 */
interface EmbedderConfig {
  /**
   * The default model the embedder should use.
   */
  model?: EmbeddingModel | undefined;
}

/**
 * Options for controlling an {@link Embedder} call.
 *
 * Note that embedder plugins may augment this type with additional options.
 */
interface EmbedderOptions {
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
 * The return type of an {@link Embedder} call. If the argument is a string,
 * an embedding vector is returned. If the argument is an array of strings,
 * an array of embedding vectors is returned.
 */
type Embedded<
  T extends string | readonly string[] = string | readonly string[],
> =
  T extends string ? EmbeddingVector
  : T extends readonly string[] ? EmbeddingVector[]
  : T extends string | readonly string[] ? EmbeddingVector | EmbeddingVector[]
  : never;

/**
 * A function that returns an {@link EmbeddingVector} for each provided string.
 * If the `embed` argument is a string, then an embedding vector is returned.
 * If the `embed` argument is an array of strings, then an array of embedding
 * vectors is returned.
 */
interface Embedder {
  <T extends string | readonly string[]>(
    embed: T,
    options?: EmbedderOptions,
  ): Promise<Embedded<T>>;
}

export type { EmbedderConfig, EmbedderOptions, Embedded, Embedder };
