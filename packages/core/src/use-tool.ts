import type { ToolDescriptor, ToolFunction } from "./tool.ts";
import { Tool } from "./tool.ts";
import { Context } from "./context.ts";

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

    const context = Context.get();
    if (context !== undefined) {
      tool = context.useTool(tool, options);
    }

    return tool;
  },
  {
    brand: Symbol("toolcog.useTool"),
  },
) as typeof useTool;

export type { UseToolOptions };
export { useTool };
