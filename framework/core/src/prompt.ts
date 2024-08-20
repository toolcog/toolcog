import type { FunctionSchema } from "./schema.ts";
import type { Tool } from "./tool.ts";
import type { GenerativeModel } from "./generative.ts";
import type { GeneratorConfig, GeneratorOptions } from "./generator.ts";

interface PromptConfig extends GeneratorConfig {
  defaults?: Record<string, unknown> | undefined;
}

interface PromptOptions extends GeneratorOptions {}

/** @internal */
type IsVariadic<T extends readonly unknown[]> =
  T extends [unknown?] ? false
  : T extends [infer Head, ...infer Tail] ? IsVariadic<Tail>
  : T extends [...infer Body, infer Foot] ? IsVariadic<Body>
  : true;

type PromptParameters<F extends (...args: any[]) => unknown> =
  IsVariadic<Parameters<F>> extends true ? Parameters<F>
  : [...Parameters<F>, options?: PromptOptions];

type PromptReturnType<F extends (...args: any[]) => unknown> = Promise<
  Awaited<ReturnType<F>>
>;

interface PromptFunction<F extends (...args: any[]) => unknown> {
  (...args: PromptParameters<F>): PromptReturnType<F>;

  readonly id: string;

  readonly model: GenerativeModel | undefined;

  readonly tools: readonly Tool[];

  readonly instructions: string | undefined;

  readonly function: FunctionSchema;
}

const definePrompt: {
  <F extends (...args: any[]) => unknown>(
    config?: PromptConfig,
  ): PromptFunction<F>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <F extends (...args: any[]) => unknown>(
    config?: PromptConfig,
  ): PromptFunction<F> => {
    throw new Error("Uncompiled prompt");
  },
  {
    brand: Symbol("toolcog.definePrompt"),
  } as const,
) as typeof definePrompt;

const prompt: {
  <T = string>(
    instructions: string | undefined,
    args?: Record<string, unknown>,
    options?: PromptOptions,
  ): Promise<T>;
  <T = string>(
    args?: Record<string, unknown>,
    options?: PromptOptions,
  ): Promise<T>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <T>(
    instructionsOrArgs?: string | Record<string, unknown>,
    argsOrOptions?: Record<string, unknown> | PromptOptions,
    options?: PromptOptions,
  ): Promise<T> => {
    throw new Error("Uncompiled prompt");
  },
  {
    brand: Symbol("toolcog.prompt"),
  } as const,
) as typeof prompt;

export type {
  PromptConfig,
  PromptOptions,
  PromptParameters,
  PromptReturnType,
  PromptFunction,
};
export { definePrompt, prompt };
