import { AsyncContext } from "@toolcog/util/async";
import type {
  Embeddings,
  EmbedderConfig,
  EmbedderOptions,
  Embedded,
  Embedder,
  Idioms,
  IdiomResolver,
  Index,
  IndexerConfig,
  IndexerOptions,
  Indexer,
  Tool,
  GeneratorConfig,
  GeneratorOptions,
  Generator,
} from "@toolcog/core";
import { indexer } from "./indexer.ts";
import type { Plugin, PluginSource } from "./plugin.ts";
import { resolvePlugins } from "./plugin.ts";
import type { Toolkit, ToolkitSource } from "./toolkit.ts";
import { resolveToolkits } from "./toolkit.ts";
import type { Inventory, InventorySource } from "./inventory.ts";
import { createInventory, resolveInventory } from "./inventory.ts";

/**
 * Configuration options for initializing a Runtime.
 */
interface RuntimeConfigSource {
  /**
   * Plugins for the runtime to use.
   */
  plugins?: PluginSource[] | null | undefined;

  /**
   * Toolkits for the runtime to index.
   */
  toolkits?: ToolkitSource[] | null | undefined;

  /**
   * The embedder configuration for the runtime.
   */
  embedder?: EmbedderConfig | undefined;

  /**
   * The indexer configuration for the runtime.
   */
  indexer?: IndexerConfig | undefined;

  /**
   * The generator configuration for the runtime.
   */
  generator?: GeneratorConfig | undefined;

  /**
   * The inventory of embeddings for idioms resolved by the runtime.
   */
  inventory?: InventorySource | undefined;
}

/**
 * Fully resolved configuration options for initializing a Runtime.
 */
interface RuntimeConfig {
  /**
   * Plugins for the runtime to use.
   */
  plugins?: Plugin[] | null | undefined;

  /**
   * Toolkits for the runtime to index.
   */
  toolkits?: Toolkit[] | null | undefined;

  /**
   * The embedder configuration for the runtime.
   */
  embedder?: EmbedderConfig | undefined;

  /**
   * The indexer configuration for the runtime.
   */
  indexer?: IndexerConfig | undefined;

  /**
   * The generator configuration for the runtime.
   */
  generator?: GeneratorConfig | undefined;

  /**
   * The inventory of embeddings for idioms resolved by the runtime.
   */
  inventory?: Inventory | undefined;
}

class Runtime {
  readonly #plugins: Plugin[];
  readonly #toolkits: Toolkit[];
  readonly #embedderConfig: EmbedderConfig;
  readonly #indexerConfig: IndexerConfig;
  readonly #generatorConfig: GeneratorConfig;
  readonly #inventory: Inventory;

  /**
   * Creates a new runtime with the given configuration.
   *
   * @param config - The configuration for the runtime.
   */
  constructor(config?: RuntimeConfig) {
    this.#plugins = config?.plugins ?? [];
    this.#toolkits = config?.toolkits ?? [];
    this.#embedderConfig = config?.embedder ?? {};
    this.#indexerConfig = config?.indexer ?? {};
    this.#generatorConfig = config?.generator ?? {};
    this.#inventory = config?.inventory ?? createInventory();
  }

  /**
   * The plugins loaded by this runtime.
   */
  get plugins(): readonly Plugin[] {
    return this.#plugins;
  }

  /**
   * The toolkits loaded by this runtime.
   */
  get toolkits(): readonly Toolkit[] {
    return this.#toolkits;
  }

  /**
   * The default configuration for embedders used by agents running in the
   * context of this runtime.
   */
  get embedderConfig(): EmbedderConfig {
    return this.#embedderConfig;
  }

  /**
   * The default configuration for indexers used by agents running in the
   * context of this runtime.
   */
  get indexerConfig(): IndexerConfig {
    return this.#indexerConfig;
  }

  /**
   * The default configuration for generators used by agents running in the
   * context of this runtime.
   */
  get generatorConfig(): GeneratorConfig {
    return this.#generatorConfig;
  }

  /**
   * The inventory of embeddings for idioms resolved by the runtime.
   */
  get inventory(): Inventory {
    return this.#inventory;
  }

  /**
   * Adds the specified plugin to the runtime, making its embedders, indexers,
   * and generators available for use by agents running in the runtime.
   *
   * @param plugin - The plugin to add to the runtime.
   */
  addPlugin(plugin: Plugin): void {
    this.#plugins.push(plugin);
  }

  /**
   * Adds the specified toolkit to the runtime, making its tools available
   * for selection by agents running in the runtime.
   *
   * @param toolkit - The toolkit to add to the runtime.
   */
  addToolkit(toolkit: Toolkit): void {
    this.#toolkits.push(toolkit);
  }

  /**
   * Merges the specified inventory into the runtime's inventory, making its
   * embeddings available to idioms resolved by the runtime.
   *
   * @param inventory - The inventory to merge into the runtime's inventory.
   */
  addInventory(inventory: Inventory): void {
    this.#inventory.embeddingModels = [
      ...new Set([
        ...this.#inventory.embeddingModels,
        ...inventory.embeddingModels,
      ]),
    ];
    this.#inventory.idioms = {
      ...this.#inventory.idioms,
      ...inventory.idioms,
    };
  }

  /**
   * Merges the specified embedder options with the runtime's embedder
   * configuration.
   *
   * @param options - The embedder options to merge with the runtime's
   * embedder configuration.
   * @returns The merged embedder options.
   */
  embedderOptions(options: EmbedderOptions | undefined): EmbedderOptions {
    return {
      ...this.embedderConfig,
      ...options,
    };
  }

  /**
   * Merges the specified indexer options with the runtime's indexer
   * configuration.
   *
   * @param options - The indexer options to merge with the runtime's
   * indexer configuration.
   * @returns The merged indexer options.
   */
  indexerOptions(options: IndexerOptions | undefined): IndexerOptions {
    return {
      embedder: embed,
      ...this.embedderConfig,
      ...this.indexerConfig,
      ...options,
    };
  }

  /**
   * Merges the specified generator options with the runtime's generator
   * configuration.
   *
   * @param options - The generator options to merge with the runtime's
   * generator configuration.
   * @returns The merged generator options.
   */
  generatorOptions(options: GeneratorOptions | undefined): GeneratorOptions {
    return {
      ...this.generatorConfig,
      ...options,
      ...((
        this.generatorConfig.tools !== undefined &&
        this.generatorConfig.tools !== null &&
        options?.tools !== undefined &&
        options.tools !== null
      ) ?
        { tools: [...this.generatorConfig.tools, ...options.tools] }
      : undefined),
    };
  }

  /**
   * Returns an `Embedder` that is compatible with the specified `options`.
   *
   * @param options - The options that the embedder must be compatible with.
   * @returns A promise that resolves to a compatible embedder.
   * @throws If no compatible embedder could be found.
   */
  async embedder(options?: EmbedderOptions): Promise<Embedder> {
    const plugins = this.plugins;
    for (const plugin of plugins) {
      const embedder = await plugin.embedder?.(options);
      if (embedder !== undefined) {
        return embedder;
      }
    }
    throw new Error("No embedder");
  }

  /**
   * Returns an `Indexer` that is compatible with the specified `options`.
   *
   * @param options - The options that the indexer must be compatible with.
   * @returns A promise that resolves to a compatible indexer.
   * @throws If no compatible indexer could be found.
   */
  async indexer(options: IndexerOptions): Promise<Indexer> {
    const plugins = this.plugins;
    for (const plugin of plugins) {
      const indexer = await plugin.indexer?.(options);
      if (indexer !== undefined) {
        return indexer;
      }
    }
    return indexer;
  }

  /**
   * Returns a `Generator` that is compatible with the specified `options`.
   *
   * @param options - The options that the generator must be compatible with.
   * @returns A promise that resolves to a compatible generator.
   * @throws If no compatible generator could be found.
   */
  async generator(options?: GeneratorOptions): Promise<Generator> {
    const plugins = this.plugins;
    for (const plugin of plugins) {
      const generator = await plugin.generator?.(options);
      if (generator !== undefined) {
        return generator;
      }
    }
    throw new Error("No generator");
  }

  /**
   * Generates embedding vectors for the provided input.
   *
   * @typeParam T - The type of the input, either a string or an array
   * of strings.
   * @param input - The string or strings for which to generate embeddings.
   * @param options - The options to use when embedding the input.
   * @returns A promise that resolves to the embedding vector(s) for the
   * input(s).
   */
  async embed<T extends string | readonly string[]>(
    input: T,
    options?: EmbedderOptions,
  ): Promise<Embedded<T>> {
    options = this.embedderOptions(options);
    const embedder = await this.embedder(options);
    return await embedder(input, options);
  }

  /**
   * Creates a semantic index from a set of idioms.
   *
   * @typeParam T - The type of the idioms to index.
   * @param idioms - The idioms to index.
   * @param options - The options to use when creating the index.
   * @returns A promise that resolves to the index.
   */
  async index<T extends readonly unknown[]>(
    idioms: Idioms<T>,
    options?: IndexerOptions,
  ): Promise<Index<T>> {
    options = this.indexerOptions(options);
    const indexer = await this.indexer(options);
    return await indexer(idioms, options);
  }

  /**
   * Invokes a generative model with specified instructions and arguments.
   *
   * @param args - Arguments for the generative function.
   * @param options - Options to control the generator's behavior.
   * @returns A promise that resolves to the generated response.
   */
  async generate(args: unknown, options?: GeneratorOptions): Promise<unknown> {
    options = this.generatorOptions(options);
    const generator = await this.generator(options);
    return await generator(args, options);
  }

  /**
   * Returns the inventoried embeddings to use for an idiom. Overrides the
   * default descriptive phrases associated with the idiom
   *
   * @param id - The ID of the idiom to resolve.
   * @param value - The value of the idiom to resolve.
   * @returns The inventoried embeddings for the idiom, or `undefined` if the
   * idiom's default descriptive phrases should be used.
   */
  resolveIdiom(id: string, value: unknown): Embeddings | undefined {
    return this.inventory.idioms[id]?.embeddings;
  }

  /**
   * Indexes the tools from all the toolkits registered with this runtime.
   *
   * @param options - The configuration options for the indexer.
   * @returns A promise that resolves to the indexed tools.
   */
  async toolIndex(options?: IndexerOptions): Promise<Index<readonly Tool[]>> {
    const tools = (
      await Promise.all(this.toolkits.map((toolkit) => toolkit.tools?.() ?? []))
    ).flat();
    return await this.index(tools, options);
  }

  /**
   * The default system prompt for generators running in the context
   * of this runtime.
   */
  static systemPrompt(): string {
    return "You are an AI function embedded in a computer program.";
  }

  /**
   * Resolves the given runtime configuration options.
   *
   * @param config - The runtime configuration options to resolve.
   * @returns The fully resolved runtime configuration options.
   */
  static async resolveConfig(
    config?: RuntimeConfigSource,
  ): Promise<RuntimeConfig> {
    return {
      plugins: await resolvePlugins(config?.plugins),
      toolkits: await resolveToolkits(config?.toolkits),
      embedder: config?.embedder,
      indexer: config?.indexer,
      generator: config?.generator,
      inventory: await resolveInventory(config?.inventory),
    };
  }

  /**
   * Creates a new runtime with the given configuration.
   *
   * @param config - The configuration for the runtime.
   * @returns The new runtime.
   */
  static async create(config?: RuntimeConfigSource): Promise<Runtime> {
    return new this(await this.resolveConfig(config));
  }

  /**
   * Async local storage for the currently active runtime.
   */
  static readonly #current = new AsyncContext.Variable<Runtime>({
    name: "toolcog.runtime",
  });

  /**
   * Returns the runtime that's active for the current async context.
   *
   * @throws If not currently running in a runtime context.
   */
  static current(): Runtime {
    const runtime = this.#current.get();
    if (runtime === undefined) {
      throw new Error("Not in a toolcog runtime context");
    }
    return runtime;
  }

  /**
   * Returns the runtime that's active for the current async context,
   * or `null` if not currently running in a runtime context.
   */
  static get(): Runtime | null {
    return this.#current.get() ?? null;
  }

  /**
   * Runs a function in the context of the specified runtime.
   *
   * @param runtime - The runtime in which to run the function,
   * or `null` to run the function outside of any runtime context.
   * @param func - The function to run in the runtime context.
   * @param args - The arguments to pass to the function.
   * @returns The return value of the function.
   */
  static run<F extends (...args: any[]) => unknown>(
    runtime: Runtime | null | undefined,
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> {
    return this.#current.run(runtime ?? undefined, func, ...args);
  }
}

/**
 * Generates embedding vectors for the provided input using the currently
 * active runtime.
 *
 * @typeParam T - The type of the input, either a string or an array of strings.
 * @param input - The string or strings for which to generate embeddings.
 * @param options - The options to use when embedding the input.
 * @returns A promise that resolves to the embedding vector(s) for the input(s).
 */
const embed: Embedder = <T extends string | readonly string[]>(
  input: T,
  options?: EmbedderOptions,
): Promise<Embedded<T>> => {
  const runtime = Runtime.current();
  return runtime.embed(input, options);
};

/**
 * Creates a semantic index from a set of idioms using the currently
 * active runtime.
 *
 * @typeParam T - The type of the idioms to index.
 * @param idioms - The idioms to index.
 * @param options - The options to use when creating the index.
 * @returns A promise that resolves to the index.
 */
const index: Indexer = <T extends readonly unknown[]>(
  idioms: Idioms<T>,
  options?: IndexerOptions,
): Promise<Index<T>> => {
  const runtime = Runtime.current();
  return runtime.index(idioms, options);
};

/**
 * Invokes a generative model with specified instructions and arguments using
 * the currently active runtime.
 *
 * @param args - Arguments for the generative function.
 * @param options - Options to control the generator's behavior.
 * @returns A promise that resolves to the generated response.
 */
const generate: Generator = (
  args: unknown,
  options?: GeneratorOptions,
): Promise<unknown> => {
  const runtime = Runtime.current();
  return runtime.generate(args, options);
};

/**
 * Returns the embeddings to use for an idiom in the currently active runtime.
 * Overrides the default descriptive phrases associated with the idiom.
 *
 * @param id - The ID of the idiom to resolve.
 * @param value - The value of the idiom to resolve.
 * @returns The inventoried embeddings for the idiom, or `undefined` if the
 * idiom's default descriptive phrases should be used.
 */
const resolveIdiom: IdiomResolver = (
  id: string,
  value: unknown,
): Embeddings | undefined => {
  const runtime = Runtime.current();
  return runtime.resolveIdiom(id, value);
};

export type { RuntimeConfigSource, RuntimeConfig };
export { Runtime, embed, index, generate, resolveIdiom };
