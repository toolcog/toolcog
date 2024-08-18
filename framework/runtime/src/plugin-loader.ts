interface PluginLoaderConfig {
  /**
   * A list of module prefixes that will be prepended to plugin names in order
   * to construct a plugin module specifier.
   */
  modulePrefixes?: string[] | undefined;

  /**
   * A list of plugins to pre-load.
   */
  preloadPlugins?: readonly string[] | undefined;
}

class PluginLoader<Plugin> {
  readonly #modulePrefixes: readonly string[];

  readonly #plugins: Map<string, Plugin>;

  readonly #preloadPlugins: readonly string[];

  #initialized: Promise<void> | null;

  constructor(config?: PluginLoaderConfig) {
    this.#modulePrefixes = config?.modulePrefixes ?? [];
    this.#plugins = new Map();

    this.#preloadPlugins = config?.preloadPlugins ?? [];
    this.#initialized = null;
  }

  /**
   * Returns an iterator over all currently loaded plugins.
   */
  plugins(): IterableIterator<Plugin> {
    return this.#plugins.values();
  }

  /**
   * Registers a `plugin` with the given `name`.
   */
  addPlugin(name: string, plugin: Plugin): void {
    this.#plugins.set(name, plugin);
  }

  /**
   * Unregisters the plugin with the given `name`.
   */
  removePlugin(name: string): void {
    this.#plugins.delete(name);
  }

  /**
   * Returns the plugin with the given `name`, loading the plugin if it's
   * not already cached. Throws an `Error` with the failed lookup locations
   * if the plugin could not be found.
   */
  async getPlugin(name: string): Promise<Plugin> {
    // Check for a cached plugin.
    let plugin = this.#plugins.get(name);

    if (plugin === undefined) {
      // Try to load the plugin.
      plugin = await this.loadPlugin(name);
      // Cache the loaded plugin.
      this.#plugins.set(name, plugin);
    }

    return plugin;
  }

  /**
   * Loads a plugin module for the given `name`. Throws an `Error` with
   * the failed lookup locations if the plugin could not be found.
   * @internal
   */
  async loadPlugin(name: string): Promise<Plugin> {
    const failedLookups: string[] = [];

    // Check if the plugin name does not match any known module prefix.
    if (
      !name.startsWith("@") &&
      !this.#modulePrefixes.some((modulePrefix) =>
        name.startsWith(modulePrefix),
      )
    ) {
      // Try to load a plugin with each module prefix.
      for (const modulePrefix of this.#modulePrefixes) {
        const moduleSpecifier = modulePrefix + name;
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
      // Try to load a plugin whose module specifier is the plugin name.
      return (await import(name)) as Plugin;
    } catch {
      // Record the failed lookup location.
      failedLookups.push(name);
    }

    // No plugin was found; include the failed lookup locations in the error.
    let message = `Unable to load plugin ${JSON.stringify(name)}`;
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
  initialize(): Promise<void> {
    if (this.#initialized === null) {
      this.#initialized = this.preloadPlugins();
    }
    return this.#initialized;
  }

  /**
   * Pre-loads an initial set of plugins.
   * @internal
   */
  async preloadPlugins(): Promise<void> {
    for (const name of this.#preloadPlugins) {
      try {
        await this.getPlugin(name);
      } catch {
        // Ignore pre-load failures.
      }
    }
  }
}

export type { PluginLoaderConfig };
export { PluginLoader };
