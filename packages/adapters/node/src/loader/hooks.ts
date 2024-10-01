import type {
  ResolveHookContext,
  ResolveFnOutput,
  ResolveHook,
  LoadHookContext,
  LoadFnOutput,
  LoadHook,
} from "node:module";
import {
  resolve as resolvePath,
  parse as parsePath,
  format as formatPath,
} from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";
import { toolcogTransformer } from "@toolcog/compiler";
import { loadConfigFile } from "./config.ts";
import { ProjectLoader } from "./project.ts";

/** @internal */
const createModuleHooks = (): { resolve: ResolveHook; load: LoadHook } => {
  const projectCache = new Map<string, ProjectLoader>();

  const programTransformers = [toolcogTransformer];

  const resolveProject = (specifier: string): ProjectLoader => {
    const configPath = ts.findConfigFile(specifier, ts.sys.fileExists);
    if (configPath === undefined) {
      // Create a temporary project to load the typescript source.
      const config = {
        options: {
          allowImportingTsExtensions: true,
          module: ts.ModuleKind.NodeNext,
          outdir: resolvePath(process.cwd(), "dist"),
          skipLibCheck: true,
          strict: true,
          target: ts.ScriptTarget.ESNext,
        },
        fileNames: [specifier],
        errors: [],
      } satisfies ts.ParsedCommandLine;
      return new ProjectLoader(config, ts.sys, programTransformers);
    }

    let project = projectCache.get(configPath);
    if (project === undefined) {
      const config = loadConfigFile(configPath);
      config.options.noEmit = false;

      project = new ProjectLoader(config, ts.sys, programTransformers);
      projectCache.set(configPath, project);
    }
    return project;
  };

  const resolve = async (
    specifier: string,
    context: ResolveHookContext,
    nextResolve: (
      specifier: string,
      context?: ResolveHookContext,
    ) => ResolveFnOutput | Promise<ResolveFnOutput>,
  ): Promise<ResolveFnOutput> => {
    if (!/\.m?tsx?$/.test(specifier)) {
      try {
        return await Promise.resolve(nextResolve(specifier, context));
      } catch (error) {
        // Check if the failed resolution was a builtin module.
        if (specifier === "toolcog" || specifier.startsWith("@toolcog/")) {
          // Try to resolve builtin modules relative to the loader;
          // this enables builtin imports regardless of current directory.
          return nextResolve(specifier, {
            ...context,
            parentURL: import.meta.url,
          });
        }

        // Try to rewrite js extensions back to their original ts files.
        const { dir, name, ext } = parsePath(specifier);
        const tsExt =
          ext === ".js" ? ".ts"
          : ext === ".mjs" ? ".mts"
          : undefined;
        if (tsExt !== undefined) {
          const tsSpecifier = formatPath({ dir, name, ext: tsExt });
          return nextResolve(tsSpecifier, context);
        }

        throw error;
      }
    }

    const project = resolveProject(specifier);

    const resolvedModule = project.resolveModuleName(
      specifier,
      context.parentURL !== undefined ? fileURLToPath(context.parentURL) : "",
    ).resolvedModule;
    if (resolvedModule === undefined) {
      return nextResolve(specifier, context);
    }

    return {
      shortCircuit: true,
      url: pathToFileURL(resolvedModule.resolvedFileName).toString(),
    };
  };

  const load = (
    url: string,
    context: LoadHookContext,
    nextLoad: (
      url: string,
      context?: LoadHookContext,
    ) => LoadFnOutput | Promise<LoadFnOutput>,
  ): LoadFnOutput | Promise<LoadFnOutput> => {
    if (!/\.m?tsx?$/.test(url)) {
      return nextLoad(url, context);
    }

    const sourcePath = fileURLToPath(url);

    const project = resolveProject(sourcePath);

    const compiledProject = project.compile();

    const compiledSource = compiledProject.getCompiledSource(sourcePath);
    if (compiledSource === undefined) {
      return nextLoad(url, context);
    }

    const outputFile = compiledSource.getOutputFile();
    const output = compiledSource.getOutput();
    if (outputFile === undefined || output === undefined) {
      return nextLoad(url, context);
    }

    const packageJsonInfoCache = project.compilerHost
      .getModuleResolutionCache?.()
      ?.getPackageJsonInfoCache();

    const packageJsonInfo = ts.getPackageScopeForPath(
      sourcePath,
      ts.getTemporaryModuleResolutionState(
        packageJsonInfoCache,
        project.compilerHost,
        project.compilerOptions,
      ),
    );

    let resolutionMode: ts.ResolutionMode;
    if (packageJsonInfo !== undefined) {
      resolutionMode = ts.getImpliedNodeFormatForFile(
        outputFile,
        packageJsonInfoCache,
        project.compilerHost,
        project.compilerOptions,
      );
    } else {
      // Default to ESM when no package.json is present.
      resolutionMode = ts.ModuleKind.ESNext;
    }

    const moduleFormat =
      resolutionMode === ts.ModuleKind.CommonJS ? "commonjs"
      : resolutionMode === ts.ModuleKind.ESNext ? "module"
      : undefined;
    if (moduleFormat === undefined) {
      throw new Error(
        `Unknown module format for source: ${JSON.stringify(sourcePath)}`,
      );
    }

    return {
      shortCircuit: true,
      format: moduleFormat,
      source: output,
    };
  };

  return { resolve, load };
};

const { resolve, load } = createModuleHooks();

export { createModuleHooks, resolve, load };
