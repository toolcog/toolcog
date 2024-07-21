import type { Schema } from "@toolcog/util/schema";
import type { ToolFunction } from "./tool.ts";
import { Toolcog } from "./toolcog.ts";

interface GenerateOptions {
  modelId?: string | undefined;

  title?: string | undefined;

  instructions?: string | undefined;

  parameters?: Schema | null | undefined;

  return?: Schema | null | undefined;

  tools?: ToolFunction[] | null | undefined;

  signal?: AbortSignal | null | undefined;
}

interface GenerativeModel {
  readonly modelId: string;

  generate<T = string>(args?: unknown, options?: GenerateOptions): Promise<T>;

  instruct<T = string>(
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

const instruct: {
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
    return model.instruct(instructions, args, options);
  },
  {
    brand: Symbol("toolcog.instruct"),
  },
) as typeof instruct;

export type { GenerateOptions, GenerativeModel };
export { generate, instruct };
