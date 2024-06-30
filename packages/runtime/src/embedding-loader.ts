import type { EmbeddingModel } from "@toolcog/core";
import { ModelLoader } from "./model-loader.ts";

interface EmbeddingPlugin {
  getEmbeddingModel?(modelName?: string): Promise<EmbeddingModel | undefined>;
}

class EmbeddingLoader extends ModelLoader<EmbeddingModel, EmbeddingPlugin> {
  async loadModel(
    plugin: EmbeddingPlugin,
    modelName?: string,
  ): Promise<EmbeddingModel | undefined> {
    return plugin.getEmbeddingModel?.(modelName);
  }
}

export type { EmbeddingPlugin };
export { EmbeddingLoader };
