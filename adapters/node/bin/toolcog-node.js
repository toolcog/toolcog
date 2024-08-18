#!/usr/bin/env node

import { runMain } from "citty";
import { nodeCommand, version } from "@toolcog/node";

await runMain({
  ...nodeCommand,
  meta: {
    name: "toolcog-node",
    version,
    description: nodeCommand.meta.description,
  },
});
