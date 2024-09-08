import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { defineConfig } from "rollup";
import { nodeExternals } from "rollup-plugin-node-externals";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";
import { dts } from "rollup-plugin-dts";

const defineLib = (options = {}) => {
  const {
    input = "./src/lib.ts",
    outputDir = "./dist",
    outputTag,
    formats = ["esm", "cjs", "dts"],
    exports,
    exportConditions,
    external = [/^@?toolcog\//],
    transformers,
    plugins,
  } = options;

  let replaceOptions = options.replace;
  if (typeof replaceOptions === "function") {
    const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
    replaceOptions = replaceOptions(pkg);
  }

  const entityFileName = (ext, chunkInfo) => {
    const name =
      chunkInfo.facadeModuleId.endsWith("/src/mod.ts") ?
        basename(chunkInfo.facadeModuleId.slice(0, -"/src/mod.ts".length))
      : chunkInfo.facadeModuleId.endsWith("/mod.ts") ?
        basename(chunkInfo.facadeModuleId.slice(0, -"/mod.ts".length))
      : basename(chunkInfo.name);
    return outputTag !== undefined ?
        `${name}.${outputTag}${ext}`
      : `${name}${ext}`;
  };

  const esmOutput =
    formats.includes("esm") ?
      {
        dir: outputDir,
        format: "esm",
        exports,
        sourcemap: true,
        entryFileNames: entityFileName.bind(undefined, ".js"),
      }
    : undefined;

  const cjsOutput =
    formats.includes("cjs") ?
      {
        dir: outputDir,
        format: "cjs",
        exports,
        sourcemap: true,
        entryFileNames: entityFileName.bind(undefined, ".cjs"),
      }
    : undefined;

  const dtsOutput =
    formats.includes("dts") ?
      {
        dir: outputDir,
        format: "esm",
        exports,
        entryFileNames: entityFileName.bind(undefined, ".d.ts"),
      }
    : undefined;

  const configs = [];

  if (esmOutput !== undefined || cjsOutput !== undefined) {
    const config = defineConfig({
      input,
      output: [
        ...(esmOutput !== undefined ? [esmOutput] : []),
        ...(cjsOutput !== undefined ? [cjsOutput] : []),
      ],
      external,
      plugins: [
        nodeExternals(),
        nodeResolve({
          extensions: [".js", ".ts"],
          exportConditions,
        }),
        typescript({
          transformers,
        }),
        ...(replaceOptions !== undefined ? [replace(replaceOptions)] : []),
        ...(plugins ?? []),
      ],
      onwarn(warning, warn) {
        if (
          warning.plugin === "typescript" &&
          warning.pluginCode === "TS5096"
        ) {
          // Suppress TS5096: Option 'allowImportingTsExtensions' can only
          // be used when either 'noEmit' or 'emitDeclarationOnly' is set.
          return;
        }
        warn(warning);
      },
    });
    configs.push(config);
  }

  if (dtsOutput !== undefined) {
    const config = defineConfig({
      input,
      output: dtsOutput,
      external,
      plugins: [
        nodeExternals(),
        nodeResolve({
          extensions: [".js", ".ts"],
          exportConditions,
        }),
        dts(),
      ],
    });
    configs.push(config);
  }

  return configs;
};

export { defineLib };
