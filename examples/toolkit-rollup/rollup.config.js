import { defineConfig } from "rollup";
import { nodeExternals } from "rollup-plugin-node-externals";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { dts } from "rollup-plugin-dts";
import { toolcogTransformer } from "@toolcog/compiler";

// Define ESM and CJS bundles.
const jsConfig = defineConfig({
  input: "./src/lib.ts",
  output: [
    {
      file: "./dist/lib.js",
      format: "esm",
      exports: "named",
      sourcemap: true,
    },
    {
      file: "./dist/lib.cjs",
      format: "cjs",
      exports: "named",
      sourcemap: true,
    },
  ],
  plugins: [
    // Bundle devDependencies while marking all others as external.
    nodeExternals(),
    // Resolve package dependencies.
    nodeResolve({ extensions: [".js", ".ts"] }),
    // Transpile TypeScript to JavaScript.
    typescript({
      transformers: (program) => ({
        before: [
          // Enable the Toolcog transformer.
          toolcogTransformer(program, {
            moduleId: false,
          }),
        ],
      }),
    }),
  ],
});

// Define DTS bundle.
const dtsConfig = defineConfig({
  input: "./src/lib.ts",
  output: {
    file: "./dist/lib.d.ts",
    format: "esm",
  },
  plugins: [
    nodeExternals(),
    nodeResolve({ extensions: [".js", ".ts"] }),
    // Generate TypeScript declarations.
    dts(),
  ],
});

export default [jsConfig, dtsConfig];
