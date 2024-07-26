import { AsyncContext } from "@toolcog/util/async";
import type { Message, SystemMessage } from "./message.ts";
import { Runtime } from "./runtime.ts";

interface Thread {
  readonly messages: readonly Message[];

  addMessage(message: Message): void;
}

const Thread = (() => {
  const threadVariable = new AsyncContext.Variable<Thread>({
    name: "toolcog.thread",
  });

  const get = (): Thread | undefined => {
    return threadVariable.get();
  };

  const create = async (messages?: Message[]): Promise<Thread> => {
    const runtime = Runtime.current();
    return runtime.createThread(messages);
  };

  const getOrCreate = async (): Promise<Thread> => {
    let thread = get();
    if (thread === undefined) {
      thread = await create();
    }
    return thread;
  };

  const run = <F extends (...args: any[]) => unknown>(
    thread: Thread,
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> => {
    return threadVariable.run(thread, func, ...args);
  };

  return {
    create,
    get,
    getOrCreate,
    run,
  } as const;
})();

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

export { Thread, TemporaryThread };
