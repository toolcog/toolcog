import { stylize } from "@toolcog/util/tty";
import { Context } from "./context.ts";

type PartialTheme<T> =
  T extends { [P in PropertyKey]: unknown } ?
    { [P in keyof T]?: PartialTheme<T[P]> }
  : T;

interface RootTheme {
  readonly prefix: string;
  readonly spinner: {
    readonly interval: number;
    readonly frames: readonly string[];
  };
  readonly style: {
    readonly prefix: (text: string) => string;
    readonly spinner: (text: string) => string;
    readonly message: (text: string) => string;
    readonly answer: (text: string) => string;
    readonly default: (text: string) => string;
    readonly disabled: (text: string) => string;
    readonly highlight: (text: string) => string;
    readonly help: (text: string) => string;
    readonly key: (text: string) => string;
    readonly error: (text: string) => string;
  };
}

const style = stylize(() => Context.get()?.view.styled ?? true);

const rootTheme: RootTheme = {
  prefix: "?",
  spinner: {
    interval: 80,
    frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  },
  style: {
    prefix: style.green,
    spinner: style.yellow,
    message: style.bold,
    answer: style.cyan,
    default: (text) => style.dim("(" + text + ")"),
    disabled: style.dim,
    highlight: style.cyan,
    help: style.dim,
    key: (text: string) => style.cyan("<" + text + ">"),
    error: (text) => style.red("> " + text),
  },
};

const makeTheme: {
  <Theme>(theme: Theme): Theme & RootTheme;
  <Theme extends object, BaseTheme extends object>(
    theme: PartialTheme<Theme>,
    baseTheme: BaseTheme,
  ): Theme & BaseTheme;
} = <Theme extends object, BaseTheme extends object>(
  theme: PartialTheme<Theme>,
  baseTheme?: BaseTheme,
): Theme & BaseTheme => {
  if (baseTheme === undefined) {
    baseTheme = rootTheme as BaseTheme;
  }
  return {
    ...baseTheme,
    ...theme,
    ...("style" in baseTheme && "style" in theme ?
      { style: { ...(baseTheme.style as object), ...(theme.style as object) } }
    : undefined),
  } as Theme & BaseTheme;
};

export type { PartialTheme, RootTheme };
export { style, rootTheme, makeTheme };
