import type {
  GeneratorOptions,
  Generator,
  EmbedderOptions,
  Embedder,
  IndexerOptions,
  Indexer,
} from "@toolcog/core";

interface ToolcogPlugin {
  readonly name: string;

  readonly version?: string;

  readonly generator?: (
    options?: GeneratorOptions,
  ) => Promise<Generator | undefined>;

  readonly embedder?: (
    options?: EmbedderOptions,
  ) => Promise<Embedder | undefined>;

  readonly indexer?: (options: IndexerOptions) => Promise<Indexer | undefined>;
}

export type { ToolcogPlugin };
