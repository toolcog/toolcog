import type { FunctionSchema } from "./schema.ts";

/**
 * Each key of this type represents a known generative model name.
 * Generator plugins augment this type to add supported models names.
 *
 * Use the {@link GenerativeModel} type, which references the keys of this type,
 * to refer to strings that represent generative model names. The indirection
 * through this type is necessary because type aliases cannot be augmented.
 */
interface GenerativeModelNames {}

/**
 * The identifying name of a generative model.
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type GenerativeModel = keyof GenerativeModelNames | (string & {});

/**
 * Generative model configuration options, such as API keys and API client
 * parameters. Generator plugins augment this type with supported options.
 */
interface GenerativeConfig {}

interface GenerativeFunction {
  readonly id: string;

  readonly model: GenerativeModel | undefined;

  readonly function: FunctionSchema;
}

export type {
  GenerativeModelNames,
  GenerativeModel,
  GenerativeConfig,
  GenerativeFunction,
};
