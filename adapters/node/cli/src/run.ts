import { resolve } from "node:path";
import { Command, Option } from "commander";
import { Thread, withTools } from "@toolcog/runtime";
import { Repl } from "@toolcog/repl";
import { spawnLoader } from "./spawn.ts";

interface RunOptions {
  loaded?: boolean;
  eval?: string;
  print?: string | boolean;
  interactive?: boolean;
}

const run = async (
  script: string | undefined,
  options: RunOptions,
): Promise<void> => {
  // Check if the @toolcog/node/loader needs to be enabled.
  if (options.loaded !== true) {
    // Spawn a child process with the loader enabled.
    const exitCode = await spawnLoader();
    // Exit the parent process when the child process exits.
    return process.exit(exitCode);
  }

  // Normalize options.
  const code =
    options.eval ??
    (typeof options.print === "string" ? options.print : undefined);
  const print = options.print !== undefined && options.print !== false;
  const interactive = options.interactive ?? false;

  // Run script except when evaluating non-interactive code.
  if (script !== undefined && (code === undefined || interactive)) {
    const scriptPath = resolve(process.cwd(), script);
    await import(scriptPath);
    return;
  }

  // Evaluate all input in a contiguous conversation thread.
  const thread = await Thread.create();
  await Thread.run(thread, async () => {
    // Evaluate input in a tools scope.
    await withTools([], async () => {
      // Instantiate a REPL to evaluate code.
      const repl = new Repl();

      // Evaluate the builtin prelude.
      await repl.evalPrelude();

      // Check if a code argument was provided.
      if (code !== undefined) {
        // Evaluate the code argument.
        const bindings = await repl.evalCode(code);
        // Check if the result should be printed.
        if (print) {
          // Print the result variable.
          repl.output.write(repl.formatValue(bindings._1) + "\n");
        }
      }

      // Check if the REPL should be run.
      if (interactive || (code === undefined && process.stdin.isTTY)) {
        // Print the REPL banner.
        repl.printBanner();
        // Run the REPL session.
        await repl.run();
      }
    });
  });
};

const runCommand = (name?: string): Command => {
  return new Command(name)
    .addOption(
      new Option(
        "--loaded",
        "indicates that esm module hooks are loaded",
      ).hideHelp(),
    )
    .option("-e, --eval <code>", "evaluate code")
    .option("-p, --print [code]", "evaluate code and print the result")
    .option(
      "-i, --interactive",
      "start the REPL even if stdin does not appear to be a terminal",
    )
    .argument("[script.ts]")
    .action(run);
};

export type { RunOptions };
export { run, runCommand };
