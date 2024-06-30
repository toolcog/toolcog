import ts from "typescript";

class CompiledSource {
  readonly diagnostics: ts.Diagnostic[];
  readonly emittedFiles: Map<string, string>;

  constructor() {
    this.diagnostics = [];
    this.emittedFiles = new Map();
  }

  findEmittedFile(
    predicate: (fileName: string, fileText: string) => boolean,
  ): [fileName: string, fileText: string] | undefined {
    for (const [fileName, fileText] of this.emittedFiles) {
      if (predicate(fileName, fileText)) {
        return [fileName, fileText];
      }
    }
    return undefined;
  }

  getOutputFile(): string | undefined {
    return this.findEmittedFile((fileName) =>
      /\.(c|m)?js$/.test(fileName),
    )?.[0];
  }

  getOutput(): string | undefined {
    return this.findEmittedFile((fileName) =>
      /\.(c|m)?js$/.test(fileName),
    )?.[1];
  }

  getSourceMapFile(): string | undefined {
    return this.findEmittedFile((fileName) =>
      /\.(c|m)?js.map$/.test(fileName),
    )?.[0];
  }

  getSourceMap(): string | undefined {
    return this.findEmittedFile((fileName) =>
      /\.(c|m)?js.map$/.test(fileName),
    )?.[1];
  }

  getDeclarationFile(): string | undefined {
    return this.findEmittedFile((fileName) =>
      /\.d\.(c|m)?ts$/.test(fileName),
    )?.[0];
  }

  getDeclaration(): string | undefined {
    return this.findEmittedFile((fileName) =>
      /\.d\.(c|m)?ts$/.test(fileName),
    )?.[1];
  }
}

interface LoaderHost extends ts.CompilerHost {
  compiledSources: Map<string, CompiledSource>;

  /**
   * Add each of the given diagnostics to its relevant `CompiledSource`.
   * Returns the diagnostics that don't pertain to any particular file.
   * @internal
   */
  addDiagnostics(diagnostics: readonly ts.Diagnostic[]): ts.Diagnostic[];
}

const createLoaderHost = (
  compilerOptions: ts.CompilerOptions,
  moduleResolutionHost: ts.ModuleResolutionHost,
): LoaderHost => {
  // Destructure the module resolution host.
  const {
    fileExists,
    readFile,
    trace,
    realpath,
    directoryExists,
    getDirectories,
  } = moduleResolutionHost;
  let { getCurrentDirectory, useCaseSensitiveFileNames } = moduleResolutionHost;

  if (getCurrentDirectory === undefined) {
    getCurrentDirectory = ts.sys.getCurrentDirectory;
  }
  if (useCaseSensitiveFileNames === undefined) {
    useCaseSensitiveFileNames = ts.sys.useCaseSensitiveFileNames;
  } else if (typeof useCaseSensitiveFileNames === "function") {
    useCaseSensitiveFileNames = useCaseSensitiveFileNames();
  }
  const getCanonicalFileName = ts.createGetCanonicalFileName(
    useCaseSensitiveFileNames,
  );

  // Create resolution caches.
  const moduleResolutionCache = ts.createModuleResolutionCache(
    getCurrentDirectory(),
    getCanonicalFileName,
  );
  const typeReferenceDirectiveResolutionCache =
    ts.createTypeReferenceDirectiveResolutionCache(
      getCurrentDirectory(),
      getCanonicalFileName,
      compilerOptions,
      moduleResolutionCache.getPackageJsonInfoCache(),
    );

  // Create the compiler host and incrementally add defined methods.
  const compilerHost = {} as LoaderHost;

  compilerHost.compiledSources = new Map<string, CompiledSource>();

  compilerHost.fileExists = fileExists;
  compilerHost.readFile = readFile;
  if (realpath !== undefined) {
    compilerHost.realpath = realpath;
  }
  if (trace !== undefined) {
    compilerHost.trace = trace;
  }
  if (directoryExists !== undefined) {
    compilerHost.directoryExists = directoryExists;
  }
  if (getDirectories !== undefined) {
    compilerHost.getDirectories = getDirectories;
  }
  compilerHost.getCurrentDirectory = getCurrentDirectory;
  compilerHost.useCaseSensitiveFileNames = () =>
    ts.sys.useCaseSensitiveFileNames;

  compilerHost.getSourceFile = (
    fileName: string,
    languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
    //onError?: (message: string) => void,
    //shouldCreateNewSourceFile?: boolean,
  ): ts.SourceFile | undefined => {
    const sourceText = compilerHost.readFile(fileName);
    if (sourceText === undefined) {
      return undefined;
    }
    return ts.createSourceFile(fileName, sourceText, languageVersionOrOptions);
  };

  //compilerHost.getSourceFileByPath = (
  //  fileName: string,
  //  path: ts.Path,
  //  languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
  //  onError?: (message: string) => void,
  //  shouldCreateNewSourceFile?: boolean,
  //): ts.SourceFile | undefined => {};

  compilerHost.getDefaultLibFileName = ts.getDefaultLibFilePath;

  compilerHost.getDefaultLibLocation = () =>
    ts.getDirectoryPath(ts.normalizePath(ts.sys.getExecutingFilePath()));

  const getCompiledSource = (fileName: string): CompiledSource => {
    let compiledSource = compilerHost.compiledSources.get(fileName);
    if (compiledSource === undefined) {
      compiledSource = new CompiledSource();
      compilerHost.compiledSources.set(fileName, compiledSource);
    }
    return compiledSource;
  };

  compilerHost.writeFile = (
    fileName: string,
    text: string,
    writeByteOrderMark: boolean,
    onError?: (message: string) => void,
    sourceFiles?: readonly ts.SourceFile[],
    data?: ts.WriteFileCallbackData,
  ): void => {
    if (sourceFiles === undefined) {
      return;
    }
    for (const sourceFile of sourceFiles) {
      const compiledSource = getCompiledSource(sourceFile.fileName);
      compiledSource.emittedFiles.set(fileName, text);
    }
  };

  compilerHost.addDiagnostics = (
    diagnostics: readonly ts.Diagnostic[],
  ): ts.Diagnostic[] => {
    const compiledDiagnostics: ts.Diagnostic[] = [];
    for (const diagnostic of diagnostics) {
      const fileName = diagnostic.file?.fileName;
      if (fileName !== undefined) {
        const compiledSource = getCompiledSource(fileName);
        compiledSource.diagnostics.push(diagnostic);
      } else {
        compiledDiagnostics.push(diagnostic);
      }
    }
    return compiledDiagnostics;
  };

  compilerHost.getCanonicalFileName = getCanonicalFileName;

  compilerHost.getNewLine = () => ts.sys.newLine;

  //compilerHost.readDirectory = (
  //  rootDir: string,
  //  extensions: readonly string[],
  //  excludes: readonly string[] | undefined,
  //  includes: readonly string[],
  //  depth?: number,
  //): string[] => {};

  compilerHost.getModuleResolutionCache = ():
    | ts.ModuleResolutionCache
    | undefined => {
    return moduleResolutionCache;
  };

  compilerHost.resolveModuleNames = (
    moduleNames: string[],
    containingFile: string,
    reusedNames: string[] | undefined,
    redirectedReference: ts.ResolvedProjectReference | undefined,
    compilerOptions: ts.CompilerOptions,
    containingSourceFile?: ts.SourceFile,
  ): (ts.ResolvedModule | undefined)[] => {
    return moduleNames.map(
      (moduleName: string): ts.ResolvedModule | undefined => {
        return ts.resolveModuleName(
          moduleName,
          containingFile,
          compilerOptions,
          moduleResolutionHost,
          moduleResolutionCache,
          redirectedReference,
        ).resolvedModule;
      },
    );
  };

  //compilerHost.resolveModuleNameLiterals = (
  //  moduleLiterals: readonly ts.StringLiteralLike[],
  //  containingFile: string,
  //  redirectedReference: ts.ResolvedProjectReference | undefined,
  //  options: ts.CompilerOptions,
  //  containingSourceFile: ts.SourceFile,
  //  reusedNames: readonly ts.StringLiteralLike[] | undefined,
  //): readonly ts.ResolvedModuleWithFailedLookupLocations[] => {};

  compilerHost.resolveTypeReferenceDirectives = (
    typeReferenceDirectiveNames: string[] | readonly ts.FileReference[],
    containingFile: string,
    redirectedReference: ts.ResolvedProjectReference | undefined,
    compilerOptions: ts.CompilerOptions,
    containingFileMode?: ts.ResolutionMode,
  ): (ts.ResolvedTypeReferenceDirective | undefined)[] => {
    return typeReferenceDirectiveNames.map(
      (
        directiveName: string | ts.FileReference,
      ): ts.ResolvedTypeReferenceDirective | undefined => {
        if (typeof directiveName !== "string") {
          directiveName = directiveName.fileName;
        }
        return ts.resolveTypeReferenceDirective(
          directiveName,
          containingFile,
          compilerOptions,
          moduleResolutionHost,
          redirectedReference,
          typeReferenceDirectiveResolutionCache,
          containingFileMode,
        ).resolvedTypeReferenceDirective;
      },
    );
  };

  //compilerHost.resolveTypeReferenceDirectiveReferences = <
  //  T extends ts.FileReference | string,
  //>(
  //  typeDirectiveReferences: readonly T[],
  //  containingFile: string,
  //  redirectedReference: ts.ResolvedProjectReference | undefined,
  //  options: ts.CompilerOptions,
  //  containingSourceFile: ts.SourceFile | undefined,
  //  reusedNames: readonly T[] | undefined,
  //): readonly ts.ResolvedTypeReferenceDirectiveWithFailedLookupLocations[] => {};

  compilerHost.getEnvironmentVariable = ts.sys.getEnvironmentVariable;

  return compilerHost;
};

export type { LoaderHost };
export { CompiledSource, createLoaderHost };
