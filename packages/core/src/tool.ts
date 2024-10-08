import type { Schema } from "@toolcog/util/json";
import type { Embeddings } from "./embedding.ts";

/**
 * An LLM-callable function. AI models use the associated descriptive schemas
 * to decide when and how to invoke the function based on natural language
 * prompts. Tools are typically creating using the {@link defineTool} intrinsic.
 *
 * The `Tool` interface structurally conform to the {@link Idiom} interface,
 * enabling tools to be directly included in tool selection indexes.
 *
 * @typeParam F - The type of the underlying function.
 */
interface Tool<
  F extends (...args: any[]) => unknown = (...args: any[]) => unknown,
> {
  /**
   * Invokes the tool with the provided arguments. The arguments must conform
   * to the `parameters` schema, and the return value must conform to the
   * `returns` schema.
   *
   * @param args - The arguments to pass to the tool.
   * @returns The result of the tool call.
   */
  (...args: Parameters<F>): ReturnType<F>;

  /**
   * A unique, semi-stable identifier for the tool, derived from
   * the package name, module path, and declaration hierarchy.
   */
  readonly id: string;

  /**
   * The name of the tool. Must be a valid identifier.
   */
  readonly name: string;

  /**
   * The static value associated with the idiom, which is the tool itself.
   */
  readonly value: this;

  /**
   * A natural language description of the tool's functionality, providing
   * context and usage information for AI models. The `defineTool` intrinsic
   * extracts the description from the function's documentation comment.
   */
  readonly description: string | undefined;

  /**
   * A JSON Schema that describes the argument values accepted by the tool.
   * The `defineTool` intrinsic generates this schema via static analysis
   * of the function's type signature. Descriptions of all schema elements
   * are extracted from the documentation comments of their associated types.
   */
  readonly parameters: Schema | undefined;

  /**
   * A JSON Schema that describes the values returned by the tool.
   * The `defineTool` intrinsic generates this schema via static analysis
   * of the function's type signature. Descriptions of all schema elements
   * are extracted from the documentation comments of their associated types.
   */
  readonly returns: Schema | undefined;

  /**
   * Returns the embeddings associated with the tool. The embeddings are
   * generated from descriptive phrases specified via `@idiom` doc tags
   * in the code comments for the tool declaration. These embeddings are
   * used to select tools that are relevant to a given prompt.
   *
   * @returns An object mapping descriptive phrases to their embeddings.
   */
  readonly embeds: () => Embeddings;
}

/**
 * A type utility that converts a tuple of functions into a tuple of their
 * corresponding tools. Useful for working with multiple tools in a type-safe
 * manner.
 *
 * @typeParam F - A tuple of functions to convert into tools.
 */
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
 * An intrinsic function that defines an LLM-callable tool by statically
 * analyzing the type signature and documentation comments of an ordinary
 * TypeScript function.
 *
 * Use `defineTool` to make a TypeScript function callable by tool-capable LLMs.
 * The Toolcog compiler transforms calls to this intrinsic, generating JSON
 * schemas for the function's parameters and return type. Descriptions of all
 * schema elements are extracted from the documentation comments of their
 * associated types.
 *
 * @example
 * ```typescript
 * /**
 *  * Returns the sum of two numbers.
 *  * @idiom Add two numbers.
 *  * @param a - The augend.
 *  * @param b - The addend.
 *  * @returns The sum of `a` and `b`.
 *  *\/
 * const add = defineTool((a: number, b: number): number => {
 *   return a + b;
 * });
 * ```
 *
 * @typeParam F - The type of the function to transform into a tool.
 * @param func - The function to make callable by an LLM.
 * @returns An LLM `Tool` that invokes the function.
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

/**
 * An intrinsic function that generates LLM-callable tools for a list of
 * TypeScript functions.
 *
 * Use `defineTools` to create multiple `Tool` objects at once. The Toolcog
 * compiler transforms this intrinsic, producing an array of `Tool` objects
 * with descriptive schemas an embeddings.
 *
 * @example
 * ```typescript
 * /**
 *  * Returns the product of two numbers.
 *  * @idiom Multiply two numbers.
 *  * @param a - The first number.
 *  * @param b - The second number.
 *  * @returns The product of `a` and `b`.
 *  *\/
 * const multiply = (a: number, b: number): number => {
 *   return a * b;
 * };
 *
 * /**
 *  * Returns the quotient of two numbers.
 *  * @idiom Divide two numbers.
 *  * @param a - The dividend.
 *  * @param b - The divisor.
 *  * @returns The quotient of `a` and `b`.
 *  *\/
 * const divide = (a: number, b: number): number => {
 *   return a / b;
 * };
 *
 * const tools = defineTools([multiply, divide]);
 * ```
 *
 * @typeParam F - A tuple of functions to transform into tools.
 * @param funcs - An array of functions to make callable by an LLM.
 * @returns An array of `Tool` objects corresponding to the provided functions.
 */
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
