import type { View } from "./view.ts";
import { batched } from "./context.ts";
import { useRef } from "./use-ref.ts";
import { useEffect } from "./use-effect.ts";
import type { Key } from "./key.ts";

const useKeypress = (callback: (keypress: Key, view: View) => void): void => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect((view: View) => {
    const onKeypress = batched((input: string, keypress: Key) => {
      if (!view.hidden) {
        callbackRef.current(keypress, view);
      }
    });

    view.input.addListener("keypress", onKeypress);
    return () => {
      view.input.removeListener("keypress", onKeypress);
    };
  }, []);
};

export { useKeypress };
