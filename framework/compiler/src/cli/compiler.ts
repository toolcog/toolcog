import { Command } from "commander";
import { createGenerateCommand } from "./generate.ts";

const createCompilerCommand = (name: string): Command => {
  return new Command(name)
    .description("Toolcog compiler")
    .addCommand(createGenerateCommand("generate"));
};

export { createCompilerCommand };
