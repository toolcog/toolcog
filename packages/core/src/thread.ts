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

  const create = (): Thread => {
    return {
      messages: [],
      addMessage(message: Message): void {
        (this.messages as Message[]).push(message);
      },
    };
  };

  const get = (): Thread | undefined => {
    return threadVariable.get();
  };

  const getOrCreate = (): Thread => {
    let thread = get();
    if (thread === undefined) {
      thread = create();
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
  };
})();

export { Thread };
