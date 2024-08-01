import { expect, it, vi } from "vitest";
import { ModelLoader } from "./model-loader.ts";

class TestModel {
  readonly modelName: string;

  constructor(modelName: string) {
    this.modelName = modelName;
  }
}

class TestModelPlugin {
  readonly models: readonly TestModel[];
  readonly defaultModel: TestModel | undefined;

  constructor(models: readonly TestModel[], defaultModel?: TestModel) {
    this.models = models;
    this.defaultModel = defaultModel;
  }

  getModel(modelName?: string): Promise<TestModel | undefined> {
    if (modelName === undefined) {
      return Promise.resolve(this.defaultModel);
    }
    return Promise.resolve(
      this.models.find((model) => model.modelName === modelName),
    );
  }
}

class TestModelLoader extends ModelLoader<TestModel, TestModelPlugin> {
  loadModel(
    plugin: TestModelPlugin,
    modelName?: string,
  ): Promise<TestModel | undefined> {
    return plugin.getModel(modelName);
  }
}

it("should get a model from a designated plugin", async () => {
  const loader = new TestModelLoader();

  vi.mock("pluginA", () => new TestModelPlugin([new TestModel("model1")]));

  expect(await loader.getModel("pluginA/model1")).toEqual(
    new TestModel("model1"),
  );
});

it("should cache loaded models", async () => {
  const loader = new TestModelLoader();

  vi.mock("pluginB", () => new TestModelPlugin([new TestModel("model2")]));

  const model2 = await loader.getModel("pluginB/model2");
  expect(await loader.getModel("pluginB/model2")).toBe(model2);
});

it("should throw when getting a non-existent model", async () => {
  const loader = new TestModelLoader();

  vi.mock("pluginC", () => new TestModelPlugin([new TestModel("model3")]));

  await expect(loader.getModel("pluginC/non-existent")).rejects.toThrowError();
});

it("should find a model with an unspecified plugin", async () => {
  const loader = new TestModelLoader();

  vi.mock("pluginD", () => new TestModelPlugin([new TestModel("model4")]));
  vi.mock("pluginE", () => new TestModelPlugin([new TestModel("model5")]));

  // Pre-load model plugins.
  await loader.getPlugin("pluginD");
  await loader.getPlugin("pluginE");

  expect(await loader.getModel("model5")).toEqual(new TestModel("model5"));
});

it("should return a preferred default model when no model name is specified", async () => {
  const loader = new TestModelLoader(undefined, {
    defaultModelId: "pluginF/model6",
  });

  vi.mock("pluginF", () => new TestModelPlugin([new TestModel("model6")]));

  expect(await loader.getModel()).toEqual(new TestModel("model6"));
});

it("should return a plugin's default model when no preferred default is specified", async () => {
  const loader = new TestModelLoader();

  vi.mock("pluginG", () => new TestModelPlugin([], new TestModel("model7")));

  // Pre-load model plugin.
  await loader.getPlugin("pluginG");

  expect(await loader.getModel()).toEqual(new TestModel("model7"));
});

it("should throw an error if no default model could be loaded", async () => {
  const loader = new TestModelLoader();

  await expect(loader.getModel()).rejects.toThrowError();
});
