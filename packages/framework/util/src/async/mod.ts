/** @module async */

import type { VariableOptions as AsyncContextVariableOptions } from "./variable.ts";
import { Variable as AsyncContextVariable } from "./variable.ts";
import { Snapshot as AsyncContextSnapshot } from "./snapshot.ts";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AsyncContext {
  export type VariableOptions<T> = AsyncContextVariableOptions<T>;
  export const Variable = AsyncContextVariable;
  export const Snapshot = AsyncContextSnapshot;
}
