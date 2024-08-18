import { resolve as resolvePath } from "node:path";
import type ts from "typescript";
import YAML from "yaml";
import type { GenerativeModel, EmbeddingModel } from "@toolcog/core";

interface GeneratorConfig {
  model?: GenerativeModel | undefined;
}

interface EmbedderConfig {
  model?: EmbeddingModel | undefined;
}

interface ToolcogConfig {
  generator?: GeneratorConfig | undefined;
  embedder?: EmbedderConfig | undefined;
}

const toolcogConfigFileName = "toolcog-config.yaml";

const resolveToolcogConfigFile = (
  sourceFile: ts.SourceFile | undefined,
  configFileName: string = toolcogConfigFileName,
): string | undefined => {
  const packageDirectory = sourceFile?.packageJsonScope?.packageDirectory;
  if (packageDirectory === undefined) {
    return undefined;
  }
  return resolvePath(packageDirectory, configFileName);
};

const readToolcogConfig = (
  ts: typeof import("typescript"),
  configFile: string | undefined,
): ToolcogConfig | undefined => {
  if (configFile === undefined || !ts.sys.fileExists(configFile)) {
    return undefined;
  }
  const yaml = ts.sys.readFile(configFile, "utf-8");
  if (yaml === undefined) {
    return undefined;
  }
  return parseToolcogConfig(yaml);
};

const writeToolcogConfig = (
  ts: typeof import("typescript"),
  configFile: string | undefined,
  config: ToolcogConfig | undefined,
): void => {
  if (configFile === undefined || config === undefined) {
    return;
  }
  ts.sys.writeFile(configFile, formatToolcogConfig(config));
};

const parseToolcogConfig = (yaml: string): ToolcogConfig => {
  return YAML.parse(yaml) as ToolcogConfig;
};

const formatToolcogConfig = (config: ToolcogConfig): string => {
  return YAML.stringify(config);
};

export type { GeneratorConfig, EmbedderConfig, ToolcogConfig };
export {
  toolcogConfigFileName,
  resolveToolcogConfigFile,
  readToolcogConfig,
  writeToolcogConfig,
  parseToolcogConfig,
  formatToolcogConfig,
};
