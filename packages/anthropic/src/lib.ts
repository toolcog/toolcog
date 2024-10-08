export type {
  AnthropicGeneratorConfig,
  AnthropicGeneratorOptions,
} from "./generator.ts";
export { generator, generate } from "./generator.ts";

export type { AnthropicPluginConfig } from "./plugin.ts";
export { anthropic, anthropic as default } from "./plugin.ts";
