import type { Schema } from "@toolcog/util/json";
import type { Embeddings } from "./embedding.ts";
import type { Tool } from "./tool.ts";

/**
 * Registry for generative model names supported by generator plugins.
 * Plugins augment this interface with the names of models they support.
 * Use {@link GenerativeModel} for type-safe references to these model names.
 */
interface GenerativeModelNames {}

/**
 * The name of a generative model, either a registered identifier or any string.
 * To specify a model from a plugin, prefix the model name with the plugin's
 * package name followed by a colon. For example, `"openai:custom-model"`
 * refers to the model `"custom-model"` from the `@toolcog/openai` plugin.
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type GenerativeModel = keyof GenerativeModelNames | (string & {});

/**
 * Specifies the various ways to provide tools to a generator.
 * A `ToolSource` can be:
 * - A `Tool`
 * - An array of `Tool`s
 * - A `Promise` resolving to a `Tool` or an array of `Tool`s
 * - A function taking arguments and returning a `Tool`, an array of `Tool`s,
 *   or a `Promise` thereof
 */
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

/**
 * Converts a `ToolSource` into one or more `Tool`s by resolving promises
 * and invoking functions as necessary.
 *
 * @param tool - The `ToolSource` to resolve.
 * @param args - Arguments to pass if the `ToolSource` is a function.
 * @returns A `Promise` resolving to a `Tool`, an array of `Tool`s,
 * or `undefined`.
 */
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

/**
 * Resolves an array of `ToolSource`s into an array of `Tool`s.
 * Invokes any tool-producing functions with the provided arguments.
 *
 * @param tools - The array of `ToolSource`s to resolve.
 * @param args - Arguments to pass if any `ToolSource` is a function.
 * @returns A `Promise` resolving to an array of `Tool`s, or `undefined`.
 */
const resolveTools: {
  (tools: readonly ToolSource[], args: unknown): Promise<Tool[]>;
  (
    tools: readonly ToolSource[] | null | undefined,
    args: unknown,
  ): Promise<Tool[] | undefined>;
} = (async (
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
}) as typeof resolveTools;

/**
 * Possible sources of instructions for a generative function.
 * An `InstructionsSource` can be:
 * - A string containing instructions
 * - A `Promise` resolving to a string
 * - A function taking generative function arguments and returning
 *   a string or a `Promise` of a string
 */
type InstructionsSource =
  | ((args: unknown) => Promise<string | undefined> | string | undefined)
  | Promise<string | undefined>
  | string
  | undefined;

/**
 * Converts an `InstructionsSource` into a string by resolving promises
 * and invoking functions as necessary.
 *
 * @param instructions - The `InstructionsSource` to resolve.
 * @param args - Arguments to pass if the `InstructionsSource` is a function.
 * @returns A `Promise` resolving to a string of instructions, or `undefined`.
 */
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
 * Options for configuring a {@link Generator} function. Generator plugins
 * may augment this interface with additional model-specific options.
 */
interface GeneratorConfig {
  /**
   * The default set of tools the generator should make available for use.
   */
  tools?: readonly ToolSource[] | null | undefined;

  /**
   * The default generative model to use.
   */
  model?: GenerativeModel | undefined;

  /**
   * The default system prompt for the generator.
   */
  system?: string | undefined;

  /**
   * Whether the generator should stream responses by default.
   */
  stream?: boolean | undefined;
}

/**
 * Options for controlling a {@link Generator} call.  Generator plugins may
 * augment this interface with additional model-specific options.
 */
interface GeneratorOptions {
  /**
   * A unique identifier for the prompt.
   */
  id?: string | undefined;

  /**
   * A JSON schema describing the arguments to the generator call.
   */
  parameters?: Schema | undefined;

  /**
   * A JSON schema describing the expected return value from the generator.
   */
  returns?: Schema | undefined;

  /**
   * Instructions the generator should follow when generating the response.
   */
  instructions?: InstructionsSource | undefined;

  /**
   * Tools available for use by the generator during execution.
   */
  tools?: readonly ToolSource[] | null | undefined;

  /**
   * The generative model to use for this call.
   */
  model?: GenerativeModel | undefined;

  /**
   * The system prompt to use for this call.
   */
  system?: string | undefined;

  /**
   * Whether to stream the responses for this call.
   */
  stream?: boolean | undefined;

  /**
   * An `AbortSignal` to allow cancellation of the generator call.
   */
  signal?: AbortSignal | null | undefined;
}

/**
 * A function that leverages a generative model to produce a return value
 * based on provided arguments and options.
 *
 * If `options.parameters` and `options.returns` are defined, the model
 * is prompted to interpret `args` according to its parameter schema,
 * and to generate a response that conforms to its return schema. Otherwise,
 * `args` is expected to be a string used as the raw prompt, and the model's
 * response will be returned as a string.
 *
 * @param args - The arguments to pass to the generator,
 * either a structured object or a string prompt.
 * @param options - Options to control the generator's behavior.
 * @returns A `Promise` resolving to the generated result.
 */
interface Generator {
  (args: unknown, options?: GeneratorOptions): Promise<unknown>;
}

/**
 * Configuration options for a generative function.
 */
interface GenerativeConfig extends GeneratorConfig {
  /**
   * Default tools the generative function should have available for use.
   */
  tools?: readonly ToolSource[] | null | undefined;

  /**
   * Default argument values for the generative function's parameters.
   */
  defaults?: Record<string, unknown> | undefined;
}

/**
 * Options for a call to a generative function.
 */
interface GenerativeOptions extends GeneratorOptions {
  /**
   * Tools to make available for this call, overriding any default tools.
   */
  tools?: readonly ToolSource[] | null | undefined;

  /**
   * Instructions for this call, overriding any default instructions.
   */
  instructions?: InstructionsSource | undefined;
}

/** @internal */
type IsVariadic<T extends readonly unknown[]> =
  T extends [unknown?] ? false
  : T extends [infer Head, ...infer Tail] ? IsVariadic<Tail>
  : T extends [...infer Body, infer Foot] ? IsVariadic<Body>
  : true;

/**
 * Constructs the parameter list for a generative function based on the original
 * function's type signature. Appends a `GenerativeOptions` parameter, if the
 * original function is not variadic. If the original function is variadic,
 * its parameters are passed through unchanged.
 */
type GenerativeParameters<F extends (...args: any[]) => unknown> =
  IsVariadic<Parameters<F>> extends true ? Parameters<F>
  : [...Parameters<F>, options?: GenerativeOptions];

/**
 * Constructs the return type of a generative function base on the original
 * function's type signature. Yields a `Promise` resolving to the awaited
 * return type of the original function.
 */
type GenerativeReturnType<F extends (...args: any[]) => unknown> = Promise<
  Awaited<ReturnType<F>>
>;

/**
 * A function implemented by a generative model, matching a given TypeScript
 * function signature. The signature mirrors that of the original function,
 * with an added `GenerativeOptions` parameter if the function is not variadic.
 *
 * @typeParam F - The type of the original function signature.
 */
interface GenerativeFunction<
  F extends (...args: any[]) => unknown = (...args: any[]) => unknown,
> {
  (...args: GenerativeParameters<F>): GenerativeReturnType<F>;
  /**
   * A unique, semi-stable identifier for the generative function,
   * derived from the package name, module path, and declaration hierarchy.
   */
  readonly id: string;

  /**
   * The name of the generative function.
   */
  readonly name: string;

  /**
   * The static value associated with the idiom, which is the generative
   * function itself.
   */
  readonly value: this;

  /**
   * A natural language description of the function's behavior, providing
   * context and usage information for AI models. The `definePrompt` intrinsic
   * extracts the description from the function's documentation comment.
   */
  readonly description: string | undefined;

  /**
   * A JSON Schema that describes the argument values accepted by the function.
   * The `definePrompt` intrinsic generates this schema via static analysis
   * of the function's type signature. Descriptions of all schema elements
   * are extracted from the documentation comments of their associated types.
   */
  readonly parameters: Schema | undefined;

  /**
   * A JSON Schema that describes the values returned by the function.
   * The `definePrompt` intrinsic generates this schema via static analysis
   * of the function's type signature. Descriptions of all schema elements
   * are extracted from the documentation comments of their associated types.
   */
  readonly returns: Schema | undefined;

  /**
   * Instructions the model should follow when generating the function's output.
   */
  readonly instructions: InstructionsSource;

  /**
   * Tools the generative function should have access to when invoked.
   */
  readonly tools: readonly ToolSource[];

  /**
   * Returns the embeddings associated with the generative function.
   * The embeddings are generated from descriptive phrases specified via
   * `@idiom` doc tags in the code comments for the generative function
   * declaration. These embeddings are used to select generative tools
   * that are relevant to a given prompt.
   *
   * @returns An object mapping descriptive phrases to their embeddings.
   */
  readonly embeds: () => Embeddings;
}

/**
 * Defines a generative function implemented at runtime by an AI model.
 *
 * Use `definePrompt` to create a TypeScript function whose implementation
 * is provided by an AI model. The Toolcog compiler transforms calls to this
 * intrinsic, generating a `GenerativeFunction` that delegates to a generative
 * model at runtime. The compiler also generates JSON Schemas for the function's
 * parameters and return type, which are used to prompt the model appropriately.
 *
 * @example
 * ```typescript
 * /**
 *  * Generates a character profile based on the provided role and alignment.
 *  * @param role - The role the character plays.
 *  * @param alignment - The character's moral alignment.
 *  *\/
 * const createCharacter = definePrompt<(
 *   role: string,
 *   alignment: "good" | "evil"
 * ) => {
 *   /** The character's name. *\/
 *   name: string;
 *   /** The character's age. *\/
 *   age: number;
 *   /** The character's gender. *\/
 *   gender: "male" | "female" | "non-binary" | "other";
 *   /** Whether the character is alive. *\/
 *   alive: boolean;
 *   /** A memorable tagline for the character. *\/
 *   tagline: string;
 *   /** The character's role. *\/
 *   role: string;
 *   /** The character's alignment. *\/
 *   alignment: "good" | "evil" | "neutral";
 * }>();
 * ```
 *
 * @param config - Configuration options for the generative function.
 * @returns A generative function that uses a generative model to produce
 * its output.
 */
const definePrompt: {
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
    brand: Symbol("toolcog.definePrompt"),
  } as const,
) as typeof definePrompt;

/**
 * Invokes a generative model with specified instructions and arguments.
 * Use `prompt` for ad-hoc interactions with a generative model.
 *
 * @example
 * ```typescript
 * const choices = ["Door #1", "Door #2", "Door #3"];
 * const choice = await prompt("Pick a door to open", { choices });
 * ```
 *
 * @param instructions - Instructions for the generative model.
 * @param args - Arguments for the generative function.
 * @param options - Options to control the generator's behavior.
 * @returns A promise that resolves to the generated result.
 */
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
export { resolveTool, resolveTools, resolveInstructions, definePrompt, prompt };
