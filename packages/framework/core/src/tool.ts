import type { Schema } from "@toolcog/util/json";

interface Tool<
  F extends (...args: any[]) => unknown = (...args: any[]) => unknown,
> {
  (...args: Parameters<F>): ReturnType<F>;

  readonly id: string;

  readonly name: string;

  readonly description: string | undefined;

  readonly parameters: Schema | undefined;

  readonly returns: Schema | undefined;
}

type Tools<F extends readonly ((...args: any[]) => unknown)[]> =
  F extends readonly [] ? readonly []
  : F extends readonly [infer Elem] ?
    Elem extends (...args: any[]) => unknown ?
      readonly [Tool<Elem>]
    : never
  : F extends readonly [infer Head, ...infer Tail] ?
    readonly [
      Head extends (...args: any[]) => unknown ? Tool<Head> : never,
      ...(Tail extends readonly ((...args: any[]) => unknown)[] ? Tools<Tail>
      : never),
    ]
  : F extends readonly [...infer Body, infer Foot] ?
    readonly [
      ...(Body extends readonly ((...args: any[]) => unknown)[] ? Tools<Body>
      : never),
      Foot extends (...args: any[]) => unknown ? Tool<Foot> : never,
    ]
  : F extends readonly (infer Elem)[] ?
    Elem extends (...args: any[]) => unknown ?
      readonly Tool<Elem>[]
    : never
  : F extends (...args: any[]) => unknown ? Tool<F>
  : never;

/** @internal */
type AnyTool = Tool;

/** @internal */
type AnyTools = Tools<readonly ((...args: any[]) => unknown)[]>;

/**
 * Generates an LLM tool for a TypeScript function.
 */
const defineTool: {
  <const F extends (...args: any[]) => unknown>(func: F): Tool<F>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <const F extends (...args: any[]) => unknown>(func: F): Tool<F> => {
    throw new Error("Uncompiled tool");
  },
  {
    brand: Symbol("toolcog.defineTool"),
  } as const,
) as typeof defineTool;

const defineTools: {
  <const F extends readonly ((...args: any[]) => unknown)[]>(
    funcs: readonly [...F],
  ): Tools<F>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <const F extends readonly ((...args: any[]) => unknown)[]>(
    funcs: readonly [...F],
  ): Tools<F> => {
    throw new Error("Uncompiled tools");
  },
  {
    brand: Symbol("toolcog.defineTools"),
  } as const,
) as typeof defineTools;

export type { Tool, Tools, AnyTool, AnyTools };
export { defineTool, defineTools };
