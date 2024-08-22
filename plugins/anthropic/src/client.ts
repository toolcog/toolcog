import { Anthropic } from "@anthropic-ai/sdk";

const createMessage = (
  client: Anthropic,
  body: Anthropic.MessageCreateParams,
  options?: Anthropic.RequestOptions,
): AsyncIterableIterator<Anthropic.Message> => {
  if (body.stream === true) {
    return createMessageStreaming(client, body, options);
  } else {
    return createMessageNonStreaming(client, body, options);
  }
};

async function* createMessageNonStreaming(
  client: Anthropic,
  body: Anthropic.MessageCreateParamsNonStreaming,
  options?: Anthropic.RequestOptions,
): AsyncIterableIterator<Anthropic.Message> {
  yield client.messages.create(body, options);
}

async function* createMessageStreaming(
  client: Anthropic,
  body: Anthropic.MessageCreateParamsStreaming,
  options?: Anthropic.RequestOptions,
): AsyncIterableIterator<Anthropic.Message> {
  const stream = client.messages.stream(body, options);

  let abortListener: (() => void) | undefined;
  if (options?.signal !== undefined && options.signal !== null) {
    options.signal.throwIfAborted();
    abortListener = () => stream.controller.abort();
    options.signal.addEventListener("abort", abortListener, {
      once: true,
    });
  }

  try {
    for await (const _ of stream) {
      if (stream.currentMessage !== undefined) {
        yield stream.currentMessage;
      }
    }
  } finally {
    options?.signal?.removeEventListener("abort", abortListener!);
  }
}

export { createMessage };
