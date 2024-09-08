import YAML from "yaml";
import type { EmbeddingVector, Embeddings } from "@toolcog/core";
import { decodeEmbeddings, encodeEmbeddings } from "@toolcog/core";

interface Precache<V = EmbeddingVector> {
  embeddings: Embeddings<V>;
}

const precacheFileName = ".toolcog/precache.yaml";

const parsePrecache = (yaml: string): Precache => {
  return decodePrecache(
    YAML.parse(yaml, {
      customTags: ["binary"],
    }) as Precache<Buffer>,
  );
};

const formatPrecache = (cache: Precache): string => {
  return YAML.stringify(encodePrecache(cache), {
    customTags: ["binary"],
  });
};

const decodePrecache = (cache: Precache<Buffer>): Precache => {
  return {
    embeddings: decodeEmbeddings(cache.embeddings),
  };
};

const encodePrecache = (cache: Precache): Precache<Buffer> => {
  return {
    embeddings: encodeEmbeddings(cache.embeddings),
  };
};

const createPrecache = (): Precache => {
  return {
    embeddings: Object.create(null) as Precache["embeddings"],
  };
};

export type { Embeddings, Precache };
export { precacheFileName, parsePrecache, formatPrecache, createPrecache };
