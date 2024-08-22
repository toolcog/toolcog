import type { ClientOptions } from "@anthropic-ai/sdk";
import { Anthropic } from "@anthropic-ai/sdk";
import { Dispatcher } from "@toolcog/util/task";
import type {
  Schema,
  Tool,
  GeneratorConfig,
  GeneratorOptions,
  Generator,
} from "@toolcog/core";
import { resolveTools, resolveInstructions } from "@toolcog/core";
import type { ToolMessage, ToolCall } from "@toolcog/runtime";
import { Thread } from "@toolcog/runtime";
import { Job } from "@toolcog/runtime";
import { createMessage } from "./client.ts";

declare module "@toolcog/core" {
  // Manually synchronized with Anthropic.Model.
  interface GenerativeModelNames {
    "claude-3-5-sonnet-20240620": unknown;
    "claude-3-opus-20240229": unknown;
    "claude-3-sonnet-20240229": unknown;
    "claude-3-haiku-20240307": unknown;
    "claude-2.1": unknown;
    "claude-2.0": unknown;
    "claude-instant-1.2": unknown;
  }

  interface GenerativeConfig {
    anthropic?: Anthropic | ClientOptions | undefined;

    stream?: boolean | undefined;

    max_tokens?: number | undefined;

    metadata?: Anthropic.MessageCreateParams.Metadata;

    stop_sequences?: readonly string[] | undefined;

    temperature?: number | undefined;

    top_k?: number | undefined;

    top_p?: number | undefined;
  }

  interface GenerativeOptions {
    anthropic?: Anthropic | ClientOptions | undefined;

    stream?: boolean | undefined;

    max_tokens?: number | undefined;

    metadata?: Anthropic.MessageCreateParams.Metadata;

    stop_sequences?: readonly string[] | undefined;

    temperature?: number | undefined;

    tool_choice?:
      | Anthropic.MessageCreateParams.ToolChoiceAuto
      | Anthropic.MessageCreateParams.ToolChoiceAny
      | Anthropic.MessageCreateParams.ToolChoiceTool
      | undefined;

    top_k?: number | undefined;

    top_p?: number | undefined;
  }
}

interface AnthropicGeneratorConfig extends GeneratorConfig {
  dispatcher?: Dispatcher | undefined;
}

interface AnthropicGeneratorOptions extends GeneratorOptions {
  dispatcher?: Dispatcher | undefined;
}

const generator = (
  options?: AnthropicGeneratorOptions,
): Generator | undefined => {
  const model = options?.model;
  if (model !== undefined) {
    if (model.startsWith("anthropic:") || model.startsWith("claude-")) {
      return generate;
    }
  } else if (
    options?.anthropic !== undefined ||
    (typeof process !== "undefined" && process.env.ANTHROPIC_API_KEY)
  ) {
    return generate;
  }

  return undefined;
};

const generate = (async (
  args: unknown,
  options?: AnthropicGeneratorOptions,
): Promise<unknown> => {
  const client =
    options?.anthropic instanceof Anthropic ?
      options.anthropic
    : new Anthropic(options?.anthropic);

  const dispatcher = options?.dispatcher ?? new Dispatcher({ retry: false });
  const signal = options?.signal;
  const stream = options?.stream ?? true;

  let model = options?.model ?? "claude-3-5-sonnet-20240620";
  if (model.startsWith("anthropic:")) {
    model = model.slice("anthropic:".length);
  }

  let instructions: string | undefined;
  if (typeof args === "string") {
    instructions = args;
    args = undefined;
  } else {
    instructions = await resolveInstructions(options?.instructions, args);
  }

  const parametersSchema = options?.function?.parameters;
  const returnSchema = options?.function?.return;

  let resultSchema: Schema | undefined;
  let outputSchema: Schema | undefined;
  if (returnSchema !== undefined && returnSchema.type !== "object") {
    resultSchema = {
      type: "object",
      description: "A wrapper to contain the result of a function call.",
      properties: {
        result: returnSchema,
      },
      required: ["result"],
    };
    outputSchema = resultSchema;
  } else {
    outputSchema = returnSchema;
  }

  let returnTool: Anthropic.Tool | undefined;
  if (outputSchema !== undefined) {
    returnTool = {
      name: "return",
      description: "Return the generated result.",
      input_schema: outputSchema as Anthropic.Tool.InputSchema,
    };
  }

  const tools = await resolveTools(options?.tools, args);

  const requestTools =
    returnTool !== undefined || (tools !== undefined && tools.length !== 0) ?
      [
        ...(returnTool !== undefined ? [returnTool] : []),
        ...(tools !== undefined ? tools.map(createAnthropicTool) : []),
      ]
    : undefined;

  let toolChoice = options?.tool_choice;

  const prompt = createPrompt(
    parametersSchema,
    outputSchema,
    tools,
    args,
    instructions,
  );

  const thread = await Thread.getOrCreate();
  thread.addMessage({
    role: "user",
    content: prompt,
  });

  while (true) {
    let system: string | undefined;
    const messages: Anthropic.MessageParam[] = [];

    for (const message of thread.messages) {
      if (message.role === "system") {
        if (system === undefined) {
          system = message.content;
        } else {
          system += "\n" + message.content;
        }
      } else if (message.role === "user") {
        let content: Anthropic.MessageParam["content"] | undefined;
        const previousMessage = messages[messages.length - 1];
        if (previousMessage !== undefined && previousMessage.role === "user") {
          messages.pop();
          content = previousMessage.content;
        }
        if (typeof message.content === "string") {
          if (typeof content === "string") {
            content = [{ type: "text", text: content }];
          } else if (content === undefined) {
            content = message.content;
          } else {
            content.push({ type: "text", text: message.content });
          }
        } else {
          if (typeof content === "string") {
            content = [{ type: "text", text: content }];
          } else if (content === undefined) {
            content = [];
          }
          for (const block of message.content) {
            if (block.type === "text") {
              content.push(block);
            }
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            else if (block.type === "image_url") {
              // TODO
            }
          }
        }
        messages.push({ role: "user", content });
      } else if (message.role === "assistant") {
        const content: Anthropic.MessageParam["content"] = [];
        if (typeof message.content === "string") {
          content.push({ type: "text", text: message.content });
        }
        if (message.tool_calls !== undefined) {
          for (const toolCall of message.tool_calls) {
            content.push({
              type: "tool_use",
              id: toolCall.id,
              name: toolCall.function.name,
              input: JSON.parse(toolCall.function.arguments),
            });
          }
        }
        messages.push({ role: "assistant", content });
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      else if (message.role === "tool") {
        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: message.tool_call_id,
              content: message.content,
            },
          ],
        });
      }
    }

    const request = {
      model,
      ...(system !== undefined ? { system } : undefined),
      messages,

      ...(requestTools !== undefined ? { tools: requestTools } : undefined),

      stream,

      max_tokens: options?.max_tokens ?? 8192,
      ...(options?.metadata !== undefined ?
        { metadata: options.metadata }
      : undefined),
      ...(options?.stop_sequences !== undefined ?
        { stop_sequences: options.stop_sequences as string[] }
      : undefined),
      ...(options?.temperature !== undefined ?
        { temperature: options.temperature }
      : undefined),
      ...(toolChoice !== undefined ? { tool_choice: toolChoice } : undefined),
      ...(options?.top_k !== undefined ? { top_k: options.top_k } : undefined),
      ...(options?.top_p !== undefined ? { top_p: options.top_p } : undefined),
    } satisfies Anthropic.MessageCreateParams;

    let message: Anthropic.Message | undefined;

    await Job.run(
      {
        icon: "≡",
        title: model,
        status: "...",
      },
      async (job) => {
        const response = await dispatcher.enqueue(
          () => createMessage(client, request, { signal }),
          { signal },
        );

        for await (message of response) {
          let content = "";
          for (const block of message.content) {
            if (block.type !== "text") {
              continue;
            }
            content += block.text;
          }
          job.update({
            status: content,
            ellipsize: -1,
          });
        }

        const tokenCount = message?.usage.output_tokens ?? "unknown";
        job.update({
          status: tokenCount === 1 ? "<1 token>" : `<${tokenCount} tokens>`,
          ellipsize: 1,
        });
        job.finish();
      },
    );

    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    if (message === undefined || message.stop_reason === null) {
      // The request was aborted.
      throw new Error("Interrupted");
    }

    let content = "";
    let tool_calls: ToolCall[] | undefined;
    for (const block of message.content) {
      if (block.type === "text") {
        content += block.text;
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      else if (block.type === "tool_use") {
        if (tool_calls === undefined) {
          tool_calls = [];
        }
        tool_calls.push({
          type: "function",
          id: block.id,
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    thread.addMessage({
      role: "assistant",
      content,
      tool_calls,
    });

    let returnValue: unknown;

    if (message.stop_reason === "tool_use") {
      const toolResults: Promise<ToolMessage>[] = [];

      for (const block of message.content) {
        if (block.type !== "tool_use") {
          continue;
        }

        if (block.name === "return" && returnTool !== undefined) {
          returnValue = block.input;
          thread.addMessage({
            role: "tool",
            tool_call_id: block.id,
            content: "",
          });
          continue;
        }

        const tool = tools?.find((tool) =>
          tool.function.name === block.name ? tool : undefined,
        );
        if (tool === undefined) {
          throw new Error("Unknown tool " + JSON.stringify(block.name));
        }

        const toolResult = Job.run(
          {
            icon: "⚙",
            title: tool.id,
          },
          async (toolJob) => {
            const toolThread = await Thread.create();
            return Thread.run(toolThread, async () => {
              const result = await callTool(tool, block.input);

              toolJob.finish(result);

              return {
                role: "tool",
                tool_call_id: block.id,
                content: result,
              } satisfies ToolMessage;
            });
          },
        );

        toolResults.push(toolResult);
      }

      for (const toolResult of await Promise.all(toolResults)) {
        thread.addMessage(toolResult);
      }

      if (returnValue === undefined) {
        continue;
      }
    }

    if (
      returnSchema !== undefined &&
      returnValue === undefined &&
      message.stop_reason === "end_turn"
    ) {
      if (
        toolChoice !== undefined &&
        toolChoice.type === "tool" &&
        toolChoice.name === "return"
      ) {
        throw new Error("Model refused to use return tool.");
      }
      toolChoice = {
        type: "tool",
        name: "return",
      };
      continue;
    }

    if (returnSchema === undefined) {
      return content;
    } else if (returnSchema.type === "void") {
      return undefined;
    }

    if (resultSchema !== undefined) {
      returnValue = (returnValue as { result: unknown }).result;
    }
    return returnValue;
  }
}) satisfies Generator;

const createAnthropicTool = (tool: Tool): Anthropic.Tool => {
  return {
    name: tool.function.name,

    ...(tool.function.description !== undefined ?
      { description: tool.function.description }
    : undefined),

    input_schema: (tool.function.parameters as
      | Anthropic.Tool.InputSchema
      | undefined) ?? { type: "object" },
  };
};

const createPrompt = (
  parametersSchema: Schema | undefined,
  returnSchema: Schema | undefined,
  tools: readonly Tool[] | undefined,
  args: unknown,
  instructions: string | undefined,
): string => {
  let parametersDirective: string | undefined;
  if (parametersSchema !== undefined) {
    parametersDirective =
      "Interpret the JSON function arguments according to the JSON parameters schema.";
  }

  let executionDirective: string | undefined;
  if (parametersSchema !== undefined) {
    executionDirective =
      "Use the interpreted arguments to perform the function as instructed.";
  } else if (returnSchema !== undefined) {
    executionDirective = "Perform the function as instructed.";
  }

  let toolsDirective: string | undefined;
  if (
    tools !== undefined &&
    tools.length !== 0 &&
    (parametersSchema !== undefined || returnSchema !== undefined)
  ) {
    toolsDirective = "Use tools as needed to follow all instructions.";
  }

  let returnDirective: string | undefined;
  if (returnSchema !== undefined) {
    returnDirective = 'Use the "return" tool to return a result.';
  }

  let directives: string | undefined;
  if (parametersDirective !== undefined) {
    directives = parametersDirective;
  }
  if (executionDirective !== undefined) {
    if (directives === undefined) {
      directives = executionDirective;
    } else {
      directives += " " + executionDirective;
    }
  }
  if (toolsDirective !== undefined) {
    if (directives === undefined) {
      directives = toolsDirective;
    } else {
      directives += " " + toolsDirective;
    }
  }
  if (returnDirective !== undefined) {
    if (directives === undefined) {
      directives = returnDirective;
    } else {
      directives += " " + returnDirective;
    }
  }

  let parametersContext: string | undefined;
  if (parametersSchema !== undefined) {
    parametersContext =
      "Parameters schema: " + JSON.stringify(parametersSchema);
  }

  let argumentsContext: string | undefined;
  if (args !== undefined) {
    argumentsContext = "Function arguments: " + JSON.stringify(args);
  }

  let context: string | undefined;
  if (parametersContext !== undefined) {
    context = parametersContext;
  }
  if (argumentsContext !== undefined) {
    if (context === undefined) {
      context = argumentsContext;
    } else {
      context += "\n" + argumentsContext;
    }
  }

  let prompt: string | undefined;
  if (directives !== undefined) {
    prompt = directives;
  }
  if (context !== undefined) {
    if (prompt === undefined) {
      prompt = context;
    } else {
      prompt += "\n\n" + context;
    }
  }
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
};

const parseToolArguments = (tool: Tool, args: unknown): unknown[] => {
  const functionSchema = tool.function;
  const parametersSchema = functionSchema.parameters;
  const parameters = parametersSchema?.properties;
  if (parameters === undefined) {
    return [];
  }

  const parsedArgs = args as Record<string, unknown> | null;
  if (parsedArgs === null || typeof parsedArgs !== "object") {
    throw new Error(
      "Invalid arguments " +
        JSON.stringify(parsedArgs) +
        " for tool " +
        JSON.stringify(functionSchema.name),
    );
  }

  return Object.entries(parameters).map(([parameterName, parameterSchema]) => {
    const argument = parsedArgs[parameterName];
    // TODO: Validate argument.
    return argument;
  });
};

const formatToolResult = (tool: Tool, result: unknown): string => {
  return result !== undefined ? JSON.stringify(result) : "";
};

const callTool = async (tool: Tool, args: unknown): Promise<string> => {
  const toolArguments = parseToolArguments(tool, args);

  const toolResult = await Promise.resolve(
    tool.call(undefined, ...toolArguments),
  );

  return formatToolResult(tool, toolResult);
};

export type { AnthropicGeneratorConfig, AnthropicGeneratorOptions };
export { generator, generate };
