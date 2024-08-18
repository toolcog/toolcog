import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import ts from "typescript";
import { defineCommand } from "citty";
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

interface GenerateCommandArgs {
  manifest?: string | boolean | undefined;
  cache?: string | boolean | undefined;
}

const runGenerateCommand = async (
  filesGlob: string,
  options: GenerateCommandArgs,
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

const generateCommand = defineCommand({
  meta: {
    name: "generate",
    description: "Generate toolcog modules",
  },
  args: {
    manifest: {
      type: "string",
      valueHint: "FILE",
      description: "Generate a manifest of all toolcog resources",
    },
    cache: {
      type: "string",
      valueHint: "FILE",
      description: "Cache prefetched data",
    },
    files: {
      type: "positional",
      description: "Glob of files for which to generate toolcog modules",
      default: `**/*${toolcogManifestFileSuffix}`,
      required: false,
    },
  },
  run: ({ args }) => {
    return runGenerateCommand(args.files, {
      manifest: args.manifest === "" ? true : args.manifest,
      cache: args.cache === "" ? true : args.cache,
    });
  },
});

export type { GenerateCommandArgs };
export { runGenerateCommand, generateCommand };
