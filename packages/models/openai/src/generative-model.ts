import { OpenAI } from "openai";
import type { DispatcherOptions } from "@toolcog/util/task";
import { Dispatcher } from "@toolcog/util/task";
import type { Schema } from "@toolcog/util/schema";
import type { GenerateOptions, GenerativeModel } from "@toolcog/core";

type OpenAIGenerativeModelName =
  | "gpt-3.5-turbo"
  | "gpt-4"
  | "gpt-4-turbo"
  | "gpt-4o"
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

interface OpenAIGenerativeModelOptions {
  client?: OpenAI | undefined;

  modelName?: OpenAIGenerativeModelName | undefined;

  dispatcher?: Dispatcher | DispatcherOptions | undefined;
}

class OpenAIGenerativeModel implements GenerativeModel {
  static readonly DefaultModelName = "gpt-4o";

  static isSupportedModelName(modelName: string): boolean {
    return modelName.startsWith("gpt-");
  }

  readonly #client: OpenAI;

  readonly #modelName: OpenAIGenerativeModelName;

  readonly #dispatcher: Dispatcher;

  constructor(options?: OpenAIGenerativeModelOptions) {
    this.#client = options?.client ?? new OpenAI();
    this.#modelName =
      options?.modelName ?? OpenAIGenerativeModel.DefaultModelName;

    let dispatcher = options?.dispatcher;
    if (dispatcher === undefined) {
      dispatcher = { retry: false };
    }
    if (!(dispatcher instanceof Dispatcher)) {
      dispatcher = new Dispatcher(dispatcher);
    }
    this.#dispatcher = dispatcher as Dispatcher;
  }

  get client(): OpenAI {
    return this.#client;
  }

  get modelName(): OpenAIGenerativeModelName {
    return this.#modelName;
  }

  get modelId(): string {
    return `openai/${this.#modelName}`;
  }

  get dispatcher(): Dispatcher {
    return this.#dispatcher;
  }

  generate<T = string>(args?: unknown, options?: GenerateOptions): Promise<T> {
    return this.prompt(undefined, args, options);
  }

  async prompt<T = string>(
    instructions?: string,
    args?: unknown,
    options?: GenerateOptions,
  ): Promise<T> {
    if (options === undefined) {
      throw new Error("Prompt not compiled");
    }

    let returnSchema: Schema;
    let returnWrapper: boolean;
    if (options.return === undefined) {
      returnSchema = {
        type: "object",
        properties: {
          return: { type: "string" },
        },
        required: ["return"],
      };
      returnWrapper = true;
    } else if (options.return.type !== "object") {
      returnSchema = {
        type: "object",
        properties: {
          return: options.return,
        },
        required: ["return"],
      };
      returnWrapper = true;
    } else {
      returnSchema = options.return;
      returnWrapper = false;
    }

    let tools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined;
    if (options.tools !== undefined) {
      tools = options.tools.map((tool) => {
        return {
          type: tool.type,
          function: tool.function,
        } as OpenAI.Chat.Completions.ChatCompletionTool;
      });
    }

    if (instructions === undefined) {
      instructions = options.instructions;
    }
    if (instructions === undefined) {
      instructions = "Use the function arguments to generate a response.";
    }

    const systemMessage =
      "You are an AI function embedded in a computer program.";

    const userMessage =
      "Use the JSON parameters schema to interpret the JSON function arguments. " +
      "Then use the interpreted arguments to perform the function as instructed. " +
      "Respond with JSON object that conforms to the JSON return schema. " +
      "\n\n" +
      "Parameters schema: " +
      JSON.stringify(options.parameters) +
      "\n" +
      "Return schema: " +
      JSON.stringify(returnSchema) +
      "\n" +
      "Function arguments: " +
      JSON.stringify(args) +
      "\n\n" +
      instructions;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    messages.push({ role: "system", content: systemMessage });
    messages.push({ role: "user", content: userMessage });

    while (true) {
      const request = {
        model: this.#modelName,
        messages,
        ...(tools !== undefined ? { tools } : undefined),
        response_format: { type: "json_object" },
      } satisfies OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

      const response = await this.#dispatcher.enqueue(() => {
        return this.#client.chat.completions.create(request);
      });

      const choice = response.choices[0]!;

      const responseMessage = choice.message;
      messages.push(responseMessage);

      const toolCalls = responseMessage.tool_calls;
      if (toolCalls !== undefined) {
        for (const toolCall of toolCalls) {
          const toolCallDescriptor = toolCall.function;
          const toolArguments = JSON.parse(
            toolCallDescriptor.arguments,
          ) as Record<string, unknown>;
          const tool = options.tools!.find(
            (tool) => tool.function.name === toolCallDescriptor.name,
          )!;
          const toolArgs: unknown[] = [];
          for (const key in toolArguments) {
            toolArgs.push(toolArguments[key]);
          }
          const toolReturn = await tool.callable!.call(null, ...toolArgs);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolReturn),
          });
        }
        continue;
      }

      let value: T;
      if (returnWrapper) {
        value = (JSON.parse(responseMessage.content!) as { return: T }).return;
      } else {
        value = JSON.parse(responseMessage.content!) as T;
      }
      return value;
    }
  }
}

export type { OpenAIGenerativeModelName, OpenAIGenerativeModelOptions };
export { OpenAIGenerativeModel };
