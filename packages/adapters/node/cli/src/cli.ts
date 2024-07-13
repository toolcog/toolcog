import { Command } from "commander";
import { runCommand } from "./run.ts";

const cli = (name?: string): Command => {
  return runCommand(name ?? "toolcog-node")
    .version(__version__)
    .description(__description__);
};

export { cli };
