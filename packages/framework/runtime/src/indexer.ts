import type {
  EmbeddingModel,
  EmbeddingVector,
  EmbeddingDistance,
  Embedding,
  EmbedderOptions,
  Embedder,
  Idioms,
  IndexOptions,
  Index,
  IndexerOptions,
  Indexer,
} from "@toolcog/core";
import { currentQuery } from "./agent.ts";

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
    query: EmbeddingVector,
    limit: number | undefined,
  ): T[number][] | undefined => {
    const distances: number[] = [];
    const values: T[number][] = [];

    for (const idiom of index.idioms) {
      let nearestIdiom: number | undefined;
      const idiomEmbeddings = idiom();
      for (const text in idiomEmbeddings) {
        const embedding = idiomEmbeddings[text]!;
        const embeddingVector = embedding[model];
        if (embeddingVector === undefined) {
          return undefined; // Trap to load missing embeddings.
        }

        const distance = index.distance(query, embeddingVector);
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

    return values;
  };

  const embed = async (
    model: EmbeddingModel,
    embedder: Embedder,
    options: EmbedderOptions | undefined,
  ): Promise<void> => {
    const texts: string[] = [];
    const embeddings: Embedding[] = [];

    for (const idiom of index.idioms) {
      const idiomEmbeddings = idiom();
      for (const text in idiomEmbeddings) {
        const embedding = idiomEmbeddings[text]!;
        if (!(model in embedding)) {
          texts.push(text);
          embeddings.push(embedding);
        }
      }
    }

    if (texts.length !== 0) {
      const embeddingVectors = await embedder(texts, options);
      for (let i = 0; i < embeddingVectors.length; i += 1) {
        const embedding = embeddings[i] as {
          [Model in EmbeddingModel]?: EmbeddingVector;
        };
        embedding[model] = embeddingVectors[i]!;
      }
    }
  };

  const index = (async (
    query?: string | EmbeddingVector,
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

    if (query === undefined) {
      query = currentQuery();
    }
    if (typeof query === "string") {
      query = await embedder(query, options);
    } else {
      throw new Error("Unspecified query");
    }

    let neighbors = nearest(model, query, options.limit);

    if (neighbors === undefined) {
      await embed(model, embedder, options);

      neighbors = nearest(model, query, options.limit);
      if (neighbors === undefined) {
        throw new Error("Failed to resolve all embeddings");
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
