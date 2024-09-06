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
  GeneratorConfig,
  GeneratorOptions,
  Generator,
} from "@toolcog/core";
import { AgentContext } from "./agent.ts";
import { indexer } from "./indexer.ts";
import type { Plugin, PluginSource } from "./plugin.ts";
import { resolvePlugins } from "./plugin.ts";
import type { Inventory, InventorySource } from "./inventory.ts";
import { createInventory, resolveInventory } from "./inventory.ts";

interface RuntimeConfigSource {
  plugins?: PluginSource[] | null | undefined;

  embedder?: EmbedderConfig | undefined;

  indexer?: IndexerConfig | undefined;

  generator?: GeneratorConfig | undefined;

  inventory?: InventorySource | undefined;
}

interface RuntimeConfig {
  plugins?: Plugin[] | null | undefined;

  embedder?: EmbedderConfig | undefined;

  indexer?: IndexerConfig | undefined;

  generator?: GeneratorConfig | undefined;

  inventory?: Inventory | undefined;
}

class Runtime {
  readonly #plugins: Plugin[];
  readonly #embedderConfig: EmbedderConfig;
  readonly #indexerConfig: IndexerConfig;
  readonly #generatorConfig: GeneratorConfig;
  readonly #inventory: Inventory;

  constructor(config?: RuntimeConfig) {
    this.#plugins = config?.plugins ?? [];
    this.#embedderConfig = config?.embedder ?? {};
    this.#indexerConfig = config?.indexer ?? {};
    this.#generatorConfig = config?.generator ?? {};
    this.#inventory = config?.inventory ?? createInventory();
  }

  get plugins(): Plugin[] {
    return this.#plugins;
  }

  get embedderConfig(): EmbedderConfig {
    return this.#embedderConfig;
  }

  get indexerConfig(): IndexerConfig {
    return this.#indexerConfig;
  }

  get generatorConfig(): GeneratorConfig {
    return this.#generatorConfig;
  }

  get inventory(): Inventory {
    return this.#inventory;
  }

  embedderOptions(options: EmbedderOptions | undefined): EmbedderOptions {
    return {
      ...this.embedderConfig,
      ...options,
    };
  }

  indexerOptions(options: IndexerOptions | undefined): IndexerOptions {
    return {
      ...this.embedderConfig,
      ...this.indexerConfig,
      ...options,
    };
  }

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

  async embed<T extends string | readonly string[]>(
    texts: T,
    options?: EmbedderOptions,
  ): Promise<Embedded<T>> {
    options = this.embedderOptions(options);
    const embedder = await this.embedder(options);
    return await embedder(texts, options);
  }

  async index<T extends readonly unknown[]>(
    idioms: Idioms<T>,
    options?: IndexerOptions,
  ): Promise<Index<T>> {
    options = this.indexerOptions(options);
    const indexer = await this.indexer(options);
    return await indexer(idioms, options);
  }

  async generate(args: unknown, options?: GeneratorOptions): Promise<unknown> {
    options = this.generatorOptions(options);

    let context: AgentContext | null = null;
    if (typeof args === "string") {
      context = AgentContext.get();
      context?.setQuery(args);
    }

    try {
      const generator = await this.generator(options);
      return await generator(args, options);
    } finally {
      context?.setQuery(undefined);
    }
  }

  resolveIdiom(id: string, value: unknown): Embeddings | undefined {
    return this.inventory.idioms[id]?.embeddings;
  }

  static systemPrompt(): string {
    return "You are an AI function embedded in a computer program.";
  }

  static async resolveConfig(
    config?: RuntimeConfigSource,
  ): Promise<RuntimeConfig> {
    return {
      plugins: await resolvePlugins(config?.plugins),
      embedder: config?.embedder,
      indexer: config?.indexer,
      generator: config?.generator,
      inventory: await resolveInventory(config?.inventory),
    };
  }

  static async create(config?: RuntimeConfigSource): Promise<Runtime> {
    return new this(await this.resolveConfig(config));
  }

  static readonly #current = new AsyncContext.Variable<Runtime>({
    name: "toolcog.runtime",
  });

  static current(): Runtime {
    const runtime = this.#current.get();
    if (runtime === undefined) {
      throw new Error("Not in a toolcog runtime context");
    }
    return runtime;
  }

  static get(): Runtime | null {
    return this.#current.get() ?? null;
  }

  static run<F extends (...args: any[]) => unknown>(
    runtime: Runtime | null | undefined,
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> {
    return this.#current.run(runtime ?? undefined, func, ...args);
  }
}

const embed: Embedder = <T extends string | readonly string[]>(
  texts: T,
  options?: EmbedderOptions,
): Promise<Embedded<T>> => {
  const runtime = Runtime.current();
  return runtime.embed(texts, options);
};

const index: Indexer = <T extends readonly unknown[]>(
  idioms: Idioms<T>,
  options?: IndexerOptions,
): Promise<Index<T>> => {
  const runtime = Runtime.current();
  return runtime.index(idioms, options);
};

const generate: Generator = (
  args: unknown,
  options?: GeneratorOptions,
): Promise<unknown> => {
  const runtime = Runtime.current();
  return runtime.generate(args, options);
};

const resolveIdiom: IdiomResolver = (
  id: string,
  value: unknown,
): Embeddings | undefined => {
  const runtime = Runtime.current();
  return runtime.resolveIdiom(id, value);
};

export type { RuntimeConfigSource, RuntimeConfig };
export { Runtime, embed, index, generate, resolveIdiom };
