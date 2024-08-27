import type { Schema } from "@toolcog/util/json";
import type { Tool, ToolSource } from "./tool.ts";
import type { GenerativeModel, InstructionsSource } from "./generative.ts";

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

const resolveTool = async (
  tool: ToolSource,
  args: unknown,
): Promise<Tool | undefined> => {
  if (typeof tool === "function" && !("id" in tool) && !("function" in tool)) {
    tool = tool(args);
  }
  return await (tool as Promise<Tool | undefined> | Tool | undefined);
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
      tools.push(result.value);
    }
    return tools;
  }, []);
};

const resolveInstructions = async (
  instructions: InstructionsSource,
  args: unknown,
): Promise<string | undefined> => {
  if (typeof instructions === "function") {
    instructions = instructions(args);
  }
  return await instructions;
};

export type { GeneratorConfig, GeneratorOptions, Generator };
export { resolveTool, resolveTools, resolveInstructions };
