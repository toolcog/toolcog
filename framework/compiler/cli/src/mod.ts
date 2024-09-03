export type { InventoryGenerateCommandOptions } from "./inventory-generate.ts";
export {
  runInventoryGenerateCommand,
  createInventoryGenerateCommand,
} from "./inventory-generate.ts";

export { createInventoryCommand } from "./inventory.ts";

export { createCompilerCommand } from "./compiler.ts";

export const version = __version__;
