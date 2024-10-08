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

/**
 * Computes the cosine distance between two embeddings.
 *
 * @param a - The first embedding.
 * @param b - The second embedding.
 * @returns The cosine distance between the two embeddings.
 */
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

/**
 * Creates an index for performing similarity searches over a set of idioms.
 *
 * @param idioms - The idioms to index.
 * @param indexerOptions - The options for the indexer.
 * @returns A promise resolving to the index.
 */
const indexer = (<T extends readonly unknown[]>(
  idioms: Idioms<T>,
  indexerOptions?: IndexerOptions,
): Promise<Index<T>> => {
  /**
   * Finds the nearest idioms to a set of prompt embeddings.
   *
   * @param model - The embedding model to use.
   * @param promptHistory - The prompt embeddings to search.
   * @param options - The options for the search.
   * @returns The nearest idioms, or `undefined` if the search failed.
   */
  const nearest = (
    model: EmbeddingModel,
    promptHistory: readonly Embeddings[],
    options: IndexOptions,
  ): T[number][] | undefined => {
    const limit = options.limit;
    const penaltyRate = 1.0 + (options.historyPenalty ?? 0.1);

    const promptEmbeddingsCount = promptHistory.length;
    const distances: number[] = [];
    const values: T[number][] = [];

    for (const idiom of index.idioms) {
      let nearestIdiom: number | undefined;
      const idiomEmbeddings = idiom.embeds();
      for (const phrase in idiomEmbeddings) {
        const idiomEmbedding = idiomEmbeddings[phrase]!;
        const idiomEmbeddingVector = idiomEmbedding[model];
        if (idiomEmbeddingVector === undefined) {
          return undefined; // Trap to load missing idiom embeddings.
        }

        for (let i = 0; i < promptEmbeddingsCount; i += 1) {
          const penalty = Math.pow(penaltyRate, promptEmbeddingsCount - i - 1);

          const promptEmbeddings = promptHistory[i]!;
          for (const phrase in promptEmbeddings) {
            const promptEmbedding = promptEmbeddings[phrase]!;
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

  /**
   * Embeds a set of phrases using an embedder.
   *
   * @param model - The embedding model to use.
   * @param embedder - The embedder to use.
   * @param embeddingsArray - The phrases to embed.
   * @param options - The options for the embedder.
   */
  const embed = async (
    model: EmbeddingModel,
    embedder: Embedder,
    embeddingsArray: readonly Embeddings[],
    options: EmbedderOptions | undefined,
  ): Promise<void> => {
    const phrases: string[] = [];
    const textEmbeddings: Embedding[] = [];

    for (const embeddings of embeddingsArray) {
      for (const phrase in embeddings) {
        const embedding = embeddings[phrase]!;
        if (!(model in embedding)) {
          phrases.push(phrase);
          textEmbeddings.push(embedding);
        }
      }
    }

    if (phrases.length !== 0) {
      const vectors = await embedder(phrases, options);
      for (let i = 0; i < vectors.length; i += 1) {
        const embedding = textEmbeddings[i] as {
          [Model in EmbeddingModel]?: EmbeddingVector;
        };
        embedding[model] = vectors[i]!;
      }
    }
  };

  /**
   * Returns the values in the index that are most similar to the query.
   *
   * @param query - The input for which to find similar values in the index.
   * @param options - Result limit, embedding model, and other search options.
   * @returns The indexed values that are most similar to the query.
   * @throws if the embedding model or embedder is not specified.
   * @throws if the query is not provided and cannot be inferred from the
   * current agent context.
   */
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
    let promptHistory: readonly Embeddings[] | undefined;
    if (typeof query === "string") {
      promptHistory = [{ [query]: {} }];
    } else if (((agentContext = AgentContext.get()), agentContext !== null)) {
      promptHistory = agentContext.promptEmbeddings;
    } else {
      throw new Error("Unspecified query");
    }

    await embed(model, embedder, promptHistory, options);

    let neighbors = nearest(model, promptHistory, options);

    if (neighbors === undefined) {
      const idiomEmbeddingsArray = index.idioms.map((idiom) => idiom.embeds());
      await embed(model, embedder, idiomEmbeddingsArray, options);

      neighbors = nearest(model, promptHistory, options);
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
