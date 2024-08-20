import type { ClientOptions } from "openai";
import { OpenAI } from "openai";
import { Dispatcher } from "@toolcog/util/task";
import type {
  GeneratorConfig,
  GeneratorOptions,
  Generator,
} from "@toolcog/core";
import { Thread } from "@toolcog/runtime";
import { GenerativeCall, Job } from "@toolcog/runtime";
import type { ChatCompletion } from "./chat-completion.ts";
import { createChatCompletion } from "./chat-completion.ts";

declare module "@toolcog/core" {
  // From OpenAI.ChatModel.
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
    streaming?: boolean | undefined;
  }

  interface GenerativeOptions {
    streaming?: boolean | undefined;
  }
}

interface OpenAIGeneratorConfig extends GeneratorConfig {
  openai?: OpenAI | ClientOptions | undefined;

  dispatcher?: Dispatcher | undefined;
}

interface OpenAIGeneratorOptions extends GeneratorOptions {
  openai?: OpenAI | ClientOptions | undefined;

  dispatcher?: Dispatcher | undefined;
}

const defaultGenerativeModel = "gpt-4o";

const generator = (options?: OpenAIGeneratorOptions): Generator | undefined => {
  const model = options?.model;
  if (model !== undefined) {
    if (model.startsWith("gpt-")) {
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

  const streaming = options?.streaming ?? true;

  const model = options?.model ?? defaultGenerativeModel;

  let instructions: string | undefined;
  if (typeof args === "string") {
    instructions = args;
    args = undefined;
  }

  const generativeCall = await GenerativeCall.create(args, {
    tools: options?.tools,
    instructions: instructions ?? options?.instructions,
    function: options?.function,
    resultType: "object",
  });

  let tools: OpenAI.ChatCompletionTool[] | undefined;
  if (generativeCall.tools !== null) {
    tools = generativeCall.tools.map((tool) => {
      return {
        type: "function",
        function: tool.function as OpenAI.FunctionDefinition,
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
      model,
      messages: thread.messages as OpenAI.ChatCompletionMessageParam[],
      ...(tools !== undefined && tools.length !== 0 ? { tools } : undefined),
      ...(generativeCall.resultSchema !== null ?
        {
          response_format: {
            type: "json_object",
          },
        }
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
      const toolResults = message.tool_calls?.map((toolCall) => {
        const toolFunction = toolCall.function;
        const tool = generativeCall.findTool(toolFunction.name)!;
        return Job.run(
          {
            icon: "⚙",
            title: tool.id,
          },
          async (toolJob) => {
            const toolThread = await Thread.create();
            return Thread.run(toolThread, async () => {
              const result = await generativeCall.callTool(
                tool,
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
}) satisfies Generator;

export type { OpenAIGeneratorConfig, OpenAIGeneratorOptions };
export { generator, generate };
