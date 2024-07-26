import type { EmbeddingModel } from "@toolcog/core";
import { ModelLoader } from "./model-loader.ts";

interface EmbeddingModelPlugin {
  supportsEmbeddingModel?(modelName: string): boolean;

  embeddingModel?: EmbeddingModel | undefined;
}

class EmbeddingModelLoader extends ModelLoader<
  EmbeddingModel,
  EmbeddingModelPlugin
> {
  async loadModel(
    plugin: EmbeddingModelPlugin,
    modelName?: string,
  ): Promise<EmbeddingModel | undefined> {
    if (
      modelName === undefined ||
      plugin.supportsEmbeddingModel === undefined ||
      plugin.supportsEmbeddingModel(modelName)
    ) {
      return plugin.embeddingModel;
    }
    return undefined;
  }
}

export type { EmbeddingModelPlugin };
export { EmbeddingModelLoader };
