import type { Schema } from "@toolcog/util/json";
import type { ToolSource } from "./tool.ts";
import type { InstructionsSource, GenerativeFunction } from "./generative.ts";
import type { GeneratorConfig, GeneratorOptions } from "./generator.ts";

interface PromptConfig extends GeneratorConfig {
  tools?: readonly ToolSource[] | null | undefined;

  defaults?: Record<string, unknown> | undefined;
}

interface PromptOptions extends GeneratorOptions {
  tools?: readonly ToolSource[] | null | undefined;

  instructions?: InstructionsSource | undefined;
}

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

interface PromptFunction<
  F extends (...args: any[]) => unknown = (...args: any[]) => unknown,
> extends GenerativeFunction {
  (...args: PromptParameters<F>): PromptReturnType<F>;

  readonly id: string;

  readonly name: string;

  readonly description: string | undefined;

  readonly parameters: Schema | undefined;

  readonly returns: Schema | undefined;

  readonly instructions: InstructionsSource;

  readonly tools: readonly ToolSource[];
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
