import { resolve as resolvePath } from "node:path";
import type ts from "typescript";
import YAML from "yaml";
import type { Schema } from "@toolcog/util/json";

/**
 * An idiom declared in a module.
 */
interface IdiomDef {
  /**
   * The descriptive phrases associated with this idiom.
   */
  phrases: string[];
}

/**
 * A semantic index declared in a module.
 */
interface IndexDef {
  /**
   * The IDs of the idioms that appear in this index.
   */
  idioms: string[];
}

/**
 * An LLM tool declared in a module.
 */
interface ToolDef {
  /**
   * The name of the tool.
   */
  name?: string | undefined;
  /**
   * A natural language description of the tool's functionality.
   */
  description?: string | undefined;
  /**
   * A JSON Schema that describes the argument values accepted by the tool.
   */
  parameters?: Schema | undefined;
  /**
   * A JSON Schema that describes the values returned by the tool.
   */
  returns?: Schema | undefined;
}

/**
 * A generative function declared in a module.
 */
interface PromptDef {
  /**
   * The name of the generative function.
   */
  name?: string | undefined;
  /**
   * A natural language description of the function's behavior.
   */
  description?: string | undefined;
  /**
   * A JSON Schema that describes the argument values accepted by the function.
   */
  parameters?: Schema | undefined;
  /**
   * A JSON Schema that describes the values returned by the function.
   */
  returns?: Schema | undefined;
  /**
   * Instructions the model should follow when generating the function's output.
   */
  instructions?: string | undefined;
}

/**
 * A manifest of AI declarations defined by a module.
 */
interface ModuleDef {
  /**
   * The idioms declared in the module.
   */
  idioms: { [idiomId: string]: IdiomDef };
  /**
   * The indexes declared in the module.
   */
  indexes: { [indexId: string]: IndexDef };
  /**
   * The tools declared in the module.
   */
  tools: { [toolId: string]: ToolDef };
  /**
   * The generative functions declared in the module.
   */
  prompts: { [promptId: string]: PromptDef };
}

/**
 * A manifest of AI declarations defined by a project. The Toolcog compiler
 * generates a manifest file containing all tools, prompts, idioms, and indexes
 * defined by a project. The manifest file can then be post-processed to
 * prefetch embeddings, generate embedded vector indexes, or seed external
 * vector databases.
 *
 * The `toolcog inventory generate` command generates an {@link Inventory} file
 * from a manifest file. The inventory file contains precomputed assets that
 * can be bundled into an application for efficient runtime use.
 */
interface Manifest {
  /**
   * The modules contained in the project.
   */
  modules: { [moduleId: string]: ModuleDef };
}

/**
 * The default file name for AI manifest files.
 */
const manifestFileName = "toolcog-manifest.yaml";

/**
 * Returns the path to the AI manifest file that corresponds to a specified
 * TypeScript project.
 *
 * @param ts - The TypeScript version to use.
 * @param compilerOptions - The compiler options for the TypeScript project.
 * @param getCommonSourceDirectory - A function that returns the longest
 * directory path shared by all source files in the project.
 * @param fileName - The name of the manifest file.
 * @returns The path to the manifest file for the TypeScript project.
 */
const resolveManifestFile = (
  ts: typeof import("typescript"),
  compilerOptions: ts.CompilerOptions,
  getCommonSourceDirectory: () => string,
  fileName: string = manifestFileName,
): string | undefined => {
  return ts.getOutputJSFileNameWorker(
    resolvePath(getCommonSourceDirectory(), fileName),
    compilerOptions,
    false, // ignoreCase
    getCommonSourceDirectory,
  );
};

/**
 * Parses an AI manifest file.
 *
 * @param yaml - The YAML content of the manifest file.
 * @returns The parsed AI manifest.
 */
const parseManifest = (yaml: string): Manifest => {
  return YAML.parse(yaml) as Manifest;
};

/**
 * Formats an AI manifest as a YAML string.
 *
 * @param manifest - The AI manifest to format.
 * @returns The formatted YAML string.
 */
const formatManifest = (manifest: Manifest): string => {
  manifest = {
    modules: Object.fromEntries(
      Object.entries(manifest.modules)
        .map(([moduleId, moduleDef]) => {
          return [moduleId, encodeModuleDef(moduleDef)] as const;
        })
        .sort((a, b) => a[0].localeCompare(b[0])),
    ),
  };
  return YAML.stringify(manifest, {
    blockQuote: "literal",
  });
};

/**
 * Creates a new AI manifest.
 *
 * @returns An empty AI manifest.
 */
const createManifest = (): Manifest => {
  return {
    modules: Object.create(null) as Manifest["modules"],
  };
};

/**
 * Encodes an AI module manifest for serialization. Sorts keys for consistent,
 * diff-friendly output.
 *
 * @param moduleDef - The AI module manifest to encode.
 * @returns The encoded AI module manifest.
 * @internal
 */
const encodeModuleDef = (moduleDef: ModuleDef): ModuleDef => {
  return {
    idioms: Object.fromEntries(
      Object.entries(moduleDef.idioms).sort((a, b) => a[0].localeCompare(b[0])),
    ),
    indexes: Object.fromEntries(
      Object.entries(moduleDef.indexes).sort((a, b) =>
        a[0].localeCompare(b[0]),
      ),
    ),
    tools: Object.fromEntries(
      Object.entries(moduleDef.tools).sort((a, b) => a[0].localeCompare(b[0])),
    ),
    prompts: Object.fromEntries(
      Object.entries(moduleDef.prompts).sort((a, b) =>
        a[0].localeCompare(b[0]),
      ),
    ),
  };
};

/**
 * Creates a new AI module manifest.
 *
 * @returns An empty AI module manifest.
 */
const createModuleDef = (): ModuleDef => {
  return {
    idioms: Object.create(null) as ModuleDef["idioms"],
    indexes: Object.create(null) as ModuleDef["indexes"],
    tools: Object.create(null) as ModuleDef["tools"],
    prompts: Object.create(null) as ModuleDef["prompts"],
  };
};

export type { IdiomDef, IndexDef, ToolDef, PromptDef, ModuleDef, Manifest };
export {
  manifestFileName,
  resolveManifestFile,
  parseManifest,
  formatManifest,
  createManifest,
  createModuleDef,
};
