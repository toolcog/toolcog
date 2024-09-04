import { Command } from "commander";
import { createInventoryGenerateCommand } from "./inventory-generate.ts";

const createInventoryCommand = (name: string): Command => {
  return new Command(name)
    .description("Commands for working with toolcog inventory files")
    .addCommand(createInventoryGenerateCommand("generate"));
};

export { createInventoryCommand };
