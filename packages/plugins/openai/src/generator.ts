import type { ClientOptions } from "openai";
import { OpenAI } from "openai";
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
import type { AssistantBlock, UserBlock, Message } from "@toolcog/runtime";
import { AgentContext, Job } from "@toolcog/runtime";
import type { ChatCompletion } from "./client.ts";
import { createChatCompletion } from "./client.ts";

declare module "@toolcog/core" {
  // Manually synchronized with OpenAI.ChatModel.
  interface GenerativeModelNames {
    "gpt-4o": unknown;
    "gpt-4o-2024-05-13": unknown;
    "gpt-4o-2024-08-06": unknown;
    "gpt-4o-mini": unknown;
    "gpt-4o-mini-2024-07-18": unknown;
    "gpt-4-turbo": unknown;
    "gpt-4-turbo-2024-04-09": unknown;
    "gpt-4-0125-preview": unknown;
    "gpt-4-turbo-preview": unknown;
    "gpt-4-1106-preview": unknown;
    "gpt-4-vision-preview": unknown;
    "gpt-4": unknown;
    "gpt-4-0314": unknown;
    "gpt-4-0613": unknown;
    "gpt-4-32k": unknown;
    "gpt-4-32k-0314": unknown;
    "gpt-4-32k-0613": unknown;
    "gpt-3.5-turbo": unknown;
    "gpt-3.5-turbo-16k": unknown;
    "gpt-3.5-turbo-0301": unknown;
    "gpt-3.5-turbo-0613": unknown;
    "gpt-3.5-turbo-1106": unknown;
    "gpt-3.5-turbo-0125": unknown;
    "gpt-3.5-turbo-16k-0613": unknown;
  }

  interface GeneratorConfig {
    openai?: OpenAI | ClientOptions | undefined;

    jsonMode?: boolean | undefined;

    frequency_penalty?: number | undefined;

    logit_bias?: Record<string, number> | null | undefined;

    max_tokens?: number | undefined;

    parallel_tool_calls?: boolean | undefined;

    presence_penalty?: number | undefined;

    seed?: number | undefined;

    service_tier?: "auto" | "default" | undefined;

    stop?: readonly string[] | string | null | undefined;

    temperature?: number | undefined;

    top_p?: number | undefined;

    user?: string | undefined;
  }

  interface GeneratorOptions {
    openai?: OpenAI | ClientOptions | undefined;

    jsonMode?: boolean | undefined;

    frequency_penalty?: number | undefined;

    logit_bias?: Record<string, number> | null | undefined;

    max_tokens?: number | undefined;

    parallel_tool_calls?: boolean | undefined;

    presence_penalty?: number | undefined;

    seed?: number | undefined;

    service_tier?: "auto" | "default" | undefined;

    stop?: readonly string[] | string | null | undefined;

    temperature?: number | undefined;

    tool_choice?: OpenAI.ChatCompletionToolChoiceOption | undefined;

    top_p?: number | undefined;

    user?: string | undefined;
  }
}

interface OpenAIGeneratorConfig extends GeneratorConfig {
  dispatcher?: Dispatcher | undefined;
}

interface OpenAIGeneratorOptions extends GeneratorOptions {
  dispatcher?: Dispatcher | undefined;
}

const generator = (options?: OpenAIGeneratorOptions): Generator | undefined => {
  const model = options?.model;
  if (model !== undefined) {
    if (model.startsWith("openai:") || model.startsWith("gpt-")) {
      return generate;
    }
  } else if (
    options?.openai !== undefined ||
    (typeof process !== "undefined" && process.env.OPENAI_API_KEY !== undefined)
  ) {
    return generate;
  }

  return undefined;
};

const generate = (async (
  args: unknown,
  options?: OpenAIGeneratorOptions,
): Promise<unknown> => {
  const client =
    options?.openai instanceof OpenAI ?
      options.openai
    : new OpenAI(options?.openai);

  const dispatcher = options?.dispatcher ?? new Dispatcher({ retry: false });
  const signal = options?.signal;

  let model = options?.model ?? "gpt-4o-2024-08-06";
  if (model.startsWith("openai:")) {
    model = model.slice("openai:".length);
  }

  let instructions: string | undefined;
  if (typeof args === "string") {
    instructions = args;
    args = undefined;
  } else {
    instructions = await resolveInstructions(options?.instructions, args);
  }

  let jsonMode = options?.jsonMode;
  if (jsonMode === undefined) {
    switch (model) {
      case "gpt-4o":
      case "gpt-4o-2024-05-13":
        jsonMode = true;
        break;
      case "gpt-4o-2024-08-06":
      case "gpt-4o-mini":
      case "gpt-4o-mini-2024-07-18":
        jsonMode = false;
        break;
      case "gpt-4-turbo":
      case "gpt-4-turbo-2024-04-09":
      case "gpt-4-0125-preview":
      case "gpt-4-turbo-preview":
      case "gpt-4-1106-preview":
      case "gpt-4-vision-preview":
      case "gpt-4":
      case "gpt-4-0314":
      case "gpt-4-0613":
      case "gpt-4-32k":
      case "gpt-4-32k-0314":
      case "gpt-4-32k-0613":
      case "gpt-3.5-turbo":
      case "gpt-3.5-turbo-16k":
      case "gpt-3.5-turbo-0301":
      case "gpt-3.5-turbo-0613":
      case "gpt-3.5-turbo-1106":
      case "gpt-3.5-turbo-0125":
      case "gpt-3.5-turbo-16k-0613":
        jsonMode = true;
        break;
      default:
        jsonMode = false;
    }
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

  let responseFormat:
    | OpenAI.ResponseFormatJSONObject
    | OpenAI.ResponseFormatJSONSchema
    | undefined;
  let responseSchema: OpenAI.ResponseFormatJSONSchema.JSONSchema | undefined;

  if (jsonMode) {
    responseFormat = {
      type: "json_object",
    };
  } else if (outputSchema !== undefined) {
    responseSchema = {
      name: "return",
      ...(outputSchema.description !== undefined ?
        { description: outputSchema.description }
      : undefined),
      schema: outputSchema as Record<string, unknown>,
    };
    responseFormat = {
      type: "json_schema",
      json_schema: responseSchema,
    };
  }

  const tools = await resolveTools(options?.tools, args);

  const openAITools =
    tools !== undefined && tools.length !== 0 ?
      tools.map(toOpenAITool)
    : undefined;

  const context = AgentContext.getOrCreate();

  const systemMessage: OpenAI.ChatCompletionSystemMessageParam | undefined =
    options?.system !== undefined ?
      { role: "system", content: options.system }
    : undefined;

  const messages = [
    ...(systemMessage !== undefined ? [systemMessage] : []),
    ...context.messages.flatMap(toOpenAIMessage),
  ];
  const initialMessageCount = messages.length;

  const prompt = createPrompt(
    parametersSchema,
    outputSchema,
    jsonMode,
    tools,
    args,
    instructions,
  );

  messages.push({
    role: "user",
    content: prompt,
  });

  while (true) {
    const request = {
      model,
      messages,

      ...(responseFormat !== undefined ?
        { response_format: responseFormat }
      : undefined),

      ...(openAITools !== undefined ? { tools: openAITools } : undefined),

      stream: options?.stream ?? false,
      ...((options?.stream ?? false) ?
        {
          stream_options: {
            include_usage: true,
          },
        }
      : undefined),

      ...(options?.frequency_penalty !== undefined ?
        { frequency_penalty: options.frequency_penalty }
      : undefined),
      ...(options?.logit_bias !== undefined ?
        { logit_bias: options.logit_bias }
      : undefined),
      ...(options?.max_tokens !== undefined ?
        { max_tokens: options.max_tokens }
      : undefined),
      ...(options?.parallel_tool_calls !== undefined ?
        { parallel_tool_calls: options.parallel_tool_calls }
      : undefined),
      ...(options?.presence_penalty !== undefined ?
        { presence_penalty: options.presence_penalty }
      : undefined),
      ...(options?.seed !== undefined ? { seed: options.seed } : undefined),
      ...(options?.service_tier !== undefined ?
        { service_tier: options.service_tier }
      : undefined),
      ...(options?.stop !== undefined ?
        { stop: options.stop as string[] | string | null }
      : undefined),
      ...(options?.temperature !== undefined ?
        { temperature: options.temperature }
      : undefined),
      ...(options?.tool_choice !== undefined ?
        { tool_choice: options.tool_choice }
      : undefined),
      ...(options?.top_p !== undefined ? { top_p: options.top_p } : undefined),
      ...(options?.user !== undefined ? { user: options.user } : undefined),
    } satisfies OpenAI.ChatCompletionCreateParams;

    let response: ChatCompletion | undefined;

    await Job.spawn(model, async (job) => {
      const completion = await dispatcher.enqueue(
        () => createChatCompletion(client, request, { signal }),
        { signal },
      );

      for await (response of completion) {
        const choice = response.choices[0];
        if (choice === undefined) {
          continue;
        }

        if (choice.message.content !== null) {
          job.update({
            output: choice.message.content,
            outputType: "markdown",
            ellipsize: -1,
          });
        }
      }

      job.finish();
    });

    const choice = response?.choices[0];
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    if (choice === undefined || choice.finish_reason === null) {
      // The request was aborted.
      throw new Error("Interrupted");
    }

    const message = choice.message;
    messages.push({
      role: "assistant",
      content: message.content,
      refusal: message.refusal,
      ...(message.tool_calls !== undefined ?
        { tool_calls: message.tool_calls }
      : undefined),
    });

    if (choice.finish_reason === "tool_calls") {
      const toolResults: Promise<OpenAI.ChatCompletionToolMessageParam>[] = [];

      for (const toolCall of message.tool_calls!) {
        const toolFunction = toolCall.function;

        const tool = tools?.find((tool) =>
          tool.name === toolFunction.name ? tool : undefined,
        );
        if (tool === undefined) {
          throw new Error("Unknown tool " + JSON.stringify(toolFunction.name));
        }

        const toolResult = Job.spawn(tool.id, async (toolJob) => {
          return AgentContext.spawn(undefined, async () => {
            const result = await callTool(tool, toolFunction.arguments);

            toolJob.finish(result);

            return {
              role: "tool",
              tool_call_id: toolCall.id,
              content: result,
            } satisfies OpenAI.ChatCompletionToolMessageParam;
          });
        });

        toolResults.push(toolResult);
      }

      messages.push(...(await Promise.all(toolResults)));

      continue;
    }

    for (const message of messages
      .slice(initialMessageCount)
      .reduce(fromOpenAIMessage, [])) {
      context.addMessage(message);
    }

    if (returnSchema === undefined) {
      return message.content ?? "";
    } else if (returnSchema.type === "void") {
      return undefined;
    }

    let resultValue =
      message.content !== null && message.content.length !== 0 ?
        (JSON.parse(message.content) as unknown)
      : undefined;
    if (resultSchema !== undefined) {
      resultValue = (resultValue as { result: unknown }).result;
    }
    return resultValue;
  }
}) satisfies Generator;

const toOpenAITool = (tool: Tool): OpenAI.ChatCompletionTool => {
  return {
    type: "function",
    function: {
      name: tool.name,

      ...(tool.description !== undefined ?
        { description: tool.description }
      : undefined),

      ...(tool.parameters !== undefined ?
        { parameters: tool.parameters as OpenAI.FunctionParameters }
      : undefined),
    },
  };
};

const toOpenAIMessage = (
  message: Message,
): OpenAI.ChatCompletionMessageParam[] => {
  if (typeof message.content === "string") {
    return [message as OpenAI.ChatCompletionMessageParam];
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  if (message.role === "user") {
    let content: OpenAI.ChatCompletionContentPart[] | undefined;
    for (const block of message.content) {
      if (block.type === "text") {
        if (content === undefined) {
          content = [];
        }
        content.push(block);
      } else if (block.type === "image") {
        if (content === undefined) {
          content = [];
        }
        content.push({
          type: "image_url",
          image_url: { url: block.source },
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      else if (block.type === "response") {
        if (content !== undefined) {
          messages.push({ role: "user", content });
        }
        content = undefined;
        messages.push({
          role: "tool",
          tool_call_id: block.id,
          content: block.result,
        });
      }
    }
    if (content !== undefined) {
      messages.push({ role: "user", content });
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  else if (message.role === "assistant") {
    let content:
      | (
          | OpenAI.ChatCompletionContentPartText
          | OpenAI.ChatCompletionContentPartRefusal
        )[]
      | undefined;
    let toolCalls: OpenAI.ChatCompletionMessageToolCall[] | undefined;
    for (const block of message.content) {
      if (block.type === "text") {
        if (content === undefined) {
          content = [];
        }
        content.push(block);
      } else if (block.type === "refusal") {
        if (content === undefined) {
          content = [];
        }
        content.push(block);
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      else if (block.type === "request") {
        if (toolCalls === undefined) {
          toolCalls = [];
        }
        toolCalls.push({
          type: "function",
          id: block.id,
          function: {
            name: block.name,
            arguments:
              block.arguments !== undefined ?
                JSON.stringify(block.arguments)
              : "",
          },
        });
      }
    }
    messages.push({
      role: "assistant",
      ...(content !== undefined ? { content } : undefined),
      ...(toolCalls !== undefined ? { tool_calls: toolCalls } : undefined),
    });
  }
  return messages;
};

const fromOpenAIMessage = (
  messages: Message[],
  message: OpenAI.ChatCompletionMessageParam,
): Message[] => {
  if (message.role === "assistant") {
    let content: AssistantBlock[] | string | undefined;

    if (typeof message.content === "string") {
      content = message.content;
    } else if (message.content !== undefined && message.content !== null) {
      content = message.content;
    }

    if (message.refusal !== undefined && message.refusal !== null) {
      if (content === undefined) {
        content = [];
      } else if (typeof content === "string") {
        content = [{ type: "text", text: content }];
      }
      content.push({ type: "refusal", refusal: message.refusal });
    }

    if (message.tool_calls !== undefined && message.tool_calls.length !== 0) {
      if (content === undefined) {
        content = [];
      } else if (typeof content === "string") {
        content = [{ type: "text", text: content }];
      }
      for (const toolCall of message.tool_calls) {
        content.push({
          type: "request",
          id: toolCall.id,
          name: toolCall.function.name,
          arguments:
            toolCall.function.arguments.length !== 0 ?
              JSON.parse(toolCall.function.arguments)
            : undefined,
        });
      }
    }

    if (content === undefined) {
      content = [];
    }
    messages.push({ role: "assistant", content });
  } else if (message.role === "user" || message.role === "tool") {
    const lastMessage = messages[messages.length - 1];
    let content: UserBlock[] | string | undefined =
      lastMessage?.role === "user" ?
        (lastMessage.content as UserBlock[] | string)
      : undefined;

    if (message.role === "user") {
      if (typeof message.content === "string") {
        if (content === undefined) {
          content = message.content;
        } else {
          if (typeof content === "string") {
            content = [{ type: "text", text: content }];
          }
          content.push({ type: "text", text: message.content });
        }
      } else {
        if (content === undefined) {
          content = [];
        } else if (typeof content === "string") {
          content = [{ type: "text", text: content }];
        }
        for (const block of message.content) {
          if (block.type === "text") {
            content.push(block);
          }
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          else if (block.type === "image_url") {
            content.push({ type: "image", source: block.image_url.url });
          }
        }
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    else if (message.role === "tool") {
      if (content === undefined) {
        content = [];
      } else if (typeof content === "string") {
        content = [{ type: "text", text: content }];
      }
      content.push({
        type: "response",
        id: message.tool_call_id,
        result:
          typeof message.content === "string" && message.content.length !== 0 ?
            message.content
          : "",
      });
    }

    if (content === undefined) {
      content = [];
    }
    if (lastMessage?.role === "user") {
      messages[messages.length - 1] = { role: "user", content };
    } else {
      messages.push({ role: "user", content });
    }
  }

  return messages;
};

const createPrompt = (
  parametersSchema: Schema | undefined,
  returnSchema: Schema | undefined,
  jsonMode: boolean,
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
  if (returnSchema !== undefined && jsonMode) {
    directives.push(
      "Respond with the generated return value as a JSON object " +
        "that conforms to the provided JSON return schema.",
    );
  }

  const context: string[] = [];
  if (args !== undefined) {
    context.push("Arguments: " + formatJson(args, parametersSchema));
  }
  if (returnSchema !== undefined && jsonMode) {
    context.push("Return schema: " + JSON.stringify(returnSchema));
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

const parseToolArguments = (tool: Tool, args: string): unknown[] => {
  const parametersSchema = tool.parameters;
  const parameters = parametersSchema?.properties;
  if (parameters === undefined) {
    return [];
  }

  let parsedArgs: Record<string, unknown> | null | undefined;
  try {
    parsedArgs =
      args.length !== 0 ?
        (JSON.parse(args) as Record<string, unknown> | null)
      : undefined;
  } catch (cause) {
    throw new Error(
      "Malformed arguments " +
        JSON.stringify(args) +
        " for tool " +
        JSON.stringify(tool.name),
      { cause },
    );
  }
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

const callTool = async (tool: Tool, args: string): Promise<string> => {
  const toolArguments = parseToolArguments(tool, args);

  const toolResult = await Promise.resolve(
    tool.call(undefined, ...toolArguments),
  );

  return formatJson(toolResult, tool.returns);
};

export type { OpenAIGeneratorConfig, OpenAIGeneratorOptions };
export { generator, generate };
