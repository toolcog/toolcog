import { exec } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import {
  isAbsolute as isAbsolutePath,
  resolve as resolvePath,
} from "node:path";
import { promisify } from "node:util";
import ts from "typescript";
import { style, confirm } from "@toolcog/util/tui";

const execAsync = promisify(exec);

/** @internal */
const isPackageImport = (moduleName: string): boolean => {
  return !moduleName.startsWith(".") && !isAbsolutePath(moduleName);
};

/** @internal */
const getPackageName = (moduleName: string): string => {
  const parts = moduleName.split("/");
  if (moduleName.startsWith("@")) {
    return parts.slice(0, 2).join("/");
  } else {
    return parts[0]!;
  }
};

interface LoadModulesOptions {
  searchDirs?: string[] | undefined;
}

interface InstallPackagesOptions extends LoadModulesOptions {
  message?: string | undefined;
  confirm?: string | boolean | undefined;
}

const loadModules = async <T>(
  modules: readonly string[],
  options?: LoadModulesOptions,
): Promise<{
  loadedModules: Record<string, T | null>;
  missingModules: string[];
}> => {
  const containingFiles = (options?.searchDirs ?? [process.cwd()]).map(
    (searchDir) => resolvePath(searchDir, "package.json"),
  );
  const compilerOptions: ts.CompilerOptions = {
    allowImportingTsExtensions: true,
    module: ts.ModuleKind.NodeNext,
    noDtsResolution: true,
    target: ts.ScriptTarget.ESNext,
  };

  const loadedModules = Object.create(null) as Record<string, T | null>;
  const missingModules: string[] = [];

  for (const moduleName of modules) {
    for (const containingFile of containingFiles) {
      const resolvedModule = ts.resolveModuleName(
        moduleName,
        containingFile,
        compilerOptions,
        ts.sys,
        undefined,
        undefined,
        ts.ModuleKind.ESNext,
      ).resolvedModule;
      if (resolvedModule !== undefined) {
        const modulePath = resolvedModule.resolvedFileName;
        const module = (await import(modulePath)) as T;
        loadedModules[moduleName] = module;
        break;
      } else {
        loadedModules[moduleName] = null;
        if (isPackageImport(moduleName)) {
          missingModules.push(moduleName);
        }
      }
    }
  }

  return { loadedModules, missingModules };
};

/**
 * Installs the specified packages into a temporary directory and returns
 * the path to the temporary package directory.
 */
const installPackages = async (
  packages: readonly string[],
  options?: InstallPackagesOptions,
): Promise<string> => {
  const hash = createHash("sha256")
    .update(packages.join(","))
    .digest("hex")
    .substring(0, 16);

  const installDir = resolvePath(homedir(), ".toolcog", "packages", hash);
  if (!existsSync(installDir)) {
    if (options?.confirm === undefined || options.confirm !== false) {
      console.log(
        style.bold(
          options?.message ?? "Need to install the following packages:",
        ) +
          "\n" +
          packages
            .map((packageName) => "- " + style.green(packageName))
            .join("\n"),
      );
      const proceed = await confirm({
        message:
          typeof options?.confirm === "string" ?
            options.confirm
          : "Ok to install?",
      });
      if (!proceed) {
        process.exit(1);
      }
    }

    await mkdir(installDir, { recursive: true });
  }

  try {
    await execAsync("npm install " + packages.join(" "), { cwd: installDir });
  } catch (error) {
    throw new Error(
      "Failed to install packages " +
        packages.join(", ") +
        ": " +
        ((error as { stderr?: string }).stderr ?? (error as Error).message),
    );
  }

  return installDir;
};

const loadOrInstallModules = async <T>(
  modules: readonly string[],
  options?: InstallPackagesOptions,
): Promise<{
  loadedModules: Record<string, T | null>;
  installDir: string | undefined;
}> => {
  const { loadedModules, missingModules } = await loadModules<T>(
    modules,
    options,
  );

  let installDir: string | undefined;
  if (missingModules.length !== 0) {
    const packages = new Set<string>();
    for (const moduleName of missingModules) {
      packages.add(getPackageName(moduleName));
    }

    installDir = await installPackages([...packages], options);

    const containingFile = resolvePath(installDir, "package.json");
    const compilerOptions: ts.CompilerOptions = {
      allowImportingTsExtensions: true,
      module: ts.ModuleKind.NodeNext,
      noDtsResolution: true,
      target: ts.ScriptTarget.ESNext,
    };

    for (const moduleName of missingModules) {
      const resolvedModule = ts.resolveModuleName(
        moduleName,
        containingFile,
        compilerOptions,
        ts.sys,
        undefined,
        undefined,
        ts.ModuleKind.ESNext,
      ).resolvedModule;
      if (resolvedModule !== undefined) {
        const modulePath = resolvedModule.resolvedFileName;
        const module = (await import(modulePath)) as T;
        loadedModules[moduleName] = module;
      } else {
        loadedModules[moduleName] = null;
      }
    }
  }

  return { loadedModules, installDir };
};

export type { LoadModulesOptions, InstallPackagesOptions };
export {
  isPackageImport,
  getPackageName,
  loadModules,
  installPackages,
  loadOrInstallModules,
};
