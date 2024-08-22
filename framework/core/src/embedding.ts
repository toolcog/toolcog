/**
 * Each key of this type represents a known embedding model name.
 * Embedder plugins augment this type to add supported model names.
 *
 * Use the {@link EmbeddingModel} type, which references the keys of this type,
 * to refer to strings that represent embedding model names. The indirection
 * through this type is necessary because type aliases cannot be augmented.
 */
interface EmbeddingModelNames {}

/**
 * The identifying name of an embedding model.
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type EmbeddingModel = keyof EmbeddingModelNames | (string & {});

/**
 * Options for configuring an embedding model, such as API keys and API client
 * parameters. Embedder plugins augment this type with supported options.
 */
interface EmbeddingConfig {}

/**
 * Options for controlling an embedding model request, such as an abort signal
 * for cancelling the request. Generator plugins augment this type with
 * supported options.
 */
interface EmbeddingOptions {}

/**
 * The type of an embedding vector. Embedding vectors are stored as float
 * arrays for memory efficiency.
 */
type EmbeddingVector = Float32Array;

/**
 * A distance metric in an embedding vector space.
 */
type EmbeddingDistance = (a: EmbeddingVector, b: EmbeddingVector) => number;

/**
 * A mapping of embedding vectors keyed by embedding model.
 */
interface Embedding {
  readonly [model: EmbeddingModel]: EmbeddingVector;
}

export type {
  EmbeddingModelNames,
  EmbeddingModel,
  EmbeddingConfig,
  EmbeddingOptions,
  EmbeddingVector,
  EmbeddingDistance,
  Embedding,
};
