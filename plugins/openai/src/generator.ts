import type { ClientOptions } from "openai";
import { OpenAI } from "openai";
import { Dispatcher } from "@toolcog/util/task";
import type {
  Schema,
  Tool,
  GeneratorConfig,
  GeneratorOptions,
  Generator,
} from "@toolcog/core";
import { resolveTools, resolveInstructions } from "@toolcog/core";
import type { ToolMessage } from "@toolcog/runtime";
import { Thread } from "@toolcog/runtime";
import { Job } from "@toolcog/runtime";
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

  interface GenerativeConfig {
    openai?: OpenAI | ClientOptions | undefined;

    stream?: boolean | undefined;

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

  interface GenerativeOptions {
    openai?: OpenAI | ClientOptions | undefined;

    stream?: boolean | undefined;

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
    (typeof process !== "undefined" && process.env.OPENAI_API_KEY)
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
  const stream = options?.stream ?? true;

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

  const jsonMode =
    options?.jsonMode ??
    (model.startsWith("gpt-3.5") ||
      model === "gpt-4" ||
      model.startsWith("gpt-4-") ||
      model === "gpt-4o" ||
      model === "gpt-4o-2024-05-13");

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

  let responseFormat:
    | OpenAI.ResponseFormatJSONObject
    | OpenAI.ResponseFormatJSONSchema
    | undefined;
  if (jsonMode) {
    responseFormat = {
      type: "json_object",
    };
  } else if (outputSchema !== undefined) {
    responseFormat = {
      type: "json_schema",
      json_schema: {
        name: "return",
        ...(outputSchema.description !== undefined ?
          { description: outputSchema.description }
        : undefined),
        schema: outputSchema as Record<string, unknown>,
      },
    };
  }

  const tools = await resolveTools(options?.tools, args);

  const requestTools =
    tools !== undefined && tools.length !== 0 ?
      tools.map(createOpenAITool)
    : undefined;

  const prompt = createPrompt(
    parametersSchema,
    outputSchema,
    jsonMode,
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
    const request = {
      model,
      messages: thread.messages as OpenAI.ChatCompletionMessageParam[],

      ...(responseFormat !== undefined ?
        { response_format: responseFormat }
      : undefined),

      ...(requestTools !== undefined ? { tools: requestTools } : undefined),

      stream,
      ...(stream ?
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

    await Job.run(
      {
        icon: "≡",
        title: model,
        status: "...",
      },
      async (job) => {
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
              status: choice.message.content,
              ellipsize: -1,
            });
          }
        }

        const tokenCount = response?.usage?.completion_tokens ?? "unknown";
        job.update({
          status: tokenCount === 1 ? "<1 token>" : `<${tokenCount} tokens>`,
          ellipsize: 1,
        });
        job.finish();
      },
    );

    const choice = response?.choices[0];
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    if (choice === undefined || choice.finish_reason === null) {
      // The request was aborted.
      throw new Error("Interrupted");
    }

    const message = choice.message;
    thread.addMessage(message);

    if (choice.finish_reason === "tool_calls") {
      const toolResults: Promise<ToolMessage>[] = [];

      for (const toolCall of message.tool_calls!) {
        const toolFunction = toolCall.function;

        const tool = tools?.find((tool) =>
          tool.function.name === toolFunction.name ? tool : undefined,
        );
        if (tool === undefined) {
          throw new Error("Unknown tool " + JSON.stringify(toolFunction.name));
        }

        const toolResult = Job.run(
          {
            icon: "⚙",
            title: tool.id,
          },
          async (toolJob) => {
            const toolThread = await Thread.create();
            return Thread.run(toolThread, async () => {
              const result = await callTool(tool, toolFunction.arguments);

              toolJob.finish(result);

              return {
                role: "tool",
                tool_call_id: toolCall.id,
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

      continue;
    }

    if (returnSchema === undefined) {
      return message.content ?? "";
    } else if (returnSchema.type === "void") {
      return undefined;
    }

    let returnValue = JSON.parse(message.content ?? "") as unknown;
    if (resultSchema !== undefined) {
      returnValue = (returnValue as { result: unknown }).result;
    }
    return returnValue;
  }
}) satisfies Generator;

const createOpenAITool = (tool: Tool): OpenAI.ChatCompletionTool => {
  return {
    type: "function",
    function: {
      name: tool.function.name,

      ...(tool.function.description !== undefined ?
        { description: tool.function.description }
      : undefined),

      ...(tool.function.parameters !== undefined ?
        {
          parameters: tool.function.parameters as OpenAI.FunctionParameters,
        }
      : undefined),
    },
  };
};

const createPrompt = (
  parametersSchema: Schema | undefined,
  returnSchema: Schema | undefined,
  jsonMode: boolean,
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
  if (returnSchema !== undefined && jsonMode) {
    returnDirective =
      "Return a result by responding with a JSON object that conforms to the JSON return schema.";
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

  let returnContext: string | undefined;
  if (returnSchema !== undefined && jsonMode) {
    returnContext = "Return schema: " + JSON.stringify(returnSchema);
  }

  let argumentsContext: string | undefined;
  if (args !== undefined) {
    argumentsContext = "Function arguments: " + JSON.stringify(args);
  }

  let context: string | undefined;
  if (parametersContext !== undefined) {
    context = parametersContext;
  }
  if (returnContext !== undefined) {
    if (context === undefined) {
      context = returnContext;
    } else {
      context += "\n" + returnContext;
    }
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

const parseToolArguments = (tool: Tool, args: string): unknown[] => {
  const functionSchema = tool.function;
  const parametersSchema = functionSchema.parameters;
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
        JSON.stringify(functionSchema.name),
      { cause },
    );
  }
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

const callTool = async (tool: Tool, args: string): Promise<string> => {
  const toolArguments = parseToolArguments(tool, args);

  const toolResult = await Promise.resolve(
    tool.call(undefined, ...toolArguments),
  );

  return formatToolResult(tool, toolResult);
};

export type { OpenAIGeneratorConfig, OpenAIGeneratorOptions };
export { generator, generate };
