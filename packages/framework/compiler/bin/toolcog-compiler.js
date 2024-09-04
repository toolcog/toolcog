#!/usr/bin/env node

import { Runtime } from "@toolcog/runtime";
import { createCompilerCommand, version } from "@toolcog/compiler/cli";

const runtime = await Runtime.create({
  embedder: {
    model: "text-embedding-3-small",
  },
  generator: {
    system: Runtime.systemPrompt(),
  },
  plugins: [
    import("@toolcog/openai").then((plugin) => plugin.default()),
    import("@toolcog/anthropic").then((plugin) => plugin.default()),
  ],
});

await Runtime.run(runtime, () => {
  return createCompilerCommand("toolcog-compiler")
    .version(version)
    .parseAsync(process.argv);
});
