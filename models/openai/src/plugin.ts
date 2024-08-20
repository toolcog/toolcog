import type { ClientOptions } from "openai";
import { Dispatcher } from "@toolcog/util/task";
import type {
  GeneratorOptions,
  Generator,
  EmbedderOptions,
  Embedder,
} from "@toolcog/core";
import type { ToolcogPlugin } from "@toolcog/runtime";
import type { OpenAIGeneratorConfig } from "./generator.ts";
import { generator } from "./generator.ts";
import type { OpenAIEmbedderConfig } from "./embedder.ts";
import { embedder } from "./embedder.ts";

interface OpenAIPluginConfig extends ClientOptions {
  generator?: OpenAIGeneratorConfig | undefined;

  embedder?: OpenAIEmbedderConfig | undefined;

  dispatcher?: Dispatcher | undefined;
}

const openai = (config?: OpenAIPluginConfig): ToolcogPlugin => {
  const {
    generator: generatorConfig,
    embedder: embedderConfig,
    dispatcher,
    ...clientOptions
  } = config ?? {};

  return {
    name: "openai",
    version: __version__,

    generator: (options?: GeneratorOptions): Promise<Generator | undefined> => {
      return Promise.resolve(
        generator({
          openai: clientOptions,
          dispatcher,
          ...generatorConfig,
          ...options,
        }),
      );
    },

    embedder: (options?: EmbedderOptions): Promise<Embedder | undefined> => {
      return Promise.resolve(
        embedder({
          openai: clientOptions,
          dispatcher,
          ...embedderConfig,
          ...options,
        }),
      );
    },
  } as const;
};

export type { OpenAIPluginConfig };
export { openai };
