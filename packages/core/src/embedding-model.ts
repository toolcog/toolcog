import type { Embedding, EmbeddingMap } from "./embedding.ts";
import { Toolcog } from "./toolcog.ts";

interface EmbedOptions {
  modelId?: string | undefined;

  cache?: readonly EmbeddingMap[] | EmbeddingMap | null | undefined;

  signal?: AbortSignal | undefined;
}

interface EmbeddingModel {
  readonly modelId: string;

  embed(content: string, options?: EmbedOptions): Promise<Embedding>;
  embed(
    content: readonly string[],
    options?: EmbedOptions,
  ): Promise<Embedding[]>;
  embed(
    content: string | readonly string[],
    options?: EmbedOptions,
  ): Promise<Embedding | Embedding[]>;
}

const embed: {
  embed(content: string, options?: EmbedOptions): Promise<Embedding>;
  embed(
    content: readonly string[],
    options?: EmbedOptions,
  ): Promise<Embedding[]>;
  embed(
    content: string | readonly string[],
    options?: EmbedOptions,
  ): Promise<Embedding | Embedding[]>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  (async (
    content: string | readonly string[],
    options?: EmbedOptions,
  ): Promise<Embedding | Embedding[]> => {
    const toolcog = await Toolcog.current();
    const model = await toolcog.getEmbeddingModel(options?.modelId);
    return model.embed(content, options);
  }) as unknown as typeof embed,
  {
    brand: Symbol("toolcog.embed"),
  },
) as typeof embed;

export type { EmbedOptions, EmbeddingModel };
export { embed };
