import type { Schema } from "@toolcog/util/json";
import type { Tool } from "./tool.ts";

/**
 * Each key of this type represents the name of a known generative model.
 * Generator plugins augment this type to add supported model names.
 *
 * Use the {@link GenerativeModel} type for strings that should represent
 * generative model names. The `GenerativeModel` type extracts the keys of
 * this type. The indirection through this type is necessary because type
 * aliases cannot be augmented.
 */
interface GenerativeModelNames {}

/**
 * The identifying name of a generative model.
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type GenerativeModel = keyof GenerativeModelNames | (string & {});

type ToolSource =
  | ((
      args: unknown,
    ) =>
      | Promise<readonly Tool[] | Tool | undefined>
      | readonly Tool[]
      | Tool
      | undefined)
  | Promise<readonly Tool[] | Tool | undefined>
  | readonly Tool[]
  | Tool
  | undefined;

const resolveTool = async (
  tool: ToolSource,
  args: unknown,
): Promise<readonly Tool[] | Tool | undefined> => {
  if (
    typeof tool === "function" &&
    !("parameters" in tool) &&
    !("returns" in tool)
  ) {
    tool = tool(args);
  }
  return await (tool as
    | Promise<readonly Tool[] | Tool | undefined>
    | readonly Tool[]
    | Tool
    | undefined);
};

const resolveTools = async (
  tools: readonly ToolSource[] | null | undefined,
  args: unknown,
): Promise<Tool[] | undefined> => {
  if (tools === undefined || tools === null) {
    return undefined;
  }
  return (
    await Promise.allSettled(tools.map((tool) => resolveTool(tool, args)))
  ).reduce<Tool[]>((tools, result) => {
    if (result.status === "fulfilled" && result.value !== undefined) {
      if (Array.isArray(result.value)) {
        tools.push(...(result.value as readonly Tool[]));
      } else {
        tools.push(result.value as Tool);
      }
    }
    return tools;
  }, []);
};

type InstructionsSource =
  | ((args: unknown) => Promise<string | undefined> | string | undefined)
  | Promise<string | undefined>
  | string
  | undefined;

const resolveInstructions = async (
  instructions: InstructionsSource,
  args: unknown,
): Promise<string | undefined> => {
  if (typeof instructions === "function") {
    instructions = instructions(args);
  }
  return await instructions;
};

/**
 * Options for configuring a {@link Generator} function.
 *
 * Note that generator plugins may augment this type with additional options.
 */
interface GeneratorConfig {
  /**
   * The default set of tools the generator should use.
   */
  tools?: readonly ToolSource[] | null | undefined;

  /**
   * The default model the generator should use.
   */
  model?: GenerativeModel | undefined;

  /**
   * The default system prompt the generator should use
   * when generating the response.
   */
  system?: string | undefined;

  /**
   * Whether or not the generator should stream responses by default.
   */
  stream?: boolean | undefined;
}

/**
 * Options for controlling a {@link Generator} call.
 *
 * Note that generator plugins may augment this type with additional options.
 */
interface GeneratorOptions {
  id?: string | undefined;

  /**
   * A schema that describes the arguments to the generator call.
   */
  parameters?: Schema | undefined;

  /**
   * A schema that describes the value the generator must generate.
   */
  returns?: Schema | undefined;

  /**
   * Instructions the generator should follow when generating the response.
   */
  instructions?: InstructionsSource | undefined;

  /**
   * The tools the generator should use when generating the response.
   */
  tools?: readonly ToolSource[] | null | undefined;

  /**
   * The model the generator should use to generate the response.
   */
  model?: GenerativeModel | undefined;

  /**
   * The system prompt the generator should use when generating the response.
   */
  system?: string | undefined;

  /**
   * Whether or not the generator should stream responses.
   */
  stream?: boolean | undefined;

  /**
   * An abort signal that can be used to cancel the generator call.
   */
  signal?: AbortSignal | null | undefined;
}

/**
 * A function that uses a generative model to generate its return value.
 * `options.model` specifies the generative model to use, if defined.
 * The model will be prompted to follow any instructions provided in
 * `options.instructions`. And it will be given access to any tools
 * provided in `options.tools`.
 *
 * If `options.function` defines a function schema, the model will be prompted
 * to interpret the `args` according to its parameter schema, and to generate
 * a response that conform the its return schema. If no function schema is
 * provided, `args` will be used as the raw prompt, and the model's response
 * will be returned as a string.
 */
interface Generator {
  (args: unknown, options?: GeneratorOptions): Promise<unknown>;
}

interface GenerativeConfig extends GeneratorConfig {
  tools?: readonly ToolSource[] | null | undefined;

  defaults?: Record<string, unknown> | undefined;
}

interface GenerativeOptions extends GeneratorOptions {
  tools?: readonly ToolSource[] | null | undefined;

  instructions?: InstructionsSource | undefined;
}

/** @internal */
type IsVariadic<T extends readonly unknown[]> =
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

interface GenerativeFunction<
  F extends (...args: any[]) => unknown = (...args: any[]) => unknown,
> {
  (...args: GenerativeParameters<F>): GenerativeReturnType<F>;

  readonly id: string;

  readonly name: string;

  readonly description: string | undefined;

  readonly parameters: Schema | undefined;

  readonly returns: Schema | undefined;

  readonly instructions: InstructionsSource;

  readonly tools: readonly ToolSource[];
}

const defineFunction: {
  <F extends (...args: any[]) => unknown>(
    config?: GenerativeConfig,
  ): GenerativeFunction<F>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <F extends (...args: any[]) => unknown>(
    config?: GenerativeConfig,
  ): GenerativeFunction<F> => {
    throw new Error("Uncompiled generative function");
  },
  {
    brand: Symbol("toolcog.defineFunction"),
  } as const,
) as typeof defineFunction;

const prompt: {
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
    throw new Error("Uncompiled prompt");
  },
  {
    brand: Symbol("toolcog.prompt"),
  } as const,
) as typeof prompt;

export type {
  GenerativeModelNames,
  GenerativeModel,
  ToolSource,
  InstructionsSource,
  GeneratorConfig,
  GeneratorOptions,
  Generator,
  GenerativeConfig,
  GenerativeOptions,
  GenerativeParameters,
  GenerativeReturnType,
  GenerativeFunction,
};
export {
  resolveTool,
  resolveTools,
  resolveInstructions,
  defineFunction,
  prompt,
};
