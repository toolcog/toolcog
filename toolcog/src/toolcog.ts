import { Command } from "commander";
import { createGenerateCommand } from "@toolcog/compiler/cli";
import { createNodeCommand } from "@toolcog/node";

const createToolcogCommand = (name: string): Command => {
  return createNodeCommand(name)
    .description("Run toolcog programs")
    .addCommand(createGenerateCommand("generate"));
};

export { createToolcogCommand };
