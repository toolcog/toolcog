import type { Schema } from "@toolcog/util/schema";

/** @internal */
type ToolFunction = (...args: any[]) => unknown;

/** @internal */
type ToolFunctions =
  | ToolFunction
  | readonly ToolFunctions[]
  | { readonly [key: string]: ToolFunctions };

interface ToolDescriptor {
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly parameters?: Schema | undefined;
  readonly return?: Schema | undefined;
}

interface Tool<F extends ToolFunction = ToolFunction> {
  (...args: Parameters<F>): ReturnType<F>;

  readonly descriptor: ToolDescriptor;
}

type Tools<F extends ToolFunctions = ToolFunctions> =
  // Handle `ToolFunction` case.
  F extends ToolFunction ? Tool<F>
  : // Handle `ToolFunctions[]` cases.
  F extends [] ? []
  : F extends [infer Elem] ?
    Elem extends ToolFunctions ?
      [Tools<Elem>]
    : never
  : F extends [infer Head, ...infer Tail] ?
    [
      Head extends ToolFunctions ? Tools<Head> : never,
      ...(Tail extends readonly ToolFunctions[] ? Tools<Tail> : never),
    ]
  : F extends [...infer Body, infer Foot] ?
    [
      ...(Body extends readonly ToolFunctions[] ? Tools<Body> : never),
      Foot extends ToolFunctions ? Tools<Foot> : never,
    ]
  : F extends (infer Elem)[] ?
    Elem extends ToolFunctions ?
      Tools<Elem>[]
    : never
  : // Handle `readonly ToolFunctions[]` cases.
  F extends readonly [] ? readonly []
  : F extends readonly [infer Elem] ?
    Elem extends ToolFunctions ?
      readonly [Tools<Elem>]
    : never
  : F extends readonly [infer Head, ...infer Tail] ?
    readonly [
      Head extends ToolFunctions ? Tools<Head> : never,
      ...(Tail extends readonly ToolFunctions[] ? Tools<Tail> : never),
    ]
  : F extends readonly [...infer Body, infer Foot] ?
    readonly [
      ...(Body extends readonly ToolFunctions[] ? Tools<Body> : never),
      Foot extends ToolFunctions ? Tools<Foot> : never,
    ]
  : F extends readonly (infer Elem)[] ?
    Elem extends ToolFunctions ?
      readonly Tools<Elem>[]
    : never
  : // Handle `{ [key: string]: ToolFunctions }` cases.
  F extends { readonly [key: string]: ToolFunctions } ?
    {
      [K in keyof F]: Tools<F[K]>;
    }
  : never;

interface UseTool<F extends ToolFunction = ToolFunction> extends Tool<F> {
  readonly implicit: true | undefined;
}

type UseTools<F extends ToolFunctions = ToolFunctions> =
  // Handle `ToolFunction` case.
  F extends ToolFunction ? UseTool<F>
  : // Handle `ToolFunctions[]` cases.
  F extends [] ? []
  : F extends [infer Elem] ?
    Elem extends ToolFunctions ?
      [UseTools<Elem>]
    : never
  : F extends [infer Head, ...infer Tail] ?
    [
      Head extends ToolFunctions ? UseTools<Head> : never,
      ...(Tail extends readonly ToolFunctions[] ? UseTools<Tail> : never),
    ]
  : F extends [...infer Body, infer Foot] ?
    [
      ...(Body extends readonly ToolFunctions[] ? UseTools<Body> : never),
      Foot extends ToolFunctions ? UseTools<Foot> : never,
    ]
  : F extends (infer Elem)[] ?
    Elem extends ToolFunctions ?
      UseTools<Elem>[]
    : never
  : // Handle `readonly ToolFunctions[]` cases.
  F extends readonly [] ? readonly []
  : F extends readonly [infer Elem] ?
    Elem extends ToolFunctions ?
      readonly [UseTools<Elem>]
    : never
  : F extends readonly [infer Head, ...infer Tail] ?
    readonly [
      Head extends ToolFunctions ? UseTools<Head> : never,
      ...(Tail extends readonly ToolFunctions[] ? UseTools<Tail> : never),
    ]
  : F extends readonly [...infer Body, infer Foot] ?
    readonly [
      ...(Body extends readonly ToolFunctions[] ? UseTools<Body> : never),
      Foot extends ToolFunctions ? UseTools<Foot> : never,
    ]
  : F extends readonly (infer Elem)[] ?
    Elem extends ToolFunctions ?
      readonly UseTools<Elem>[]
    : never
  : // Handle `{ [key: string]: ToolFunctions }` cases.
  F extends { readonly [key: string]: ToolFunctions } ?
    {
      [K in keyof F]: UseTools<F[K]>;
    }
  : never;

const defineTool: {
  <F extends ToolFunction>(func: F): Tool<F>;
  <F extends readonly ToolFunctions[]>(funcs: [...F]): Tools<F>;
  <F extends { readonly [key: string]: ToolFunctions }>(funcs: F): Tools<F>;
  <F extends ToolFunctions>(funcs: F): Tools<F>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <F extends ToolFunctions>(funcs: F): Tools<F> => {
    throw new Error("Uncompiled tool");
  },
  {
    brand: Symbol("toolcog.defineTool"),
  } as const,
) as typeof defineTool;

const useTool: {
  <F extends ToolFunction>(func: F): UseTool<F>;
  <F extends readonly ToolFunctions[]>(funcs: [...F]): UseTools<F>;
  <F extends { readonly [key: string]: ToolFunctions }>(funcs: F): UseTools<F>;
  <F extends ToolFunctions>(funcs: F): UseTools<F>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <F extends ToolFunctions>(funcs: F): UseTools<F> => {
    throw new Error("Uncompiled tool");
  },
  {
    brand: Symbol("toolcog.useTool"),
  } as const,
) as typeof useTool;

const forEachTool = <T>(
  tools: Tools,
  callback: (tool: Tool) => T | void,
): T | undefined => {
  if (typeof tools === "function") {
    return callback(tools) as T | undefined;
  } else if (Array.isArray(tools)) {
    for (const tool of tools as readonly Tools[]) {
      const result = forEachTool(tool, callback);
      if (result !== undefined) {
        return result;
      }
    }
  } else if (typeof tools === "object") {
    for (const key in tools) {
      const tool = (tools as { readonly [key: string]: Tools })[key]!;
      const result = forEachTool(tool, callback);
      if (result !== undefined) {
        return result;
      }
    }
  }
  return undefined;
};

const mapTools = <T>(tools: Tools, callback: (tool: Tool) => T): T[] => {
  const array: T[] = [];
  forEachTool(tools, (tool) => array.push(callback(tool)));
  return array;
};

// The following types are used internally by the toolcog compiler.

/** @internal */
type AnyTool = Tool;

/** @internal */
type AnyTools = Tools;

/** @internal */
type UseAnyTool = UseTool;

/** @internal */
type UseAnyTools = UseTools;

export type {
  ToolDescriptor,
  Tool,
  Tools,
  UseTool,
  UseTools,
  AnyTool,
  AnyTools,
  UseAnyTool,
  UseAnyTools,
};
export { defineTool, useTool, forEachTool, mapTools };
