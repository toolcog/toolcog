import type {
  EmbedderOptions,
  Embedder,
  IndexerOptions,
  Indexer,
  GeneratorOptions,
  Generator,
} from "@toolcog/core";

/**
 * A plugin for the Toolcog {@link Runtime}. Plugins decouple application code
 * from any particular generative model, embedding model, or vector index.
 */
interface Plugin {
  /**
   * The name of the plugin.
   */
  readonly name: string;

  /**
   * The version of the plugin.
   */
  readonly version?: string;

  /**
   * Returns an `Embedder` that can generate embeddings compatible with
   * the specified `options`.
   */
  readonly embedder?: (
    options?: EmbedderOptions,
  ) => Promise<Embedder | undefined>;

  /**
   * Returns an `Indexer` that can generate semantic indexes compatible with
   * the specified `options`.
   */
  readonly indexer?: (options: IndexerOptions) => Promise<Indexer | undefined>;

  /**
   * Returns a `Generator` that can generate structured outputs compatible with
   * the specified `options`.
   */
  readonly generator?: (
    options?: GeneratorOptions,
  ) => Promise<Generator | undefined>;
}

/**
 * A module that exports a default `Plugin` implementation.
 */
interface PluginModule {
  /**
   * The default export of the module.
   */
  default?:
    | (() => Promise<Plugin | undefined> | Plugin | undefined)
    | Plugin
    | undefined;
}

/**
 * Specifies the various ways to provide a plugin. A `PluginSource` can be:
 * - A function returning a plugin, `undefined`, or a promise thereof
 * - A promise resolving to a plugin module, plugin object, or `undefined`
 * - A plugin module
 * - A plugin object
 * - `undefined`
 */
type PluginSource =
  | (() => Promise<Plugin | undefined> | Plugin | undefined)
  | Promise<PluginModule | Plugin | undefined>
  | PluginModule
  | Plugin
  | undefined;

/**
 * Converts a `PluginSource` into a `Plugin` by resolving promises,
 * invoking functions, or extracting the default export as necessary.
 *
 * @param plugin - The plugin source to resolve.
 * @returns The resolved plugin, or `undefined` if the source doesn't
 * resolve to a valid plugin.
 */
const resolvePlugin = async (
  plugin: PluginSource,
): Promise<Plugin | undefined> => {
  plugin = await plugin;
  if (plugin !== undefined && "default" in plugin) {
    plugin = plugin.default;
  }
  if (typeof plugin === "function") {
    plugin = await plugin();
  }
  return plugin as Plugin | undefined;
};

/**
 * Converts an array of `PluginSource`s into an array of `Plugin`s by resolving
 * promises and invoking functions as necessary.
 *
 * @param plugins - The plugin sources to resolve.
 * @returns The resolved plugins.
 */
const resolvePlugins: {
  (plugins: readonly PluginSource[]): Promise<Plugin[]>;
  (
    plugins: readonly PluginSource[] | null | undefined,
  ): Promise<Plugin[] | undefined>;
} = (async (
  plugins: readonly PluginSource[] | null | undefined,
): Promise<Plugin[] | undefined> => {
  if (plugins === undefined || plugins === null) {
    return undefined;
  }
  return (
    await Promise.allSettled(plugins.map((plugin) => resolvePlugin(plugin)))
  ).reduce<Plugin[]>((plugins, result) => {
    if (result.status === "fulfilled" && result.value !== undefined) {
      plugins.push(result.value);
    }
    return plugins;
  }, []);
}) as typeof resolvePlugins;

export type { Plugin, PluginModule, PluginSource };
export { resolvePlugin, resolvePlugins };
