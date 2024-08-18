import { defineCommand } from "citty";
import { generateCommand } from "@toolcog/compiler/cli";
import { nodeCommand } from "@toolcog/node";

const toolcogCommand = defineCommand({
  ...nodeCommand,
  meta: {
    name: "toolcog",
    description: "Run toolcog programs",
  },
  subCommands: {
    generate: generateCommand,
  },
});

export { toolcogCommand };
