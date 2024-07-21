import { OpenAI } from "openai";
import type { DispatcherOptions } from "@toolcog/util/task";
import { Dispatcher } from "@toolcog/util/task";
import type { GenerateOptions, GenerativeModel } from "@toolcog/core";
import { Tool, Thread } from "@toolcog/core";
import { GenerativeFunction, Job } from "@toolcog/runtime";
import type { ChatCompletion } from "./chat-completion.ts";
import { createChatCompletion } from "./chat-completion.ts";

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

  instruct<T = string>(
    instructions?: string,
    args?: unknown,
    options?: GenerateOptions,
  ): Promise<T> {
    return this.prompt<T>(instructions, args, options);
  }

  async prompt<T>(
    instructions?: string,
    args?: unknown,
    options?: GenerateOptions,
  ): Promise<T> {
    if (options === undefined) {
      throw new Error("Uncompiled prompt");
    }

    const generativeFunction = new GenerativeFunction({
      instructions: instructions ?? options.instructions,
      parameters: options.parameters,
      return: options.return,
      tools: options.tools,
      resultType: "object",
    });

    let tools: OpenAI.ChatCompletionTool[] | undefined;
    if (
      options.tools !== undefined &&
      options.tools !== null &&
      options.tools.length !== 0
    ) {
      tools = options.tools.map((tool) => {
        return {
          type: "function",
          function: tool[Tool.descriptor] as OpenAI.FunctionDefinition,
        } satisfies OpenAI.ChatCompletionTool;
      });
    }

    const thread = await Thread.getOrCreate();

    thread.addMessage({
      role: "user",
      content: generativeFunction.prompt(args),
    });

    while (true) {
      const request = {
        model: this.#modelName,
        messages: thread.messages as OpenAI.ChatCompletionMessageParam[],
        ...(tools !== undefined ? { tools } : undefined),
        ...(generativeFunction.resultSchema !== null ?
          { response_format: { type: "json_object" } }
        : undefined),
        stream: this.#streaming,
        ...(this.#streaming ?
          {
            stream_options: {
              include_usage: true,
            },
          }
        : undefined),
      } satisfies OpenAI.ChatCompletionCreateParams;

      let response: ChatCompletion | undefined;

      await Job.run(
        {
          icon: "≡",
          title: options.title ?? this.modelName,
          status: "...",
        },
        async (job) => {
          for await (response of createChatCompletion(this.#client, request, {
            signal: options.signal,
          })) {
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
        throw new Error("interrupted");
      }

      const message = choice.message;

      thread.addMessage(message);

      if (choice.finish_reason === "tool_calls") {
        const toolResults = message.tool_calls?.map((toolCall) => {
          const toolFunction = toolCall.function;
          return Job.run(
            {
              icon: "⚙",
              title: toolFunction.name,
            },
            async (toolJob) => {
              const toolThread = await Thread.create();
              return Thread.run(toolThread, async () => {
                const result = await generativeFunction.callTool(
                  toolFunction.name,
                  toolFunction.arguments,
                );
                toolJob.finish(result);
                return {
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: result,
                } as const;
              });
            },
          );
        });

        if (toolResults !== undefined) {
          for (const toolResult of await Promise.all(toolResults)) {
            thread.addMessage(toolResult);
          }
        }

        continue;
      }

      return generativeFunction.parseResult(message.content ?? "") as T;
    }
  }
}

export type { OpenAIGenerativeModelName, OpenAIGenerativeModelOptions };
export { OpenAIGenerativeModel };
