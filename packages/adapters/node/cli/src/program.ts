import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command, Option } from "commander";
import ts from "typescript";
import { Thread } from "@toolcog/core";
import { Repl } from "@toolcog/repl";

declare const __version__: string;
declare const __description__: string;

const programAction = async (
  files: readonly string[],
  options: { loaded?: boolean; eval?: string; interactive?: boolean },
): Promise<void> => {
  if (options.loaded !== true) {
    // Spawn a child process with the @toolcog/node/loader enabled.
    const child = spawn(
      process.execPath,
      [
        "--require",
        fileURLToPath(import.meta.resolve("../../quiet/dist/lib.cjs")),
        "--loader",
        import.meta.resolve("../../loader/dist/lib.js"),
        process.argv[1]!,
        "--loaded",
        ...process.argv.slice(2),
      ],
      {
        argv0: process.argv0,
        env: process.env,
        stdio: "inherit",
      },
    );

    const code = await new Promise<number>((resolve) => {
      child.on("close", (code) => {
        resolve(code ?? 1);
      });
    });

    // Exit the parent process when the child process exits.
    return process.exit(code);
  }

  // The @toolcog/node/loader is presumed to be enabled here.

  const { eval: code, interactive = false } = options;
  const executeEval = code !== undefined && !(interactive && files.length > 0);
  const executeEntrypoint = !executeEval && files.length > 0;
  const executeRepl =
    !executeEntrypoint &&
    (interactive || (!!process.stdin.isTTY && !executeEval));
  const executeStdin = !executeEval && !executeRepl && !executeEntrypoint;

  if (executeEntrypoint) {
    for (const file of files) {
      const filePath = resolve(process.cwd(), file);
      await import(filePath);
    }
  } else {
    if (executeEval) {
      // TODO
    }
    if (executeRepl) {
      // Random node warnings are extremely disruptive and unhelpful.
      process.removeAllListeners("warning");

      const thread = Thread.create();
      await Thread.run(thread, async () => {
        // Instantiate the REPL.
        const repl = new Repl();

        // Print the REPL banner.
        console.log(
          `Welcome to Toolcog v${__version__} (Node.js ${process.version}, TypeScript v${ts.version}).`,
        );
        console.log('Type ".help" for more information.');
        console.log();

        // Run the REPL session.
        await repl.run();
      });
    }
    if (executeStdin) {
      // TODO
    }
  }
};

const program = new Command("toolcog-node")
  .version(__version__)
  .description(__description__)
  .addOption(
    new Option(
      "--loaded",
      "indicates that esm module hooks are loaded",
    ).hideHelp(),
  )
  .option("-e, --eval <code>", "evaluate code")
  .option(
    "-i, --interactive",
    "start the REPL even if stdin does not appear to be a terminal",
  )
  .argument("[files...]")
  .action(programAction);

export { program };
