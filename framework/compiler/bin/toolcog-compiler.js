#!/usr/bin/env node

import { Runtime } from "@toolcog/runtime";
import { createCompilerCommand, version } from "@toolcog/compiler/cli";

const runtime = await Runtime.create({
  plugins: [import("@toolcog/openai").then((plugin) => plugin.default())],
});

await Runtime.run(runtime, () => {
  return createCompilerCommand("toolcog-compiler")
    .version(version)
    .parseAsync(process.argv);
});
