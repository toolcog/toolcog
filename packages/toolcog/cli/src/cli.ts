import { Command } from "commander";
import { runCommand } from "@toolcog/node/cli";

const cli = (name?: string): Command => {
  return runCommand(name ?? "toolcog")
    .version(__version__)
    .description(__description__);
};

export { cli };
