import type { ClientOptions } from "@anthropic-ai/sdk";
import { Dispatcher } from "@toolcog/util/task";
import type { GeneratorOptions, Generator } from "@toolcog/core";
import type { Plugin } from "@toolcog/runtime";
import type { AnthropicGeneratorConfig } from "./generator.ts";
import { generator } from "./generator.ts";

interface AnthropicPluginConfig extends ClientOptions {
  generator?: AnthropicGeneratorConfig | undefined;

  dispatcher?: Dispatcher | undefined;
}

const anthropic = (config?: AnthropicPluginConfig): Plugin => {
  const {
    generator: generatorConfig,
    dispatcher,
    ...clientOptions
  } = config ?? {};

  return {
    name: "anthropic",
    version: __version__,

    generator: (options?: GeneratorOptions): Promise<Generator | undefined> => {
      return Promise.resolve(
        generator({
          anthropic: clientOptions,
          dispatcher,
          ...generatorConfig,
          ...options,
        }),
      );
    },
  } as const;
};

export type { AnthropicPluginConfig };
export { anthropic };
