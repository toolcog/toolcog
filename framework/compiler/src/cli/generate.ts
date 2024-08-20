import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import ts from "typescript";
import { Command } from "commander";
import { glob } from "glob";
import type { ToolcogManifest } from "@toolcog/compiler";
import {
  toolcogCacheFileName,
  createToolcogCache,
  readToolcogCache,
  writeToolcogCache,
  toolcogManifestFileSuffix,
  readToolcogManifest,
  formatToolcogManifest,
  mergeToolcogManifests,
  generateToolcogModule,
} from "@toolcog/compiler";

interface GenerateCommandOptions {
  manifest?: string | boolean | undefined;
  cache?: string | boolean | undefined;
}

const runGenerateCommand = async (
  filesGlob: string,
  options: GenerateCommandOptions,
): Promise<void> => {
  const manifestFiles = await glob(filesGlob);

  const cacheFile =
    typeof options.cache === "string" ? options.cache
    : options.cache === true ? toolcogCacheFileName
    : undefined;

  const cache = (await readToolcogCache(cacheFile)) ?? createToolcogCache();

  const printer = ts.createPrinter();

  const manifests: ToolcogManifest[] = [];

  for (const manifestFile of manifestFiles) {
    const manifest = await readToolcogManifest(manifestFile);
    if (manifest?.module === undefined) {
      continue;
    }
    manifests.push(manifest);

    const moduleSourceFile = await generateToolcogModule(
      ts,
      ts.factory,
      manifest,
      cache,
    );
    if (moduleSourceFile === undefined) {
      continue;
    }

    const moduleSource = printer.printFile(moduleSourceFile);

    const moduleDir = dirname(manifestFile);
    const moduleFile = resolvePath(moduleDir, manifest.module);

    if (!existsSync(moduleDir)) {
      await mkdir(moduleDir, { recursive: true });
    }
    await writeFile(moduleFile, moduleSource);
  }

  await writeToolcogCache(cacheFile, cache);

  const manifestFile =
    typeof options.manifest === "string" ? options.manifest
    : options.manifest === true ? "toolcog-manifest.yaml"
    : undefined;
  if (manifestFile !== undefined) {
    const manifest = mergeToolcogManifests(...manifests);
    await writeFile(manifestFile, formatToolcogManifest(manifest));
  }
};

const createGenerateCommand = (name: string): Command => {
  return new Command(name)
    .description("Generate toolcog modules")
    .option(
      "--manifest [toolcog-manifest.yaml]",
      "Generate a manifest of all toolcog resources",
    )
    .option(`--cache [${toolcogCacheFileName}]`, "Cache prefetched data")
    .argument(
      "[files]",
      "Glob of files for which to generate toolcog modules",
      `**/*${toolcogManifestFileSuffix}`,
    )
    .action(runGenerateCommand);
};

export type { GenerateCommandOptions };
export { runGenerateCommand, createGenerateCommand };
