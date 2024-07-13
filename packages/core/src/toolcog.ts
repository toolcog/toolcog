import { AsyncContext } from "@toolcog/util/async";
import type { Message } from "./message.ts";
import type { Tool } from "./tool.ts";
import type { Thread } from "./thread.ts";
import type { UseToolOptions } from "./use-tool.ts";
import type { GenerativeModel } from "./generative-model.ts";
import type { EmbeddingModel } from "./embedding-model.ts";

interface Toolcog {
  createThread(messages?: Message[]): Thread;

  useTool(tool: Tool, options?: UseToolOptions): Tool;

  getGenerativeModel(modelId?: string): Promise<GenerativeModel>;

  getEmbeddingModel(modelId?: string): Promise<EmbeddingModel>;
}

const Toolcog = (() => {
  const toolcogVariable = new AsyncContext.Variable<Toolcog>({
    name: "toolcog",
  });

  let runtime: Toolcog | undefined;

  const load = async (): Promise<Toolcog> => {
    try {
      const { Runtime } = await import("@toolcog/runtime");
      return new Runtime() as Toolcog;
    } catch {
      throw new Error('Unable to load "@toolcog/runtime"');
    }
  };

  const global = async (): Promise<Toolcog> => {
    if (runtime === undefined) {
      runtime = await load();
    }
    return runtime;
  };

  const current = async (): Promise<Toolcog> => {
    let toolcog = toolcogVariable.get();
    if (toolcog === undefined) {
      toolcog = await global();
    }
    return toolcog;
  };

  const get = (): Toolcog | undefined => {
    return toolcogVariable.get();
  };

  const run = <F extends (...args: any[]) => unknown>(
    toolcog: Toolcog,
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> => {
    return toolcogVariable.run(toolcog, func, ...args);
  };

  return {
    global,
    current,
    get,
    run,
  };
})();

export { Toolcog };
