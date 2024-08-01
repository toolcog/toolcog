import { AsyncContext } from "@toolcog/util/async";
import type {
  EmbeddingVectors,
  GenerativeModelOptions,
  GenerativeModel,
  EmbeddingModelOptions,
  EmbeddingModel,
} from "@toolcog/core";
import type { Message } from "./message.ts";
import type { Thread } from "./thread.ts";
import { TemporaryThread } from "./thread.ts";
import type { PluginLoaderOptions } from "./plugin-loader.ts";
import { PluginLoader } from "./plugin-loader.ts";
import type {
  ModelLoaderOptions,
  GenerativeModelPlugin,
  EmbeddingModelPlugin,
} from "./model-loader.ts";
import { GenerativeModelLoader, EmbeddingModelLoader } from "./model-loader.ts";

interface RuntimeOptions {
  pluginLoader?: PluginLoaderOptions | undefined;

  generativeModelLoader?: ModelLoaderOptions | undefined;

  embeddingModelLoader?: ModelLoaderOptions | undefined;
}

class Runtime {
  readonly #pluginLoader: PluginLoader<
    GenerativeModelPlugin & EmbeddingModelPlugin
  >;

  readonly #generativeModelLoader: GenerativeModelLoader;

  readonly #embeddingModelLoader: EmbeddingModelLoader;

  constructor(options?: RuntimeOptions) {
    this.#pluginLoader = new PluginLoader(
      options?.pluginLoader ?? Runtime.DefaultPluginLoaderOptions,
    );

    this.#generativeModelLoader = new GenerativeModelLoader(
      this.#pluginLoader,
      options?.generativeModelLoader,
    );

    this.#embeddingModelLoader = new EmbeddingModelLoader(
      this.#pluginLoader,
      options?.embeddingModelLoader,
    );
  }

  createThread(messages?: Message[]): Thread {
    return new TemporaryThread(messages);
  }

  async getGenerativeModel(model?: string): Promise<GenerativeModel> {
    await this.#pluginLoader.initialize();
    return this.#generativeModelLoader.getModel(model);
  }

  async getEmbeddingModel(model?: string): Promise<EmbeddingModel> {
    await this.#pluginLoader.initialize();
    return this.#embeddingModelLoader.getModel(model);
  }

  /** @internal */
  static readonly DefaultPluginLoaderOptions = {
    modulePrefixes: ["@toolcog/", "toolcog-model-"],
    preloadPluginIds: ["openai"],
  } as const satisfies PluginLoaderOptions;

  static readonly #current = new AsyncContext.Variable<Runtime>({
    name: "toolcog.runtime",
  });

  static #global: Runtime | undefined;

  static global(): Runtime {
    if (Runtime.#global === undefined) {
      Runtime.#global = new Runtime();
    }
    return Runtime.#global;
  }

  static current(): Runtime {
    let runtime = Runtime.#current.get();
    if (runtime === undefined) {
      runtime = Runtime.global();
    }
    return runtime;
  }

  static get(): Runtime | null {
    return Runtime.#current.get() ?? null;
  }

  static run<F extends (...args: any[]) => unknown>(
    runtime: Runtime,
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> {
    return Runtime.#current.run(runtime, func, ...args);
  }
}

const generativeModel = (async (
  args: unknown,
  options?: GenerativeModelOptions,
): Promise<unknown> => {
  const runtime = Runtime.current();
  const generativeModel = await runtime.getGenerativeModel(options?.model);
  return generativeModel(args, options);
}) satisfies GenerativeModel;

const embeddingModel = (async <T extends string | readonly string[]>(
  content: T,
  options?: EmbeddingModelOptions,
): Promise<EmbeddingVectors<T>> => {
  const runtime = Runtime.current();
  const embeddingModel = await runtime.getEmbeddingModel(options?.model);
  return embeddingModel(content, options);
}) satisfies EmbeddingModel;

export type { RuntimeOptions };
export { Runtime, generativeModel, embeddingModel };
