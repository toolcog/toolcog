import type { ClientOptions } from "openai";
import { Dispatcher } from "@toolcog/util/task";
import type {
  EmbedderOptions,
  Embedder,
  GeneratorOptions,
  Generator,
} from "@toolcog/core";
import type { Plugin } from "@toolcog/runtime";
import type { OpenAIEmbedderConfig } from "./embedder.ts";
import { embedder } from "./embedder.ts";
import type { OpenAIGeneratorConfig } from "./generator.ts";
import { generator } from "./generator.ts";

interface OpenAIPluginConfig extends ClientOptions {
  embedder?: OpenAIEmbedderConfig | undefined;

  generator?: OpenAIGeneratorConfig | undefined;

  dispatcher?: Dispatcher | undefined;
}

const openai = (config?: OpenAIPluginConfig): Plugin => {
  const {
    embedder: embedderConfig,
    generator: generatorConfig,
    dispatcher,
    ...clientOptions
  } = config ?? {};

  return {
    name: "openai",
    version: __version__,

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
  } as const;
};

export type { OpenAIPluginConfig };
export { openai };
