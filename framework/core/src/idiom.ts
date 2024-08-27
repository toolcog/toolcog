import type { Embeddings } from "./embedding.ts";

/**
 * A collection of embeddings associated with a value.
 */
interface Idiom<T> {
  (): Embeddings;

  readonly id: string;

  readonly value: T;
}

type Idioms<T extends readonly unknown[]> =
  T extends readonly [] ? readonly []
  : T extends readonly [infer Elem] ? readonly [Idiom<Elem>]
  : T extends readonly [infer Head, ...infer Tail] ?
    readonly [Idiom<Head>, ...Idioms<Tail>]
  : T extends readonly [...infer Body, infer Foot] ?
    readonly [...Idioms<Body>, Idiom<Foot>]
  : T extends readonly (infer Elem)[] ? readonly Idiom<Elem>[]
  : never;

/** @internal */
type AnyIdiom = Idiom<unknown>;

/** @internal */
type AnyIdioms = Idioms<readonly unknown[]>;

interface IdiomResolver {
  (id: string, value: unknown): Embeddings | undefined;
}

const defineIdiom: {
  <const T>(value: T): Idiom<T>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <const T>(value: T): Idiom<T> => {
    throw new Error("Uncompiled idiom");
  },
  {
    brand: Symbol("toolcog.defineIdiom"),
  } as const,
) as typeof defineIdiom;

const defineIdioms: {
  <const T extends readonly unknown[]>(values: readonly [...T]): Idioms<T>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <const T extends readonly unknown[]>(values: readonly [...T]): Idioms<T> => {
    throw new Error("Uncompiled idioms");
  },
  {
    brand: Symbol("toolcog.defineIdioms"),
  } as const,
) as typeof defineIdioms;

export type { Idiom, Idioms, AnyIdiom, AnyIdioms, IdiomResolver };
export { defineIdiom, defineIdioms };
