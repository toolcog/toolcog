import { AsyncContext } from "@toolcog/util/async";
import type { Message } from "./message.ts";
import { Toolcog } from "./toolcog.ts";

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
    const toolcog = await Toolcog.current();
    return toolcog.createThread(messages);
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

export { Thread };
