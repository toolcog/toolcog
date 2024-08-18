import type {
  EmbeddingModel,
  EmbedderOptions,
  EmbedderResult,
  Embedder,
} from "@toolcog/core";
import type { PluginLoaderConfig } from "./plugin-loader.ts";
import { PluginLoader } from "./plugin-loader.ts";

interface EmbedderPlugin {
  readonly getEmbedder: (
    options?: EmbedderOptions,
  ) => Promise<Embedder | undefined>;
}

class EmbedderLoader extends PluginLoader<EmbedderPlugin> {
  readonly #models: Map<EmbeddingModel, Embedder>;

  constructor(config?: PluginLoaderConfig) {
    super(config);
    this.#models = new Map();
  }

  models(): IterableIterator<[model: EmbeddingModel, embedder: Embedder]> {
    return this.#models.entries();
  }

  addModel(model: EmbeddingModel, embedder: Embedder): void {
    this.#models.set(model, embedder);
  }

  removeModel(model: EmbeddingModel): void {
    this.#models.delete(model);
  }

  async getModel(model: EmbeddingModel): Promise<Embedder> {
    // Check for a cached model.
    let embedder = this.#models.get(model);

    if (embedder === undefined) {
      // Extract the optional plugin component of the model name.
      let pluginName: string | undefined;
      let modelName: EmbeddingModel | undefined;
      const slashIndex = model.lastIndexOf("/");
      if (slashIndex >= 0) {
        pluginName = model.substring(0, slashIndex);
        modelName = model.substring(slashIndex + 1);
        if (slashIndex < model.length - 1) {
          modelName = model.substring(slashIndex + 1);
        }
      } else {
        modelName = model;
      }

      if (pluginName !== undefined) {
        // Try to load the model from the designated plugin.
        const plugin = await this.getPlugin(pluginName);
        embedder = await plugin.getEmbedder({ model: modelName });
        if (embedder === undefined) {
          throw new Error(
            "Unable to load model " +
              JSON.stringify(modelName) +
              " from plugin " +
              JSON.stringify(pluginName),
          );
        }
      } else {
        // Search all loaded plugins for a compatible model.
        embedder = await this.findEmbedder({ model: modelName });
        if (embedder === undefined) {
          throw new Error("Unable to load model " + JSON.stringify(modelName));
        }
      }

      // Cache the loaded model.
      this.#models.set(model, embedder);
    }

    return embedder;
  }

  async getEmbedder(options?: EmbedderOptions): Promise<Embedder> {
    const model = options?.model;
    if (model !== undefined) {
      return await this.getModel(model);
    }

    const embedder = await this.findEmbedder(options);
    if (embedder === undefined) {
      throw new Error("Unable to load default embedder");
    }

    return embedder;
  }

  /**
   * Searches all loaded plugins for a embedder that's compatible
   * with the given `options`.
   * @internal
   */
  async findEmbedder(
    options: EmbedderOptions | undefined,
  ): Promise<Embedder | undefined> {
    for (const plugin of this.plugins()) {
      const embedder = await plugin.getEmbedder(options);
      if (embedder !== undefined) {
        return embedder;
      }
    }
    return undefined;
  }

  static #default: EmbedderLoader | undefined;

  static default(): EmbedderLoader {
    if (this.#default === undefined) {
      this.#default = new EmbedderLoader({
        modulePrefixes: ["@toolcog/", "toolcog-plugin-"],
        preloadPlugins: ["openai"],
      });
    }
    return this.#default;
  }
}

const embedder = (async <T extends string | readonly string[]>(
  embeds: T,
  options?: EmbedderOptions,
): Promise<EmbedderResult<T>> => {
  const loader = EmbedderLoader.default();
  await loader.initialize();

  const embedder = await loader.getEmbedder(options);
  return await embedder(embeds, options);
}) satisfies Embedder;

export type { EmbedderPlugin };
export { EmbedderLoader, embedder };
