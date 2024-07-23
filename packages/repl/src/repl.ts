import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { EOL, homedir } from "node:os";
import { dirname, resolve } from "node:path";
import type { CompleterResult } from "node:readline";
import type { Interface } from "node:readline";
import { createInterface, cursorTo } from "node:readline";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import { constants, runInThisContext } from "node:vm";
import ts from "typescript";
import type { Style } from "@toolcog/util/tty";
import { stylize, splitLines, wrapText } from "@toolcog/util/tty";
import type { Tool } from "@toolcog/core";
import { Toolcog } from "@toolcog/core";
import { Job } from "@toolcog/runtime";
import {
  getModuleExportType,
  toolcogTransformerFactory,
} from "@toolcog/compiler";
import { classifyInput } from "./classify-input.ts";
import { transformImportDeclaration } from "./transform-import.ts";
import { transformTopLevelAwait } from "./transform-await.ts";
import { reportStatus } from "./report-status.ts";

interface ReplOptions {
  input?: NodeJS.ReadableStream | undefined;
  output?: NodeJS.WritableStream | undefined;

  terminal?: boolean | undefined;
  styled?: boolean | undefined;

  historyFile?: string | undefined;
  historySize?: number | undefined;

  languageVersion?: ts.ScriptTarget | undefined;
  languageVariant?: ts.LanguageVariant | undefined;

  compilerOptions?: ts.CompilerOptions | undefined;

  documentRegistry?: ts.DocumentRegistry | undefined;
}

class Repl {
  readonly #input: NodeJS.ReadableStream;
  readonly #output: NodeJS.WritableStream;

  readonly #terminal: boolean | undefined;
  readonly #styled: boolean;
  readonly #style: Style;

  readonly #historyFile: string;
  readonly #historySize: number;

  readonly #languageVersion: ts.ScriptTarget;
  readonly #languageVariant: ts.LanguageVariant;

  readonly #compilerOptions: ts.CompilerOptions;

  readonly #scanner: ts.Scanner;
  readonly #printer: ts.Printer;

  readonly #languageService: ts.LanguageService;

  readonly #scriptName: string;
  #scriptSnapshot: ts.IScriptSnapshot | undefined;
  #scriptVersion: number;

  #cumulativeInput: string;
  #bufferedInput: string;
  #turnCount: number;

  #executedStatementCount: number;
  #pendingStatementCount: number;

  #pendingBindingTypes: Record<string, ts.Type>;

  #tools: Tool[];

  #abortController: AbortController | null;

  constructor(options?: ReplOptions) {
    this.#input = options?.input ?? process.stdin;
    this.#output = options?.output ?? process.stdout;

    this.#terminal = options?.terminal;
    this.#styled =
      options?.styled ??
      (this.#terminal === true ||
        (this.#output as Partial<NodeJS.WriteStream>).isTTY === true);
    this.#style = stylize(this.#styled);

    this.#historyFile =
      options?.historyFile ?? resolve(homedir(), ".toolcog", "repl_history");
    this.#historySize = options?.historySize ?? 50;

    this.#languageVersion = options?.languageVersion ?? ts.ScriptTarget.Latest;
    this.#languageVariant =
      options?.languageVariant ?? ts.LanguageVariant.Standard;

    this.#compilerOptions = options?.compilerOptions ?? {
      allowImportingTsExtensions: true,
      module: ts.ModuleKind.NodeNext,
      outdir: resolve(process.cwd(), "dist"),
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ESNext,
    };

    this.#scanner = ts.createScanner(
      this.#languageVersion,
      false,
      this.#languageVariant,
    );
    this.#printer = ts.createPrinter();

    const documentRegistry =
      options?.documentRegistry ?? ts.createDocumentRegistry();

    const languageServiceHost = {
      getScriptFileNames: () => [this.#scriptName],
      getScriptVersion: (fileName) => {
        if (fileName === this.#scriptName) {
          return this.#scriptVersion.toString();
        }
        return "0";
      },
      getScriptSnapshot: (fileName) => {
        if (fileName === this.#scriptName) {
          return this.#scriptSnapshot;
        }

        const fileText = ts.sys.readFile(fileName);
        if (fileText !== undefined) {
          return ts.ScriptSnapshot.fromString(fileText);
        }

        return undefined;
      },
      getCurrentDirectory: () => process.cwd(),
      getCompilationSettings: () => this.#compilerOptions,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
      realpath: ts.sys.realpath!,
      getCustomTransformers: (): ts.CustomTransformers | undefined => {
        return {
          before: [
            toolcogTransformerFactory(
              this.#languageService.getProgram()!,
              {
                keepIntrinsicImports: true,
              },
              undefined,
              languageServiceHost,
            ),
            this.#postprocessor(this.#languageService.getProgram()!),
          ],
        };
      },
      resolveModuleNames: (
        moduleNames: string[],
        containingFile: string,
        reusedNames: string[] | undefined,
        redirectedReference: ts.ResolvedProjectReference | undefined,
        compilerOptions: ts.CompilerOptions,
        containingSourceFile?: ts.SourceFile,
      ): (ts.ResolvedModule | undefined)[] => {
        return moduleNames.map(
          (moduleName: string): ts.ResolvedModule | undefined => {
            let resolvedModule = ts.resolveModuleName(
              moduleName,
              containingFile,
              compilerOptions,
              languageServiceHost,
              undefined,
              redirectedReference,
            ).resolvedModule;

            // Check for failed resolution of a builtin module.
            if (
              resolvedModule === undefined &&
              (moduleName === "toolcog" || moduleName.startsWith("@toolcog/"))
            ) {
              // Try to resolve builtin modules relative to the loader;
              // this enables builtin imports regardless of current directory.
              resolvedModule = ts.resolveModuleName(
                moduleName,
                fileURLToPath(import.meta.url),
                compilerOptions,
                languageServiceHost,
                undefined,
                redirectedReference,
              ).resolvedModule;
            }

            return resolvedModule;
          },
        );
      },
    } satisfies ts.LanguageServiceHost;

    this.#languageService = ts.createLanguageService(
      languageServiceHost,
      documentRegistry,
    );

    this.#scriptName = resolve(process.cwd(), "[repl].mts");
    this.#scriptSnapshot = undefined;
    this.#scriptVersion = 0;

    this.#cumulativeInput = "";
    this.#bufferedInput = "";
    this.#turnCount = 1;

    this.#executedStatementCount = 0;
    this.#pendingStatementCount = 0;

    this.#pendingBindingTypes = {};

    this.#tools = [];

    this.#abortController = null;
  }

  get version(): string {
    return __version__;
  }

  get input(): NodeJS.ReadableStream {
    return this.#input;
  }

  get output(): NodeJS.WritableStream {
    return this.#output;
  }

  get outputRows(): number | undefined {
    return (this.#output as Partial<NodeJS.WriteStream>).isTTY === true ?
        (this.#output as NodeJS.WriteStream).rows
      : undefined;
  }

  get outputCols(): number | undefined {
    return (this.#output as Partial<NodeJS.WriteStream>).isTTY === true ?
        (this.#output as NodeJS.WriteStream).columns
      : undefined;
  }

  get styled(): boolean {
    return this.#styled;
  }

  get style(): Style {
    return this.#style;
  }

  initialPrompt(turn: number): string {
    return this.#style.green(turn + "> ");
  }

  continuationPrompt(turn: number): string {
    return this.#style.green("| ".padStart(turn.toString().length + 2, " "));
  }

  printBanner(): void {
    this.#output.write(`Welcome to Toolcog v${this.version}`);
    this.#output.write(" (");
    this.#output.write(`Node.js ${process.version}`);
    this.#output.write(", ");
    this.#output.write(`TypeScript v${ts.version}`);
    this.#output.write(")");
    this.#output.write(EOL);

    this.#output.write('Type ".help" for more information.');
    this.#output.write(EOL);
    this.#output.write(EOL);
  }

  async evalPrelude(): Promise<void> {
    // Import toolcog intrinsics.
    await this.evalCode(
      'import { defineTool, useTool, generate } from "@toolcog/core";\n',
    );
    // Un-increment the turn count.
    this.#turnCount -= 1;
  }

  async #createInterface(): Promise<Interface> {
    // Load REPL history from file.
    let history: string[] | undefined;
    if (this.#historySize > 0 && existsSync(this.#historyFile)) {
      const historyData = await readFile(this.#historyFile, "utf-8");
      history = splitLines(historyData).reverse();
    }

    // Create the readline interface.
    const readline = createInterface({
      input: this.#input,
      output: this.#output,
      terminal: this.#terminal,
      completer: this.#completer,
      history,
      historySize: this.#historySize,
    });

    // Handle history change events.
    readline.on("history", async (history: string[]): Promise<void> => {
      if (this.#historySize === 0) {
        return;
      }
      const historyDir = dirname(this.#historyFile);
      if (!existsSync(historyDir)) {
        await mkdir(historyDir, { recursive: true });
      }
      const historyData = history.slice().reverse().join(EOL);
      await writeFile(this.#historyFile, historyData, "utf-8");
    });

    return readline;
  }

  async run(): Promise<void> {
    // Initialize the readline interface.
    const readline = await this.#createInterface();

    // Handle Ctrl+C events.
    readline.on("SIGINT", async () => {
      // Abort any currently active run.
      this.#abortController?.abort();

      // Clear any currently buffered input.
      this.#bufferedInput = "";

      // Move the cursor to the end of the line.
      cursorTo(this.#output, readline.line.length);

      // Reset the line buffer and print a newline.
      (readline as { line: string }).line = "";
      this.#output.write(EOL);

      // Issue a new prompt.
      readline.setPrompt(this.initialPrompt(this.#turnCount));
      readline.prompt();
    });

    // Write the initial REPL prompt.
    readline.setPrompt(this.initialPrompt(this.#turnCount));
    readline.prompt();

    // Iterate over all input lines received by the REPL.
    for await (const line of readline) {
      // Check for non-continuation line special cases.
      if (this.#bufferedInput.length === 0) {
        const input = line.trim();

        // Check for an empty input line.
        if (input.length === 0) {
          // Issue a new prompt and wait for the next line.
          readline.prompt();
          continue;
        }

        // Check for an explicit exit command.
        if (input === ".exit") {
          readline.close();
          break;
        }
      }

      // Append the new input line to the currently buffered input.
      this.#bufferedInput += line + EOL;

      // Classify the currently buffered input as natural language,
      // code, or as needing a continuation line.
      const inputType = classifyInput(this.#scanner, this.#bufferedInput);

      // Check if the input needs a continuation line.
      if (inputType === "cont") {
        // Issue a continuation prompt and wait for the next line.
        readline.setPrompt(this.continuationPrompt(this.#turnCount));
        readline.prompt();
        continue;
      }

      // Capture full stack traces on error.
      const stackTraceLimit = Error.stackTraceLimit;
      Error.stackTraceLimit = Infinity;
      try {
        if (inputType === "lang") {
          // Evaluate natural language input.
          await this.#runLang(this.#bufferedInput, readline);
        } else {
          // Evaluate code input.
          await this.#runCode(this.#bufferedInput, readline);
        }
      } catch (error) {
        // Print the error to the output stream and continue.
        this.printError(error);
      } finally {
        // Write a newline to provide visual separation.
        this.#output.write(EOL);

        // Reset stack trace limit.
        Error.stackTraceLimit = stackTraceLimit;

        // Reset the input buffer.
        this.#bufferedInput = "";

        // Issue the next prompt.
        readline.setPrompt(this.initialPrompt(this.#turnCount));
        readline.prompt();
      }
    }

    // Write a newline before exiting the REPL.
    this.#output.write(EOL);
  }

  printError(error: unknown): void {
    this.#output.write(this.#style.red(String(error)) + EOL);
  }

  async #runLang(input: string, readline: Interface): Promise<void> {
    await Job.run({ title: "Prompt" }, async (root) => {
      // Print job status updates.
      const finished = reportStatus(
        { root },
        {
          input: this.#input,
          output: this.#output,
          readline,
          styled: this.#styled,
        },
      );

      let output: string;
      try {
        // Evaluate the natural language prompt.
        output = await this.evalLang(input);
      } finally {
        // Wait for all job status updates to finish.
        root.finish();
        await finished;
      }

      // Print the natural language prompt completion to the output stream.
      if (typeof output === "string") {
        this.printText(this.#style.green(output + EOL));
      } else {
        this.printValue(output);
      }
    });
  }

  printText(text: string): void {
    const outputCols = this.outputCols;
    if (outputCols !== undefined) {
      text = wrapText(text, outputCols - 1);
    }
    this.#output.write(text);
  }

  async evalLang(input: string): Promise<string> {
    this.#abortController = new AbortController();
    try {
      // Complete the natural language using the default generative model.
      const toolcog = await Toolcog.current();
      const model = await toolcog.getGenerativeModel();
      const output = await model.generate(input, undefined, {
        tools: this.#tools,
        signal: this.#abortController.signal,
      });

      // Increment the turn count.
      this.#turnCount += 1;

      // Return the natural language prompt completion.
      return output;
    } finally {
      this.#abortController = null;
    }
  }

  async #runCode(input: string, readline: Interface): Promise<void> {
    await Job.run(undefined, async (root) => {
      // Print job status updates.
      const finished = reportStatus(
        { root },
        {
          input: this.#input,
          output: this.#output,
          readline,
          styled: this.#styled,
        },
      );

      let bindings: Record<string, unknown>;
      try {
        // Evaluate the input code.
        bindings = await this.evalCode(input);
      } finally {
        // Wait for all job status updates to finish.
        root.finish();
        await finished;
      }

      // Print all newly declared bindings to the output stream.
      this.printBindings(bindings);
    });
  }

  printBindings(bindings: Record<string, unknown>): void {
    for (const key in bindings) {
      const value = bindings[key];
      this.#output.write(this.#style.green(key));
      this.#output.write(": ");
      this.printValue(value);
    }
  }

  printValue(value: unknown): void {
    this.#output.write(this.formatValue(value) + EOL);
  }

  formatValue(value: unknown): string {
    return inspect(value, { colors: true, showProxy: true });
  }

  async evalCode(input: string): Promise<Record<string, unknown>> {
    // Preprocess the currently buffered input.
    const processedInput = this.#preprocess(input);

    // Compile and evaluate the preprocessed input.
    const bindings = await this.#evaluate(processedInput);

    // Incorporate all newly declared bindings into the REPL's state.
    this.#updateBindings(bindings, this.#pendingBindingTypes);

    // Increment the turn count.
    this.#turnCount += 1;

    // Commit the successfully evaluated code.
    this.#cumulativeInput += processedInput;
    this.#executedStatementCount += this.#pendingStatementCount;
    this.#pendingStatementCount = 0;
    this.#pendingBindingTypes = {};

    // Return the newly declared bindings.
    return bindings;
  }

  #updateBindings(
    bindings: Record<string, unknown>,
    bindingTypes: Record<string, ts.Type>,
  ): void {
    // Assign all newly declared bindings to the VM context.
    Object.assign(globalThis, bindings);

    const program = this.#languageService.getProgram()!;
    const checker = program.getTypeChecker();
    const useToolType = getModuleExportType(
      ts,
      ts.sys,
      program,
      checker,
      "UseAnyTool",
      "@toolcog/core",
      "",
    );

    if (useToolType !== undefined) {
      for (const bindingName in bindingTypes) {
        const bindingType = bindingTypes[bindingName]!;
        if (checker.isTypeAssignableTo(bindingType, useToolType)) {
          this.addTool(bindingName, bindings[bindingName]! as Tool);
        }
      }
    }
  }

  get tools(): readonly Tool[] {
    return this.#tools;
  }

  addTool(toolName: string, tool: Tool): void {
    this.#tools.push(tool);
  }

  #preprocess(input: string): string {
    const sourceFile = ts.createSourceFile(this.#scriptName, input, {
      languageVersion: this.#languageVersion,
      impliedNodeFormat: ts.ModuleKind.ESNext,
    });

    const transformationResult = ts.transform(
      sourceFile,
      [this.#preprocessor],
      this.#compilerOptions,
    );

    return this.#printer.printNode(
      ts.EmitHint.SourceFile,
      transformationResult.transformed[0]!,
      transformationResult.transformed[0]!,
    );
  }

  #evaluate(processedInput: string): Promise<Record<string, unknown>> {
    // Compile typescript to javascript.
    const executableCode = this.#compile(processedInput);

    // Execute the transpiled javascript code.
    const bindings = runInThisContext(executableCode, {
      breakOnSigint: true,
      importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
    }) as Record<string, unknown>;

    return Promise.resolve(bindings);
  }

  #compile(processedInput: string): string {
    // Update the script snapshot with the current cumulative input.
    this.#scriptSnapshot = ts.ScriptSnapshot.fromString(
      this.#cumulativeInput + processedInput,
    );
    this.#scriptVersion += 1;

    // Transpile typescript to javascript.
    const output = this.#languageService.getEmitOutput(this.#scriptName, false);
    const diagnostics = [
      ...this.#languageService.getCompilerOptionsDiagnostics(),
      ...this.#languageService.getSyntacticDiagnostics(this.#scriptName),
      ...this.#languageService.getSemanticDiagnostics(this.#scriptName),
    ].filter((diagnostic) => {
      if (
        diagnostic.code === 5096 // Allow importing .ts extensions.
      ) {
        return false;
      }
      return true;
    });
    if (diagnostics.length !== 0) {
      let message = "";
      for (let i = 0; i < diagnostics.length; i += 1) {
        if (i !== 0) {
          message += "\n";
        }
        message += ts.flattenDiagnosticMessageText(
          diagnostics[i]!.messageText,
          "\n",
        );
      }
      throw new Error(message);
    }

    // Get the transpiled javascript code.
    let transpiledCode = output.outputFiles[0]!.text;

    // Remove injected trailing `export {}` that makes node barf.
    if (transpiledCode.endsWith("export {};\n")) {
      transpiledCode = transpiledCode.slice(0, -"export {};\n".length);
    } else if (transpiledCode.endsWith("export {};\r\n")) {
      transpiledCode = transpiledCode.slice(0, -"export {};\r\n".length);
    }

    return transpiledCode;
  }

  #completer = (line: string): CompleterResult => {
    // Combine cumulative and currently buffered input.
    const input = this.#cumulativeInput + this.#bufferedInput + line + EOL;

    // Update the script snapshot with the combined input.
    this.#scriptSnapshot = ts.ScriptSnapshot.fromString(input);
    this.#scriptVersion += 1;

    // Get the completions at the current position.
    const completions = this.#languageService.getCompletionsAtPosition(
      this.#scriptName,
      input.length,
      {},
    );

    if (completions === undefined) {
      return [[], line];
    }

    // Get the completion entries.
    const completionEntries = completions.entries.map((entry) => entry.name);

    // Filter the completions to match the suffix.
    const filteredCompletions = completionEntries.filter((completion) =>
      completion.startsWith(line),
    );

    return [filteredCompletions, line];
  };

  readonly #preprocessor = (
    context: ts.TransformationContext,
  ): ts.Transformer<ts.SourceFile> => {
    const transformLastStatement = (statement: ts.Statement): ts.Statement => {
      if (!ts.isExpressionStatement(statement)) {
        return statement;
      }

      // Don't assign intrinsic tool statements to result variables.
      if (
        ts.isCallExpression(statement.expression) &&
        ts.isIdentifier(statement.expression.expression) &&
        (statement.expression.expression.text === "defineTool" ||
          statement.expression.expression.text === "useTool")
      ) {
        return statement;
      }

      // Assign the last expression to a result variable.
      const resultVariableName = ts.factory.createUniqueName(
        `_${this.#turnCount}`,
        ts.GeneratedIdentifierFlags.Optimistic |
          ts.GeneratedIdentifierFlags.AllowNameSubstitution,
      );
      return ts.factory.createVariableStatement(
        undefined,
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              resultVariableName,
              undefined,
              undefined,
              statement.expression,
            ),
          ],
          ts.NodeFlags.Const,
        ),
      );
    };

    return (sourceFile: ts.SourceFile): ts.SourceFile => {
      return context.factory.updateSourceFile(sourceFile, [
        // Passthrough all but the last statement.
        ...sourceFile.statements.slice(0, -1),
        // Try to assign the last expression to a result variable.
        ...sourceFile.statements.slice(-1).map(transformLastStatement),
      ]);
    };
  };

  readonly #postprocessor =
    (program: ts.Program) =>
    (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
      const factory = context.factory;
      const checker = program.getTypeChecker();

      const visitNext = (node: ts.Node): ts.Node | undefined => {
        if (ts.isImportDeclaration(node) && node.importClause !== undefined) {
          // Transform import declaration to awaited dynamic import statement.
          return transformImportDeclaration(factory, node);
        }

        if (ts.isBlockScope(node, node.parent)) {
          // Don't descend into nested block scopes.
          return node;
        }

        return ts.visitEachChild(node, visitNext, context);
      };

      return (sourceFile: ts.SourceFile): ts.SourceFile => {
        if (sourceFile.fileName !== this.#scriptName) {
          return sourceFile;
        }

        const statements = ts.visitNodes(
          sourceFile.statements,
          visitNext,
          undefined,
          this.#executedStatementCount,
          undefined,
        ) as ts.NodeArray<ts.Statement>;

        this.#pendingStatementCount = statements.length;

        return factory.updateSourceFile(sourceFile, [
          // Wrap all statements in an async IIFE that returns an object
          // containing all declared bindings.
          transformTopLevelAwait(
            factory,
            checker,
            statements,
            this.#pendingBindingTypes,
          ),
        ]);
      };
    };
}

export type { ReplOptions };
export { Repl };
