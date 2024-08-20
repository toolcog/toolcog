import { AsyncContext } from "@toolcog/util/async";
import type { Tool } from "@toolcog/core";

const toolsVariable = new AsyncContext.Variable<Tool[]>({
  name: "toolcog.tools",
});

const currentTools = (): Tool[] => {
  return toolsVariable.get() ?? [];
};

const withTools = <F extends (...args: any[]) => unknown>(
  tools: Tool[],
  func: F,
  ...args: Parameters<F>
): ReturnType<F> => {
  return toolsVariable.run(tools, func, ...args);
};

const useTool = <const T extends Tool>(tool: T): T => {
  const currentTools = toolsVariable.get();
  if (currentTools === undefined) {
    throw new Error("No current tools scope");
  }
  currentTools.push(tool);
  return tool;
};

const useTools = <const T extends readonly Tool[]>(tools: T): T => {
  const currentTools = toolsVariable.get();
  if (currentTools === undefined) {
    throw new Error("No current tools scope");
  }
  currentTools.push(...tools);
  return tools;
};

export { currentTools, withTools, useTool, useTools };
