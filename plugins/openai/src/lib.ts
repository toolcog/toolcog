export type {
  OpenAIEmbedderConfig,
  OpenAIEmbedderOptions,
} from "./embedder.ts";
export { embedder, embed } from "./embedder.ts";

export type {
  OpenAIGeneratorConfig,
  OpenAIGeneratorOptions,
} from "./generator.ts";
export { generator, generate } from "./generator.ts";

export type { OpenAIPluginConfig } from "./plugin.ts";
export { openai, openai as default } from "./plugin.ts";
