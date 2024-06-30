import { defineConfig } from "rollup";
import { nodeExternals } from "rollup-plugin-node-externals";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { dts } from "rollup-plugin-dts";

const defineLib = (options = {}) => {
  const {
    inputName = "lib",
    outputName = inputName,
    formats = ["esm", "cjs", "dts"],
    exportConditions,
    external = [/^@?toolcog\//],
    plugins,
  } = options;

  const esmOutput =
    formats.includes("esm") ?
      {
        file: `./dist/${outputName}.js`,
        format: "esm",
        sourcemap: true,
      }
    : undefined;

  const cjsOutput =
    formats.includes("cjs") ?
      {
        file: `./dist/${outputName}.cjs`,
        format: "cjs",
        sourcemap: true,
      }
    : undefined;

  const dtsOutput =
    formats.includes("dts") ?
      {
        file: `./dist/${outputName}.d.ts`,
        format: "esm",
      }
    : undefined;

  const configs = [];

  if (esmOutput !== undefined || cjsOutput !== undefined) {
    const config = defineConfig({
      input: `./src/${inputName}.ts`,
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
        typescript(),
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
      input: `./src/${inputName}.ts`,
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
