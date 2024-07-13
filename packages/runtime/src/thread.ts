import type { Message, SystemMessage, Thread } from "@toolcog/core";

class TemporaryThread implements Thread {
  readonly #messages: Message[];

  constructor(messages?: Message[]) {
    if (messages === undefined) {
      messages = [(this.constructor as typeof TemporaryThread).systemMessage];
    }
    this.#messages = messages;
  }

  get messages(): readonly Message[] {
    return this.#messages;
  }

  addMessage(message: Message): void {
    this.#messages.push(message);
  }

  static readonly systemMessage: SystemMessage = {
    role: "system",
    content: "You are an AI function embedded in a computer program.",
  };
}

export { TemporaryThread };
