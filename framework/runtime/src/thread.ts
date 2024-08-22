import { AsyncContext } from "@toolcog/util/async";
import type { Message } from "./message.ts";

interface Thread {
  readonly messages: readonly Message[];

  addMessage(message: Message): void;
}

const Thread = (() => {
  const threadVariable = new AsyncContext.Variable<Thread>({
    name: "toolcog.thread",
  });

  const create = (messages?: Message[]): Promise<Thread> => {
    return Promise.resolve(new TemporaryThread(messages));
  };

  const get = (): Thread | null => {
    return threadVariable.get() ?? null;
  };

  const getOrCreate = async (): Promise<Thread> => {
    let thread = get();
    if (thread === null) {
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

  constructor(messages: Message[] = []) {
    this.#messages = messages;
  }

  get messages(): readonly Message[] {
    return this.#messages;
  }

  addMessage(message: Message): void {
    this.#messages.push(message);
  }
}

export { Thread, TemporaryThread };
