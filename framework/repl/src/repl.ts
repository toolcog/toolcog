import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { EOL, homedir } from "node:os";
import { sep, dirname, resolve as resolvePath } from "node:path";
import type { Interface, CompleterResult } from "node:readline";
import { createInterface, cursorTo } from "node:readline";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import { constants, runInThisContext } from "node:vm";
import ts from "typescript";
import { replaceLines, splitLines } from "@toolcog/util";
import type { Style } from "@toolcog/util/tty";
import { stylize, wrapText } from "@toolcog/util/tty";
import { toolcogTransformer } from "@toolcog/compiler";
import { Job, currentTools, generator } from "@toolcog/runtime";
import { classifyInput } from "./classify-input.ts";
import { transformImportDeclaration } from "./transform-import.ts";
import { transformTopLevelAwait } from "./transform-await.ts";
import { reportStatus } from "./report-status.ts";

class ReplCompilerError extends Error {
  readonly diagnostics: readonly ts.Diagnostic[];

  constructor(
    message: string,
    diagnostics: readonly ts.Diagnostic[],
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.diagnostics = diagnostics;
  }
}

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

  readonly #formatDiagnosticsHost: ts.FormatDiagnosticsHost;

  readonly #languageServiceHost: ts.LanguageServiceHost;
  readonly #languageService: ts.LanguageService;

  readonly #scriptName: string;
  #scriptSnapshot: ts.IScriptSnapshot | undefined;
  #scriptVersion: number;

  #cumulativeInput: string;
  #bufferedInput: string;
  #turnCount: number;

  #executedStatementCount: number;
  #pendingStatementCount: number;

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
      options?.historyFile ??
      resolvePath(homedir(), ".toolcog", "repl_history");
    this.#historySize = options?.historySize ?? 50;

    this.#languageVersion = options?.languageVersion ?? ts.ScriptTarget.Latest;
    this.#languageVariant =
      options?.languageVariant ?? ts.LanguageVariant.Standard;

    this.#compilerOptions = options?.compilerOptions ?? {
      allowImportingTsExtensions: true,
      module: ts.ModuleKind.NodeNext,
      outdir: resolvePath(process.cwd(), "dist"),
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

    this.#formatDiagnosticsHost = {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: (fileName: string) => fileName,
      getNewLine: () => ts.sys.newLine,
    };

    this.#languageServiceHost = {
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
            toolcogTransformer(
              this.#languageService.getProgram()!,
              {
                contextToolsImportName: "currentTools",
                contextToolsModuleName: "@toolcog/runtime",
                standalone: true,
                keepIntrinsicImports: true,
              },
              undefined,
              this.#languageServiceHost,
            ),
            this.#postprocessor,
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
              this.#languageServiceHost,
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
                this.#languageServiceHost,
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
      this.#languageServiceHost,
      options?.documentRegistry ?? ts.createDocumentRegistry(),
    );

    this.#scriptName = resolvePath(process.cwd(), "[repl].mts");
    this.#scriptSnapshot = undefined;
    this.#scriptVersion = 0;

    this.#cumulativeInput = "";
    this.#bufferedInput = "";
    this.#turnCount = 1;

    this.#executedStatementCount = 0;
    this.#pendingStatementCount = 0;

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
      "import {\n" +
        "  defineTool,\n" +
        "  defineTools,\n" +
        "  definePrompt,\n" +
        "  prompt,\n" +
        "  embed,\n" +
        "  defineIdiom,\n" +
        "  defineIdioms,\n" +
        "  defineIndex,\n" +
        '} from "@toolcog/core";\n' +
        "import {\n" +
        "  currentTools,\n" +
        "  withTools,\n" +
        "  useTool,\n" +
        "  generator,\n" +
        "  embedder,\n" +
        "  indexer,\n" +
        '} from "@toolcog/runtime";\n',
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
    readline.addListener(
      "history",
      async (history: string[]): Promise<void> => {
        if (this.#historySize === 0) {
          return;
        }
        const historyDir = dirname(this.#historyFile);
        if (!existsSync(historyDir)) {
          await mkdir(historyDir, { recursive: true });
        }
        const historyData = history.slice().reverse().join(EOL);
        await writeFile(this.#historyFile, historyData, "utf-8");
      },
    );

    return readline;
  }

  async run(): Promise<void> {
    repl: while (true) {
      // Initialize the readline interface.
      const readline = await this.#createInterface();

      // Handle Ctrl+C events.
      readline.addListener("SIGINT", () => {
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

      // Count the number of emitted lines to determine when it's safe
      // to break out of the async iterator.
      let bufferedLineCount = 0;
      const readlineEmit: (
        event: string | symbol,
        ...args: unknown[]
      ) => boolean = readline.emit;
      readline.emit = (event: string | symbol, ...args: unknown[]): boolean => {
        if (event === "line") {
          bufferedLineCount += 1;
        }
        return readlineEmit.call(readline, event, ...args);
      };

      let inputType: "lang" | "code" | "cont" | undefined;

      // Iterate over all input lines received by the REPL.
      for await (const line of readline) {
        bufferedLineCount -= 1;

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
            break repl;
          }
        }

        // Append the new input line to the currently buffered input.
        this.#bufferedInput += line + EOL;

        // Consume all buffered lines before processing input.
        if (bufferedLineCount > 0) {
          continue;
        }

        // Classify the currently buffered input as natural language,
        // code, or as needing a continuation line.
        inputType = classifyInput(this.#scanner, this.#bufferedInput);

        // Check if the input needs a continuation line.
        if (inputType === "cont") {
          // Issue a continuation prompt and wait for the next line.
          readline.setPrompt(this.continuationPrompt(this.#turnCount));
          readline.prompt();
          continue;
        }

        // Handle the input outside of a readline context to prevent conflict
        // between the REPL and interactive tools.
        break;
      }

      // End the readline context for this REPL input.
      readline.close();

      // Check if the line iterator was terminated.
      if (inputType === undefined) {
        break;
      }

      // Capture a full stack trace on error.
      const stackTraceLimit = Error.stackTraceLimit;
      Error.stackTraceLimit = Infinity;

      try {
        if (inputType === "lang") {
          // Evaluate natural language input.
          await this.#runLang(this.#bufferedInput);
        } else {
          // Evaluate code input.
          await this.#runCode(this.#bufferedInput);
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
      }

      // Begin a new readline context.
      continue;
    }

    // Write a newline before exiting the REPL.
    this.#output.write(EOL);
  }

  printError(error: unknown): void {
    let output = "";
    output += this.#style.redBright(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      (error as object)?.constructor?.name ?? "Error",
    );
    output += ": ";

    if (error instanceof Error) {
      output += this.formatError(error);
    } else {
      output += String(error);
    }
    output += EOL;

    this.#output.write(output);
  }

  formatError(error: Error): string {
    let output = error.message;
    if (error.stack !== undefined) {
      output += EOL;
      output += this.formatStack(error.stack);
    }
    return output;
  }

  formatStack(stack: string): string {
    const cwd = process.cwd() + sep;
    return replaceLines(stack, (frame) => this.formatStackFrame(frame, cwd));
  }

  static readonly #stackFrameRegex =
    /^(?: *)(at)(?: +)(?:(async)(?: +))?([^ ]+)(?:(?: +)\((.+)\))?(?: *)$/;

  formatStackFrame(frame: string, cwd: string): string | undefined {
    const match = Repl.#stackFrameRegex.exec(frame);
    if (match === null) {
      return undefined;
    }

    let functionName: string | undefined;
    let fileName: string;
    if (match[4] !== undefined) {
      functionName = match[3]!;
      fileName = match[4];
    } else {
      fileName = match[3]!;
    }

    fileName = fileName.replace("file://", "").replace(cwd, "");

    let rowNumber: string | undefined;
    let colNumber: string | undefined;

    const colIndex = fileName.lastIndexOf(":");
    if (colIndex >= 0) {
      const lineIndex = fileName.lastIndexOf(":", colIndex - 1);
      if (lineIndex >= 0) {
        rowNumber = fileName.slice(lineIndex + 1, colIndex);
        colNumber = fileName.slice(colIndex + 1);
        fileName = fileName.slice(0, lineIndex);
      }
    }

    let line = "  ";
    line += this.#style.gray("at");
    line += " ";
    if (match[2] !== undefined) {
      line += this.#style.blueBright("async");
      line += " ";
    }

    if (functionName !== undefined) {
      line += functionName;
      line += " ";
      line += "(";
    }

    line += this.#style.cyanBright(fileName);
    if (rowNumber !== undefined && colNumber !== undefined) {
      line += ":";
      line += this.#style.yellowBright(rowNumber);
      line += ":";
      line += this.#style.yellowBright(colNumber);
    }

    if (functionName !== undefined) {
      line += ")";
    }

    return line;
  }

  async #runLang(input: string): Promise<void> {
    await Job.run({ title: "Prompt" }, async (root) => {
      // Print job status updates.
      const finished = reportStatus(
        { root },
        {
          input: this.#input,
          output: this.#output,
          styled: this.#styled,
          interceptConsole: true,
        },
      );

      let output: unknown;
      try {
        // Evaluate the natural language input.
        output = await this.evalLang(input);
      } finally {
        // Wait for all job status updates to finish.
        root.finish();
        await finished;
      }

      // Print the natural language input completion to the output stream.
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

  async evalLang(input: string): Promise<unknown> {
    this.#abortController = new AbortController();
    try {
      // Complete the natural language using the default generator.
      const output = generator(input, {
        tools: currentTools(),
        signal: this.#abortController.signal,
      });

      // Increment the turn count.
      this.#turnCount += 1;

      // Return the natural language prompt completion.
      return await output;
    } finally {
      this.#abortController = null;
    }
  }

  async #runCode(input: string): Promise<void> {
    await Job.run(undefined, async (root) => {
      // Print job status updates.
      const finished = reportStatus(
        { root },
        {
          input: this.#input,
          output: this.#output,
          styled: this.#styled,
          interceptConsole: true,
        },
      );

      let bindings: Record<string, unknown>;
      try {
        // Evaluate the input code.
        bindings = await this.evalCode(input);
      } catch (error) {
        if (error instanceof ReplCompilerError) {
          // Diagnostics have already been reported.
          return;
        }
        throw error;
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

  printDiagnostics(diagnostics: readonly ts.Diagnostic[]): void {
    this.#output.write(
      ts.formatDiagnosticsWithColorAndContext(
        diagnostics,
        this.#formatDiagnosticsHost,
      ),
    );
  }

  async evalCode(input: string): Promise<Record<string, unknown>> {
    // Preprocess the currently buffered input.
    const processedInput = this.#preprocess(input);

    // Compile and evaluate the preprocessed input.
    const bindings = await this.#evaluate(processedInput);

    // Assign all newly declared bindings to the VM context.
    Object.assign(globalThis, bindings);

    // Increment the turn count.
    this.#turnCount += 1;

    // Commit the successfully evaluated code.
    this.#cumulativeInput += processedInput;
    this.#executedStatementCount += this.#pendingStatementCount;
    this.#pendingStatementCount = 0;

    // Return the newly declared bindings.
    return bindings;
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

    // Await the evaluation of the bindings promise.
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

    // Collect filtered diagnostics.
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

    // Report diagnostics.
    if (diagnostics.length !== 0) {
      this.printDiagnostics(diagnostics);
      const hasError =
        diagnostics.find((diagnostic) => {
          return diagnostic.category === ts.DiagnosticCategory.Error;
        }) !== undefined;
      if (hasError) {
        throw new ReplCompilerError("Invalid REPL input", diagnostics);
      }
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

      // Assign the last expression to a result variable.
      const resultVariableName = ts.factory.createUniqueName(
        `_${this.#turnCount}`,
        ts.GeneratedIdentifierFlags.Optimistic |
          ts.GeneratedIdentifierFlags.ReservedInNestedScopes,
      );
      return ts.factory.createVariableStatement(
        undefined, // modifiers
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              resultVariableName,
              undefined, // exclamationToken
              undefined, // type
              statement.expression,
            ),
          ],
          ts.NodeFlags.Const,
        ),
      );
    };

    return (sourceFile: ts.SourceFile): ts.SourceFile => {
      this.#pendingStatementCount = sourceFile.statements.length;

      return context.factory.updateSourceFile(sourceFile, [
        // Passthrough all but the last statement.
        ...sourceFile.statements.slice(0, -1),
        // Try to assign the last expression to a result variable.
        ...sourceFile.statements.slice(-1).map(transformLastStatement),
      ]);
    };
  };

  readonly #postprocessor = (
    context: ts.TransformationContext,
  ): ts.Transformer<ts.SourceFile> => {
    const factory = context.factory;

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

      return factory.updateSourceFile(sourceFile, [
        // Wrap all statements in an async IIFE that returns an object
        // containing all declared bindings.
        transformTopLevelAwait(factory, statements),
      ]);
    };
  };
}

export type { ReplOptions };
export { ReplCompilerError, Repl };
