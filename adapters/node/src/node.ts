import { resolve } from "node:path";
import { defineCommand } from "citty";
import { Thread, withTools } from "@toolcog/runtime";
import { Repl } from "@toolcog/repl";
import { spawnLoader } from "./spawn.ts";

interface NodeCommandArgs {
  loaded?: boolean;
  eval?: string;
  print?: string | boolean;
  interactive?: boolean;
}

const runNodeCommand = async (
  script: string | undefined,
  options: NodeCommandArgs,
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

const nodeCommand = defineCommand({
  meta: {
    name: "node",
    description: "Run toolcog programs with Node.js",
  },
  args: {
    loaded: {
      type: "boolean",
      description:
        "Indicates that the toolcog esm module hooks are loaded (internal)",
    },
    eval: {
      type: "string",
      alias: "e",
      valueHint: "CODE",
      description: "Evaluate code",
    },
    print: {
      type: "string",
      alias: "p",
      valueHint: "CODE",
      description: "Evaluate code and print the result",
    },
    interactive: {
      type: "boolean",
      alias: "i",
      description:
        "Start the REPL even if stdin does not appear to be a terminal",
    },
    script: {
      type: "positional",
      description: "The script to execute",
      required: false,
    },
  },
  run: ({ args, cmd }) => {
    if (
      args._[0] !== undefined &&
      cmd.subCommands !== undefined &&
      args._[0] in cmd.subCommands
    ) {
      return;
    }

    return runNodeCommand(args.script, {
      loaded: args.loaded,
      eval: args.eval,
      print: args.print === "" ? true : args.print,
      interactive: args.interactive,
    });
  },
});

export type { NodeCommandArgs };
export { runNodeCommand, nodeCommand };
