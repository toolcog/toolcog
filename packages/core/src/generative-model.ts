import type { Schema } from "@toolcog/util/schema";
import type { ToolFunction } from "./tool.ts";
import { Toolcog } from "./toolcog.ts";

type GenerateParameters = Record<string, unknown>;

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

  generate<T = string>(
    instructions: string | undefined,
    args?: GenerateParameters,
    options?: GenerateOptions,
  ): Promise<T>;
  generate<T = string>(
    args?: GenerateParameters,
    options?: GenerateOptions,
  ): Promise<T>;
}

const generate: {
  <T = string>(
    instructions: string | undefined,
    args?: GenerateParameters,
    options?: GenerateOptions,
  ): Promise<T>;
  <T = string>(
    args?: GenerateParameters,
    options?: GenerateOptions,
  ): Promise<T>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  async <T>(
    instructionsOrArgs?: string | GenerateParameters,
    argsOrOptions?: GenerateParameters | GenerateOptions,
    options?: GenerateOptions,
  ): Promise<T> => {
    let instructions: string | undefined;
    let args: GenerateParameters | undefined;
    if (typeof instructionsOrArgs !== "object") {
      instructions = instructionsOrArgs;
      args = argsOrOptions as GenerateParameters | undefined;
    } else {
      args = instructionsOrArgs;
      options = argsOrOptions as GenerateOptions | undefined;
    }

    const toolcog = await Toolcog.current();
    const model = await toolcog.getGenerativeModel(options?.modelId);
    return model.generate(instructions, args, options);
  },
  {
    brand: Symbol("toolcog.generate"),
  },
) as typeof generate;

export type { GenerateParameters, GenerateOptions, GenerativeModel };
export { generate };
