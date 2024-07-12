import type { ToolDescriptor, ToolFunction } from "./tool.ts";
import { Tool } from "./tool.ts";
import { Toolcog } from "./toolcog.ts";

interface UseToolOptions {
  descriptor?: ToolDescriptor | undefined;
}

const useTool: {
  (func: ToolFunction, options?: UseToolOptions): Tool;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  (func: ToolFunction, options?: UseToolOptions): Tool => {
    const descriptor = options?.descriptor;
    if (descriptor === undefined) {
      throw new Error("Uncompiled tool");
    }

    let tool: Tool = Object.assign(
      (...args: unknown[]): unknown => {
        return func.call(undefined, ...args);
      },
      {
        [Tool.descriptor]: descriptor,
      },
    );

    const toolcog = Toolcog.get();
    if (toolcog !== undefined) {
      tool = toolcog.useTool(tool, options);
    }

    return tool;
  },
  {
    brand: Symbol("toolcog.useTool"),
  },
) as typeof useTool;

export type { UseToolOptions };
export { useTool };
