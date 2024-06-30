import type { ToolFunction, FunctionTool, FunctionDescriptor } from "./tool.ts";
import { Context } from "./context.ts";

interface UseToolOptions {
  function?: FunctionDescriptor | undefined;
}

interface UseTool extends FunctionTool {
  readonly [useTool.brand]: unknown;
}

const useToolBrand: unique symbol = Symbol("toolcog.useTool");

const useTool: {
  (callable: ToolFunction, options?: UseToolOptions): UseTool;

  /** @internal */
  readonly brand: unique symbol;

  /** @internal */
  readonly [useToolBrand]: unknown;
} = Object.assign(
  (callable: ToolFunction, options?: UseToolOptions): UseTool => {
    const descriptor = options?.function;
    if (descriptor === undefined) {
      throw new Error("Uncompiled tool");
    }

    let tool = {
      type: "function",
      function: descriptor,
      callable,
    } as UseTool;

    const context = Context.get();
    if (context !== undefined) {
      tool = context.useTool(tool, options) as UseTool;
    }

    return tool;
  },
  {
    brand: Symbol("toolcog.useTool"),
    [useToolBrand]: null,
  },
) as typeof useTool;

export type { UseToolOptions, UseTool };
export { useTool };
