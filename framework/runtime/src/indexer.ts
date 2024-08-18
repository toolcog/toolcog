import type { Index, IndexerProps, Indexer } from "@toolcog/core";
import { embeddedIndexer } from "./embedded-indexer.ts";
import type { PluginLoaderConfig } from "./plugin-loader.ts";
import { PluginLoader } from "./plugin-loader.ts";

interface IndexerPlugin {
  readonly getIndexer: (props: IndexerProps) => Promise<Indexer | undefined>;
}

class IndexerLoader extends PluginLoader<IndexerPlugin> {
  constructor(config?: PluginLoaderConfig) {
    super(config);
  }

  async getIndexer(props: IndexerProps): Promise<Indexer> {
    let indexer = await this.findIndexer(props);
    if (indexer === undefined) {
      indexer = embeddedIndexer;
    }
    return indexer;
  }

  /**
   * Searches all loaded plugins for an indexer that's compatible
   * with the given `props`.
   * @internal
   */
  async findIndexer(props: IndexerProps): Promise<Indexer | undefined> {
    for (const plugin of this.plugins()) {
      const indexer = await plugin.getIndexer(props);
      if (indexer !== undefined) {
        return indexer;
      }
    }
    return undefined;
  }

  static #default: IndexerLoader | undefined;

  static default(): IndexerLoader {
    if (this.#default === undefined) {
      this.#default = new IndexerLoader({
        modulePrefixes: ["@toolcog/", "toolcog-plugin-"],
        preloadPlugins: [],
      });
    }
    return this.#default;
  }
}

const indexer = (async <T extends readonly unknown[]>(
  props: IndexerProps<T>,
): Promise<Index<T>> => {
  const loader = IndexerLoader.default();
  await loader.initialize();

  const indexer = await loader.getIndexer(props);
  return await indexer(props);
}) satisfies Indexer;

export type { IndexerPlugin };
export { IndexerLoader, indexer };
