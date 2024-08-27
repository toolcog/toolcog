import type { EmbeddingModel, Embedder } from "@toolcog/core";
import { embed } from "./runtime.ts";
import type { Manifest } from "./manifest.ts";
import type { Inventory } from "./inventory.ts";
import type { Precache } from "./precache.ts";
import { createPrecache } from "./precache.ts";

interface PrefetchInventoryOptions {
  embeddingModels?: EmbeddingModel[] | undefined;

  embedder?: Embedder | undefined;

  precache?: Precache | undefined;
}

const prefetchInventory = async (
  manifest: Manifest,
  options?: PrefetchInventoryOptions,
): Promise<Inventory> => {
  const embeddingModels = options?.embeddingModels ?? [];
  const embedder = options?.embedder ?? embed;
  const precache = options?.precache ?? createPrecache();

  const texts = new Set<string>();
  for (const moduleId in manifest.modules) {
    const moduleDef = manifest.modules[moduleId]!;
    for (const idiomId in moduleDef.idioms) {
      const idiomDef = moduleDef.idioms[idiomId]!;
      for (const text of idiomDef.embeds) {
        texts.add(text);
      }
    }
  }

  const missingTexts = Object.fromEntries(
    embeddingModels.map((embeddingModel) => {
      return [embeddingModel, new Set<string>()];
    }),
  );

  for (const text of texts) {
    let embeddingCache = precache.embeddings[text];
    if (embeddingCache === undefined) {
      embeddingCache = {};
      precache.embeddings[text] = embeddingCache;
    }

    for (const embeddingModel of embeddingModels) {
      if (embeddingCache[embeddingModel] === undefined) {
        missingTexts[embeddingModel]!.add(text);
      }
    }
  }

  // Prefetch missing texts for each embedding model.
  for (const embeddingModel in missingTexts) {
    if (missingTexts[embeddingModel]!.size === 0) {
      continue;
    }

    const texts = [...missingTexts[embeddingModel]!];
    const vectors = await embedder(texts, { model: embeddingModel });

    for (let i = 0; i < texts.length; i += 1) {
      precache.embeddings[texts[i]!]![embeddingModel] = vectors[i]!;
    }
  }

  const idioms = Object.fromEntries(
    Object.values(manifest.modules).flatMap((moduleDef) =>
      Object.entries(moduleDef.idioms).map(([idiomId, idiomDef]) => [
        idiomId,
        {
          embeddings: Object.fromEntries(
            idiomDef.embeds.map(
              (text) => [text, precache.embeddings[text] ?? {}] as const,
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
