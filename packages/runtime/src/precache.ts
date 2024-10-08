import YAML from "yaml";
import type { EmbeddingVector, Embeddings } from "@toolcog/core";
import { decodeEmbeddings, encodeEmbeddings } from "@toolcog/core";

/**
 * A cache of pre-generated embeddings.
 */
interface Precache<V = EmbeddingVector> {
  embeddings: Embeddings<V>;
}

/**
 * The default file name for embedding precache files.
 */
const precacheFileName = ".toolcog/precache.yaml";

/**
 * Parses an embedding precache from a YAML string.
 *
 * @param yaml - The YAML string to parse.
 * @returns The parsed embedding precache.
 */
const parsePrecache = (yaml: string): Precache => {
  return decodePrecache(
    YAML.parse(yaml, {
      customTags: ["binary"],
    }) as Precache<Buffer>,
  );
};

/**
 * Formats an embedding precache as a YAML string.
 *
 * @param cache - The embedding precache to format.
 * @returns The formatted YAML string.
 */
const formatPrecache = (cache: Precache): string => {
  return YAML.stringify(encodePrecache(cache), {
    customTags: ["binary"],
  });
};

/**
 * Decodes the embedding vectors in a parsed embedding precache for in-memory
 * use. Base64-decodes all embedding vectors into `Float32Array`s.
 *
 * @param cache - The embedding precache to decode.
 * @returns The decoded embedding precache.
 */
const decodePrecache = (cache: Precache<Buffer>): Precache => {
  return {
    embeddings: decodeEmbeddings(cache.embeddings),
  };
};

/**
 * Encodes the embedding vectors in an embedding precache for serialization.
 * Base64-encodes all embedding vectors into `Buffer`s.
 *
 * @param cache - The embedding precache to encode.
 * @returns The encoded embedding precache.
 */
const encodePrecache = (cache: Precache): Precache<Buffer> => {
  return {
    embeddings: encodeEmbeddings(cache.embeddings),
  };
};

/**
 * Creates a new embedding precache.
 *
 * @returns An empty embedding precache.
 */
const createPrecache = (): Precache => {
  return {
    embeddings: Object.create(null) as Precache["embeddings"],
  };
};

export type { Embeddings, Precache };
export { precacheFileName, parsePrecache, formatPrecache, createPrecache };
