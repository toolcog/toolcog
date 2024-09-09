import type { ClientOptions } from "@anthropic-ai/sdk";
import { Anthropic } from "@anthropic-ai/sdk";
import type { Schema } from "@toolcog/util/json";
import { formatJson } from "@toolcog/util/json";
import { Dispatcher } from "@toolcog/util/task";
import type {
  Tool,
  GeneratorConfig,
  GeneratorOptions,
  Generator,
} from "@toolcog/core";
import { resolveTools, resolveInstructions } from "@toolcog/core";
import type { MessageBlock, Message } from "@toolcog/runtime";
import { AgentContext, Job } from "@toolcog/runtime";
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

  interface GeneratorConfig {
    anthropic?: Anthropic | ClientOptions | undefined;

    max_tokens?: number | undefined;

    metadata?: Anthropic.MessageCreateParams.Metadata;

    stop_sequences?: readonly string[] | undefined;

    temperature?: number | undefined;

    top_k?: number | undefined;

    top_p?: number | undefined;
  }

  interface GeneratorOptions {
    anthropic?: Anthropic | ClientOptions | undefined;

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
    (typeof process !== "undefined" &&
      process.env.ANTHROPIC_API_KEY !== undefined)
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

  const parametersSchema = options?.parameters;
  const returnSchema = options?.returns;

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

  const anthropicTools =
    returnTool !== undefined || (tools !== undefined && tools.length !== 0) ?
      [
        ...(returnTool !== undefined ? [returnTool] : []),
        ...(tools !== undefined ? tools.map(toAnthropicTool) : []),
      ]
    : undefined;

  let toolChoice = options?.tool_choice;

  const context = AgentContext.getOrCreate();

  const system = options?.system;

  const messages = context.messages.map(toAnthropicMessage);
  const initialMessageCount = messages.length;

  const prompt = createPrompt(
    parametersSchema,
    outputSchema,
    tools,
    args,
    instructions,
  );

  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user") {
    let content = lastMessage.content;
    if (typeof content === "string") {
      content = [{ type: "text", text: content }];
    }
    content.push({ type: "text", text: prompt });
    messages[messages.length - 1] = { role: "user", content };
  } else {
    messages.push({ role: "user", content: prompt });
  }

  while (true) {
    const request = {
      model,
      ...(system !== undefined ? { system } : undefined),
      messages,

      ...(anthropicTools !== undefined ? { tools: anthropicTools } : undefined),

      stream: options?.stream ?? false,

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

    await Job.spawn(model, async (job) => {
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
          output: content,
          outputType: "markdown",
          ellipsize: -1,
        });
      }

      job.finish();
    });

    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    if (message === undefined || message.stop_reason === null) {
      // The request was aborted.
      throw new Error("Interrupted");
    }

    messages.push({
      role: "assistant",
      content: message.content,
    });

    let resultValue: unknown;

    if (message.stop_reason === "tool_use") {
      const toolResults: Promise<Anthropic.ToolResultBlockParam>[] = [];

      for (const block of message.content) {
        if (block.type !== "tool_use") {
          continue;
        }

        if (block.name === "return" && returnTool !== undefined) {
          resultValue = block.input;
          toolResults.push(
            Promise.resolve({
              type: "tool_result",
              tool_use_id: block.id,
              content: "",
            }),
          );
          continue;
        }

        const tool = tools?.find((tool) =>
          tool.name === block.name ? tool : undefined,
        );
        if (tool === undefined) {
          throw new Error("Unknown tool " + JSON.stringify(block.name));
        }

        const toolResult = Job.spawn(tool.id, async (toolJob) => {
          return AgentContext.spawn(undefined, async () => {
            const result = await callTool(tool, block.input);

            toolJob.finish(result);

            return {
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            } satisfies Anthropic.ToolResultBlockParam;
          });
        });

        toolResults.push(toolResult);
      }

      if (toolResults.length !== 0) {
        messages.push({
          role: "user",
          content: await Promise.all(toolResults),
        });
      }

      if (resultValue === undefined) {
        continue;
      }
    }

    if (
      returnSchema !== undefined &&
      resultValue === undefined &&
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

    for (let i = initialMessageCount; i < messages.length; i += 1) {
      context.addMessage(fromAnthropicMessage(messages[i]!));
    }

    if (returnSchema === undefined) {
      let content = "";
      for (const block of message.content) {
        if (block.type === "text") {
          content += block.text;
        }
      }
      return content;
    } else if (returnSchema.type === "void") {
      return undefined;
    }

    if (resultSchema !== undefined) {
      resultValue = (resultValue as { result: unknown }).result;
    }
    return resultValue;
  }
}) satisfies Generator;

const toAnthropicTool = (tool: Tool): Anthropic.Tool => {
  return {
    name: tool.name,

    ...(tool.description !== undefined ?
      { description: tool.description }
    : undefined),

    input_schema: (tool.parameters as
      | Anthropic.Tool.InputSchema
      | undefined) ?? { type: "object" },
  };
};

const toAnthropicMessage = (message: Message): Anthropic.MessageParam => {
  if (typeof message.content === "string") {
    return message as Anthropic.MessageParam;
  }

  const content: Anthropic.MessageParam["content"] = [];
  for (const block of message.content) {
    if (block.type === "text") {
      content.push(block);
    } else if (block.type === "image") {
      const match = /^data:([^;]+);base64,(.+)$/.exec(block.source);
      if (match !== null) {
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type:
              match[1]! as Anthropic.ImageBlockParam.Source["media_type"],
            data: match[2]!,
          },
        });
      }
    } else if (block.type === "refusal") {
      content.push({
        type: "text",
        text: block.refusal,
      });
    } else if (block.type === "request") {
      content.push({
        type: "tool_use",
        id: block.id,
        name: block.name,
        input: block.arguments,
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    else if (block.type === "response") {
      content.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: block.result,
      });
    }
  }
  return { role: message.role, content };
};

const fromAnthropicMessage = (message: Anthropic.MessageParam): Message => {
  if (typeof message.content === "string") {
    return message as Message;
  }

  const content: MessageBlock[] = [];
  for (const block of message.content) {
    if (block.type === "text") {
      content.push(block);
    } else if (block.type === "image") {
      content.push({
        type: "image",
        source: `data:${block.source.media_type};base64,${block.source.data}`,
      });
    } else if (block.type === "tool_use") {
      content.push({
        type: "request",
        id: block.id,
        name: block.name,
        arguments: block.input,
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    else if (block.type === "tool_result") {
      content.push({
        type: "response",
        id: block.tool_use_id,
        result:
          typeof block.content === "string" && block.content.length !== 0 ?
            block.content
          : "",
      });
    }
  }
  return { role: message.role, content } as Message;
};

const createPrompt = (
  parametersSchema: Schema | undefined,
  returnSchema: Schema | undefined,
  tools: readonly Tool[] | undefined,
  args: unknown,
  instructions: string | undefined,
): string => {
  const directives: string[] = [];
  if (parametersSchema !== undefined) {
    directives.push(
      "Perform the function as instructed using the provided arguments.",
    );
  } else if (returnSchema !== undefined) {
    directives.push("Perform the function as instructed.");
  }
  if (
    tools !== undefined &&
    tools.length !== 0 &&
    (parametersSchema !== undefined || returnSchema !== undefined)
  ) {
    directives.push(
      "Use tools as needed to generate the return value of the function.",
    );
  }
  if (returnSchema !== undefined) {
    directives.push(
      'Invoke the "return" tool with the generated return value.',
    );
  }

  const context: string[] = [];
  if (args !== undefined) {
    context.push("Arguments: " + formatJson(args, parametersSchema));
  }

  const sections: string[] = [];
  if (directives.length !== 0) {
    sections.push(directives.join(" "));
  }
  if (context.length !== 0) {
    sections.push(context.join("\n"));
  }
  if (instructions !== undefined) {
    if (sections.length === 0) {
      sections.push(instructions);
    } else {
      sections.push("Instructions:" + "\n" + instructions);
    }
  }

  const prompt = sections.join("\n\n");
  if (prompt.length === 0) {
    throw new Error("No generation instructions");
  }
  return prompt;
};

const parseToolArguments = (tool: Tool, args: unknown): unknown[] => {
  const parametersSchema = tool.parameters;
  const parameters = parametersSchema?.properties;
  if (parameters === undefined) {
    return [];
  }

  const parsedArgs = args as Record<string, unknown> | null | undefined;
  if (
    parsedArgs === undefined ||
    parsedArgs === null ||
    typeof parsedArgs !== "object"
  ) {
    throw new Error(
      "Invalid arguments " +
        JSON.stringify(parsedArgs) +
        " for tool " +
        JSON.stringify(tool.name),
    );
  }

  return Object.entries(parameters).map(([parameterName, parameterSchema]) => {
    const argument = parsedArgs[parameterName];
    // TODO: Validate argument.
    return argument;
  });
};

const callTool = async (tool: Tool, args: unknown): Promise<string> => {
  const toolArguments = parseToolArguments(tool, args);

  const toolResult = await Promise.resolve(
    tool.call(undefined, ...toolArguments),
  );

  return formatJson(toolResult, tool.returns);
};

export type { AnthropicGeneratorConfig, AnthropicGeneratorOptions };
export { generator, generate };
