import { OpenAI } from "openai";
import type { DispatcherOptions } from "@toolcog/util/task";
import { Dispatcher } from "@toolcog/util/task";
import type { Schema } from "@toolcog/util/schema";
import type { GenerateOptions, GenerativeModel } from "@toolcog/core";
import { Job } from "@toolcog/runtime";

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

  streaming?: boolean | undefined;

  dispatcher?: Dispatcher | DispatcherOptions | undefined;
}

class OpenAIGenerativeModel implements GenerativeModel {
  static readonly DefaultModelName = "gpt-4o";

  static isSupportedModelName(modelName: string): boolean {
    return modelName.startsWith("gpt-");
  }

  readonly #client: OpenAI;

  readonly #modelName: OpenAIGenerativeModelName;

  readonly #streaming: boolean;

  readonly #dispatcher: Dispatcher;

  constructor(options?: OpenAIGenerativeModelOptions) {
    this.#client = options?.client ?? new OpenAI();
    this.#modelName =
      options?.modelName ?? OpenAIGenerativeModel.DefaultModelName;
    this.#streaming = options?.streaming ?? true;

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

  get streaming(): boolean {
    return this.#streaming;
  }

  get dispatcher(): Dispatcher {
    return this.#dispatcher;
  }

  generate<T = string>(args?: unknown, options?: GenerateOptions): Promise<T> {
    return Job.run(
      {
        icon: "≡",
        title: options?.title ?? "Generate",
        status: "pending",
      },
      (job) => this.#prompt<T>(job, undefined, args, options),
    );
  }

  prompt<T = string>(
    instructions?: string,
    args?: unknown,
    options?: GenerateOptions,
  ): Promise<T> {
    return Job.run(
      {
        icon: "≡",
        title: options?.title ?? "Generate",
        status: "pending",
      },
      (job) => this.#prompt<T>(job, instructions, args, options),
    );
  }

  async #prompt<T>(
    job: Job,
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

    let tools: OpenAI.ChatCompletionTool[] | undefined;
    if (options.tools !== undefined) {
      tools = options.tools.map((tool) => {
        return {
          type: tool.type,
          function: tool.function,
        } as OpenAI.ChatCompletionTool;
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

    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    messages.push({ role: "system", content: systemMessage });
    messages.push({ role: "user", content: userMessage });

    while (true) {
      let content: string | null | undefined;
      let toolCalls: OpenAI.ChatCompletionMessageToolCall[] | undefined;
      let message: OpenAI.ChatCompletionMessageParam;

      const request = {
        model: this.#modelName,
        messages,
        ...(tools !== undefined ? { tools } : undefined),
        response_format: { type: "json_object" },
      } satisfies OpenAI.ChatCompletionCreateParams;

      if (this.#streaming) {
        const stream = await this.#dispatcher.enqueue(() => {
          return this.#client.chat.completions.create({
            ...request,
            stream: true,
          });
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (delta === undefined) {
            continue;
          }

          const deltaContent = delta.content;
          if (typeof deltaContent === "string") {
            if (content === undefined) {
              content = deltaContent;
            } else {
              // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
              content += deltaContent;
            }

            job.update({
              status: content ?? "",
              ellipsize: -1,
            });
          }

          if (delta.tool_calls !== undefined) {
            if (toolCalls === undefined) {
              toolCalls = [];
            }
            for (const toolCallDelta of delta.tool_calls) {
              let toolCall = toolCalls[toolCallDelta.index];
              if (toolCall === undefined) {
                toolCall = {
                  id: toolCallDelta.id ?? "",
                  type: "function",
                  function: {
                    name: toolCallDelta.function?.name ?? "",
                    arguments: toolCallDelta.function?.arguments ?? "",
                  },
                };
                toolCalls[toolCallDelta.index] = toolCall;
                continue;
              }

              if (toolCallDelta.id !== undefined) {
                toolCall.id = toolCallDelta.id;
              }
              if (toolCallDelta.function !== undefined) {
                if (toolCallDelta.function.name !== undefined) {
                  toolCall.function.name = toolCallDelta.function.name;
                }
                if (toolCallDelta.function.arguments !== undefined) {
                  toolCall.function.arguments =
                    toolCallDelta.function.arguments;
                }
              }
            }
          }
        }

        message = {
          role: "assistant",
          ...(content !== undefined ? { content } : undefined),
          ...(toolCalls !== undefined ? { tool_calls: toolCalls } : undefined),
        };
      } else {
        const response = await this.#dispatcher.enqueue(() => {
          return this.#client.chat.completions.create(request);
        });

        message = response.choices[0]!.message;
        content = message.content;
        toolCalls = message.tool_calls;

        job.update({
          status: content ?? "",
          ellipsize: -1,
        });
      }

      messages.push(message);

      if (toolCalls !== undefined) {
        const toolResults = toolCalls.map((toolCall) => {
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
          return Job.run(
            {
              icon: "⚙",
              title: toolCallDescriptor.name,
            },
            async (toolJob) => {
              const toolReturn = await tool.callable!.call(null, ...toolArgs);
              const toolContent = JSON.stringify(toolReturn);
              toolJob.finish(toolContent);
              return {
                role: "tool",
                tool_call_id: toolCall.id,
                content: toolContent,
              } as const;
            },
          );
        });
        messages.push(...(await Promise.all(toolResults)));
        continue;
      }

      job.finish({
        status: undefined,
        ellipsize: 1,
      });

      let value: T;
      if (returnWrapper) {
        value = (JSON.parse(content!) as { return: T }).return;
      } else {
        value = JSON.parse(content!) as T;
      }
      return value;
    }
  }
}

export type { OpenAIGenerativeModelName, OpenAIGenerativeModelOptions };
export { OpenAIGenerativeModel };
