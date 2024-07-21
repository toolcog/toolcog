import type { Schema } from "@toolcog/util/schema";
import type { ToolFunction } from "@toolcog/core";
import { Tool } from "@toolcog/core";

type GenerativeResultType = "any" | "object";

interface GenerativeFunctionOptions {
  instructions?: string | undefined;

  parameters?: Schema | null | undefined;

  return?: Schema | null | undefined;

  tools?: ToolFunction[] | null | undefined;

  resultType?: GenerativeResultType | undefined;
}

class GenerativeFunction {
  readonly #instructions: string | undefined;

  readonly #parameters: Schema | null;

  readonly #return: Schema | null;

  readonly #tools: readonly ToolFunction[] | null;

  readonly #resultType: GenerativeResultType;

  #resultSchema: Schema | null | undefined;

  constructor(options: GenerativeFunctionOptions) {
    this.#instructions = options.instructions;
    this.#parameters = options.parameters ?? null;
    this.#return = options.return ?? null;
    this.#tools = options.tools ?? [];
    this.#resultType = options.resultType ?? "any";
    this.#resultSchema = undefined;
  }

  get instructions(): string | undefined {
    return this.#instructions;
  }

  get parameters(): Schema | null {
    return this.#parameters;
  }

  get return(): Schema | null {
    return this.#return;
  }

  get tools(): readonly ToolFunction[] | null {
    return this.#tools;
  }

  get resultType(): GenerativeResultType {
    return this.#resultType;
  }

  createResultSchema(): Schema | null {
    const resultType = this.resultType;
    const returnSchema = this.return;

    if (
      resultType === "object" &&
      returnSchema !== null &&
      returnSchema.type !== "object"
    ) {
      return {
        type: "object",
        description: "A wrapper to contain the result of a function call.",
        properties: {
          result: returnSchema,
        },
        required: ["result"],
      };
    }

    return returnSchema;
  }

  get resultSchema(): Schema | null {
    if (this.#resultSchema === undefined) {
      this.#resultSchema = this.createResultSchema();
    }
    return this.#resultSchema;
  }

  parametersDirective(): string | undefined {
    if (this.parameters !== null) {
      return "Interpret the JSON function arguments according to the JSON parameters schema.";
    }
    return undefined;
  }

  executionDirective(): string | undefined {
    if (this.parameters !== null) {
      return "Use the interpreted arguments to perform the function as instructed.";
    } else if (this.resultSchema !== null) {
      return "Perform the function as instructed.";
    }
    return undefined;
  }

  toolsDirective(): string | undefined {
    const tools = this.tools;
    if (
      tools !== null &&
      tools.length !== 0 &&
      (this.parameters !== null || this.resultSchema !== null)
    ) {
      return "Call tools as needed when following the instructions.";
    }
    return undefined;
  }

  resultDirective(): string | undefined {
    if (this.resultSchema !== null) {
      return "Respond with a JSON object that conforms to the JSON result schema.";
    }
    return undefined;
  }

  functionDirectives(): string | undefined {
    let directives: string | undefined;

    const parametersDirective = this.parametersDirective();
    if (parametersDirective !== undefined) {
      directives = parametersDirective;
    }

    const executionDirective = this.executionDirective();
    if (executionDirective !== undefined) {
      if (directives === undefined) {
        directives = executionDirective;
      } else {
        directives += " " + executionDirective;
      }
    }

    const toolsDirective = this.toolsDirective();
    if (toolsDirective !== undefined) {
      if (directives === undefined) {
        directives = toolsDirective;
      } else {
        directives += " " + toolsDirective;
      }
    }

    const resultDirective = this.resultDirective();
    if (resultDirective !== undefined) {
      if (directives === undefined) {
        directives = resultDirective;
      } else {
        directives += " " + resultDirective;
      }
    }

    return directives;
  }

  parametersContext(): string | undefined {
    const parametersSchema = this.parameters;
    if (parametersSchema !== null) {
      return "Parameters schema: " + JSON.stringify(parametersSchema);
    }
    return undefined;
  }

  resultContext(): string | undefined {
    const resultSchema = this.resultSchema;
    if (resultSchema !== null) {
      return "Result schema: " + JSON.stringify(resultSchema);
    }
    return undefined;
  }

  argumentsContext(args: unknown): string | undefined {
    if (args !== undefined) {
      return "Function arguments: " + JSON.stringify(args);
    }
    return undefined;
  }

  functionContext(args: unknown): string | undefined {
    let prompt: string | undefined;

    const parametersContext = this.parametersContext();
    if (parametersContext !== undefined) {
      prompt = parametersContext;
    }

    const resultContext = this.resultContext();
    if (resultContext !== undefined) {
      if (prompt === undefined) {
        prompt = resultContext;
      } else {
        prompt += "\n" + resultContext;
      }
    }

    const argumentsContext = this.argumentsContext(args);
    if (argumentsContext !== undefined) {
      if (prompt === undefined) {
        prompt = argumentsContext;
      } else {
        prompt += "\n" + argumentsContext;
      }
    }

    return prompt;
  }

  prompt(args: unknown): string {
    let prompt: string | undefined;

    const functionDirectives = this.functionDirectives();
    if (functionDirectives !== undefined) {
      prompt = functionDirectives;
    }

    const functionContext = this.functionContext(args);
    if (functionContext !== undefined) {
      if (prompt === undefined) {
        prompt = functionContext;
      } else {
        prompt += "\n\n" + functionContext;
      }
    }

    const instructions = this.instructions;
    if (instructions !== undefined) {
      if (prompt === undefined) {
        prompt = instructions;
      } else {
        prompt += "\n\n" + "Instructions:" + "\n" + instructions;
      }
    }

    if (prompt === undefined) {
      throw new Error("No generation instructions");
    }

    return prompt;
  }

  parseResult(result: string): unknown {
    const returnSchema = this.return;
    if (returnSchema === null) {
      return result;
    }

    const resultType = this.resultType;
    if (returnSchema.type === "void") {
      return undefined;
    }

    let resultValue = JSON.parse(result) as unknown;
    if (resultType === "object" && returnSchema.type !== "object") {
      resultValue = (resultValue as { result: unknown }).result;
    }

    return resultValue;
  }

  getTool(name: string): ToolFunction | undefined {
    return this.tools?.find((tool) => tool[Tool.descriptor]?.name === name);
  }

  parseToolArguments(tool: ToolFunction, args: string): unknown[] {
    const toolDescriptor = tool[Tool.descriptor];
    const parametersSchema = toolDescriptor?.parameters;
    const parameters = parametersSchema?.properties;
    if (parameters === undefined) {
      return [];
    }

    let parsedArgs: Record<string, unknown> | null;
    try {
      parsedArgs = JSON.parse(args) as Record<string, unknown> | null;
    } catch (cause) {
      throw new Error(
        "Malformed arguments " +
          JSON.stringify(args) +
          " for tool " +
          JSON.stringify(toolDescriptor?.name),
        { cause },
      );
    }
    if (parsedArgs === null || typeof parsedArgs !== "object") {
      throw new Error(
        "Invalid arguments " +
          JSON.stringify(parsedArgs) +
          " for tool " +
          JSON.stringify(toolDescriptor?.name),
      );
    }

    return Object.entries(parameters).map(
      ([parameterName, parameterSchema]) => {
        const argument = parsedArgs[parameterName];
        // TODO: Validate argument.
        return argument;
      },
    );
  }

  formatToolResult(tool: ToolFunction, result: unknown): string {
    return JSON.stringify(result);
  }

  async callTool(name: ToolFunction | string, args: string): Promise<string> {
    let tool: ToolFunction | undefined;
    if (typeof name === "string") {
      tool = this.getTool(name);
      if (tool === undefined) {
        throw new Error("Unknown tool " + JSON.stringify(name));
      }
    } else {
      tool = name;
    }

    const toolArguments = this.parseToolArguments(tool, args);

    const toolResult = await Promise.resolve(
      tool.call(undefined, ...toolArguments),
    );

    return this.formatToolResult(tool, toolResult);
  }
}

export type { GenerativeResultType, GenerativeFunctionOptions };
export { GenerativeFunction };
