import { AsyncContext } from "@toolcog/util/async";
import type {
  GeneratorConfig,
  GeneratorOptions,
  Generator,
  EmbedderConfig,
  EmbedderOptions,
  EmbedderResult,
  Embedder,
  Idioms,
  Index,
  IndexerConfig,
  IndexerOptions,
  Indexer,
} from "@toolcog/core";
import type { Plugin, PluginSource } from "./plugin.ts";
import { resolvePlugins } from "./plugin.ts";
import { indexer as defaultIndexer } from "./indexer.ts";

interface RuntimeConfigSource {
  generator?: GeneratorConfig | undefined;

  embedder?: EmbedderConfig | undefined;

  indexer?: IndexerConfig | undefined;

  plugins?: PluginSource[] | null | undefined;
}

interface RuntimeConfig {
  generator?: GeneratorConfig | undefined;

  embedder?: EmbedderConfig | undefined;

  indexer?: IndexerConfig | undefined;

  plugins?: Plugin[] | null | undefined;
}

class Runtime {
  readonly #generatorConfig: GeneratorConfig;
  readonly #embedderConfig: EmbedderConfig;
  readonly #indexerConfig: IndexerConfig;
  readonly #plugins: Plugin[];

  constructor(config?: RuntimeConfig) {
    this.#generatorConfig = config?.generator ?? {};
    this.#embedderConfig = config?.embedder ?? {};
    this.#indexerConfig = config?.indexer ?? {};
    this.#plugins = config?.plugins ?? [];
  }

  get generatorConfig(): GeneratorConfig {
    return this.#generatorConfig;
  }

  get embedderConfig(): EmbedderConfig {
    return this.#embedderConfig;
  }

  get indexerConfig(): IndexerConfig {
    return this.#indexerConfig;
  }

  get plugins(): Plugin[] {
    return this.#plugins;
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

  embedderOptions(options: EmbedderOptions | undefined): EmbedderOptions {
    return {
      ...this.embedderConfig,
      ...options,
    };
  }

  indexerOptions(options: IndexerOptions | undefined): IndexerOptions {
    return {
      ...this.indexerConfig,
      ...options,
    };
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
    return defaultIndexer;
  }

  async generate(args: unknown, options?: GeneratorOptions): Promise<unknown> {
    options = this.generatorOptions(options);
    const generator = await this.generator(options);
    return await generator(args, options);
  }

  async embed<T extends string | readonly string[]>(
    embeds: T,
    options?: EmbedderOptions,
  ): Promise<EmbedderResult<T>> {
    options = this.embedderOptions(options);
    const embedder = await this.embedder(options);
    return await embedder(embeds, options);
  }

  async index<T extends readonly unknown[]>(
    idioms: Idioms<T>,
    options?: IndexerOptions,
  ): Promise<Index<T>> {
    options = this.indexerOptions(options);
    const indexer = await this.indexer(options);
    return await indexer(idioms, options);
  }

  static async resolveConfig(
    config?: RuntimeConfigSource,
  ): Promise<RuntimeConfig> {
    return {
      generator: config?.generator,
      embedder: config?.embedder,
      indexer: config?.indexer,
      plugins: await resolvePlugins(config?.plugins),
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
      throw new Error(
        "No toolcog runtime is defined in the current execution context",
      );
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

const generate: Generator = (
  args: unknown,
  options?: GeneratorOptions,
): Promise<unknown> => {
  const runtime = Runtime.current();
  return runtime.generate(args, options);
};

const embed: Embedder = <T extends string | readonly string[]>(
  embeds: T,
  options?: EmbedderOptions,
): Promise<EmbedderResult<T>> => {
  const runtime = Runtime.current();
  return runtime.embed(embeds, options);
};

const index: Indexer = <T extends readonly unknown[]>(
  idioms: Idioms<T>,
  options?: IndexerOptions,
): Promise<Index<T>> => {
  const runtime = Runtime.current();
  return runtime.index(idioms, options);
};

export type { RuntimeConfigSource, RuntimeConfig };
export { Runtime, generate, embed, index };
