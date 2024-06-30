import type {
  ResolveHookContext,
  ResolveFnOutput,
  ResolveHook,
  LoadHookContext,
  LoadFnOutput,
  LoadHook,
} from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";
import { toolcogTransformerFactory } from "@toolcog/compiler";
import { ProjectLoader, loadConfigFile } from "@toolcog/loader";

const createModuleHooks = (): { resolve: ResolveHook; load: LoadHook } => {
  const projectCache = new Map<string, ProjectLoader>();

  const programTransformers = [toolcogTransformerFactory];

  const resolveProject = (specifier: string): ProjectLoader | undefined => {
    const configPath = ts.findConfigFile(specifier, ts.sys.fileExists);
    if (configPath === undefined) {
      return undefined; // TODO: create temporary project
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

  const resolve = (
    specifier: string,
    context: ResolveHookContext,
    nextResolve: (
      specifier: string,
      context?: ResolveHookContext,
    ) => ResolveFnOutput | Promise<ResolveFnOutput>,
  ): ResolveFnOutput | Promise<ResolveFnOutput> => {
    if (!/\.tsx?$/.test(specifier)) {
      return nextResolve(specifier, context);
    }

    const project = resolveProject(specifier);
    if (project === undefined) {
      return nextResolve(specifier, context);
    }

    const resolvedModule = project.resolveModuleName(
      specifier,
      context.parentURL !== undefined ? fileURLToPath(context.parentURL) : "",
    );
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
    if (!/\.tsx?$/.test(url)) {
      return nextLoad(url, context);
    }

    const sourceName = fileURLToPath(url);

    const project = resolveProject(sourceName);
    if (project === undefined) {
      return nextLoad(url, context);
    }

    const compiledProject = project.compile();

    const compiledSource = compiledProject.getCompiledSource(sourceName);
    if (compiledSource === undefined) {
      return nextLoad(url, context);
    }

    const outputFile = compiledSource.getOutputFile();
    const output = compiledSource.getOutput();
    if (outputFile === undefined || output === undefined) {
      return nextLoad(url, context);
    }

    const resolutionMode = ts.getImpliedNodeFormatForFile(
      outputFile,
      project.compilerHost
        .getModuleResolutionCache?.()
        ?.getPackageJsonInfoCache(),
      project.compilerHost,
      project.compilerOptions,
    );

    const moduleFormat =
      resolutionMode === ts.ModuleKind.CommonJS ? "commonjs"
      : resolutionMode === ts.ModuleKind.ESNext ? "module"
      : undefined;
    if (moduleFormat === undefined) {
      throw new Error(
        `Unknown module format for source: ${JSON.stringify(sourceName)}`,
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
