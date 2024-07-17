import type { View } from "./view.ts";
import type { Slot } from "./context.ts";
import { enqueue, useSlot } from "./context.ts";

const useEffect = (
  effect: (view: View) => (() => void) | void,
  dependencies: readonly unknown[],
): void => {
  useSlot((slot: Slot<readonly unknown[]>): void => {
    const prevDependencies = slot.get();

    let changed: boolean;
    if (
      prevDependencies !== undefined &&
      prevDependencies.length === dependencies.length
    ) {
      let index = 0;
      while (index < dependencies.length) {
        if (!Object.is(dependencies[index], prevDependencies[index])) {
          break;
        }
        index += 1;
      }
      changed = index !== dependencies.length;
    } else {
      changed = true;
    }

    if (changed) {
      enqueue(effect);
    }

    slot.set(dependencies);
  });
};

export { useEffect };
