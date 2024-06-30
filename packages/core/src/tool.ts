import type { Schema } from "@toolcog/util/schema";

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type ToolFunction = (...args: any[]) => Promise<unknown> | unknown;

interface FunctionTool {
  readonly type: "function";
  readonly function: FunctionDescriptor;
  readonly callable?: ToolFunction | undefined;
}

interface FunctionDescriptor {
  readonly name: string;
  readonly description?: string | undefined;
  readonly parameters?: Schema | undefined;
  readonly return?: Schema | undefined;
}

export type { ToolFunction, FunctionTool, FunctionDescriptor };
