import type { Tool } from "@toolcog/core";

/**
 * A package of LLM tools related to a particular API or service.
 *
 * Toolkits typically contain more tools than would be used in a single task.
 * The Toolcog Runtime indexes registered toolkits and performs implicit tool
 * selection, providing only relevant tools to the LLM for a given prompt.
 */
interface Toolkit {
  /**
   * The name of the toolkit.
   */
  readonly name: string;

  /**
   * The version of the toolkit.
   */
  readonly version?: string;

  /**
   * The LLM tools provided by the toolkit.
   */
  readonly tools?: () => Promise<readonly Tool[]>;
}

/**
 * A module that exports a default `Toolkit` implementation.
 */
interface ToolkitModule {
  /**
   * The default export of the module.
   */
  default?:
    | (() => Promise<Toolkit | undefined> | Toolkit | undefined)
    | Toolkit
    | undefined;
}

/**
 * Specifies the various ways to provide a toolkit. A `ToolkitSource` can be:
 * - A function returning a toolkit, `undefined`, or a promise thereof
 * - A promise resolving to a toolkit module, toolkit object, or `undefined`
 * - A toolkit module
 * - A toolkit object
 * - `undefined`
 */
type ToolkitSource =
  | (() => Promise<Toolkit | undefined> | Toolkit | undefined)
  | Promise<ToolkitModule | Toolkit | undefined>
  | ToolkitModule
  | Toolkit
  | undefined;

/**
 * Converts a `ToolkitSource` into a `Toolkit` by resolving promises,
 * invoking functions, or extracting the default export as necessary.
 *
 * @param toolkit - The toolkit source to resolve.
 * @returns The resolved toolkit, or `undefined` if the source doesn't
 * resolve to a valid toolkit.
 */
const resolveToolkit = async (
  toolkit: ToolkitSource,
): Promise<Toolkit | undefined> => {
  toolkit = await toolkit;
  if (toolkit !== undefined && "default" in toolkit) {
    toolkit = toolkit.default;
  }
  if (typeof toolkit === "function") {
    toolkit = await toolkit();
  }
  return toolkit as Toolkit | undefined;
};

/**
 * Converts an array of `ToolkitSource`s into an array of `Toolkit`s by resolving
 * promises or invoking functions as necessary.
 *
 * @param toolkits - The toolkit sources to resolve.
 * @returns The resolved toolkits.
 */
const resolveToolkits: {
  (toolkits: readonly ToolkitSource[]): Promise<Toolkit[]>;
  (
    toolkits: readonly ToolkitSource[] | null | undefined,
  ): Promise<Toolkit[] | undefined>;
} = (async (
  toolkits: readonly ToolkitSource[] | null | undefined,
): Promise<Toolkit[] | undefined> => {
  if (toolkits === undefined || toolkits === null) {
    return undefined;
  }
  return (
    await Promise.allSettled(toolkits.map((toolkit) => resolveToolkit(toolkit)))
  ).reduce<Toolkit[]>((toolkits, result) => {
    if (result.status === "fulfilled" && result.value !== undefined) {
      toolkits.push(result.value);
    }
    return toolkits;
  }, []);
}) as typeof resolveToolkits;

export type { Toolkit, ToolkitModule, ToolkitSource };
export { resolveToolkit, resolveToolkits };
