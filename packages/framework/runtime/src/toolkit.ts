import type { Tool } from "@toolcog/core";

interface Toolkit {
  readonly name: string;

  readonly version?: string;

  readonly tools?: () => Promise<readonly Tool[]>;
}

type ToolkitSource =
  | (() => Promise<Toolkit | undefined> | Toolkit | undefined)
  | Promise<Toolkit | undefined>
  | Toolkit
  | undefined;

const resolveToolkit = async (
  toolkit: ToolkitSource,
): Promise<Toolkit | undefined> => {
  if (typeof toolkit === "function") {
    toolkit = toolkit();
  }
  return await toolkit;
};

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

export type { Toolkit, ToolkitSource };
export { resolveToolkit, resolveToolkits };
