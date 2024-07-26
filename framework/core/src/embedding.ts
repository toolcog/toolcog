type Embedding = readonly number[];

type Embeddings<
  Content extends string | readonly string[] = string | readonly string[],
> =
  Content extends string ? Embedding
  : Content extends string[] ? Embedding[]
  : Content extends readonly string[] ? readonly Embedding[]
  : never;

type SimilarityFunction = (a: Embedding, b: Embedding) => number;

interface EmbeddingOptions {
  modelId?: string | undefined;

  signal?: AbortSignal | undefined;
}

export type { Embedding, Embeddings, SimilarityFunction, EmbeddingOptions };
