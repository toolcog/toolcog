/**
 * Each key of this type represents a known embedding model name.
 * Embedder plugins augment this type to add supported models names.
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
 * Embedding model configuration options, such as API keys and API client
 * parameters. Embedder plugins augment this type with supported options.
 */
interface EmbeddingConfig {}

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
 * A mapping from embedding model names to embedding vectors.
 */
interface Embedding {
  readonly [model: EmbeddingModel]: EmbeddingVector;
}

export type {
  EmbeddingModelNames,
  EmbeddingModel,
  EmbeddingConfig,
  EmbeddingVector,
  EmbeddingDistance,
  Embedding,
};
