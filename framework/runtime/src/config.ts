import type {
  GenerativeModel,
  GenerativeConfig,
  EmbeddingModel,
  EmbeddingConfig,
} from "@toolcog/core";

interface GeneratorConfig extends GenerativeConfig {
  model?: GenerativeModel | undefined;
}

interface EmbedderConfig extends EmbeddingConfig {
  model?: EmbeddingModel | undefined;
}

interface ToolcogPlugin {
  name: string;

  version?: string | undefined;
}

interface ToolcogConfig {
  generator?: GeneratorConfig | undefined;

  embedder?: EmbedderConfig | undefined;

  plugins?: ToolcogPlugin[] | undefined;
}

const defineToolcogConfig = <const T extends ToolcogConfig>(config: T): T => {
  return config;
};

export type { GeneratorConfig, EmbedderConfig, ToolcogPlugin, ToolcogConfig };
export { defineToolcogConfig };
