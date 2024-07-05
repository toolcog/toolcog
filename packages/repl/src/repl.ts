import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { EOL, homedir } from "node:os";
import { dirname, resolve } from "node:path";
import type { CompleterResult } from "node:readline";
import { cursorTo } from "node:readline";
import { createInterface } from "node:readline/promises";
import { inspect } from "node:util";
import { constants, runInThisContext } from "node:vm";
import ts from "typescript";
import { toolcogTransformerFactory } from "@toolcog/compiler";
import { transformImportDeclaration } from "./transform-import.ts";
import { transformTopLevelAwait } from "./transform-await.ts";

interface ReplOptions {
  input?: NodeJS.ReadableStream | undefined;
  output?: NodeJS.WritableStream | undefined;
  terminal?: boolean | undefined;

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

  constructor(options?: ReplOptions) {
    this.#input = options?.input ?? process.stdin;
    this.#output = options?.output ?? process.stdout;
    this.#terminal = options?.terminal;
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
      getScriptVersion: (fileName) =>
        fileName === this.#scriptName ? this.#scriptVersion.toString() : "0",
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
              undefined,
              undefined,
              languageServiceHost,
            ),
            this.#postprocessor,
          ],
        };
      },
    } satisfies ts.LanguageServiceHost;

    this.#languageService = ts.createLanguageService(
      languageServiceHost,
      documentRegistry,
    );

    this.#scriptName = resolve(process.cwd(), ".toolcog", `[repl].ts`);
    this.#scriptSnapshot = undefined;
    this.#scriptVersion = 0;

    this.#cumulativeInput = "";
    this.#bufferedInput = "";
    this.#turnCount = 1;

    this.#executedStatementCount = 0;
    this.#pendingStatementCount = 0;
  }

  get input(): NodeJS.ReadableStream {
    return this.#input;
  }

  get output(): NodeJS.WritableStream {
    return this.#output;
  }

  initialPrompt(turn: number): string {
    return `${turn}> `;
  }

  continuationPrompt(turn: number): string {
    return "| ".padStart(turn.toString().length + 2, " ");
  }

  async start(): Promise<void> {
    // Load REPL history from file.
    let history: string[] | undefined;
    if (this.#historySize > 0 && existsSync(this.#historyFile)) {
      const historyData = await readFile(this.#historyFile, "utf-8");
      history = historyData.split(EOL).reverse();
    }

    // Initialize the readline interface.
    const readline = createInterface({
      input: this.#input,
      output: this.#output,
      terminal: this.#terminal,
      completer: this.#completer,
      history,
      historySize: this.#historySize,
    });

    readline.on("history", async (history: string[]): Promise<void> => {
      // Save history to file.
      if (this.#historySize > 0) {
        const historyDir = dirname(this.#historyFile);
        if (!existsSync(historyDir)) {
          await mkdir(historyDir, { recursive: true });
        }
        const historyData = history.slice().reverse().join(EOL);
        await writeFile(this.#historyFile, historyData, "utf-8");
      }
    });

    readline.on("SIGINT", async () => {
      // Ctrl+C clears the currently buffered input.
      this.#bufferedInput = "";

      // Move the cursor to the end of the line.
      cursorTo(this.#output, readline.line.length);
      // Reset the line buffer.
      (readline as { line: string }).line = "";
      // Print a newline.
      this.#output.write(EOL);
      // Issue a new prompt.
      readline.setPrompt(this.initialPrompt(this.#turnCount));
      readline.prompt();
    });

    // Write the initial REPL prompt.
    readline.setPrompt(this.initialPrompt(this.#turnCount));
    readline.prompt();

    for await (const line of readline) {
      this.#bufferedInput += line + EOL;

      if (this.#bufferedInput.trim() === ".exit") {
        readline.close();
        break;
      }

      if (this.#needsContinuation(this.#bufferedInput)) {
        readline.setPrompt(this.continuationPrompt(this.#turnCount));
        readline.prompt();
      } else {
        try {
          // Preprocess the currently buffered input.
          const processedInput = this.#preprocess(this.#bufferedInput);

          // Compile and evaluate the preprocessed input.
          const bindings = await this.#evaluate(processedInput);

          // Assign all newly declared bindings to the VM context.
          Object.assign(globalThis, bindings);

          // Print all newly declared bindings to the output.
          this.#printOutput(bindings);

          // Commit the successfully evaluated code.
          this.#cumulativeInput += processedInput;
          this.#executedStatementCount += this.#pendingStatementCount;
          this.#pendingStatementCount = 0;
        } finally {
          // Reset the input buffer and increment the turn count.
          this.#bufferedInput = "";
          this.#turnCount += 1;

          readline.setPrompt(this.initialPrompt(this.#turnCount));
          readline.prompt();
        }
      }
    }

    this.#output.write(EOL);
  }

  #preprocess(bufferedInput: string): string {
    const sourceFile = ts.createSourceFile(this.#scriptName, bufferedInput, {
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
    if (output.emitSkipped) {
      const diagnostics = this.#languageService
        .getCompilerOptionsDiagnostics()
        .concat(
          this.#languageService.getSyntacticDiagnostics(this.#scriptName),
        );
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

  #printOutput(bindings: Record<string, unknown>): void {
    for (const key in bindings) {
      const value = bindings[key];
      this.#output.write(
        key + ": " + inspect(value, { colors: true, showProxy: true }) + "\n",
      );
    }
    this.#output.write(EOL);
  }

  #completer = (line: string): CompleterResult => {
    // Combine cumulative and buffered input.
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

  #needsContinuation(source: string): boolean {
    this.#scanner.setText(source);

    // Punctuation counters.
    let parenthesisCount = 0;
    let braceCount = 0;
    let bracketCount = 0;

    let atComment = false;
    let atNewLine = false;

    try {
      // Scan the source code.
      while (this.#scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
        const token = this.#scanner.getToken();

        switch (token) {
          case ts.SyntaxKind.OpenParenToken:
            parenthesisCount += 1;
            break;
          case ts.SyntaxKind.CloseParenToken:
            parenthesisCount -= 1;
            break;
          case ts.SyntaxKind.OpenBraceToken:
            braceCount += 1;
            break;
          case ts.SyntaxKind.CloseBraceToken:
            braceCount -= 1;
            break;
          case ts.SyntaxKind.OpenBracketToken:
            bracketCount += 1;
            break;
          case ts.SyntaxKind.CloseBracketToken:
            bracketCount -= 1;
            break;
          case ts.SyntaxKind.SingleLineCommentTrivia:
          case ts.SyntaxKind.MultiLineCommentTrivia:
            atComment = true;
            atNewLine = false;
            break;
          case ts.SyntaxKind.NewLineTrivia:
            if (atNewLine) {
              atComment = false;
            }
            atNewLine = true;
            break;
          default:
            atComment = false;
            atNewLine = false;
            break;
        }

        if (parenthesisCount < 0 || braceCount < 0 || bracketCount < 0) {
          return false;
        }
      }

      // Verify that all punctuation is balanced,
      // and that the input does not end with a comment.
      return (
        parenthesisCount !== 0 ||
        braceCount !== 0 ||
        bracketCount !== 0 ||
        atComment
      );
    } finally {
      this.#scanner.setText(undefined);
    }
  }

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

  readonly #postprocessor = (
    context: ts.TransformationContext,
  ): ts.Transformer<ts.SourceFile> => {
    const visitNext = (node: ts.Node): ts.Node | undefined => {
      if (ts.isImportDeclaration(node) && node.importClause !== undefined) {
        // Transform import declaration to awaited dynamic import statement.
        return transformImportDeclaration(context.factory, node);
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

      return context.factory.updateSourceFile(sourceFile, [
        // Wrap all statements in an async IIFE that returns an object
        // containing all declared bindings.
        transformTopLevelAwait(context.factory, statements),
      ]);
    };
  };
}

export type { ReplOptions };
export { Repl };
