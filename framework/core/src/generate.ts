import type { Tools } from "./tool.ts";

type GenerateParameters = Record<string, unknown>;

interface GenerateOptions {
  title?: string | undefined;

  instructions?: string | undefined;

  modelId?: string | undefined;

  tools?: Tools | null | undefined;

  signal?: AbortSignal | null | undefined;
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
  <T>(
    instructionsOrArgs?: string | GenerateParameters,
    argsOrOptions?: GenerateParameters | GenerateOptions,
    options?: GenerateOptions,
  ): Promise<T> => {
    throw new Error("Uncompiled generative function call");
  },
  {
    brand: Symbol("toolcog.generate"),
  } as const,
) as typeof generate;

export type { GenerateParameters, GenerateOptions };
export { generate };
