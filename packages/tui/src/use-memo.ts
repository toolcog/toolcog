import type { Slot } from "./context.ts";
import { useSlot } from "./context.ts";

const useMemo = <T>(compute: () => T, dependencies: readonly unknown[]): T => {
  interface MemoState {
    value: T;
    dependencies: readonly unknown[];
  }

  return useSlot((slot: Slot<MemoState>): T => {
    let state = slot.get();

    let changed: boolean;
    if (
      state !== undefined &&
      state.dependencies.length === dependencies.length
    ) {
      let index = 0;
      while (index < dependencies.length) {
        if (!Object.is(dependencies[index], state.dependencies[index])) {
          break;
        }
        index += 1;
      }
      changed = index !== dependencies.length;
    } else {
      changed = true;
    }

    let value: T;
    if (changed) {
      value = compute();
      if (state !== undefined) {
        state.value = value;
        state.dependencies = dependencies;
      } else {
        state = { value, dependencies };
        slot.set(state);
      }
    } else {
      // Only reachable if state is defined.
      value = state!.value;
    }

    return value;
  });
};

export { useMemo };
