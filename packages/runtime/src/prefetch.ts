import type { EmbeddingModel, Embedder } from "@toolcog/core";
import { embed } from "./runtime.ts";
import type { Manifest } from "./manifest.ts";
import type { Inventory } from "./inventory.ts";
import type { Precache } from "./precache.ts";
import { createPrecache } from "./precache.ts";

/**
 * Options for prefetching the AI assets declared by a manifest.
 */
interface PrefetchInventoryOptions {
  /**
   * The embedding models for which to prefetch embeddings.
   */
  embeddingModels?: EmbeddingModel[] | undefined;

  /**
   * The embedder to use for prefetching embeddings.
   */
  embedder?: Embedder | undefined;

  /**
   * The precache to use for storing prefetched embeddings.
   */
  precache?: Precache | undefined;
}

/**
 * Prefetches the AI assets declared by a manifest for efficient runtime use.
 *
 * @param manifest - The manifest declaring the AI assets to prefetch.
 * @param options - The options for prefetching the AI assets.
 * @returns The prefetched inventory.
 */
const prefetchInventory = async (
  manifest: Manifest,
  options?: PrefetchInventoryOptions,
): Promise<Inventory> => {
  const embeddingModels = options?.embeddingModels ?? [];
  const embedder = options?.embedder ?? embed;
  const precache = options?.precache ?? createPrecache();

  const phrases = new Set<string>();
  for (const moduleId in manifest.modules) {
    const moduleDef = manifest.modules[moduleId]!;
    for (const idiomId in moduleDef.idioms) {
      const idiomDef = moduleDef.idioms[idiomId]!;
      for (const phrase of idiomDef.phrases) {
        phrases.add(phrase);
      }
    }
  }

  const missingTexts = Object.fromEntries(
    embeddingModels.map((embeddingModel) => {
      return [embeddingModel, new Set<string>()];
    }),
  );

  for (const phrase of phrases) {
    let embeddingCache = precache.embeddings[phrase];
    if (embeddingCache === undefined) {
      embeddingCache = {};
      precache.embeddings[phrase] = embeddingCache;
    }

    for (const embeddingModel of embeddingModels) {
      if (embeddingCache[embeddingModel] === undefined) {
        missingTexts[embeddingModel]!.add(phrase);
      }
    }
  }

  // Prefetch missing phrases for each embedding model.
  for (const embeddingModel in missingTexts) {
    if (missingTexts[embeddingModel]!.size === 0) {
      continue;
    }

    const phrases = [...missingTexts[embeddingModel]!];
    const vectors = await embedder(phrases, { model: embeddingModel });

    for (let i = 0; i < phrases.length; i += 1) {
      precache.embeddings[phrases[i]!]![embeddingModel] = vectors[i]!;
    }
  }

  const idioms = Object.fromEntries(
    Object.values(manifest.modules).flatMap((moduleDef) =>
      Object.entries(moduleDef.idioms).map(([idiomId, idiomDef]) => [
        idiomId,
        {
          embeddings: Object.fromEntries(
            idiomDef.phrases.map(
              (phrase) => [phrase, precache.embeddings[phrase] ?? {}] as const,
            ),
          ),
        },
      ]),
    ),
  );

  return {
    embeddingModels,
    idioms,
  };
};

export type { PrefetchInventoryOptions };
export { prefetchInventory };
