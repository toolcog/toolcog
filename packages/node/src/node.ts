import { resolve as resolvePath } from "node:path";
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import glob from "fast-glob";
import type {
  AgentContextOptions,
  Plugin,
  PluginSource,
  Toolkit,
  ToolkitSource,
  Inventory,
  RuntimeConfigSource,
} from "@toolcog/runtime";
import {
  AgentContext,
  Runtime,
  resolvePlugins,
  resolveToolkits,
  inventoryFileName,
  parseInventory,
} from "@toolcog/runtime";
import { Repl } from "@toolcog/repl";
import {
  isPackageImport,
  loadModules,
  loadOrInstallModules,
} from "@toolcog/node/installer";

interface NodeCommandOptions {
  config?: string | boolean | undefined;
  plugin?: string[] | undefined;
  toolkit?: string[] | undefined;
  toolLimit?: number | undefined;
  inventory?: string | boolean | undefined;
  generativeModel?: string | undefined;
  embeddingModel?: string | undefined;
  printMarkdown?: boolean | undefined;
  printTools?: boolean | undefined;
  printToolArgs?: boolean | undefined;
  printToolResults?: boolean | undefined;
  eval?: string | undefined;
  print?: string | boolean | undefined;
  interactive?: boolean | undefined;
}

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

  let agentContextOptions: AgentContextOptions | undefined;
  if (runtime !== null) {
    if (options.generativeModel !== undefined) {
      runtime.generatorConfig.model = options.generativeModel;
    }
    if (options.embeddingModel !== undefined) {
      runtime.embedderConfig.model = options.embeddingModel;
    }

    const plugins = await loadPlugins(options.plugin);
    for (const plugin of plugins) {
      runtime.addPlugin(plugin);
    }

    const [toolkits, inventories] = await loadToolkits(options.toolkit);
    for (const toolkit of toolkits) {
      runtime.addToolkit(toolkit);
    }
    for (const inventory of inventories) {
      runtime.addInventory(inventory);
    }

    if (inventoryGlob !== undefined) {
      const inventoryFiles = await glob(inventoryGlob);
      for (const inventoryFile of inventoryFiles) {
        const inventory = parseInventory(
          await readFile(inventoryFile, "utf-8"),
        );
        runtime.addInventory(inventory);
      }
    }

    agentContextOptions = {
      tools: [
        await runtime.toolIndex({
          limit: options.toolLimit,
        }),
      ],
    };
  }

  await Runtime.run(runtime, async () => {
    // Evaluate input in an agent context.
    await AgentContext.spawn(agentContextOptions, async () => {
      // Run script, if not evaluating non-interactive code.
      if (scriptFile !== undefined && (code === undefined || interactive)) {
        const scriptPath = resolvePath(process.cwd(), scriptFile);
        await import(scriptPath);
        return;
      }

      // Instantiate a REPL to evaluate code.
      const repl = new Repl({
        printMarkdown: options?.printMarkdown,
        printTools: options?.printTools,
        printToolArgs: options?.printToolArgs,
        printToolResults: options?.printToolResults,
      });

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
    .option<string[]>(
      "--plugin <pluginModule...>",
      "Load the specified plugin",
      (moduleName, moduleNames) => [...moduleNames, ...moduleName.split(",")],
      [],
    )
    .option<string[]>(
      "--toolkit <toolkitModule...>",
      "Load the specified toolkit",
      (moduleName, moduleNames) => [...moduleNames, ...moduleName.split(",")],
      [],
    )
    .option<number>(
      "--tool-limit <count>",
      "Maximum number of tools to select",
      (value: string) => parseInt(value),
      10,
    )
    .option(`--inventory [**/${inventoryFileName}]`, "Inventory files to load")
    .option("--generative-model <model>", "The generative model to use")
    .option("--embedding-model <model>", "The embedding model to use")
    .option("--print-markdown", "Print markdown formatting in LLM responses")
    .option("--print-tools", "Print LLM tool selections")
    .option("--print-tool-args", "Print arguments to LLM tool calls")
    .option("--print-tool-results", "Print results of LLM tool calls")
    .option("-e, --eval <code>", "Evaluate code")
    .option("-p, --print [code]", "Evaluate code and print the result")
    .option(
      "-i, --interactive",
      "Start the REPL even if stdin does not appear to be a terminal",
    )
    .argument("[script.ts]", "The script to execute")
    .action(runNodeCommand);
};

const configFileName = "toolcog.config.ts";

const loadPlugins = async (
  moduleNames: readonly string[] | undefined,
): Promise<Plugin[]> => {
  if (moduleNames === undefined) {
    return [];
  }

  const { loadedModules: pluginModules } = await loadOrInstallModules(
    moduleNames,
    {
      message: "Need to install the following plugin packages:",
    },
  );

  const pluginSources: PluginSource[] = [];
  for (const [moduleName, moduleImport] of Object.entries(pluginModules)) {
    const module = moduleImport as { readonly default?: () => PluginSource };
    if (module.default === undefined) {
      throw new Error(
        "Plugin " + JSON.stringify(moduleName) + " has no default export",
        { cause: module },
      );
    }
    const pluginSource = module.default();
    pluginSources.push(pluginSource);
  }
  return await resolvePlugins(pluginSources);
};

const loadToolkits = async (
  moduleNames: readonly string[] | undefined,
): Promise<[Toolkit[], Inventory[]]> => {
  if (moduleNames === undefined) {
    return [[], []];
  }

  const { loadedModules: toolkitModules, installDir } =
    await loadOrInstallModules(moduleNames, {
      message: "Need to install the following toolkit packages:",
    });

  const toolkitSources: ToolkitSource[] = [];
  for (const [moduleName, moduleImport] of Object.entries(toolkitModules)) {
    const toolkitModule = moduleImport as { readonly default?: () => Toolkit };
    if (toolkitModule.default === undefined) {
      throw new Error(
        "Toolkit " + JSON.stringify(moduleName) + " has no default export",
        { cause: toolkitModule },
      );
    }
    toolkitSources.push(toolkitModule);
  }
  const toolkits = await resolveToolkits(toolkitSources);

  const { loadedModules: inventoryModules } = await loadModules(
    moduleNames
      .filter(isPackageImport)
      .map((moduleName) => moduleName + "/toolcog-inventory"),
    {
      searchDirs: [
        process.cwd(),
        ...(installDir !== undefined ? [installDir] : []),
      ],
    },
  );

  const inventories: Inventory[] = [];
  for (const [moduleName, moduleImport] of Object.entries(inventoryModules)) {
    const module = moduleImport as { readonly default?: Inventory } | null;
    if (module === null) {
      // Toolkit has no inventory module.
      continue;
    } else if (module.default === undefined) {
      throw new Error(
        "Inventory module " +
          JSON.stringify(moduleName) +
          " has no default export",
        { cause: module },
      );
    }
    const inventory = module.default;
    inventories.push(inventory);
  }

  return [toolkits, inventories];
};

export type { NodeCommandOptions };
export { runNodeCommand, createNodeCommand };
