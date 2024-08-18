import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, parse as parsePath, format as formatPath } from "node:path";
import type ts from "typescript";
import YAML from "yaml";
import type { FunctionSchema } from "@toolcog/core";

interface ToolManifest {
  function: FunctionSchema;
}

interface PromptManifest {
  instructions: string | undefined;
  function: FunctionSchema;
}

interface IdiomManifest {
  embeds: string[];
}

interface IndexManifest {
  idioms: string[];
}

interface ToolcogManifest {
  module: string | undefined;
  embeddingModel: string | undefined;
  embeddingModels: string[] | undefined;
  tools: { [toolId: string]: ToolManifest };
  prompts: { [promptId: string]: PromptManifest };
  embeds: string[];
  idioms: { [idiomId: string]: IdiomManifest };
  indexes: { [indexId: string]: IndexManifest };
}

const toolcogManifestFileTag = "toolcog";

const toolcogManifestFileSuffix = `.${toolcogManifestFileTag}.yaml`;

const isToolcogManifestFile = (fileName: string): boolean => {
  return fileName.endsWith(toolcogManifestFileSuffix);
};

const resolveToolcogManifest = (
  ts: typeof import("typescript"),
  program: ts.Program,
  sourceFile: ts.SourceFile,
): string | undefined => {
  const outputFileName = ts.getOutputJSFileNameWorker(
    sourceFile.fileName,
    program.getCompilerOptions(),
    false, // ignoreCase
    program.getCommonSourceDirectory,
  );
  const { dir: outputDir, name: outputName } = parsePath(outputFileName);
  const { name: manifestName, ext: manifestExt } = parsePath(
    toolcogManifestFileSuffix,
  );
  return formatPath({
    dir: outputDir,
    name: outputName + manifestName,
    ext: manifestExt,
  });
};

const readToolcogManifest = async (
  manifestFile: string | undefined,
): Promise<ToolcogManifest | undefined> => {
  if (manifestFile === undefined || !existsSync(manifestFile)) {
    return undefined;
  }
  const yaml = await readFile(manifestFile, "utf-8");
  return parseToolcogManifest(yaml);
};

const writeToolcogManifest = async (
  manifestFile: string | undefined,
  manifest: ToolcogManifest | undefined,
): Promise<void> => {
  if (manifestFile === undefined || manifest === undefined) {
    return;
  }
  const manifestDir = dirname(manifestFile);
  if (!existsSync(manifestDir)) {
    await mkdir(manifestDir, { recursive: true });
  }
  await writeFile(manifestFile, formatToolcogManifest(manifest));
};

const parseToolcogManifest = (yaml: string): ToolcogManifest => {
  return YAML.parse(yaml) as ToolcogManifest;
};

const formatToolcogManifest = (manifest: ToolcogManifest): string => {
  return YAML.stringify(manifest);
};

const createToolcogManifest = (module?: string): ToolcogManifest => {
  return {
    module,
    embeddingModel: undefined,
    embeddingModels: [],
    tools: Object.create(null) as { [toolId: string]: ToolManifest },
    prompts: Object.create(null) as { [promptId: string]: PromptManifest },
    embeds: [],
    idioms: Object.create(null) as { [idiomId: string]: IdiomManifest },
    indexes: Object.create(null) as { [indexId: string]: IndexManifest },
  };
};

const mergeToolcogManifests = (
  ...manifests: ToolcogManifest[]
): ToolcogManifest => {
  const tools = Object.create(null) as { [toolId: string]: ToolManifest };
  const prompts = Object.create(null) as { [promptId: string]: PromptManifest };
  const embeds = new Set<string>();
  const idioms = Object.create(null) as { [idiomId: string]: IdiomManifest };
  const indexes = Object.create(null) as { [indexId: string]: IndexManifest };

  for (const manifest of manifests) {
    for (const toolId in manifest.tools) {
      tools[toolId] = manifest.tools[toolId]!;
    }
    for (const promptId in manifest.prompts) {
      prompts[promptId] = manifest.prompts[promptId]!;
    }
    for (const embed of manifest.embeds) {
      embeds.add(embed);
    }
    for (const idiomId in manifest.idioms) {
      idioms[idiomId] = manifest.idioms[idiomId]!;
    }
    for (const indexId in manifest.indexes) {
      indexes[indexId] = manifest.indexes[indexId]!;
    }
  }

  return {
    module: undefined,
    embeddingModel: undefined,
    embeddingModels: undefined,
    tools,
    prompts,
    embeds: [...embeds],
    idioms,
    indexes,
  };
};

export type {
  ToolManifest,
  PromptManifest,
  IdiomManifest,
  IndexManifest,
  ToolcogManifest,
};
export {
  toolcogManifestFileSuffix,
  isToolcogManifestFile,
  resolveToolcogManifest,
  readToolcogManifest,
  writeToolcogManifest,
  parseToolcogManifest,
  formatToolcogManifest,
  createToolcogManifest,
  mergeToolcogManifests,
};
