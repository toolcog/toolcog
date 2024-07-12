import { AsyncContext } from "@toolcog/util/async";
import type { Tool } from "./tool.ts";
import type { UseToolOptions } from "./use-tool.ts";
import type { GenerativeModel } from "./generative-model.ts";
import type { EmbeddingModel } from "./embedding-model.ts";

interface Context {
  useTool(tool: Tool, options?: UseToolOptions): Tool;

  getGenerativeModel(modelId?: string): Promise<GenerativeModel>;

  getEmbeddingModel(modelId?: string): Promise<EmbeddingModel>;
}

const Context = (() => {
  const contextVariable = new AsyncContext.Variable<Context>({
    name: "toolcog.context",
  });

  let runtime: Context | undefined;

  const load = async (): Promise<Context> => {
    try {
      const { Runtime } = await import("@toolcog/runtime");
      return new Runtime() as Context;
    } catch {
      throw new Error('Unable to load "@toolcog/runtime"');
    }
  };

  const global = async (): Promise<Context> => {
    if (runtime === undefined) {
      runtime = await load();
    }
    return runtime;
  };

  const current = async (): Promise<Context> => {
    let context = contextVariable.get();
    if (context === undefined) {
      context = await global();
    }
    return context;
  };

  const get = (): Context | undefined => {
    return contextVariable.get();
  };

  const run = <F extends (...args: any[]) => unknown>(
    context: Context,
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> => {
    return contextVariable.run(context, func, ...args);
  };

  return {
    global,
    current,
    get,
    run,
  };
})();

export type { UseToolOptions };
export { Context };
