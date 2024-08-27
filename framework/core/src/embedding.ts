/**
 * Each key of this type represents the name of a known embedding model.
 * Embedder plugins augment this type to add supported model names.
 *
 * Use the {@link EmbeddingModel} type for strings that should represent
 * embedding model names. The `EmbeddingModel` type extracts the keys of
 * this type. The indirection through this type is necessary because type
 * aliases cannot be augmented.
 */
interface EmbeddingModelNames {}

/**
 * The identifying name of an embedding model.
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type EmbeddingModel = keyof EmbeddingModelNames | (string & {});

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
 * A set of embedding vectors keyed by the model that generated each vector.
 */
interface Embedding<V = EmbeddingVector> {
  [model: EmbeddingModel]: V;
}

/**
 * A set of embeddings keyed by the embedded text.
 */
interface Embeddings<V = EmbeddingVector> {
  [text: string]: Embedding<V>;
}

const decodeEmbeddingVector = (vector: Buffer): EmbeddingVector => {
  return new Float32Array(
    vector.buffer,
    vector.byteOffset,
    vector.byteLength / 4,
  );
};

const encodeEmbeddingVector = (vector: EmbeddingVector): Buffer => {
  return Buffer.from(vector.buffer);
};

const decodeEmbedding = (embedding: Embedding<Buffer>): Embedding => {
  return Object.fromEntries(
    Object.entries(embedding).map(([model, vector]) => {
      return [model, decodeEmbeddingVector(vector)] as const;
    }),
  );
};

const encodeEmbedding = (embedding: Embedding): Embedding<Buffer> => {
  return Object.fromEntries(
    Object.entries(embedding)
      .map(([model, vector]) => {
        return [model, encodeEmbeddingVector(vector)] as const;
      })
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
};

const decodeEmbeddings = (embeddings: Embeddings<Buffer>): Embeddings => {
  return Object.fromEntries(
    Object.entries(embeddings).map(([text, embedding]) => {
      return [text, decodeEmbedding(embedding)] as const;
    }),
  );
};

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
};
export {
  decodeEmbeddingVector,
  encodeEmbeddingVector,
  decodeEmbedding,
  encodeEmbedding,
  decodeEmbeddings,
  encodeEmbeddings,
};
