/**
 * A registry for known embedding model names. Embedder plugins augment
 * this interface to add the names of the embedding models they support.
 * Use {@link EmbeddingModel} to refer to embedding model names in a
 * type-safe way.
 */
interface EmbeddingModelNames {}

/**
 * The name of an embedding model, either a known model identifier or a string.
 * To specify a model from a particular plugin, prefix the model name with the
 * plugin package name followed by a colon. For example, `"openai:custom-model"`
 * refers to the model `"custom-model"` from the `@toolcog/openai` plugin.
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type EmbeddingModel = keyof EmbeddingModelNames | (string & {});

/**
 * A vector in a high-dimensional space representing the semantic embedding
 * of a text fragment. Embedding vectors capture the semantic content of text
 * fragments and are produced by embedding models. Stored as `Float32Array`
 * for memory efficiency.
 */
type EmbeddingVector = Float32Array;

/**
 * A function that computes the distance between two embedding vectors in the
 * metric space prescribed by the implementation. The specific distance metric
 * can vary (e.g., cosine distance, Euclidean distance).
 *
 * @returns The distance between the two embedding vectors.
 */
type EmbeddingDistance = (a: EmbeddingVector, b: EmbeddingVector) => number;

/**
 * Embedding vectors for a text fragment, keyed by the name of the embedding
 * model that generated each vector. Allows storing embeddings from different
 * models for the same text fragment.
 *
 * @typeParam V - The type of the embedding vectors.
 */
type Embedding<V = EmbeddingVector> = {
  [Model in EmbeddingModel]?: V;
};

/**
 * A collection of embeddings for multiple text fragments. Maps text fragments
 * to their corresponding embeddings, which may include embedding vectors from
 * multiple models.
 *
 * @typeParam V - The type of the embedding vectors.
 */
interface Embeddings<V = EmbeddingVector> {
  [text: string]: Embedding<V>;
}

/**
 * Configuration options for an {@link Embedder} function. Embedder plugins
 * may augment this interface with additional options specific to their models.
 * This approach maintains type safety while avoiding a clutter of
 * plugin-specific options in the core interface.
 */
interface EmbedderConfig {
  /**
   * The default embedding model to use when generating embeddings.
   */
  model?: EmbeddingModel | undefined;
}

/**
 * Options for a specific call to an {@link Embedder} function.
 * These options can override the defaults specified in {@link EmbedderConfig}.
 * Embedder plugins may augment this interface with additional options specific
 * to their models.
 */
interface EmbedderOptions {
  /**
   * The embedding model to use for the embedder call.
   */
  model?: EmbeddingModel | undefined;

  /**
   * An abort signal that can be used to cancel the embedder call.
   */
  signal?: AbortSignal | undefined;
}

/**
 * The return type of an {@link Embedder} call, matching the type of the input.
 * If the input is a string, returns an {@link EmbeddingVector}.
 * If the input is an array of strings, returns an array of
 * {@link EmbeddingVector}s.
 *
 * @typeParam T - The type of the input text, either a string
 * or an array of strings.
 */
type Embedded<
  T extends string | readonly string[] = string | readonly string[],
> =
  T extends string ? EmbeddingVector
  : T extends readonly string[] ? EmbeddingVector[]
  : T extends string | readonly string[] ? EmbeddingVector | EmbeddingVector[]
  : never;

/**
 * A function that generates embedding vectors for provided text input.
 * If the `embed` argument is a string, returns an {@link EmbeddingVector}.
 * If the `embed` argument is an array of strings, returns an array of
 * {@link EmbeddingVector}s.
 *
 * @param embed - The text or texts to generate embeddings for.
 * @param options - Optional parameters to configure the embedding generation.
 * @returns A promise that resolves to the embedding vector(s) corresponding
 * to the input text(s), matching the input type.
 *
 * @typeParam T - The type of the input text, either a string
 * or an array of strings.
 */
interface Embedder {
  <T extends string | readonly string[]>(
    embed: T,
    options?: EmbedderOptions,
  ): Promise<Embedded<T>>;
}

/**
 * Decodes a binary `Buffer` into an {@link EmbeddingVector}.
 *
 * @param vector - The `Buffer` containing the binary representation
 * of the embedding vector.
 * @returns The decoded embedding vector as a `Float32Array`.
 */
const decodeEmbeddingVector = (vector: Buffer): EmbeddingVector => {
  return new Float32Array(
    vector.buffer,
    vector.byteOffset,
    vector.byteLength / 4,
  );
};

/**
 * Encodes an {@link EmbeddingVector} into a binary `Buffer`.
 *
 * @param vector - The embedding vector to encode.
 * @returns A `Buffer` containing the binary representation
 * of the embedding vector.
 */
const encodeEmbeddingVector = (vector: EmbeddingVector): Buffer => {
  return Buffer.from(vector.buffer, 0, vector.length * 4);
};

/**
 * Decodes an {@link Embedding} with vectors encoded as `Buffer`s into an
 * {@link Embedding} with vectors as {@link EmbeddingVector}s.
 *
 * @param embedding - The embedding with vectors encoded as `Buffer`s.
 * @returns The embedding with vectors decoded as {@link EmbeddingVector}s.
 */
const decodeEmbedding = (embedding: Embedding<Buffer>): Embedding => {
  return Object.fromEntries(
    Object.entries(embedding).map(([model, vector]) => {
      return [model, decodeEmbeddingVector(vector!)] as const;
    }),
  );
};

/**
 * Encodes an {@link Embedding} with vectors as {@link EmbeddingVector}s
 * into an {@link Embedding} with vectors encoded as `Buffer`s.
 *
 * @param embedding - The embedding with vectors as {@link EmbeddingVector}s.
 * @returns The embedding with vectors encoded as `Buffer`s.
 */
const encodeEmbedding = (embedding: Embedding): Embedding<Buffer> => {
  return Object.fromEntries(
    Object.entries(embedding)
      .map(([model, vector]) => {
        return [model, encodeEmbeddingVector(vector!)] as const;
      })
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
};

/**
 * Decodes an {@link Embeddings} object with vectors encoded as `Buffer`s into
 * an {@link Embeddings} object with vectors as {@link EmbeddingVector}s.
 *
 * @param embeddings - The embeddings with vectors encoded as `Buffer`s.
 * @returns The embeddings with vectors decoded as {@link EmbeddingVector}s.
 */
const decodeEmbeddings = (embeddings: Embeddings<Buffer>): Embeddings => {
  return Object.fromEntries(
    Object.entries(embeddings).map(([text, embedding]) => {
      return [text, decodeEmbedding(embedding)] as const;
    }),
  );
};

/**
 * Encodes an {@link Embeddings} object with vectors as {@link EmbeddingVector}s
 * into an {@link Embeddings} object with vectors encoded as `Buffer`s.
 *
 * @param embeddings - The embeddings with vectors as {@link EmbeddingVector}s.
 * @returns The embeddings with vectors encoded as `Buffer`s.
 */
const encodeEmbeddings = (embeddings: Embeddings): Embeddings<Buffer> => {
  return Object.fromEntries(
    Object.entries(embeddings)
      .map(([text, embedding]) => {
        return [text, encodeEmbedding(embedding)] as const;
      })
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
};

export type {
  EmbeddingModelNames,
  EmbeddingModel,
  EmbeddingVector,
  EmbeddingDistance,
  Embedding,
  Embeddings,
  EmbedderConfig,
  EmbedderOptions,
  Embedded,
  Embedder,
};
export {
  decodeEmbeddingVector,
  encodeEmbeddingVector,
  decodeEmbedding,
  encodeEmbedding,
  decodeEmbeddings,
  encodeEmbeddings,
};
