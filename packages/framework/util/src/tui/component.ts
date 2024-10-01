import { AsyncContext } from "@toolcog/util/async";
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
  interceptConsole?: boolean | undefined;
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
      const parent = Context.global();

      const view =
        options?.view ??
        new View({
          input: options?.input ?? parent?.view.input,
          output: options?.output ?? parent?.view.output,
          readline: options?.readline ?? parent?.view.readline,
          styled: options?.styled ?? parent?.view.styled,
        });

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
        if (Context.global() !== context) {
          return;
        }
        view.updateCursor();
      };

      const cleanup = (): void => {
        try {
          context.runCleanups();
        } catch (error) {
          reject(error);
        }

        try {
          if (transient) {
            view.clean();
          } else {
            view.clearContent();
          }
          view.close();
        } finally {
          restoreConsole?.();

          if (consoleCalls !== undefined && consoleCalls.length !== 0) {
            for (const consoleCall of consoleCalls) {
              consoleCall();
            }
            consoleCalls.length = 0;
          }

          signal?.removeEventListener("abort", abortListener!);
          process.removeListener("exit", exitListener);
          view.input.removeListener("keypress", onKeypress);

          Context.setGlobal(parent);
          parent?.view.show();
          parent?.update();
        }
      };

      const finish = (value: R): void => {
        // Wait for any ongoing update to complete before finalizing.
        setImmediate(() => {
          cleanup();
          resolve(value);
        });
      };

      const update = (): void => {
        if (view.hidden || Context.global() !== context) {
          return;
        }

        context.reset();

        try {
          let content = render(props, finish);
          let bottomContent: string | undefined;
          if (typeof content !== "string") {
            bottomContent = content[1];
            content = content[0];
          }

          view.render(content, bottomContent, consoleCalls);

          context.runEffects();
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      let consoleCalls: (() => void)[] | undefined;
      let restoreConsole: (() => void) | undefined;

      const context = new Context(view, update);

      Context.run(context, () => {
        if (options?.interceptConsole) {
          consoleCalls = [];
          restoreConsole = interceptConsole(context, consoleCalls);
        }

        parent?.view.hide();
        Context.setGlobal(context);

        update();
        view.input.addListener("keypress", onKeypress);
      });
    });
  };
};

const interceptConsole = (
  context: Context,
  consoleCalls: (() => void)[],
): (() => void) => {
  const consoleTrace = console.trace;
  const consoleDebug = console.debug;
  const consoleInfo = console.info;
  const consoleLog = console.log;
  const consoleWarn = console.warn;
  const consoleError = console.error;

  console.trace = AsyncContext.Snapshot.wrap((...args: unknown[]): void => {
    consoleCalls.push(() => consoleTrace.call(console, ...args));
    context.update();
  });
  console.debug = AsyncContext.Snapshot.wrap((...args: unknown[]): void => {
    consoleCalls.push(() => consoleDebug.call(console, ...args));
    context.update();
  });
  console.info = AsyncContext.Snapshot.wrap((...args: unknown[]): void => {
    consoleCalls.push(() => consoleInfo.call(console, ...args));
    context.update();
  });
  console.log = AsyncContext.Snapshot.wrap((...args: unknown[]): void => {
    consoleCalls.push(() => consoleLog.call(console, ...args));
    context.update();
  });
  console.warn = AsyncContext.Snapshot.wrap((...args: unknown[]): void => {
    consoleCalls.push(() => consoleWarn.call(console, ...args));
    context.update();
  });
  console.error = AsyncContext.Snapshot.wrap((...args: unknown[]): void => {
    consoleCalls.push(() => consoleError.call(console, ...args));
    context.update();
  });

  return (): void => {
    console.trace = consoleTrace;
    console.debug = consoleDebug;
    console.info = consoleInfo;
    console.log = consoleLog;
    console.warn = consoleWarn;
    console.error = consoleError;
  };
};

export type { ComponentFunction, ComponentOptions, Component };
export { createComponent };
