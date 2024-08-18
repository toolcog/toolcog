import type { FunctionSchema } from "./schema.ts";
import type { Tool } from "./tool.ts";
import type { GenerativeModel, GenerativeConfig } from "./generative.ts";

interface GeneratorConfig extends GenerativeConfig {
  model?: GenerativeModel | undefined;

  tools?: readonly Tool[] | null | undefined;

  instructions?: string | undefined;

  function?: FunctionSchema | undefined;
}

interface GeneratorOptions extends GeneratorConfig {
  signal?: AbortSignal | null | undefined;
}

interface Generator {
  (args: unknown, options?: GeneratorOptions): Promise<unknown>;
}

export type { GeneratorConfig, GeneratorOptions, Generator };
