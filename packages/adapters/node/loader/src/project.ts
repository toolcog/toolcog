import ts from "typescript";
import type { CompiledSource, LoaderHost } from "./host.ts";
import { createLoaderHost } from "./host.ts";

/** @internal */
type ProgramTransformerFactory = (
  program: ts.Program,
) => ts.TransformerFactory<ts.SourceFile> | ts.CustomTransformerFactory;

/** @internal */
class CompiledProject {
  readonly diagnostics: readonly ts.Diagnostic[];
  readonly compilerDiagnostics: readonly ts.Diagnostic[];
  readonly compiledSources: Map<string, CompiledSource>;

  constructor(
    diagnostics: readonly ts.Diagnostic[],
    compilerDiagnostics: readonly ts.Diagnostic[],
    compiledSources: Map<string, CompiledSource>,
  ) {
    this.diagnostics = diagnostics;
    this.compilerDiagnostics = compilerDiagnostics;
    this.compiledSources = compiledSources;
  }

  getCompiledSource(sourceFile: string): CompiledSource | undefined {
    return this.compiledSources.get(sourceFile);
  }
}

/** @internal */
class ProjectLoader {
  readonly #config: ts.ParsedCommandLine;

  readonly #compilerHost: LoaderHost;

  readonly #programTransformers: readonly ProgramTransformerFactory[];

  #program: ts.Program | null;

  #compiled: CompiledProject | null;

  constructor(
    config: ts.ParsedCommandLine,
    moduleResolutionHost: ts.ModuleResolutionHost,
    programTransformers?: readonly ProgramTransformerFactory[],
  ) {
    this.#config = config;

    this.#compilerHost = createLoaderHost(config.options, moduleResolutionHost);

    this.#programTransformers = programTransformers ?? [];

    this.#program = null;

    this.#compiled = null;
  }

  get config(): ts.ParsedCommandLine {
    return this.#config;
  }

  get compilerOptions(): ts.CompilerOptions {
    return this.#config.options;
  }

  get compilerHost(): ts.CompilerHost {
    return this.#compilerHost;
  }

  get redirectedReference(): ts.ResolvedProjectReference | undefined {
    return undefined;
  }

  get program(): ts.Program {
    if (this.#program === null) {
      this.#program = this.createProgram();
    }
    return this.#program;
  }

  compile(): CompiledProject {
    if (this.#compiled) {
      return this.#compiled;
    }

    const program = this.program;

    const transformers = {
      before: this.#programTransformers.map((programTransformerFactory) =>
        programTransformerFactory(program),
      ),
    } as const satisfies ts.CustomTransformers;

    const emitResult = program.emit(
      undefined, // targetSourceFile
      undefined, // writeFile
      undefined, // cancellationToken
      false, // emitOnlyDtsFiles
      transformers,
    );

    this.#compiled = new CompiledProject(
      emitResult.diagnostics,
      this.#compilerHost.addDiagnostics(emitResult.diagnostics),
      this.#compilerHost.compiledSources,
    );

    return this.#compiled;
  }

  createProgram(options?: ts.CreateProgramOptions): ts.Program {
    return ts.createProgram({
      rootNames: this.#config.fileNames,
      options: this.#config.options,
      ...(this.#config.projectReferences !== undefined ?
        { projectReferences: this.#config.projectReferences }
      : undefined),
      host: this.#compilerHost,
      ...(this.#program !== null ? { oldProgram: this.#program } : undefined),
      ...options,
    });
  }

  resolveModuleName(
    moduleName: string,
    containingFile: string,
    resolutionMode?: ts.ResolutionMode,
  ): ts.ResolvedModuleWithFailedLookupLocations {
    return ts.resolveModuleName(
      moduleName,
      containingFile,
      this.compilerOptions,
      this.compilerHost,
      this.compilerHost.getModuleResolutionCache?.(),
      this.redirectedReference,
      resolutionMode,
    );
  }
}

export type { CompiledProject };
export { ProjectLoader };
