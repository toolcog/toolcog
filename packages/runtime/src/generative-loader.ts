import type { GenerativeModel } from "@toolcog/core";
import { ModelLoader } from "./model-loader.ts";

interface GenerativePlugin {
  getGenerativeModel?(modelName?: string): Promise<GenerativeModel | undefined>;
}

class GenerativeLoader extends ModelLoader<GenerativeModel, GenerativePlugin> {
  async loadModel(
    plugin: GenerativePlugin,
    modelName?: string,
  ): Promise<GenerativeModel | undefined> {
    return plugin.getGenerativeModel?.(modelName);
  }
}

export type { GenerativePlugin };
export { GenerativeLoader };
