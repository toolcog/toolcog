#!/usr/bin/env node

import { runMain } from "citty";
import { toolcogCommand, version } from "toolcog";

await runMain({
  ...toolcogCommand,
  meta: {
    name: "toolcog",
    version,
    description: toolcogCommand.meta.description,
  },
});
