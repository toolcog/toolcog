import { OpenAI } from "openai";

type ChatCompletionChoice = Omit<
  OpenAI.ChatCompletion.Choice,
  "finish_reason"
> & {
  finish_reason:
    | "stop"
    | "length"
    | "tool_calls"
    | "content_filter"
    | "function_call"
    | null;
};

type ChatCompletion = Omit<OpenAI.ChatCompletion, "choices"> & {
  choices: ChatCompletionChoice[];
};

const createChatCompletion = (
  client: OpenAI,
  body: OpenAI.ChatCompletionCreateParams,
  options?: OpenAI.RequestOptions,
): AsyncIterableIterator<ChatCompletion> => {
  if (body.stream === true) {
    return createChatCompletionStreaming(client, body, options);
  } else {
    return createChatCompletionNonStreaming(client, body, options);
  }
};

async function* createChatCompletionNonStreaming(
  client: OpenAI,
  body: OpenAI.ChatCompletionCreateParamsNonStreaming,
  options?: OpenAI.RequestOptions,
): AsyncIterableIterator<ChatCompletion> {
  yield client.chat.completions.create(body, options);
}

async function* createChatCompletionStreaming(
  client: OpenAI,
  body: OpenAI.ChatCompletionCreateParamsStreaming,
  options?: OpenAI.RequestOptions,
): AsyncIterableIterator<ChatCompletion> {
  const stream = await client.chat.completions.create(body, options);

  let abortListener: (() => void) | undefined;
  if (options?.signal !== undefined && options.signal !== null) {
    options.signal.throwIfAborted();
    abortListener = () => stream.controller.abort();
    options.signal.addEventListener("abort", abortListener, {
      once: true,
    });
  }

  const choices: ChatCompletionChoice[] = [];

  try {
    for await (const chunk of stream) {
      for (const choiceDelta of chunk.choices) {
        const choiceIndex = choiceDelta.index;
        const messageDelta = choiceDelta.delta;
        const toolCallsDelta = messageDelta.tool_calls;

        let choice = choices[choiceIndex];
        if (choice === undefined) {
          choice = {
            index: choiceDelta.index,
            message: {
              role: "assistant",
              refusal: null,
              content: null,
            },
            logprobs: null,
            finish_reason: null,
          };
          choices[choiceIndex] = choice;
        }
        const message = choice.message;

        if (typeof messageDelta.content === "string") {
          if (message.content === null) {
            message.content = messageDelta.content;
          } else {
            message.content += messageDelta.content;
          }
        }

        if (typeof messageDelta.refusal === "string") {
          if (message.refusal === null) {
            message.refusal = messageDelta.refusal;
          } else {
            message.refusal += messageDelta.refusal;
          }
        }

        if (toolCallsDelta !== undefined) {
          let toolCalls = message.tool_calls;
          if (toolCalls === undefined) {
            toolCalls = [];
            message.tool_calls = toolCalls;
          }

          for (const toolCallDelta of toolCallsDelta) {
            const toolCallIndex = toolCallDelta.index;
            const toolFunctionDelta = toolCallDelta.function;

            let toolCall = toolCalls[toolCallIndex];
            if (toolCall === undefined) {
              toolCall = {
                id: toolCallDelta.id!,
                type: "function",
                function: {
                  name: undefined,
                  arguments: "",
                } as unknown as OpenAI.ChatCompletionMessageToolCall.Function,
              };
              toolCalls[toolCallIndex] = toolCall;
            }
            const toolFunction = toolCall.function;

            if (toolFunctionDelta?.name !== undefined) {
              toolFunction.name = toolFunctionDelta.name;
            }
            if (toolFunctionDelta?.arguments !== undefined) {
              toolFunction.arguments += toolFunctionDelta.arguments;
            }
          }
        }

        if (choiceDelta.logprobs !== undefined) {
          choice.logprobs = choiceDelta.logprobs;
        }
        if (choiceDelta.finish_reason !== null) {
          choice.finish_reason = choiceDelta.finish_reason;
        }
      }

      yield {
        id: chunk.id,
        object: "chat.completion",
        created: chunk.created,
        model: chunk.model,
        ...(chunk.system_fingerprint !== undefined ?
          { system_fingerprint: chunk.system_fingerprint }
        : undefined),
        choices,
        ...(chunk.service_tier !== undefined ?
          { service_tier: chunk.service_tier }
        : undefined),
        ...(chunk.usage !== undefined ? { usage: chunk.usage } : undefined),
      };
    }
  } finally {
    options?.signal?.removeEventListener("abort", abortListener!);
  }
}

export type { ChatCompletion };
export { createChatCompletion };
