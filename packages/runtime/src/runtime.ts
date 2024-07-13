import type {
  Message,
  Tool,
  Toolcog,
  Thread,
  GenerativeModel,
  EmbeddingModel,
  UseToolOptions,
} from "@toolcog/core";
import type { PluginLoaderOptions } from "./plugin-loader.ts";
import { PluginLoader } from "./plugin-loader.ts";
import type { ModelLoaderOptions } from "./model-loader.ts";
import type { GenerativePlugin } from "./generative-loader.ts";
import { GenerativeLoader } from "./generative-loader.ts";
import type { EmbeddingPlugin } from "./embedding-loader.ts";
import { EmbeddingLoader } from "./embedding-loader.ts";
import { TemporaryThread } from "./thread.ts";

const DEFAULT_PLUGIN_LOADER_OPTIONS = {
  modulePrefixes: ["@toolcog/", "toolcog-model-"],
  preloadPluginIds: ["openai"],
} as const satisfies PluginLoaderOptions;

interface RuntimeOptions {
  pluginLoader?: PluginLoaderOptions | undefined;

  generativeLoader?: ModelLoaderOptions | undefined;

  embeddingLoader?: ModelLoaderOptions | undefined;
}

class Runtime implements Toolcog {
  readonly #pluginLoader: PluginLoader<GenerativePlugin & EmbeddingPlugin>;

  readonly #generativeLoader: GenerativeLoader;

  readonly #embeddingLoader: EmbeddingLoader;

  constructor(options?: RuntimeOptions) {
    this.#pluginLoader = new PluginLoader(
      options?.pluginLoader ?? DEFAULT_PLUGIN_LOADER_OPTIONS,
    );

    this.#generativeLoader = new GenerativeLoader(
      this.#pluginLoader,
      options?.generativeLoader,
    );

    this.#embeddingLoader = new EmbeddingLoader(
      this.#pluginLoader,
      options?.embeddingLoader,
    );
  }

  createThread(messages?: Message[]): Thread {
    return new TemporaryThread(messages);
  }

  useTool(tool: Tool, options?: UseToolOptions): Tool {
    return tool;
  }

  async getGenerativeModel(modelId?: string): Promise<GenerativeModel> {
    await this.#pluginLoader.initialize();
    return this.#generativeLoader.getModel(modelId);
  }

  async getEmbeddingModel(modelId?: string): Promise<EmbeddingModel> {
    await this.#pluginLoader.initialize();
    return this.#embeddingLoader.getModel(modelId);
  }
}

export type { RuntimeOptions };
export { Runtime };
