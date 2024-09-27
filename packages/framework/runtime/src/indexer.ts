import type {
  EmbeddingModel,
  EmbeddingVector,
  EmbeddingDistance,
  Embedding,
  Embeddings,
  EmbedderOptions,
  Embedder,
  Idioms,
  IndexOptions,
  Index,
  IndexerOptions,
  Indexer,
} from "@toolcog/core";
import { AgentContext } from "./agent.ts";

const cosineDistance = (a: EmbeddingVector, b: EmbeddingVector): number => {
  const k = a.length;
  if (k !== b.length) {
    return Infinity;
  }
  let dp = 0;
  let a2 = 0;
  let b2 = 0;
  for (let i = 0; i < k; i += 1) {
    dp += a[i]! * b[i]!;
    a2 += a[i]! * a[i]!;
    b2 += b[i]! * b[i]!;
  }
  return 1 - dp / (Math.sqrt(a2) * Math.sqrt(b2));
};

const indexer = (<T extends readonly unknown[]>(
  idioms: Idioms<T>,
  indexerOptions?: IndexerOptions,
): Promise<Index<T>> => {
  const nearest = (
    model: EmbeddingModel,
    promptEmbeddingsArray: readonly Embeddings[],
    options: IndexOptions,
  ): T[number][] | undefined => {
    const limit = options.limit;
    const penaltyRate = 1.0 + (options.historyPenalty ?? 0.1);

    const promptEmbeddingsCount = promptEmbeddingsArray.length;
    const distances: number[] = [];
    const values: T[number][] = [];

    for (const idiom of index.idioms) {
      let nearestIdiom: number | undefined;
      const idiomEmbeddings = idiom.embeds();
      for (const text in idiomEmbeddings) {
        const idiomEmbedding = idiomEmbeddings[text]!;
        const idiomEmbeddingVector = idiomEmbedding[model];
        if (idiomEmbeddingVector === undefined) {
          return undefined; // Trap to load missing idiom embeddings.
        }

        for (let i = 0; i < promptEmbeddingsCount; i += 1) {
          const penalty = Math.pow(penaltyRate, promptEmbeddingsCount - i - 1);

          const promptEmbeddings = promptEmbeddingsArray[i]!;
          for (const text in promptEmbeddings) {
            const promptEmbedding = promptEmbeddings[text]!;
            const promptVector = promptEmbedding[model]!;
            const distance =
              index.distance(promptVector, idiomEmbeddingVector) * penalty;
            if (nearestIdiom !== undefined) {
              if (distance > distances[nearestIdiom]!) {
                continue;
              }
              distances.splice(nearestIdiom, 1);
              values.splice(nearestIdiom, 1);
              nearestIdiom = undefined;
            }

            let position = distances.length;
            while (position > 0 && distance < distances[position - 1]!) {
              position -= 1;
            }

            if (limit === undefined || position < limit) {
              if (limit !== undefined && distances.length === limit) {
                distances.pop();
                values.pop();
              }
              distances.splice(position, 0, distance);
              values.splice(position, 0, idiom.value);
              nearestIdiom = position;
            }
          }
        }
      }
    }

    return values;
  };

  const embed = async (
    model: EmbeddingModel,
    embedder: Embedder,
    embeddingsArray: readonly Embeddings[],
    options: EmbedderOptions | undefined,
  ): Promise<void> => {
    const texts: string[] = [];
    const textEmbeddings: Embedding[] = [];

    for (const embeddings of embeddingsArray) {
      for (const text in embeddings) {
        const embedding = embeddings[text]!;
        if (!(model in embedding)) {
          texts.push(text);
          textEmbeddings.push(embedding);
        }
      }
    }

    if (texts.length !== 0) {
      const vectors = await embedder(texts, options);
      for (let i = 0; i < vectors.length; i += 1) {
        const embedding = textEmbeddings[i] as {
          [Model in EmbeddingModel]?: EmbeddingVector;
        };
        embedding[model] = vectors[i]!;
      }
    }
  };

  const index = (async (
    query?: readonly Embeddings[] | Embeddings | string,
    options?: IndexOptions,
  ): Promise<T[number][]> => {
    const model = options?.model ?? index.model;
    if (model === undefined) {
      throw new Error("Unspecified embedding model");
    }

    const embedder = indexerOptions?.embedder ?? index.embedder;
    if (embedder === undefined) {
      throw new Error("Unspecified embedder");
    }

    options = {
      ...indexerOptions,
      ...options,
      model,
    };

    let agentContext: AgentContext | null;
    let promptEmbeddingsArray: readonly Embeddings[] | undefined;
    if (typeof query === "string") {
      promptEmbeddingsArray = [{ [query]: {} }];
    } else if (((agentContext = AgentContext.get()), agentContext !== null)) {
      promptEmbeddingsArray = agentContext.promptEmbeddings;
    } else {
      throw new Error("Unspecified query");
    }

    await embed(model, embedder, promptEmbeddingsArray, options);

    let neighbors = nearest(model, promptEmbeddingsArray, options);

    if (neighbors === undefined) {
      const idiomEmbeddingsArray = index.idioms.map((idiom) => idiom.embeds());
      await embed(model, embedder, idiomEmbeddingsArray, options);

      neighbors = nearest(model, promptEmbeddingsArray, options);
      if (neighbors === undefined) {
        throw new Error("Failed to resolve all idiom embeddings");
      }
    }

    return neighbors;
  }) as {
    (query?: unknown, options?: IndexOptions): Promise<T[number][]>;
    id: string | undefined;
    model: EmbeddingModel | undefined;
    embedder: Embedder | undefined;
    distance: EmbeddingDistance;
    idioms: Idioms<T>;
  };

  index.id = undefined;
  index.model = indexerOptions?.model;
  index.embedder = indexerOptions?.embedder;
  index.distance = indexerOptions?.distance ?? cosineDistance;
  index.idioms = idioms;

  return Promise.resolve(index);
}) satisfies Indexer;

export { cosineDistance, indexer };
