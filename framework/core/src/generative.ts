import type { Schema } from "@toolcog/util/json";
import type { ToolSource } from "./tool.ts";

/**
 * Each key of this type represents the name of a known generative model.
 * Generator plugins augment this type to add supported model names.
 *
 * Use the {@link GenerativeModel} type for strings that should represent
 * generative model names. The `GenerativeModel` type extracts the keys of
 * this type. The indirection through this type is necessary because type
 * aliases cannot be augmented.
 */
interface GenerativeModelNames {}

/**
 * The identifying name of a generative model.
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type GenerativeModel = keyof GenerativeModelNames | (string & {});

type InstructionsSource =
  | ((args: unknown) => Promise<string | undefined> | string | undefined)
  | Promise<string | undefined>
  | string
  | undefined;

interface GenerativeFunction {
  readonly id: string;

  readonly name: string;

  readonly description: string | undefined;

  readonly parameters: Schema | undefined;

  readonly returns: Schema | undefined;

  readonly instructions: InstructionsSource;

  readonly tools: readonly ToolSource[];
}

export type {
  GenerativeModelNames,
  GenerativeModel,
  InstructionsSource,
  GenerativeFunction,
};
