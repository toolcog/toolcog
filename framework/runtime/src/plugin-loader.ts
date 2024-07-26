interface PluginLoaderOptions {
  /**
   * A list of module prefixes that will be prepended to plugin IDs in order
   * to construct a plugin module specifier.
   */
  modulePrefixes?: string[] | undefined;

  /**
   * A list of plugins to pre-load.
   */
  preloadPluginIds?: readonly string[] | undefined;
}

class PluginLoader<Plugin> {
  readonly #modulePrefixes: readonly string[];

  readonly #plugins: Map<string, Plugin>;

  readonly #preloadPluginIds: readonly string[];

  #initialized: boolean;

  constructor(options?: PluginLoaderOptions) {
    this.#modulePrefixes = options?.modulePrefixes ?? [];
    this.#plugins = new Map();

    this.#preloadPluginIds = options?.preloadPluginIds ?? [];
    this.#initialized = false;
  }

  /**
   * Returns an iterator over all currently loaded plugins.
   */
  plugins(): IterableIterator<Plugin> {
    return this.#plugins.values();
  }

  /**
   * Returns the plugin with the given `pluginId`, loading the plugin if it's
   * not already cached. Throws an `Error` with the failed lookup locations
   * if the plugin could not be found.
   */
  async getPlugin(pluginId: string): Promise<Plugin> {
    // Check for a cached plugin.
    let plugin = this.#plugins.get(pluginId);

    if (plugin === undefined) {
      // Try to load the plugin.
      plugin = await this.loadPlugin(pluginId);
      // Cache the loaded plugin.
      this.#plugins.set(pluginId, plugin);
    }

    return plugin;
  }

  /**
   * Registers a `plugin` with the given `pluginId`.
   */
  addPlugin(pluginId: string, plugin: Plugin): void {
    this.#plugins.set(pluginId, plugin);
  }

  /**
   * Unregisters the plugin with the given `pluginId`.
   */
  removePlugin(pluginId: string): void {
    this.#plugins.delete(pluginId);
  }

  /**
   * Loads a plugin module for the given `pluginId`. Throws an `Error` with
   * the failed lookup locations if the plugin could not be found.
   * @internal
   */
  async loadPlugin(pluginId: string): Promise<Plugin> {
    const failedLookups: string[] = [];

    // Check if the pluginId does not match any known plugin pattern.
    if (
      !pluginId.startsWith("@") &&
      !this.#modulePrefixes.some((modulePrefix) =>
        pluginId.startsWith(modulePrefix),
      )
    ) {
      // Try to load a plugin with each module prefix.
      for (const modulePrefix of this.#modulePrefixes) {
        const moduleSpecifier = modulePrefix + pluginId;
        try {
          // Try to load a plugin with a prefixed module specifier.
          return (await import(moduleSpecifier)) as Plugin;
        } catch {
          // Record the failed lookup location.
          failedLookups.push(moduleSpecifier);
        }
      }
    }

    try {
      // Try to load a plugin whose module specifier is the pluginId.
      return (await import(pluginId)) as Plugin;
    } catch {
      // Record the failed lookup location.
      failedLookups.push(pluginId);
    }

    // No plugin was found; include the failed lookup locations in the error.
    let message = `Unable to load plugin ${JSON.stringify(pluginId)}`;
    if (this.#modulePrefixes.length !== 0) {
      message += "; tried importing ";
      for (let i = 0; i < failedLookups.length; i += 1) {
        if (i !== 0) {
          message += ", ";
          if (i === failedLookups.length - 1) {
            message += "and ";
          }
        }
        message += JSON.stringify(failedLookups[i]);
      }
    }
    throw new Error(message, { cause: { failedLookups } });
  }

  /**
   * Initializes the plugin loader by pre-loading an initial set of plugins.
   * Does nothing if already initialized.
   */
  async initialize(): Promise<void> {
    if (this.#initialized) {
      return;
    }
    this.#initialized = true;
    await this.preloadPlugins();
  }

  /**
   * Pre-loads an initial set of plugins.
   * @internal
   */
  async preloadPlugins(): Promise<void> {
    for (const pluginId of this.#preloadPluginIds) {
      try {
        await this.getPlugin(pluginId);
      } catch {
        // Ignore pre-load failure.
      }
    }
  }
}

export type { PluginLoaderOptions };
export { PluginLoader };
