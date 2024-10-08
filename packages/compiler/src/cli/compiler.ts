import { Command } from "commander";
import { createInventoryCommand } from "./inventory.ts";

const createCompilerCommand = (name: string): Command => {
  return new Command(name)
    .description("Toolcog compiler")
    .addCommand(createInventoryCommand("inventory"));
};

export { createCompilerCommand };
