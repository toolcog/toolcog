import type { ToolDescriptor } from "./tool.ts";
import type { GenerateOptions } from "./generate.ts";
import type { Embeddings, EmbeddingOptions } from "./embedding.ts";

interface GenerativeModelOptions extends GenerateOptions {
  descriptor?: ToolDescriptor | undefined;
}

interface GenerativeModel {
  (args: unknown, options?: GenerativeModelOptions): Promise<unknown>;
}

interface EmbeddingModelOptions extends EmbeddingOptions {}

interface EmbeddingModel {
  <Content extends string | readonly string[]>(
    content: Content,
    options?: EmbeddingModelOptions,
  ): Promise<Embeddings<Content>>;
}

export type {
  GenerativeModelOptions,
  GenerativeModel,
  EmbeddingModelOptions,
  EmbeddingModel,
};
