import { OpenAI } from "openai";
import type { DispatcherOptions } from "@toolcog/util/task";
import { Dispatcher } from "@toolcog/util/task";
import type { Schema } from "@toolcog/util/schema";
import type { Message, GenerateOptions, GenerativeModel } from "@toolcog/core";
import { Tool, Thread } from "@toolcog/core";
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
    return this.prompt<T>(undefined, args, options);
  }

  async prompt<T>(
    instructions?: string,
    args?: unknown,
    options?: GenerateOptions,
  ): Promise<T> {
    if (options === undefined) {
      throw new Error("Uncompiled prompt");
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
    if (options.tools !== undefined && options.tools.length !== 0) {
      tools = options.tools.map((tool) => {
        return {
          type: "function",
          function: tool[Tool.descriptor] as OpenAI.FunctionDefinition,
        } satisfies OpenAI.ChatCompletionTool;
      });
    }

    if (instructions === undefined) {
      instructions = options.instructions;
    }
    if (instructions === undefined) {
      instructions = "Use the function arguments to generate a response.";
    }

    const userMessage =
      "Use the following JSON parameters schema to interpret the JSON function arguments. " +
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

    const thread = await Thread.getOrCreate();
    thread.addMessage({ role: "user", content: userMessage });

    while (true) {
      let content: string | null | undefined;
      let toolCalls: OpenAI.ChatCompletionMessageToolCall[] | undefined;
      let message: OpenAI.ChatCompletionMessageParam | undefined;
      let tokenCount = 0;
      let finishReason = null as
        | "stop"
        | "length"
        | "tool_calls"
        | "content_filter"
        | "function_call"
        | null;

      const request = {
        model: this.#modelName,
        messages: thread.messages as OpenAI.ChatCompletionMessageParam[],
        ...(tools !== undefined ? { tools } : undefined),
        response_format: { type: "json_object" },
      } satisfies OpenAI.ChatCompletionCreateParams;
      const requestOptions = {
        signal: options.signal,
      } satisfies OpenAI.RequestOptions;

      await Job.run(
        {
          icon: "≡",
          title: options.title ?? this.modelName,
          status: "...",
        },
        async (job) => {
          if (this.#streaming) {
            const stream = await this.#dispatcher.enqueue(() => {
              return this.#client.chat.completions.create(
                {
                  ...request,
                  stream: true,
                  stream_options: {
                    include_usage: true,
                  },
                },
                requestOptions,
              );
            });

            let abortListener: (() => void) | undefined;
            if (options.signal !== undefined) {
              options.signal.throwIfAborted();
              abortListener = () => stream.controller.abort();
              options.signal.addEventListener("abort", abortListener, {
                once: true,
              });
            }

            try {
              for await (const chunk of stream) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (chunk.usage !== undefined && chunk.usage !== null) {
                  tokenCount += chunk.usage.total_tokens;
                }

                const choice = chunk.choices[0];
                if (choice !== undefined) {
                  finishReason = choice.finish_reason;
                }

                const delta = choice?.delta;
                if (delta === undefined) {
                  continue;
                }

                const deltaContent = delta.content;
                if (typeof deltaContent === "string") {
                  if (content === undefined) {
                    content = deltaContent;
                  } else {
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
                        toolCall.function.arguments +=
                          toolCallDelta.function.arguments;
                      }
                    }
                  }
                }
              }
            } finally {
              options.signal?.removeEventListener("abort", abortListener!);
            }

            message = {
              role: "assistant",
              ...(content !== undefined ? { content } : undefined),
              ...(toolCalls !== undefined ?
                { tool_calls: toolCalls }
              : undefined),
            };
          } else {
            const response = await this.#dispatcher.enqueue(() => {
              return this.#client.chat.completions.create(
                request,
                requestOptions,
              );
            });

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (response.usage !== undefined && response.usage !== null) {
              tokenCount += response.usage.total_tokens;
            }

            const choice = response.choices[0];
            if (choice !== undefined) {
              finishReason = choice.finish_reason;
            }

            message = choice!.message;
            content = message.content;
            toolCalls = message.tool_calls;

            job.update({
              status: content ?? "",
              ellipsize: -1,
            });
          }

          job.update({
            status: tokenCount === 1 ? "<1 token>" : `<${tokenCount} tokens>`,
            ellipsize: 1,
          });

          job.finish();
        },
      );

      // Check if the request was aborted.
      if (finishReason === null) {
        throw new Error("interrupted");
      }

      thread.addMessage(message as Message);

      if (finishReason === "tool_calls") {
        const toolResults = toolCalls!.map((toolCall) => {
          const toolCallDescriptor = toolCall.function;
          const toolArguments = JSON.parse(
            toolCallDescriptor.arguments,
          ) as Record<string, unknown>;
          const tool = options.tools!.find((tool) => {
            return tool[Tool.descriptor]!.name === toolCallDescriptor.name;
          })!;
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
              const toolThread = await Thread.create();
              const toolReturn = await Thread.run(toolThread, () => {
                return Promise.resolve(tool.call(null, ...toolArgs));
              });
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
        for (const toolResult of await Promise.all(toolResults)) {
          thread.addMessage(toolResult);
        }
        continue;
      }

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
