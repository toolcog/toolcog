import { AsyncContext } from "@toolcog/util/async";
import type { ToolSource } from "@toolcog/core";

const toolsVariable = new AsyncContext.Variable<ToolSource[]>({
  name: "toolcog.tools",
});

const currentTools = (): ToolSource[] => {
  return toolsVariable.get() ?? [];
};

const withTools = <F extends (...args: any[]) => unknown>(
  tools: ToolSource[],
  func: F,
  ...args: Parameters<F>
): ReturnType<F> => {
  return toolsVariable.run(tools, func, ...args);
};

const useTool = <const T extends ToolSource>(tool: T): T => {
  const currentTools = toolsVariable.get();
  if (currentTools === undefined) {
    throw new Error("No current tools scope");
  }
  currentTools.push(tool);
  return tool;
};

const useTools = <const T extends readonly ToolSource[]>(tools: T): T => {
  const currentTools = toolsVariable.get();
  if (currentTools === undefined) {
    throw new Error("No current tools scope");
  }
  currentTools.push(...tools);
  return tools;
};

export { currentTools, withTools, useTool, useTools };
