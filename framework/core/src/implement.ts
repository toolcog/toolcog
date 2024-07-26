import type { ToolDescriptor, Tools } from "./tool.ts";
import type { GenerateOptions } from "./generate.ts";

/** @internal */
type IsVariadic<T extends unknown[]> =
  T extends [unknown?] ? false
  : T extends [infer Head, ...infer Tail] ? IsVariadic<Tail>
  : T extends [...infer Body, infer Foot] ? IsVariadic<Body>
  : true;

type ImplementParameters<F extends (...args: any[]) => unknown> =
  IsVariadic<Parameters<F>> extends true ? Parameters<F>
  : [...Parameters<F>, options?: GenerateOptions];

type ImplementReturnType<F extends (...args: any[]) => unknown> = Promise<
  Awaited<ReturnType<F>>
>;

interface ImplementProps {
  defaults?: Record<string, unknown> | undefined;

  instructions?: string | undefined;

  modelId?: string | undefined;

  tools?: Tools[] | null | undefined;
}

interface Implement<F extends (...args: any[]) => unknown> {
  (...args: ImplementParameters<F>): ImplementReturnType<F>;

  readonly instructions: string | undefined;

  readonly descriptor: ToolDescriptor;

  readonly tools: Tools[];
}

const implement: {
  <F extends (...args: any[]) => unknown>(props?: ImplementProps): Implement<F>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <F extends (...args: any[]) => unknown>(
    props?: ImplementProps,
  ): Implement<F> => {
    throw new Error("Uncompiled generative function");
  },
  {
    brand: Symbol("toolcog.implement"),
  } as const,
) as typeof implement;

export type {
  ImplementParameters,
  ImplementReturnType,
  ImplementProps,
  Implement,
};
export { implement };
