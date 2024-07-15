interface Stylize {
  // eslint-disable-next-line @typescript-eslint/prefer-function-type
  (string: string): string;
}

interface Styled extends Stylize {
  readonly openCode: number;
  readonly closeCode: number;

  readonly open: string;
  readonly close: string;
}

const styled = (
  openCode: number,
  closeCode: number,
  codes: Map<number, number>,
): Styled => {
  codes.set(openCode, closeCode);

  const open = "\x1B[" + openCode + "m";
  const close = "\x1B[" + closeCode + "m";

  return Object.assign(
    (input: string): string => {
      // Begin the output string with the open sequence for this style.
      let output = open;

      // Replace all nested close codes with the open sequence for this style.
      let position = 0;
      let index: number;
      while ((index = input.indexOf(close, position)) !== -1) {
        // Append the next input chunk up to the escape sequence.
        output += input.slice(position, index);
        // Append the replacement escape sequence.
        output += open;
        // The next input chunk starts after the end of the escape sequence.
        position = index + close.length;
      }

      // Append the final input chunk, which will be the entire input
      // if no nested styles were found.
      output += position === 0 ? input : input.slice(position);

      // End the output string with the close sequence for this style.
      output += close;

      return output;
    },
    {
      openCode,
      closeCode,
      open,
      close,
    },
  );
};

interface Style {
  readonly reset: Stylize;
  readonly bold: Stylize;
  readonly dim: Stylize;
  readonly italic: Stylize;
  readonly underline: Stylize;
  readonly overline: Stylize;
  readonly inverse: Stylize;
  readonly hidden: Stylize;
  readonly strikethrough: Stylize;

  readonly black: Stylize;
  readonly red: Stylize;
  readonly green: Stylize;
  readonly yellow: Stylize;
  readonly blue: Stylize;
  readonly magenta: Stylize;
  readonly cyan: Stylize;
  readonly white: Stylize;
  readonly gray: Stylize;

  readonly redBright: Stylize;
  readonly greenBright: Stylize;
  readonly yellowBright: Stylize;
  readonly blueBright: Stylize;
  readonly magentaBright: Stylize;
  readonly cyanBright: Stylize;
  readonly whiteBright: Stylize;

  readonly bgBlack: Stylize;
  readonly bgRed: Stylize;
  readonly bgGreen: Stylize;
  readonly bgYellow: Stylize;
  readonly bgBlue: Stylize;
  readonly bgMagenta: Stylize;
  readonly bgCyan: Stylize;
  readonly bgWhite: Stylize;
  readonly bgGray: Stylize;

  readonly bgRedBright: Stylize;
  readonly bgGreenBright: Stylize;
  readonly bgYellowBright: Stylize;
  readonly bgBlueBright: Stylize;
  readonly bgMagentaBright: Stylize;
  readonly bgCyanBright: Stylize;
  readonly bgWhiteBright: Stylize;
}

const [styleCodes, style] = (() => {
  const codes = new Map<number, number>();

  const style = {
    reset: styled(0, 0, codes),
    bold: styled(1, 22, codes),
    dim: styled(2, 22, codes),
    italic: styled(3, 23, codes),
    underline: styled(4, 24, codes),
    overline: styled(53, 55, codes),
    inverse: styled(7, 27, codes),
    hidden: styled(8, 28, codes),
    strikethrough: styled(9, 29, codes),

    black: styled(30, 39, codes),
    red: styled(31, 39, codes),
    green: styled(32, 39, codes),
    yellow: styled(33, 39, codes),
    blue: styled(34, 39, codes),
    magenta: styled(35, 39, codes),
    cyan: styled(36, 39, codes),
    white: styled(37, 39, codes),
    gray: styled(90, 39, codes),

    redBright: styled(91, 39, codes),
    greenBright: styled(92, 39, codes),
    yellowBright: styled(93, 39, codes),
    blueBright: styled(94, 39, codes),
    magentaBright: styled(95, 39, codes),
    cyanBright: styled(96, 39, codes),
    whiteBright: styled(97, 39, codes),

    bgBlack: styled(40, 49, codes),
    bgRed: styled(41, 49, codes),
    bgGreen: styled(42, 49, codes),
    bgYellow: styled(43, 49, codes),
    bgBlue: styled(44, 49, codes),
    bgMagenta: styled(45, 49, codes),
    bgCyan: styled(46, 49, codes),
    bgWhite: styled(47, 49, codes),
    bgGray: styled(100, 49, codes),

    bgRedBright: styled(101, 49, codes),
    bgGreenBright: styled(102, 49, codes),
    bgYellowBright: styled(103, 49, codes),
    bgBlueBright: styled(104, 49, codes),
    bgMagentaBright: styled(105, 49, codes),
    bgCyanBright: styled(106, 49, codes),
    bgWhiteBright: styled(107, 49, codes),
  } as const satisfies Style;

  return [codes as ReadonlyMap<number, number>, style];
})();

const unstyle = (() => {
  const unstyled: Stylize = (input: string): string => input;

  return {
    reset: unstyled,
    bold: unstyled,
    dim: unstyled,
    italic: unstyled,
    underline: unstyled,
    overline: unstyled,
    inverse: unstyled,
    hidden: unstyled,
    strikethrough: unstyled,

    black: unstyled,
    red: unstyled,
    green: unstyled,
    yellow: unstyled,
    blue: unstyled,
    magenta: unstyled,
    cyan: unstyled,
    white: unstyled,
    gray: unstyled,

    redBright: unstyled,
    greenBright: unstyled,
    yellowBright: unstyled,
    blueBright: unstyled,
    magentaBright: unstyled,
    cyanBright: unstyled,
    whiteBright: unstyled,

    bgBlack: unstyled,
    bgRed: unstyled,
    bgGreen: unstyled,
    bgYellow: unstyled,
    bgBlue: unstyled,
    bgMagenta: unstyled,
    bgCyan: unstyled,
    bgWhite: unstyled,
    bgGray: unstyled,

    bgRedBright: unstyled,
    bgGreenBright: unstyled,
    bgYellowBright: unstyled,
    bgBlueBright: unstyled,
    bgMagentaBright: unstyled,
    bgCyanBright: unstyled,
    bgWhiteBright: unstyled,
  } as const satisfies Style;
})();

export type { Stylize, Styled, Style };
export { styleCodes, style, unstyle };
