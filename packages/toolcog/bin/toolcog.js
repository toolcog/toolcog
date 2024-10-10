#!/usr/bin/env node

import { Runtime } from "@toolcog/runtime";
import { createToolcogCommand, version } from "toolcog";
import "@toolcog/node/quiet";
import "@toolcog/node/register";

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
  return createToolcogCommand("toolcog")
    .version(version)
    .parseAsync(process.argv);
});
