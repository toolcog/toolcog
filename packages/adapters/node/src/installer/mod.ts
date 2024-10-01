/** @module installer */

export type { LoadModulesOptions, InstallPackagesOptions } from "./install.ts";
export {
  isPackageImport,
  getPackageName,
  loadModules,
  installPackages,
  loadOrInstallModules,
} from "./install.ts";
