import type { Slot } from "./context.ts";
import { update, useSlot } from "./context.ts";

const useState: {
  <T>(
    initialValue:
      | (T extends (...args: any[]) => unknown ? never : T)
      | (() => T),
  ): [T, (newValue: T) => void];
  <T>(
    initialValue?:
      | (T extends (...args: any[]) => unknown ? never : T)
      | (() => T),
  ): [T | undefined, (newValue: T | undefined) => void];
} = <T>(initialValue: T | (() => T)): [T, (newValue: T) => void] => {
  return useSlot((slot: Slot<T>): [T, (newValue: T) => void] => {
    const setValue = (newValue: T): void => {
      if (slot.get() === newValue) {
        return;
      }
      slot.set(newValue);
      update();
    };

    let value: T;
    if (slot.initialized) {
      value = slot.get();
    } else {
      value =
        typeof initialValue === "function" ?
          (initialValue as () => T)()
        : initialValue;
      slot.set(value);
    }

    return [value, setValue];
  });
};

export { useState };
