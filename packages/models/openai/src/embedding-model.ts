import { OpenAI } from "openai";
import type { DispatcherOptions } from "@toolcog/util/task";
import { Dispatcher } from "@toolcog/util/task";
import type { Embedding, EmbeddingModel, EmbedOptions } from "@toolcog/core";

type OpenAIEmbeddingModelName =
  | "text-embedding-ada-002"
  | "text-embedding-3-small"
  | "text-embedding-3-large"
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

interface OpenAIEmbeddingModelOptions {
  client?: OpenAI | undefined;

  modelName?: OpenAIEmbeddingModelName | undefined;

  dimensions?: number | undefined;

  batchSize?: number | undefined;

  dispatcher?: Dispatcher | DispatcherOptions | undefined;
}

class OpenAIEmbeddingModel implements EmbeddingModel {
  static readonly DefaultModelName = "text-embedding-3-small";

  static isSupportedModelName(modelName: string): boolean {
    return (
      modelName.startsWith("text-embedding-ada-") ||
      modelName.startsWith("text-embedding-3-")
    );
  }

  static readonly DefaultBatchSize = 512;

  readonly #client: OpenAI;

  readonly #modelName: OpenAIEmbeddingModelName;

  readonly #dimensions: number | undefined;

  readonly #batchSize: number;

  readonly #dispatcher: Dispatcher;

  constructor(options?: OpenAIEmbeddingModelOptions) {
    this.#client = options?.client ?? new OpenAI();
    this.#modelName =
      options?.modelName ?? OpenAIEmbeddingModel.DefaultModelName;
    this.#dimensions = options?.dimensions;
    this.#batchSize =
      options?.batchSize ?? OpenAIEmbeddingModel.DefaultBatchSize;

    let dispatcher = options?.dispatcher;
    if (dispatcher === undefined) {
      dispatcher = { retry: false };
    }
    if (!(dispatcher instanceof Dispatcher)) {
      dispatcher = new Dispatcher(dispatcher);
    }
    this.#dispatcher = dispatcher as Dispatcher;
  }

  get client(): OpenAI {
    return this.#client;
  }

  get modelName(): OpenAIEmbeddingModelName {
    return this.#modelName;
  }

  get modelId(): string {
    return `openai/${this.#modelName}`;
  }

  get dimension(): number | undefined {
    return this.#dimensions;
  }

  get batchSize(): number {
    return this.#batchSize;
  }

  get dispatcher(): Dispatcher {
    return this.#dispatcher;
  }

  embed(content: string, options?: EmbedOptions): Promise<Embedding>;
  embed(
    content: readonly string[],
    options?: EmbedOptions,
  ): Promise<Embedding[]>;
  embed(
    content: string | readonly string[],
    options?: EmbedOptions,
  ): Promise<Embedding | Embedding[]>;
  async embed(
    content: string | readonly string[],
    options?: EmbedOptions,
  ): Promise<Embedding | Embedding[]> {
    const batches: string[][] = [];
    if (typeof content === "string") {
      batches.push([content]);
    } else {
      for (let i = 0; i < content.length; i += this.#batchSize) {
        batches.push(content.slice(i, i + this.#batchSize));
      }
    }

    const requests = batches.map((batch) => () => {
      return this.#client.embeddings.create(
        {
          input: batch,
          model: this.#modelName,
          ...(this.#dimensions !== undefined ?
            { dimensions: this.#dimensions }
          : undefined),
        },
        {
          signal: options?.signal,
        },
      );
    });
    const responses = await this.#dispatcher.enqueueAll(requests);

    const embeddings: Embedding[] = [];
    for (const response of responses) {
      for (const datum of response.data) {
        embeddings.push(datum.embedding);
      }
    }

    return typeof content === "string" ? embeddings[0]! : embeddings;
  }
}

export type { OpenAIEmbeddingModelName, OpenAIEmbeddingModelOptions };
export { OpenAIEmbeddingModel };
