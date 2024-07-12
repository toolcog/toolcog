import type { Schema } from "@toolcog/util/schema";

interface ToolDescriptor {
  readonly name: string;
  readonly description?: string | undefined;
  readonly parameters?: Schema | undefined;
  readonly return?: Schema | undefined;
}

interface ToolFunction {
  (...args: any[]): unknown;

  readonly [Tool.descriptor]?: ToolDescriptor;
}

interface Tool extends ToolFunction {
  readonly [Tool.descriptor]: ToolDescriptor;
}

const Tool: {
  readonly descriptor: unique symbol;

  [Symbol.hasInstance](value: unknown): value is Tool;
} = {
  descriptor: Symbol("toolcog.tool"),

  [Symbol.hasInstance](value: unknown): value is Tool {
    return typeof value === "function" && Tool.descriptor in value;
  },
} as typeof Tool;

export type { ToolFunction, ToolDescriptor };
export { Tool };
