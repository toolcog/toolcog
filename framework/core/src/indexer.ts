import type { EmbeddingModel, EmbeddingDistance } from "./embedding.ts";
import type { Embedder } from "./embedder.ts";
import type { Idioms } from "./idiom.ts";
import type { IndexConfig, Index } from "./index.ts";

interface IndexerProps<T extends readonly unknown[] = readonly unknown[]>
  extends IndexConfig {
  id: string;

  idioms: Idioms<T>;

  model: EmbeddingModel;

  embedder: Embedder;

  embeddingDistance?: EmbeddingDistance | undefined;
}

interface Indexer {
  <T extends readonly unknown[]>(props: IndexerProps<T>): Promise<Index<T>>;
}

export type { IndexerProps, Indexer };
