import { PluginLoader } from "./plugin-loader.ts";

interface ModelLoaderOptions {
  defaultModelId?: readonly string[] | string | undefined;
}

abstract class ModelLoader<Model, Plugin> {
  readonly #pluginLoader: PluginLoader<Plugin>;

  readonly #defaultModelIds: readonly string[];

  readonly #models: Map<string | undefined, Model>;

  constructor(
    pluginLoader?: PluginLoader<Plugin>,
    options?: ModelLoaderOptions,
  ) {
    this.#pluginLoader = pluginLoader ?? new PluginLoader();

    this.#defaultModelIds =
      options?.defaultModelId === undefined ? []
      : typeof options.defaultModelId === "string" ? [options.defaultModelId]
      : options.defaultModelId;

    this.#models = new Map();
  }

  /**
   * Returns an iterator over all currently loaded model plugins.
   */
  plugins(): IterableIterator<Plugin> {
    return this.#pluginLoader.plugins();
  }

  /**
   * Returns the model plugin with the given `pluginId`, loading the plugin if
   * it's not already cached. Throws an `Error` with the failed lookup locations
   * if the plugin could not be found.
   */
  getPlugin(pluginId: string): Promise<Plugin> {
    return this.#pluginLoader.getPlugin(pluginId);
  }

  /**
   * Registers a model `plugin` with the given `pluginId`.
   */
  addPlugin(pluginId: string, plugin: Plugin): void {
    this.#pluginLoader.addPlugin(pluginId, plugin);
  }

  /**
   * Unregisters the model plugin with the given `pluginId`.
   */
  removePlugin(pluginId: string): void {
    this.#pluginLoader.removePlugin(pluginId);
  }

  /**
   * Returns the model with the given `modelId`, loading the model from a
   * plugin if it's not already cached. Throws an `Error` if the model could
   * not be found.
   */
  async getModel(modelId?: string): Promise<Model> {
    // Check for a cached model.
    let model = this.#models.get(modelId);

    if (model === undefined) {
      // Split the modelId into its pluginId/modelName components.
      const { pluginId, modelName } = splitModelId(modelId);

      if (pluginId !== undefined) {
        // Try to load the model from the designated plugin.
        const plugin = await this.#pluginLoader.getPlugin(pluginId);
        model = await this.loadModel(plugin, modelName);
        if (model === undefined) {
          throw new Error(
            `Unable to load model ${JSON.stringify(modelName)} from plugin ${JSON.stringify(pluginId)}`,
          );
        }
      } else if (modelName !== undefined) {
        // Search all loaded plugins for a matching model.
        model = await this.findModel(modelName);
        if (model === undefined) {
          throw new Error(`Unable to load model ${JSON.stringify(modelName)}`);
        }
      } else {
        // Try to load a preferred default model.
        for (const defaultModelId of this.#defaultModelIds) {
          model = await this.getModel(defaultModelId);
          if (model !== undefined) {
            break;
          }
        }
        if (model === undefined) {
          // Try to load a default model from any plugin.
          model = await this.findModel();
          if (model === undefined) {
            throw new Error("Unable to load default model");
          }
        }
      }

      // Cache the loaded model.
      this.#models.set(modelId, model);
    }

    return model;
  }

  /**
   * Registers a `model` with the given `modelId`.
   */
  addModel(modelId: string, model: Model): void {
    this.#models.set(modelId, model);
  }

  /**
   * Unregisters the model with the given `modelId`.
   */
  removeModel(modelId: string): void {
    this.#models.delete(modelId);
  }

  /**
   * Searches all loaded plugins for a model with the given `modelName`.
   * @internal
   */
  async findModel(modelName?: string): Promise<Model | undefined> {
    // Iterator over all loaded plugins.
    for (const plugin of this.#pluginLoader.plugins()) {
      // Check each plugin for a matching model.
      const model = await this.loadModel(plugin, modelName);
      if (model !== undefined) {
        return model;
      }
    }

    // Model not found.
    return undefined;
  }

  /**
   * Loads the model with the given `modelName` from the designated `plugin`.
   * @internal
   */
  abstract loadModel(
    plugin: Plugin,
    modelName?: string,
  ): Promise<Model | undefined>;
}

/**
 * Splits a model ID into its pluginId/modelName components.
 */
const splitModelId = (
  modelId: string | undefined,
): { pluginId: string | undefined; modelName: string | undefined } => {
  let pluginId: string | undefined;
  let modelName: string | undefined;

  if (modelId !== undefined) {
    const slashIndex = modelId.lastIndexOf("/");
    if (slashIndex >= 0) {
      pluginId = modelId.substring(0, slashIndex);
      if (slashIndex < modelId.length - 1) {
        modelName = modelId.substring(slashIndex + 1);
      }
    } else {
      modelName = modelId;
    }
  }

  return { pluginId, modelName };
};

export type { ModelLoaderOptions };
export { ModelLoader, splitModelId };
