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
  IndexerProps,
  Indexer,
} from "@toolcog/core";

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

const embeddedIndexer = (<T extends readonly unknown[]>(
  props: IndexerProps<T>,
): Promise<Index<T>> => {
  const { id, model, idioms, embedder, embeddingDistance, ...indexOptions } =
    props;

  const nearest = (
    model: EmbeddingModel,
    query: EmbeddingVector,
    limit: number | undefined,
  ): T[number][] => {
    const distances: number[] = [];
    const values: T[number][] = [];

    for (const idiom of index.idioms) {
      let nearestIdiom: number | undefined;
      for (const embedding of idiom.embeddings) {
        const distance = index.embeddingDistance(query, embedding[model]!);
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
    options: EmbedderOptions | undefined,
  ): Promise<void> => {
    const embeds: string[] = [];
    const embeddings: Embedding[] = [];

    for (const idiom of index.idioms) {
      for (let i = 0; i < idiom.embeds.length; i += 1) {
        if (!(model in idiom.embeddings[i]!)) {
          embeds.push(idiom.embeds[i]!);
          embeddings.push(idiom.embeddings[i]!);
        }
      }
    }

    if (embeds.length !== 0) {
      const embeddingVectors = await index.embedder(embeds, options);
      for (let i = 0; i < embeddingVectors.length; i += 1) {
        const embedding = embeddings[i] as {
          [model: EmbeddingModel]: EmbeddingVector;
        };
        embedding[model] = embeddingVectors[i]!;
      }
    }
  };

  const index = (async (
    query: string | EmbeddingVector,
    options?: IndexOptions,
  ): Promise<T[number][]> => {
    const model = options?.model ?? index.model;

    options = {
      ...indexOptions,
      ...options,
      model,
    };

    if (typeof query === "string") {
      query = await index.embedder(query, options);
    }

    if (!index.models.includes(model)) {
      await embed(model, options);
      index.models.push(model);
    }

    return nearest(model, query, options.limit);
  }) as {
    (
      query: string | EmbeddingVector,
      options?: IndexOptions,
    ): Promise<T[number][]>;
    id: string;
    model: EmbeddingModel;
    models: EmbeddingModel[];
    idioms: Idioms<T>;
    embedder: Embedder;
    embeddingDistance: EmbeddingDistance;
  };

  index.id = id;
  index.model = model;
  index.models = [];
  index.idioms = idioms;
  index.embedder = embedder;
  index.embeddingDistance = embeddingDistance ?? cosineDistance;

  return Promise.resolve(index);
}) satisfies Indexer;

export { cosineDistance, embeddedIndexer };
