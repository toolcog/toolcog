import type {
  GenerativeModel,
  GeneratorOptions,
  Generator,
} from "@toolcog/core";
import type { PluginLoaderConfig } from "./plugin-loader.ts";
import { PluginLoader } from "./plugin-loader.ts";

interface GeneratorPlugin {
  readonly getGenerator: (
    options?: GeneratorOptions,
  ) => Promise<Generator | undefined>;
}

class GeneratorLoader extends PluginLoader<GeneratorPlugin> {
  readonly #models: Map<GenerativeModel, Generator>;

  constructor(config?: PluginLoaderConfig) {
    super(config);
    this.#models = new Map();
  }

  models(): IterableIterator<[model: GenerativeModel, generator: Generator]> {
    return this.#models.entries();
  }

  addModel(model: GenerativeModel, generator: Generator): void {
    this.#models.set(model, generator);
  }

  removeModel(model: GenerativeModel): void {
    this.#models.delete(model);
  }

  async getModel(model: GenerativeModel): Promise<Generator> {
    // Check for a cached model.
    let generator = this.#models.get(model);

    if (generator === undefined) {
      // Extract the optional plugin component of the model name.
      let pluginName: string | undefined;
      let modelName: GenerativeModel | undefined;
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
        generator = await plugin.getGenerator({ model: modelName });
        if (generator === undefined) {
          throw new Error(
            "Unable to load model " +
              JSON.stringify(modelName) +
              " from plugin " +
              JSON.stringify(pluginName),
          );
        }
      } else {
        // Search all loaded plugins for a compatible model.
        generator = await this.findGenerator({ model: modelName });
        if (generator === undefined) {
          throw new Error("Unable to load model " + JSON.stringify(modelName));
        }
      }

      // Cache the loaded model.
      this.#models.set(model, generator);
    }

    return generator;
  }

  async getGenerator(options?: GeneratorOptions): Promise<Generator> {
    const model = options?.model;
    if (model !== undefined) {
      return await this.getModel(model);
    }

    const generator = await this.findGenerator(options);
    if (generator === undefined) {
      throw new Error("Unable to load default generator");
    }

    return generator;
  }

  /**
   * Searches all loaded plugins for a generator that's compatible
   * with the given `options`.
   * @internal
   */
  async findGenerator(
    options: GeneratorOptions | undefined,
  ): Promise<Generator | undefined> {
    for (const plugin of this.plugins()) {
      const generator = await plugin.getGenerator(options);
      if (generator !== undefined) {
        return generator;
      }
    }
    return undefined;
  }

  static #default: GeneratorLoader | undefined;

  static default(): GeneratorLoader {
    if (this.#default === undefined) {
      this.#default = new GeneratorLoader({
        modulePrefixes: ["@toolcog/", "toolcog-plugin-"],
        preloadPlugins: ["openai"],
      });
    }
    return this.#default;
  }
}

const generator = (async (
  args: unknown,
  options?: GeneratorOptions,
): Promise<unknown> => {
  const loader = GeneratorLoader.default();
  await loader.initialize();

  const generator = await loader.getGenerator(options);
  return await generator(args, options);
}) satisfies Generator;

export type { GeneratorPlugin };
export { GeneratorLoader, generator };
