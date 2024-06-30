type Embedding = readonly number[];

type EmbeddingMap = Record<string, Embedding>;

type EmbeddingSimilarity = (a: Embedding, b: Embedding) => number;

export type { Embedding, EmbeddingMap, EmbeddingSimilarity };
