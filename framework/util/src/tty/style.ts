interface Stylized {
  (text: string): string;
}

interface Styled extends Stylized {
  readonly openCode: number;
  readonly closeCode: number;

  readonly open: string;
  readonly close: string;
}

const styled = (
  openCode: number,
  closeCode: number,
  styleCodes: Map<number, number>,
): Styled => {
  styleCodes.set(openCode, closeCode);

  const open = "\x1B[" + openCode + "m";
  const close = "\x1B[" + closeCode + "m";

  return Object.assign(
    (text: string): string => {
      // Begin the output string with the open sequence for this style.
      let output = open;

      // Replace all nested close codes with the open sequence for this style.
      let position = 0;
      let index: number;
      while ((index = text.indexOf(close, position)) !== -1) {
        // Append the next text chunk up to the escape sequence.
        output += text.slice(position, index);
        // Append the replacement escape sequence.
        output += open;
        // The next text chunk starts after the end of the escape sequence.
        position = index + close.length;
      }

      // Append the final text chunk, which will be the entire text
      // if no nested styles were found.
      output += position === 0 ? text : text.slice(position);

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
  readonly reset: Stylized;
  readonly bold: Stylized;
  readonly dim: Stylized;
  readonly italic: Stylized;
  readonly underline: Stylized;
  readonly overline: Stylized;
  readonly inverse: Stylized;
  readonly hidden: Stylized;
  readonly strikethrough: Stylized;

  readonly black: Stylized;
  readonly red: Stylized;
  readonly green: Stylized;
  readonly yellow: Stylized;
  readonly blue: Stylized;
  readonly magenta: Stylized;
  readonly cyan: Stylized;
  readonly white: Stylized;
  readonly gray: Stylized;

  readonly redBright: Stylized;
  readonly greenBright: Stylized;
  readonly yellowBright: Stylized;
  readonly blueBright: Stylized;
  readonly magentaBright: Stylized;
  readonly cyanBright: Stylized;
  readonly whiteBright: Stylized;

  readonly bgBlack: Stylized;
  readonly bgRed: Stylized;
  readonly bgGreen: Stylized;
  readonly bgYellow: Stylized;
  readonly bgBlue: Stylized;
  readonly bgMagenta: Stylized;
  readonly bgCyan: Stylized;
  readonly bgWhite: Stylized;
  readonly bgGray: Stylized;

  readonly bgRedBright: Stylized;
  readonly bgGreenBright: Stylized;
  readonly bgYellowBright: Stylized;
  readonly bgBlueBright: Stylized;
  readonly bgMagentaBright: Stylized;
  readonly bgCyanBright: Stylized;
  readonly bgWhiteBright: Stylized;
}

const [styleCodes, style] = (() => {
  const styleCodes = new Map<number, number>();

  const style = {
    reset: styled(0, 0, styleCodes),
    bold: styled(1, 22, styleCodes),
    dim: styled(2, 22, styleCodes),
    italic: styled(3, 23, styleCodes),
    underline: styled(4, 24, styleCodes),
    overline: styled(53, 55, styleCodes),
    inverse: styled(7, 27, styleCodes),
    hidden: styled(8, 28, styleCodes),
    strikethrough: styled(9, 29, styleCodes),

    black: styled(30, 39, styleCodes),
    red: styled(31, 39, styleCodes),
    green: styled(32, 39, styleCodes),
    yellow: styled(33, 39, styleCodes),
    blue: styled(34, 39, styleCodes),
    magenta: styled(35, 39, styleCodes),
    cyan: styled(36, 39, styleCodes),
    white: styled(37, 39, styleCodes),
    gray: styled(90, 39, styleCodes),

    redBright: styled(91, 39, styleCodes),
    greenBright: styled(92, 39, styleCodes),
    yellowBright: styled(93, 39, styleCodes),
    blueBright: styled(94, 39, styleCodes),
    magentaBright: styled(95, 39, styleCodes),
    cyanBright: styled(96, 39, styleCodes),
    whiteBright: styled(97, 39, styleCodes),

    bgBlack: styled(40, 49, styleCodes),
    bgRed: styled(41, 49, styleCodes),
    bgGreen: styled(42, 49, styleCodes),
    bgYellow: styled(43, 49, styleCodes),
    bgBlue: styled(44, 49, styleCodes),
    bgMagenta: styled(45, 49, styleCodes),
    bgCyan: styled(46, 49, styleCodes),
    bgWhite: styled(47, 49, styleCodes),
    bgGray: styled(100, 49, styleCodes),

    bgRedBright: styled(101, 49, styleCodes),
    bgGreenBright: styled(102, 49, styleCodes),
    bgYellowBright: styled(103, 49, styleCodes),
    bgBlueBright: styled(104, 49, styleCodes),
    bgMagentaBright: styled(105, 49, styleCodes),
    bgCyanBright: styled(106, 49, styleCodes),
    bgWhiteBright: styled(107, 49, styleCodes),
  } as const satisfies Style;

  return [styleCodes as ReadonlyMap<number, number>, style];
})();

const unstyle = (() => {
  const unstyled: Stylized = (text: string): string => text;

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

const stylize = (enabled: (() => boolean) | boolean): Style => {
  if (enabled === true) {
    return style;
  } else if (enabled === false) {
    return unstyle;
  }

  return Object.fromEntries(
    Object.keys(style).map((key) => {
      const styled = style[key as keyof typeof style];
      const unstyled = unstyle[key as keyof typeof unstyle];
      const stylize = (text: string): string => {
        if (enabled()) {
          return styled(text);
        } else {
          return unstyled(text);
        }
      };
      return [key, stylize];
    }),
  ) as unknown as Style;
};

export type { Stylized, Styled, Style };
export { styleCodes, style, unstyle, stylize };
