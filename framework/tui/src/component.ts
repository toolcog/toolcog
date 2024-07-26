import type { ViewOptions } from "./view.ts";
import { View } from "./view.ts";
import { Context } from "./context.ts";

type ComponentFunction<Props, R> = (
  props: Props,
  finish: (value: R) => void,
) => [string, string | undefined] | string;

interface ComponentOptions extends ViewOptions {
  view?: View | undefined;
  signal?: AbortSignal | undefined;
  transient?: boolean | undefined;
}

type Component<Props, R> = (
  props: Props,
  options?: ComponentOptions,
) => Promise<R>;

const createComponent = <Props, R>(
  render: ComponentFunction<Props, R>,
): Component<Props, R> => {
  return (props: Props, options?: ComponentOptions): Promise<R> => {
    return new Promise((resolve, reject) => {
      const view = options?.view ?? new View(options);
      const signal = options?.signal;
      const transient = options?.transient ?? false;

      let abortListener: (() => void) | undefined;
      if (signal !== undefined) {
        signal.throwIfAborted();
        abortListener = () => {
          cleanup();
          reject(signal.reason);
        };
        signal.addEventListener("abort", abortListener, { once: true });
      }

      const exitListener = (code: number): void => {
        cleanup();
        reject(new Error(`Process exited with code: ${code}`));
      };
      process.addListener("exit", exitListener);

      const onKeypress = (): void => {
        view.updateCursor();
      };

      const cleanup = (): void => {
        try {
          context.runCleanups();
        } catch (error) {
          reject(error);
        }

        if (transient) {
          view.clean();
        } else {
          view.clearContent();
        }
        view.close();

        signal?.removeEventListener("abort", abortListener!);
        process.removeListener("exit", exitListener);
        view.input.removeListener("keypress", onKeypress);
      };

      const finish = (value: R): void => {
        // Wait for any ongoing update to complete before finalizing.
        setImmediate(() => {
          cleanup();
          resolve(value);
        });
      };

      const update = (): void => {
        context.reset();

        try {
          let content = render(props, finish);
          let bottomContent: string | undefined;
          if (typeof content !== "string") {
            bottomContent = content[1];
            content = content[0];
          }

          view.render(content, bottomContent);

          context.runEffects();
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      const context = new Context(view, update);

      Context.run(context, () => {
        update();
        view.input.on("keypress", onKeypress);
      });
    });
  };
};

export type { ComponentFunction, ComponentOptions, Component };
export { createComponent };
