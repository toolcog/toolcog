import { resolve as resolvePath } from "node:path";
import { Command } from "commander";
import type { RuntimeConfig } from "@toolcog/runtime";
import { Runtime, Thread, withTools } from "@toolcog/runtime";
import { Repl } from "@toolcog/repl";

interface NodeCommandOptions {
  config?: string | boolean;
  generativeModel?: string;
  embeddingModel?: string;
  eval?: string;
  print?: string | boolean;
  interactive?: boolean;
}

const runNodeCommand = async (
  scriptFile: string | undefined,
  options: NodeCommandOptions,
): Promise<void> => {
  const configFile =
    options.config === true ? "toolcog.config.ts"
    : options.config === false ? undefined
    : options.config;

  const code =
    options.eval ??
    (typeof options.print === "string" ? options.print : undefined);
  const print = options.print !== undefined && options.print !== false;
  const interactive = options.interactive ?? false;

  let runtime: Runtime | null;
  if (configFile !== undefined) {
    const configPath = resolvePath(process.cwd(), configFile);
    const configModule = (await import(configPath)) as {
      default: RuntimeConfig;
    };
    runtime = await Runtime.create(configModule.default);
  } else {
    runtime = Runtime.get();
  }

  if (runtime !== null) {
    if (options.generativeModel !== undefined) {
      runtime.generatorConfig.model = options.generativeModel;
    }
    if (options.embeddingModel !== undefined) {
      runtime.embedderConfig.model = options.embeddingModel;
    }
  }

  await Runtime.run(runtime, async () => {
    // Evaluate all input in a contiguous conversation thread.
    const thread = await Thread.create();
    await Thread.run(thread, async () => {
      // Evaluate input in a tools scope.
      await withTools([], async () => {
        // Run script, if not evaluating non-interactive code.
        if (scriptFile !== undefined && (code === undefined || interactive)) {
          const scriptPath = resolvePath(process.cwd(), scriptFile);
          await import(scriptPath);
          return;
        }

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
  });
};

const createNodeCommand = (name: string): Command => {
  return new Command(name)
    .description("Run toolcog programs with Node.js")
    .option("-c, --config [toolcog.config.ts]", "Load config from a file")
    .option("--generative-model <model>", "The generative model to use")
    .option("--embedding-model <model>", "The embedding model to use")
    .option("-e, --eval <code>", "Evaluate code")
    .option("-p, --print [code]", "Evaluate code and print the result")
    .option(
      "-i, --interactive",
      "Start the REPL even if stdin does not appear to be a terminal",
    )
    .argument("[script.ts]", "The script to execute")
    .action(runNodeCommand);
};

export type { NodeCommandOptions };
export { runNodeCommand, createNodeCommand };
