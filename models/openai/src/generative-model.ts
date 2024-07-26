import { OpenAI } from "openai";
import type { DispatcherOptions } from "@toolcog/util/task";
import { Dispatcher } from "@toolcog/util/task";
import type { GenerativeModelOptions, GenerativeModel } from "@toolcog/core";
import { mapTools } from "@toolcog/core";
import { Thread } from "@toolcog/runtime";
import { GenerativeCall, Job } from "@toolcog/runtime";
import type { ChatCompletion } from "./chat-completion.ts";
import { createChatCompletion } from "./chat-completion.ts";

type GenerativeModelName =
  | "gpt-3.5-turbo"
  | "gpt-4"
  | "gpt-4-turbo"
  | "gpt-4o"
  | "gpt-4o-mini"
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

interface GenerativeModelConfig {
  client?: OpenAI | undefined;

  modelName?: GenerativeModelName | undefined;

  streaming?: boolean | undefined;

  dispatcher?: Dispatcher | DispatcherOptions | undefined;
}

const defaultGenerativeModel = "gpt-4o-mini";

const supportsGenerativeModel = (modelName: string): boolean => {
  return modelName.startsWith("gpt-");
};

const generativeModel = (async (
  args: unknown,
  options?: GenerativeModelOptions,
  config?: GenerativeModelConfig,
): Promise<unknown> => {
  const client = config?.client ?? new OpenAI();

  const modelName = config?.modelName ?? defaultGenerativeModel;

  const streaming = config?.streaming ?? true;

  const dispatcher =
    config?.dispatcher instanceof Dispatcher ?
      config.dispatcher
    : new Dispatcher(config?.dispatcher ?? { retry: false });

  let instructions: string | undefined;
  if (typeof args === "string") {
    instructions = args;
    args = undefined;
  }

  const generativeCall = new GenerativeCall({
    instructions: instructions ?? options?.instructions,
    tools: options?.tools,
    descriptor: options?.descriptor,
    resultType: "object",
  });

  let tools: OpenAI.ChatCompletionTool[] | undefined;
  if (
    options?.tools !== undefined &&
    options.tools !== null &&
    options.tools.length !== 0
  ) {
    tools = mapTools(options.tools, (tool) => {
      return {
        type: "function",
        function: tool.descriptor as OpenAI.FunctionDefinition,
      } satisfies OpenAI.ChatCompletionTool;
    });
  }

  const thread = await Thread.getOrCreate();

  thread.addMessage({
    role: "user",
    content: generativeCall.prompt(args),
  });

  while (true) {
    const request = {
      model: modelName,
      messages: thread.messages as OpenAI.ChatCompletionMessageParam[],
      ...(tools !== undefined ? { tools } : undefined),
      ...(generativeCall.resultSchema !== null ?
        { response_format: { type: "json_object" } }
      : undefined),
      stream: streaming,
      ...(streaming ?
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
        title: options?.title ?? modelName,
        status: "...",
      },
      async (job) => {
        const completion = await dispatcher.enqueue(
          () => {
            return createChatCompletion(client, request, {
              signal: options?.signal,
            });
          },
          { signal: options?.signal },
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
              const result = await generativeCall.callTool(
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

    return generativeCall.parseResult(message.content ?? "");
  }
}) satisfies GenerativeModel;

export type { GenerativeModelName, GenerativeModelConfig };
export { supportsGenerativeModel, generativeModel };
