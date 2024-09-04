import { resolve as resolvePath } from "node:path";
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import glob from "fast-glob";
import type { RuntimeConfigSource } from "@toolcog/runtime";
import {
  Runtime,
  AgentContext,
  inventoryFileName,
  parseInventory,
} from "@toolcog/runtime";
import { Repl } from "@toolcog/repl";

interface NodeCommandOptions {
  config?: string | boolean | undefined;
  inventory?: string | boolean | undefined;
  generativeModel?: string | undefined;
  embeddingModel?: string | undefined;
  eval?: string | undefined;
  print?: string | boolean | undefined;
  interactive?: boolean | undefined;
}

const configFileName = "toolcog.config.ts";

const runNodeCommand = async (
  scriptFile: string | undefined,
  options: NodeCommandOptions,
): Promise<void> => {
  const configFile =
    typeof options.config === "string" ? options.config
    : options.config === true ? configFileName
    : undefined;

  const inventoryGlob =
    typeof options.inventory === "string" ? options.inventory
    : options.inventory === true ? `**/${inventoryFileName}`
    : undefined;

  const code =
    options.eval ??
    (typeof options.print === "string" ? options.print : undefined);
  const print = options.print !== undefined && options.print !== false;
  const interactive = options.interactive ?? false;

  let runtime: Runtime | null;
  if (configFile !== undefined) {
    const configPath = resolvePath(process.cwd(), configFile);
    const configModule = (await import(configPath)) as {
      default: RuntimeConfigSource;
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

    if (inventoryGlob !== undefined) {
      const inventoryFiles = await glob(inventoryGlob);
      for (const inventoryFile of inventoryFiles) {
        const inventory = parseInventory(
          await readFile(inventoryFile, "utf-8"),
        );
        runtime.inventory.embeddingModels = [
          ...new Set([
            ...runtime.inventory.embeddingModels,
            ...inventory.embeddingModels,
          ]),
        ];
        runtime.inventory.idioms = {
          ...runtime.inventory.idioms,
          ...inventory.idioms,
        };
      }
    }
  }

  await Runtime.run(runtime, async () => {
    // Evaluate input in an agent context.
    await AgentContext.spawn(undefined, async () => {
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
        // Stream responses when running the REPL.
        if (runtime !== null && runtime.generatorConfig.stream == undefined) {
          runtime.generatorConfig.stream = true;
        }

        // Print the REPL banner.
        repl.printBanner();

        // Run the REPL session.
        await repl.run();
      }
    });
  });
};

const createNodeCommand = (name: string): Command => {
  return new Command(name)
    .description("Run toolcog programs with Node.js")
    .option(`-c, --config [${configFileName}]`, "Load config from a file")
    .option(`--inventory [**/${inventoryFileName}]`, "Inventory files to load")
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
