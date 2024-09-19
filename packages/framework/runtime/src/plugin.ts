import type {
  EmbedderOptions,
  Embedder,
  IndexerOptions,
  Indexer,
  GeneratorOptions,
  Generator,
} from "@toolcog/core";

interface Plugin {
  readonly name: string;

  readonly version?: string;

  readonly embedder?: (
    options?: EmbedderOptions,
  ) => Promise<Embedder | undefined>;

  readonly indexer?: (options: IndexerOptions) => Promise<Indexer | undefined>;

  readonly generator?: (
    options?: GeneratorOptions,
  ) => Promise<Generator | undefined>;
}

type PluginSource =
  | (() => Promise<Plugin | undefined> | Plugin | undefined)
  | Promise<Plugin | undefined>
  | Plugin
  | undefined;

const resolvePlugin = async (
  plugin: PluginSource,
): Promise<Plugin | undefined> => {
  if (typeof plugin === "function") {
    plugin = plugin();
  }
  return await plugin;
};

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

export type { Plugin, PluginSource };
export { resolvePlugin, resolvePlugins };
