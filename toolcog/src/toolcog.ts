import type { Command } from "commander";
import { createInventoryCommand } from "@toolcog/compiler/cli";
import { createNodeCommand } from "@toolcog/node";

const createToolcogCommand = (name: string): Command => {
  return createNodeCommand(name)
    .description("Run toolcog programs")
    .addCommand(createInventoryCommand("inventory"));
};

export { createToolcogCommand };
