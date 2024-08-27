import {
  dirname,
  resolve as resolvePath,
  parse as parsePath,
  format as formatPath,
} from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Command } from "commander";
import ts from "typescript";
import type { Precache } from "@toolcog/runtime";
import {
  manifestFileName,
  parseManifest,
  inventoryFileName,
  formatInventory,
  precacheFileName,
  parsePrecache,
  formatPrecache,
  createPrecache,
  prefetchInventory,
} from "@toolcog/runtime";
import {
  inventoryModuleName,
  createInventoryModule,
  inventoryDeclarationsModuleName,
  createInventoryDeclarationsModule,
} from "@toolcog/compiler";

interface InventoryGenerateCommandOptions {
  embeddingModel?: string | boolean | undefined;
  precache?: string | boolean | undefined;
  manifest?: string | boolean | undefined;
  yaml?: string | boolean | undefined;
  js?: string | boolean | undefined;
  dts?: string | boolean | undefined;
}

const defaultEmbeddingModel = "text-embedding-3-small";

const runInventoryGenerateCommand = async (
  options: InventoryGenerateCommandOptions,
): Promise<void> => {
  const embeddingModels =
    typeof options.embeddingModel === "string" ?
      options.embeddingModel.split(",")
    : [defaultEmbeddingModel];

  const precacheFile =
    typeof options.precache === "string" ? options.precache
    : options.precache === true ? precacheFileName
    : undefined;

  const manifestFile =
    typeof options.manifest === "string" ? options.manifest
    : options.manifest === true ? manifestFileName
    : undefined;
  const manifestDir = manifestFile !== undefined ? dirname(manifestFile) : "";

  const yamlFile =
    typeof options.yaml === "string" ? options.yaml
    : options.yaml === true ? resolvePath(manifestDir, inventoryFileName)
    : undefined;

  const jsFile =
    typeof options.js === "string" ? options.js
    : options.js === true ? resolvePath(manifestDir, inventoryModuleName)
    : undefined;

  const dtsFile =
    typeof options.dts === "string" ? options.dts
    : options.dts === true ? inventoryDeclarationsModuleName
    : undefined;

  if (manifestFile !== undefined) {
    let precache: Precache | undefined;
    if (precacheFile !== undefined && existsSync(precacheFile)) {
      precache = parsePrecache(await readFile(precacheFile, "utf-8"));
    }
    if (precache === undefined) {
      precache = createPrecache();
    }

    const manifest = parseManifest(await readFile(manifestFile, "utf-8"));

    const inventory = await prefetchInventory(manifest, {
      embeddingModels,
      precache,
    });

    if (precacheFile !== undefined) {
      const precacheDir = dirname(precacheFile);
      if (!existsSync(precacheDir)) {
        await mkdir(precacheDir, { recursive: true });
      }
      await writeFile(precacheFile, formatPrecache(precache));
    }

    if (yamlFile !== undefined) {
      const yamlDir = dirname(yamlFile);
      if (!existsSync(yamlDir)) {
        await mkdir(yamlDir, { recursive: true });
      }
      await writeFile(yamlFile, formatInventory(inventory));
    }

    if (jsFile !== undefined) {
      const inventoryModule = createInventoryModule(ts, ts.factory, inventory);
      const inventorySource = ts.createPrinter().printFile(inventoryModule);

      const jsDir = dirname(jsFile);
      if (!existsSync(jsDir)) {
        await mkdir(jsDir, { recursive: true });
      }
      await writeFile(jsFile, inventorySource);
    }
  }

  if (dtsFile !== undefined) {
    const { name: moduleBase } = parsePath(jsFile ?? inventoryModuleName);
    const moduleName = formatPath({ dir: ".", name: moduleBase, ext: ".ts" });

    const inventoryDeclarationsModule = createInventoryDeclarationsModule(
      ts,
      ts.factory,
      moduleName,
    );
    const inventoryDeclarationsSource = ts
      .createPrinter()
      .printFile(inventoryDeclarationsModule);

    const dtsDir = dirname(dtsFile);
    if (!existsSync(dtsDir)) {
      await mkdir(dtsDir, { recursive: true });
    }
    await writeFile(dtsFile, inventoryDeclarationsSource);
  }
};

const createInventoryGenerateCommand = (name: string): Command => {
  return new Command(name)
    .description("Generate toolcog inventory files from a manifest")
    .option(
      `--embedding-model [${defaultEmbeddingModel}]`,
      "Prefetch embeddings for a comma-separated list of models",
    )
    .option(`--precache [${precacheFileName}]`, "Cache prefetched embeddings")
    .option(
      `--manifest [${manifestFileName}]`,
      "Prefetch embeddings declared in a manifest file",
    )
    .option(`--yaml [${inventoryFileName}]`, "Generate a yaml inventory file")
    .option(`--js [${inventoryModuleName}]`, "Generate an inventory module")
    .option(
      `--dts [${inventoryDeclarationsModuleName}]`,
      "Generate an inventory module declaration file",
    )
    .action(runInventoryGenerateCommand);
};

export type { InventoryGenerateCommandOptions };
export { runInventoryGenerateCommand, createInventoryGenerateCommand };
