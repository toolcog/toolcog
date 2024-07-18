import type { Schema } from "@toolcog/util/schema";
import type { ToolFunction } from "./tool.ts";
import { Toolcog } from "./toolcog.ts";

interface GenerateOptions {
  modelId?: string | undefined;

  title?: string | undefined;

  instructions?: string | undefined;

  parameters?: Schema | undefined;

  return?: Schema | undefined;

  tools?: ToolFunction[] | undefined;

  signal?: AbortSignal | undefined;
}

interface GenerativeModel {
  readonly modelId: string;

  generate<T = string>(args?: unknown, options?: GenerateOptions): Promise<T>;

  prompt<T = string>(
    instructions?: string,
    args?: unknown,
    options?: GenerateOptions,
  ): Promise<T>;
}

const generate: {
  <T = string>(args?: unknown, options?: GenerateOptions): Promise<T>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  async <T>(args?: unknown, options?: GenerateOptions): Promise<T> => {
    const toolcog = await Toolcog.current();
    const model = await toolcog.getGenerativeModel(options?.modelId);
    return model.generate(args, options);
  },
  {
    brand: Symbol("toolcog.generate"),
  },
) as typeof generate;

const prompt: {
  <T = string>(
    instructions: string,
    args?: unknown,
    options?: GenerateOptions,
  ): Promise<T>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  async <T>(
    instructions?: string,
    args?: unknown,
    options?: GenerateOptions,
  ): Promise<T> => {
    const toolcog = await Toolcog.current();
    const model = await toolcog.getGenerativeModel(options?.modelId);
    return model.prompt(instructions, args, options);
  },
  {
    brand: Symbol("toolcog.prompt"),
  },
) as typeof prompt;

export type { GenerateOptions, GenerativeModel };
export { generate, prompt };
