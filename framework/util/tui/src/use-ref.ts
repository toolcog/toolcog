import type { Slot } from "./context.ts";
import { useSlot } from "./context.ts";

const useRef: {
  <T>(value: T): { current: T };
  <T>(value?: T): { current: T | undefined };
} = <T>(value: T): { current: T } => {
  return useSlot((slot: Slot<{ current: T }>): { current: T } => {
    let state = slot.get();

    if (state === undefined) {
      state = { current: value };
      slot.set(state);
    }

    return state;
  });
};

export { useRef };
