import type { ClientOptions } from "openai";
import { OpenAI } from "openai";
import { Dispatcher } from "@toolcog/util/task";
import type {
  EmbeddingVector,
  EmbedderConfig,
  EmbedderOptions,
  Embedded,
  Embedder,
} from "@toolcog/core";
import { decodeEmbeddingVector } from "@toolcog/core";

declare module "@toolcog/core" {
  interface EmbeddingModelNames {
    "text-embedding-ada-002": unknown;
    "text-embedding-3-small": unknown;
    "text-embedding-3-large": unknown;
  }

  interface EmbedderConfig {
    dimensions?: number | undefined;

    batchSize?: number | undefined;
  }

  interface EmbedderOptions {
    dimensions?: number | undefined;

    batchSize?: number | undefined;
  }
}

interface OpenAIEmbedderConfig extends EmbedderConfig {
  openai?: OpenAI | ClientOptions | undefined;

  dispatcher?: Dispatcher | undefined;
}

interface OpenAIEmbedderOptions extends EmbedderOptions {
  openai?: OpenAI | ClientOptions | undefined;

  dispatcher?: Dispatcher | undefined;
}

const defaultBatchSize = 512;

const defaultEmbeddingModel = "text-embedding-3-small";

const embedder = (options?: OpenAIEmbedderOptions): Embedder | undefined => {
  const model = options?.model;
  if (model !== undefined) {
    if (
      model.startsWith("text-embedding-ada-") ||
      model.startsWith("text-embedding-3-")
    ) {
      return embed;
    }
  } else if (
    options?.openai !== undefined ||
    (typeof process !== "undefined" && process.env.OPENAI_API_KEY !== undefined)
  ) {
    return embed;
  }

  return undefined;
};

const embed = (async <T extends string | readonly string[]>(
  texts: T,
  options?: OpenAIEmbedderOptions,
): Promise<Embedded<T>> => {
  const client =
    options?.openai instanceof OpenAI ?
      options.openai
    : new OpenAI(options?.openai);

  const dispatcher = options?.dispatcher ?? new Dispatcher({ retry: false });

  const model = options?.model ?? defaultEmbeddingModel;

  const dimensions = options?.dimensions;

  const batchSize = options?.batchSize ?? defaultBatchSize;

  const batches: string[][] = [];
  if (typeof texts === "string") {
    batches.push([texts]);
  } else {
    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }
  }

  const requests = batches.map((batch) => () => {
    return client.embeddings.create(
      {
        model,
        input: batch,
        encoding_format: "base64",
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
    for (const data of response.data) {
      const buffer = Buffer.from(data.embedding as unknown as string, "base64");
      embeddings.push(decodeEmbeddingVector(buffer));
    }
  }

  return (
    typeof texts === "string" ?
      embeddings[0]!
    : embeddings) as Embedded<T>;
}) satisfies Embedder;

export type { OpenAIEmbedderConfig, OpenAIEmbedderOptions };
export { embedder, embed };
