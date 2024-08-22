#!/usr/bin/env node

import { Runtime } from "@toolcog/runtime";
import { createToolcogCommand, version } from "toolcog";
import "@toolcog/node/quiet";
import "@toolcog/node/register";

const runtime = await Runtime.create({
  generator: {
    system: Runtime.systemPrompt(),
  },
  plugins: [
    import("@toolcog/openai").then((plugin) => plugin.default()),
    import("@toolcog/anthropic").then((plugin) => plugin.default()),
  ],
});

await Runtime.run(runtime, () => {
  return createToolcogCommand("toolcog")
    .version(version)
    .parseAsync(process.argv);
});
