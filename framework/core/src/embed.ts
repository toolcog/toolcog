import type { EmbedderOptions, EmbedderResult } from "./embedder.ts";

const embed: {
  <T extends string | readonly string[]>(
    embeds: T,
    options?: EmbedderOptions,
  ): Promise<EmbedderResult<T>>;

  /** @internal */
  readonly brand: unique symbol;
} = Object.assign(
  <T extends string | readonly string[]>(
    embeds: T,
    options?: EmbedderOptions,
  ): Promise<EmbedderResult<T>> => {
    throw new Error("Uncompiled embed");
  },
  {
    brand: Symbol("toolcog.embed"),
  } as const,
) as typeof embed;

export { embed };
