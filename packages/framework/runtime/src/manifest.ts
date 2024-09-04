import { resolve as resolvePath } from "node:path";
import type ts from "typescript";
import YAML from "yaml";
import type { Schema } from "@toolcog/util/json";

interface IdiomDef {
  embeds: string[];
}

interface IndexDef {
  idioms: string[];
}

interface ToolDef {
  name?: string | undefined;
  description?: string | undefined;
  parameters?: Schema | undefined;
  returns?: Schema | undefined;
}

interface PromptDef {
  name?: string | undefined;
  description?: string | undefined;
  parameters?: Schema | undefined;
  returns?: Schema | undefined;
  instructions: string | undefined;
}

interface ModuleDef {
  idioms: { [idiomId: string]: IdiomDef };
  indexes: { [indexId: string]: IndexDef };
  tools: { [toolId: string]: ToolDef };
  prompts: { [promptId: string]: PromptDef };
}

interface Manifest {
  modules: { [moduleId: string]: ModuleDef };
}

const manifestFileName = "toolcog-manifest.yaml";

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

const parseManifest = (yaml: string): Manifest => {
  return YAML.parse(yaml) as Manifest;
};

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

const createManifest = (): Manifest => {
  return {
    modules: Object.create(null) as Manifest["modules"],
  };
};

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
