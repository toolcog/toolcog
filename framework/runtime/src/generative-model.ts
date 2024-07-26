import type { GenerativeModel } from "@toolcog/core";
import { ModelLoader } from "./model-loader.ts";

interface GenerativeModelPlugin {
  supportsGenerativeModel?(modelName: string): boolean;

  generativeModel?: GenerativeModel | undefined;
}

class GenerativeModelLoader extends ModelLoader<
  GenerativeModel,
  GenerativeModelPlugin
> {
  async loadModel(
    plugin: GenerativeModelPlugin,
    modelName?: string,
  ): Promise<GenerativeModel | undefined> {
    if (
      modelName === undefined ||
      plugin.supportsGenerativeModel === undefined ||
      plugin.supportsGenerativeModel(modelName)
    ) {
      return plugin.generativeModel;
    }
    return undefined;
  }
}

export type { GenerativeModelPlugin };
export { GenerativeModelLoader };
