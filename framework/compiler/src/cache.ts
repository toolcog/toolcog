import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import type ts from "typescript";
import YAML from "yaml";
import type { EmbeddingModel, EmbeddingVector } from "@toolcog/core";

interface EmbeddingCache {
  [model: EmbeddingModel]: EmbeddingVector;
}

interface EmbeddingsCache {
  [embed: string]: EmbeddingCache;
}

interface ToolcogCache {
  embeddings: EmbeddingsCache;
}

/** @internal */
type EncodedEmbeddingVector = Buffer;

/** @internal */
interface EncodedEmbeddingCache {
  [model: EmbeddingModel]: EncodedEmbeddingVector;
}

/** @internal */
interface EncodedEmbeddingsCache {
  [embed: string]: EncodedEmbeddingCache;
}

/** @internal */
interface EncodedToolcogCache {
  embeddings: EncodedEmbeddingsCache;
}

const toolcogCacheFileName = ".toolcog/cache.yaml";

const resolveToolcogCache = (
  sourceFile: ts.SourceFile | undefined,
  cacheFileName: string = toolcogCacheFileName,
): string | undefined => {
  const packageDirectory = sourceFile?.packageJsonScope?.packageDirectory;
  if (packageDirectory === undefined) {
    return undefined;
  }
  return resolvePath(packageDirectory, cacheFileName);
};

const readToolcogCache = async (
  cacheFile: string | undefined,
): Promise<ToolcogCache | undefined> => {
  if (cacheFile === undefined || !existsSync(cacheFile)) {
    return undefined;
  }
  const yaml = await readFile(cacheFile, "utf-8");
  return parseToolcogCache(yaml);
};

const writeToolcogCache = async (
  cacheFile: string | undefined,
  cache: ToolcogCache | undefined,
): Promise<void> => {
  if (cacheFile === undefined || cache === undefined) {
    return;
  }
  const cacheDir = dirname(cacheFile);
  if (!existsSync(cacheDir)) {
    await mkdir(cacheDir, { recursive: true });
  }
  await writeFile(cacheFile, formatToolcogCache(cache));
};

const parseToolcogCache = (yaml: string): ToolcogCache => {
  return decodeToolcogCache(
    YAML.parse(yaml, {
      customTags: ["binary"],
    }) as EncodedToolcogCache,
  );
};

const formatToolcogCache = (cache: ToolcogCache): string => {
  return YAML.stringify(encodeToolcogCache(cache), {
    customTags: ["binary"],
  });
};

const decodeToolcogCache = (cache: EncodedToolcogCache): ToolcogCache => {
  return {
    embeddings: decodeEmbeddingsCache(cache.embeddings),
  };
};

const encodeToolcogCache = (cache: ToolcogCache): EncodedToolcogCache => {
  return {
    embeddings: encodeEmbeddingsCache(cache.embeddings),
  };
};

const decodeEmbeddingsCache = (
  embeddings: EncodedEmbeddingsCache,
): EmbeddingsCache => {
  return Object.fromEntries(
    Object.entries(embeddings).map(([embed, embedding]) => {
      return [embed, decodeEmbeddingCache(embedding)] as const;
    }),
  );
};

const encodeEmbeddingsCache = (
  embeddings: EmbeddingsCache,
): EncodedEmbeddingsCache => {
  return Object.fromEntries(
    Object.entries(embeddings)
      .map(([embed, embedding]) => {
        return [embed, encodeEmbeddingCache(embedding)] as const;
      })
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
};

const decodeEmbeddingCache = (
  embedding: EncodedEmbeddingCache,
): EmbeddingCache => {
  return Object.fromEntries(
    Object.entries(embedding).map(([model, vector]) => {
      return [model, decodeEmbeddingVector(vector)] as const;
    }),
  );
};

const encodeEmbeddingCache = (
  embedding: EmbeddingCache,
): EncodedEmbeddingCache => {
  return Object.fromEntries(
    Object.entries(embedding)
      .map(([model, vector]) => {
        return [model, encodeEmbeddingVector(vector)] as const;
      })
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
};

const decodeEmbeddingVector = (
  vector: EncodedEmbeddingVector,
): EmbeddingVector => {
  return new Float32Array(
    vector.buffer,
    vector.byteOffset,
    vector.byteLength / 4,
  );
};

const encodeEmbeddingVector = (
  vector: EmbeddingVector,
): EncodedEmbeddingVector => {
  return Buffer.from(vector.buffer);
};

const createToolcogCache = (): ToolcogCache => {
  return {
    embeddings: {},
  };
};

export type { EmbeddingCache, EmbeddingsCache, ToolcogCache };
export {
  toolcogCacheFileName,
  resolveToolcogCache,
  readToolcogCache,
  writeToolcogCache,
  parseToolcogCache,
  formatToolcogCache,
  createToolcogCache,
};
