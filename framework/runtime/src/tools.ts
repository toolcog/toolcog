import { AsyncContext } from "@toolcog/util/async";
import type { Tools } from "@toolcog/core";

const toolsVariable = new AsyncContext.Variable<Tools[]>({
  name: "toolcog.tools",
});

const currentTools = (): readonly Tools[] => {
  return toolsVariable.get() ?? [];
};

const withTools = <F extends (...args: any[]) => unknown>(
  tools: Tools[],
  func: F,
  ...args: Parameters<F>
): ReturnType<F> => {
  return toolsVariable.run(tools, func, ...args);
};

const useTool = <T extends Tools>(tools: T): T => {
  const currentTools = toolsVariable.get();
  if (currentTools === undefined) {
    throw new Error("No current tools scope");
  }
  currentTools.push(tools);
  return tools;
};

export { currentTools, withTools, useTool };
