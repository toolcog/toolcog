import { OpenAI } from "openai";
import type { DispatcherOptions } from "@toolcog/util/task";
import { Dispatcher } from "@toolcog/util/task";
import type {
  EmbeddingVector,
  EmbeddingVectors,
  EmbeddingModelOptions,
  EmbeddingModel,
} from "@toolcog/core";

type EmbeddingModelName =
  | "text-embedding-ada-002"
  | "text-embedding-3-small"
  | "text-embedding-3-large"
  | (string & {});

interface EmbeddingModelConfig {
  client?: OpenAI | undefined;

  modelName?: EmbeddingModelName | undefined;

  dimensions?: number | undefined;

  batchSize?: number | undefined;

  dispatcher?: Dispatcher | DispatcherOptions | undefined;
}

const defaultBatchSize = 512;

const defaultEmbeddingModel = "text-embedding-3-small";

const supportsEmbeddingModel = (modelName: string): boolean => {
  return (
    modelName.startsWith("text-embedding-ada-") ||
    modelName.startsWith("text-embedding-3-")
  );
};

const embeddingModel = (async <T extends string | readonly string[]>(
  content: T,
  options?: EmbeddingModelOptions,
  config?: EmbeddingModelConfig,
): Promise<EmbeddingVectors<T>> => {
  const client = config?.client ?? new OpenAI();

  const modelName = config?.modelName ?? defaultEmbeddingModel;

  const dimensions = config?.dimensions;

  const batchSize = config?.batchSize ?? defaultBatchSize;

  const dispatcher =
    config?.dispatcher instanceof Dispatcher ?
      config.dispatcher
    : new Dispatcher(config?.dispatcher ?? { retry: false });

  const batches: string[][] = [];
  if (typeof content === "string") {
    batches.push([content]);
  } else {
    for (let i = 0; i < content.length; i += batchSize) {
      batches.push(content.slice(i, i + batchSize));
    }
  }

  const requests = batches.map((batch) => () => {
    return client.embeddings.create(
      {
        input: batch,
        model: modelName,
        ...(dimensions !== undefined ? { dimensions } : undefined),
      },
      {
        signal: options?.signal,
      },
    );
  });
  const responses = await dispatcher.enqueueAll(requests);

  const embeddings: EmbeddingVector[] = [];
  for (const response of responses) {
    for (const datum of response.data) {
      embeddings.push(datum.embedding);
    }
  }

  return (
    typeof content === "string" ?
      embeddings[0]!
    : embeddings) as EmbeddingVectors<T>;
}) satisfies EmbeddingModel;

export type { EmbeddingModelName, EmbeddingModelConfig };
export { supportsEmbeddingModel, embeddingModel };
