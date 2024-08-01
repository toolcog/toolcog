import type { FunctionSchema } from "./schema.ts";
import type { Tools } from "./tooling.ts";

interface GenerativeConfig {
  instructions?: string | undefined;

  tools?: Tools | null | undefined;

  model?: string | undefined;
}

interface GenerativeOptions extends GenerativeConfig {
  signal?: AbortSignal | null | undefined;
}

/** @internal */
type IsVariadic<T extends unknown[]> =
  T extends [unknown?] ? false
  : T extends [infer Head, ...infer Tail] ? IsVariadic<Tail>
  : T extends [...infer Body, infer Foot] ? IsVariadic<Body>
  : true;

type GenerativeParameters<F extends (...args: any[]) => unknown> =
  IsVariadic<Parameters<F>> extends true ? Parameters<F>
  : [...Parameters<F>, options?: GenerativeOptions];

type GenerativeReturnType<F extends (...args: any[]) => unknown> = Promise<
  Awaited<ReturnType<F>>
>;

interface GenerativeFunction<F extends (...args: any[]) => unknown> {
  (...args: GenerativeParameters<F>): GenerativeReturnType<F>;

  readonly id: string | undefined;

  readonly function: FunctionSchema;

  readonly instructions: string | undefined;

  readonly tools: readonly Tools[];

  readonly model: string | undefined;
}

interface GenerativeProps extends GenerativeConfig {
  defaults?: Record<string, unknown> | undefined;
}

const generative: {
  <F extends (...args: any[]) => unknown>(
    props?: GenerativeProps,
  ): GenerativeFunction<F>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <F extends (...args: any[]) => unknown>(
    props?: GenerativeProps,
  ): GenerativeFunction<F> => {
    throw new Error("Uncompiled generative function");
  },
  {
    brand: Symbol("toolcog.generative"),
  } as const,
) as typeof generative;

const generate: {
  <T = string>(
    instructions: string | undefined,
    args?: Record<string, unknown>,
    options?: GenerativeOptions,
  ): Promise<T>;
  <T = string>(
    args?: Record<string, unknown>,
    options?: GenerativeOptions,
  ): Promise<T>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <T>(
    instructionsOrArgs?: string | Record<string, unknown>,
    argsOrOptions?: Record<string, unknown> | GenerativeOptions,
    options?: GenerativeOptions,
  ): Promise<T> => {
    throw new Error("Uncompiled generative function call");
  },
  {
    brand: Symbol("toolcog.generate"),
  } as const,
) as typeof generate;

interface GenerativeModelOptions extends GenerativeOptions {
  function?: FunctionSchema | undefined;
}

interface GenerativeModel {
  (args: unknown, options?: GenerativeModelOptions): Promise<unknown>;
}

export type {
  GenerativeConfig,
  GenerativeOptions,
  GenerativeParameters,
  GenerativeReturnType,
  GenerativeFunction,
  GenerativeProps,
  GenerativeModelOptions,
  GenerativeModel,
};
export { generative, generate };
