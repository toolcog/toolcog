import { Command } from "commander";

declare const __version__: string;
declare const __description__: string;

const program = new Command("toolcog")
  .version(__version__)
  .description(__description__)
  .option("-e, --eval <code>", "evaluate code")
  .option(
    "-i, --interactive",
    "start the REPL even if stdin does not appear to be a terminal",
  )
  .argument("[files...]")
  .action(() => {
    // TODO
  });

export { program };
