import type {
  EmbeddingVector,
  Embeddable,
  Embed,
  Embeds,
  EmbeddingOptions,
  EmbeddingIndex,
  EmbeddingStoreOptions,
  EmbeddingStore,
} from "@toolcog/core";
import { forEachEmbed } from "@toolcog/core";

const cosineSimilarity = (a: EmbeddingVector, b: EmbeddingVector): number => {
  const k = a.length;
  if (k != b.length) {
    return NaN;
  }

  let p = 0.0;
  let p2 = 0.0;
  let q2 = 0.0;
  for (let i = 0; i < k; i += 1) {
    p += a[i]! * b[i]!;
    p2 += a[i]! * a[i]!;
    q2 += b[i]! * b[i]!;
  }

  return p / (Math.sqrt(p2) * Math.sqrt(q2));
};

const embeddingStore = (async <T extends Embeddable>(
  embeds: Embeds<T>,
  options: EmbeddingStoreOptions,
): Promise<EmbeddingIndex<T>> => {
  const model = options.model;
  const embeddingModel = options.embeddingModel;
  const similarity = options.similarity ?? cosineSimilarity;

  const embedded = await (async () => {
    const embedded: {
      embed: Embed<T>;
      intent: string;
      vector: EmbeddingVector | undefined;
    }[] = [];
    const content: string[] = [];

    forEachEmbed(embeds, (embed) => {
      for (const intent of embed.intents) {
        embedded.push({ embed, intent, vector: undefined });
        content.push(intent);
      }
    });

    const vectors = await embeddingModel(content, options);

    for (let i = 0; i < vectors.length; i += 1) {
      embedded[i]!.vector = vectors[i]!;
    }

    return embedded as {
      embed: Embed<T>;
      intent: string;
      vector: EmbeddingVector;
    }[];
  })();

  return async (
    query: string | EmbeddingVector,
    count: number,
    options?: EmbeddingOptions,
  ): Promise<T[]> => {
    let queryVector: EmbeddingVector;
    if (typeof query === "string") {
      queryVector = await embeddingModel(query, {
        ...options,
        model,
      });
    } else {
      queryVector = query;
    }

    const results = embedded.map((entry) => {
      const distance = similarity(queryVector, entry.vector);
      return { distance, entry };
    });

    results.sort((a, b) => b.distance - a.distance);

    return results.slice(0, count).map((result) => result.entry.embed.value);
  };
}) satisfies EmbeddingStore;

export { embeddingStore };
