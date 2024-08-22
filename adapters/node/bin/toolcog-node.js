#!/usr/bin/env node

import { Runtime } from "@toolcog/runtime";
import { createNodeCommand, version } from "@toolcog/node";
import "@toolcog/node/quiet";
import "@toolcog/node/register";

const runtime = await Runtime.create({
  plugins: [
    import("@toolcog/openai").then((plugin) => plugin.default()),
    import("@toolcog/anthropic").then((plugin) => plugin.default()),
  ],
});

await Runtime.run(runtime, () => {
  return createNodeCommand("toolcog-node")
    .version(version)
    .parseAsync(process.argv);
});
