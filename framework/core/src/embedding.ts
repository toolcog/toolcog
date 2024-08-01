type EmbeddingVector = readonly number[];

type EmbeddingVectors<
  T extends string | readonly string[] = string | readonly string[],
> =
  T extends string ? EmbeddingVector
  : T extends string[] ? EmbeddingVector[]
  : T extends readonly string[] ? readonly EmbeddingVector[]
  : never;

type EmbeddingSimilarity = (a: EmbeddingVector, b: EmbeddingVector) => number;

type Embeddable =
  | ((...args: any[]) => unknown)
  // Arrays are not embeddable.
  | { readonly [key: string | symbol]: unknown }
  | string
  | number
  | boolean
  | null
  | undefined;

type Embeddables = Embeddable | readonly Embeddables[];

interface Embed<T extends Embeddable = Embeddable> {
  readonly id: string | undefined;

  readonly value: T;

  readonly intents: readonly string[];
}

type Embeds<T extends Embeddables = Embeddables> =
  T extends EmbeddingFunction<infer U> ? Embeds<U>
  : // Handle `Embeddable` case.
  T extends Embeddable ? Embed<T>
  : // Handle `Embeddables[]` cases.
  T extends [] ? []
  : T extends [infer Elem] ?
    Elem extends Embeddables ?
      [Embeds<Elem>]
    : never
  : T extends [infer Head, ...infer Tail] ?
    [
      Head extends Embeddables ? Embeds<Head> : never,
      ...(Tail extends readonly Embeddables[] ? Embeds<Tail> : never),
    ]
  : T extends [...infer Body, infer Foot] ?
    [
      ...(Body extends readonly Embeddables[] ? Embeds<Body> : never),
      Foot extends Embeddables ? Embeds<Foot> : never,
    ]
  : T extends Embeddable[] ? Embed[]
  : T extends Embeddables[] ? Embeds[]
  : // Handle `readonly Embeddables[]` cases.
  T extends readonly [] ? readonly []
  : T extends readonly [infer Elem] ?
    Elem extends Embeddables ?
      readonly [Embeds<Elem>]
    : never
  : T extends readonly [infer Head, ...infer Tail] ?
    readonly [
      Head extends Embeddables ? Embeds<Head> : never,
      ...(Tail extends readonly Embeddables[] ? Embeds<Tail> : never),
    ]
  : T extends readonly [...infer Body, infer Foot] ?
    readonly [
      ...(Body extends readonly Embeddables[] ? Embeds<Body> : never),
      Foot extends Embeddables ? Embeds<Foot> : never,
    ]
  : T extends readonly Embeddable[] ? readonly Embed[]
  : T extends readonly Embeddables[] ? readonly Embeds[]
  : never;

/** @internal */
type AnyEmbed = Embed;

/** @internal */
type AnyEmbeds = Embeds;

const forEachEmbed = <T extends Embeddable>(
  embeds: Embeds<T>,
  callback: (embed: Embed<T>) => void,
): void => {
  if (isEmbedding<T>(embeds)) {
    forEachEmbed(embeds.embeds, callback);
  } else if (Array.isArray(embeds)) {
    for (const embed of embeds as readonly Embeds<T>[]) {
      forEachEmbed(embed, callback);
    }
  } else {
    callback(embeds as Embed<T>);
  }
};

interface EmbeddingConfig {
  model?: string | undefined;

  dimensions?: number | undefined;
}

interface EmbeddingOptions extends EmbeddingConfig {
  signal?: AbortSignal | undefined;
}

interface EmbeddingIndex<T extends Embeddables> {
  (
    query: string | EmbeddingVector,
    count: number,
    options?: EmbeddingOptions,
  ): Promise<T[]>;
}

interface EmbeddingFunction<T extends Embeddables> {
  (query: string | EmbeddingVector, options?: EmbeddingOptions): Promise<T>;
  (
    query: string | EmbeddingVector,
    count: number,
    options?: EmbeddingOptions,
  ): Promise<T[]>;

  readonly embeds: Embeds<T>;

  readonly index: EmbeddingIndex<T> | null;
}

interface EmbeddingProps extends EmbeddingConfig {}

const isEmbedding = <T extends Embeddables>(
  value: unknown,
): value is EmbeddingFunction<T> => {
  return typeof value === "function" && "embeds" in value;
};

const embedding: {
  <T extends Embeddable>(
    value: T,
    props?: EmbeddingProps,
  ): EmbeddingFunction<T>;
  <T extends readonly Embeddables[]>(
    values: [...T],
    props?: EmbeddingProps,
  ): EmbeddingFunction<T>;
  <T extends { readonly [key: string]: Embeddables }>(
    values: T,
    props?: EmbeddingProps,
  ): EmbeddingFunction<T>;
  <T extends Embeddables>(
    values: T,
    props?: EmbeddingProps,
  ): EmbeddingFunction<T>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <T extends Embeddables>(
    values: T,
    props?: EmbeddingProps,
  ): EmbeddingFunction<T> => {
    throw new Error("Uncompiled embedding");
  },
  {
    brand: Symbol("toolcog.embedding"),
  } as const,
) as typeof embedding;

interface EmbeddingModelOptions extends EmbeddingOptions {}

interface EmbeddingModel {
  <T extends string | readonly string[]>(
    content: T,
    options?: EmbeddingModelOptions,
  ): Promise<EmbeddingVectors<T>>;
}

interface EmbeddingStoreOptions extends EmbeddingOptions {
  model: string;

  embeddingModel: EmbeddingModel;

  embeddingCache?: unknown;

  similarity?: EmbeddingSimilarity | undefined;
}

interface EmbeddingStore {
  <T extends Embeddable>(
    embeds: Embeds<T>,
    options: EmbeddingStoreOptions,
  ): Promise<EmbeddingIndex<T>>;
}

export type {
  EmbeddingVector,
  EmbeddingVectors,
  EmbeddingSimilarity,
  Embeddable,
  Embeddables,
  EmbeddingConfig,
  EmbeddingOptions,
  Embed,
  Embeds,
  AnyEmbed,
  AnyEmbeds,
  EmbeddingIndex,
  EmbeddingFunction,
  EmbeddingProps,
  EmbeddingModelOptions,
  EmbeddingModel,
  EmbeddingStoreOptions,
  EmbeddingStore,
};
export { forEachEmbed, isEmbedding, embedding };
