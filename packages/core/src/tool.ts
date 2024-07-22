import type { Schema } from "@toolcog/util/schema";

interface ToolDescriptor {
  readonly name: string;
  readonly description?: string | undefined;
  readonly parameters?: Schema | undefined;
  readonly return?: Schema | undefined;
}

type ToolFunction = (...args: any[]) => unknown;

type ToolFunctions =
  | ToolFunction
  | readonly ToolFunctions[]
  | { readonly [key: string]: ToolFunctions };

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
  readonly implicit: undefined;
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

/** @internal */
type AnyTool = Tool;

/** @internal */
type AnyTools = Tools;

/** @internal */
type UseAnyTool = UseTool;

/** @internal */
type UseAnyTools = UseTools;

const isTool = (value: unknown): value is Tool => {
  return typeof value === "function" && "descriptor" in value;
};

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

export type {
  ToolDescriptor,
  ToolFunction,
  ToolFunctions,
  Tool,
  Tools,
  UseTool,
  UseTools,
  AnyTool,
  AnyTools,
  UseAnyTool,
  UseAnyTools,
};
export { isTool, defineTool, useTool };
