import type { FunctionSchema } from "./schema.ts";

type Toolable = (...args: any[]) => unknown;

type Toolables =
  | Toolable
  | readonly Toolables[]
  | { readonly [key: string]: Toolables };

interface Tool<F extends Toolable = Toolable> {
  (...args: Parameters<F>): ReturnType<F>;

  readonly id: string | undefined;

  readonly function: FunctionSchema;
}

type Tools<F extends Toolables = Toolables> =
  F extends Tool ? F
  : // Handle `Toolable` case.
  F extends Toolable ? Tool<F>
  : // Handle `Toolables[]` cases.
  F extends [] ? []
  : F extends [infer Elem] ?
    Elem extends Toolables ?
      [Tools<Elem>]
    : never
  : F extends [infer Head, ...infer Tail] ?
    [
      Head extends Toolables ? Tools<Head> : never,
      ...(Tail extends readonly Toolables[] ? Tools<Tail> : never),
    ]
  : F extends [...infer Body, infer Foot] ?
    [
      ...(Body extends readonly Toolables[] ? Tools<Body> : never),
      Foot extends Toolables ? Tools<Foot> : never,
    ]
  : F extends Toolable[] ? Tool[]
  : F extends Toolables[] ? Tools[]
  : // Handle `readonly Toolables[]` cases.
  F extends readonly [] ? readonly []
  : F extends readonly [infer Elem] ?
    Elem extends Toolables ?
      readonly [Tools<Elem>]
    : never
  : F extends readonly [infer Head, ...infer Tail] ?
    readonly [
      Head extends Toolables ? Tools<Head> : never,
      ...(Tail extends readonly Toolables[] ? Tools<Tail> : never),
    ]
  : F extends readonly [...infer Body, infer Foot] ?
    readonly [
      ...(Body extends readonly Toolables[] ? Tools<Body> : never),
      Foot extends Toolables ? Tools<Foot> : never,
    ]
  : F extends readonly Toolable[] ? readonly Tool[]
  : F extends readonly Toolables[] ? readonly Tools[]
  : // Handle `{ [key: string]: Toolables }` cases.
  F extends { readonly [key: string]: Toolables } ?
    {
      [K in keyof F]: Tools<F[K]>;
    }
  : never;

/** @internal */
type AnyTool = Tool;

/** @internal */
type AnyTools = Tools;

const isTool = (value: unknown): value is Tool => {
  return typeof value === "function" && "function" in value;
};

const forEachTool = (tools: Tools, callback: (tool: Tool) => void): void => {
  if (typeof tools === "function") {
    callback(tools);
  } else if (Array.isArray(tools)) {
    for (const tool of tools as readonly Tools[]) {
      forEachTool(tool, callback);
    }
  } else if (typeof tools === "object") {
    for (const key in tools) {
      const tool = (tools as { readonly [key: string]: Tools })[key]!;
      forEachTool(tool, callback);
    }
  }
};

const findTool = <T>(
  tools: Tools,
  callback: (tool: Tool) => T | undefined,
): T | undefined => {
  if (typeof tools === "function") {
    return callback(tools);
  } else if (Array.isArray(tools)) {
    for (const tool of tools as readonly Tools[]) {
      const result = findTool(tool, callback);
      if (result !== undefined) {
        return result;
      }
    }
  } else if (typeof tools === "object") {
    for (const key in tools) {
      const tool = (tools as { readonly [key: string]: Tools })[key]!;
      const result = findTool(tool, callback);
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

const tooling: {
  <F extends Toolable>(func: F): Tool<F>;
  <F extends readonly Toolables[]>(funcs: [...F]): Tools<F>;
  <F extends { readonly [key: string]: Toolables }>(funcs: F): Tools<F>;
  <F extends Toolables>(funcs: F): Tools<F>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <F extends Toolables>(funcs: F): Tools<F> => {
    throw new Error("Uncompiled tooling");
  },
  {
    brand: Symbol("toolcog.tooling"),
  } as const,
) as typeof tooling;

export type { Toolable, Toolables, Tool, Tools, AnyTool, AnyTools };
export { isTool, forEachTool, findTool, mapTools, tooling };
