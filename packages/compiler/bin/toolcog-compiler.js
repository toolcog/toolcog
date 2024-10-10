#!/usr/bin/env node

import { Runtime } from "@toolcog/runtime";
import { version } from "@toolcog/compiler";
import { createCompilerCommand } from "@toolcog/compiler/cli";

const runtime = await Runtime.create({
  plugins: [import("@toolcog/openai"), import("@toolcog/anthropic")],
  embedder: {
    model: "text-embedding-3-small",
  },
  generator: {
    system: Runtime.systemPrompt(),
  },
});

await Runtime.run(runtime, () => {
  return createCompilerCommand("toolcog-compiler")
    .version(version)
    .parseAsync(process.argv);
});
