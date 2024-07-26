import { expect, it, vi } from "vitest";
import { PluginLoader } from "./plugin-loader.ts";

class TestPlugin {
  readonly pluginId: string;

  constructor(pluginId: string) {
    this.pluginId = pluginId;
  }
}

it("should be initialized with an empty plugin map", () => {
  const loader = new PluginLoader<TestPlugin>();

  expect(Array.from(loader.plugins())).toEqual([]);
});

it("should get a manually added plugin", async () => {
  const loader = new PluginLoader<TestPlugin>();
  const plugin = new TestPlugin("plugin");

  loader.addPlugin("plugin", plugin);
  expect(await loader.getPlugin("plugin")).toBe(plugin);
});

it("should remove a manually added plugin", async () => {
  const loader = new PluginLoader<TestPlugin>();

  loader.addPlugin("plugin", new TestPlugin("plugin"));
  loader.removePlugin("plugin");
  await expect(loader.getPlugin("plugin")).rejects.toThrowError(
    'Unable to load plugin "plugin"',
  );
});

it("should cache dynamically loaded plugins", async () => {
  const loader = new PluginLoader<TestPlugin>();

  vi.mock("plugin1", () => new TestPlugin("plugin1"));

  expect(await loader.getPlugin("plugin1")).toBe(
    await loader.getPlugin("plugin1"),
  );
});

it("should throw an error if a plugin cannot be found", async () => {
  const loader = new PluginLoader<TestPlugin>();

  await expect(loader.getPlugin("plugin2")).rejects.toThrowError(
    'Unable to load plugin "plugin2"',
  );
});

it("should load a plugin with prefixed module specifier", async () => {
  const loader = new PluginLoader<TestPlugin>({ modulePrefixes: ["@vendor/"] });

  vi.mock("@vendor/plugin3", () => new TestPlugin("@vendor/plugin3"));

  expect(await loader.getPlugin("plugin3")).toEqual(
    new TestPlugin("@vendor/plugin3"),
  );
});

it("should load plugins with distinct prefixed module specifiers", async () => {
  const loader = new PluginLoader<TestPlugin>({
    modulePrefixes: ["@vendorA/", "vendorB-"],
  });

  vi.mock("@vendorA/plugin4", () => new TestPlugin("@vendorA/plugin4"));
  vi.mock("vendorB-plugin5", () => new TestPlugin("vendorB-plugin5"));

  expect(await loader.getPlugin("plugin4")).toEqual(
    new TestPlugin("@vendorA/plugin4"),
  );
  expect(await loader.getPlugin("plugin5")).toEqual(
    new TestPlugin("vendorB-plugin5"),
  );
});

it("should fallback to loading un-prefixed module specifiers", async () => {
  const loader = new PluginLoader<TestPlugin>({
    modulePrefixes: ["@vendorA/", "vendorB-"],
  });

  vi.mock("plugin6", () => new TestPlugin("plugin6"));

  expect(await loader.getPlugin("plugin6")).toEqual(new TestPlugin("plugin6"));
});

it("should throw an error if all module prefixes fail to resolve", async () => {
  const loader = new PluginLoader<TestPlugin>({
    modulePrefixes: ["@vendorA/", "vendorB-"],
  });

  await expect(loader.getPlugin("plugin7")).rejects.toThrowError(
    'Unable to load plugin "plugin7"; tried importing "@vendorA/plugin7", "vendorB-plugin7", and "plugin7"',
  );
});
