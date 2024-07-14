type Stylize = (string: string) => string;

const stylize = (open: number, close: number): Stylize => {
  const openCode = `\x1B[${open}m`;
  const closeCode = `\x1B[${close}m`;

  return (input: string): string => {
    // Begin the new string with the open code for this style.
    let string = openCode;

    // Replace all nested close codes with the open code for this style.
    let position = 0;
    let index: number;
    while ((index = input.indexOf(closeCode, position)) !== -1) {
      // Append the next input chunk up to but excluding the next close code.
      string += input.slice(position, index);
      // Append the replacement open code.
      string += openCode;
      // Start the next input chunk at the end of the last close code.
      position = index + closeCode.length;
    }

    // Append the final input chunk, which will be the entire input
    // if no nested styles were found.
    string += position === 0 ? input : input.slice(position);

    // End the new string with the close code for this style.
    string += closeCode;

    return string;
  };
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

  readonly bgBlack: Stylize;
  readonly bgRed: Stylize;
  readonly bgGreen: Stylize;
  readonly bgYellow: Stylize;
  readonly bgBlue: Stylize;
  readonly bgMagenta: Stylize;
  readonly bgCyan: Stylize;
  readonly bgWhite: Stylize;
  readonly bgGray: Stylize;

  readonly redBright: Stylize;
  readonly greenBright: Stylize;
  readonly yellowBright: Stylize;
  readonly blueBright: Stylize;
  readonly magentaBright: Stylize;
  readonly cyanBright: Stylize;
  readonly whiteBright: Stylize;

  readonly bgRedBright: Stylize;
  readonly bgGreenBright: Stylize;
  readonly bgYellowBright: Stylize;
  readonly bgBlueBright: Stylize;
  readonly bgMagentaBright: Stylize;
  readonly bgCyanBright: Stylize;
  readonly bgWhiteBright: Stylize;
}

const style: Style = (() => {
  return {
    reset: stylize(0, 0),
    bold: stylize(1, 22),
    dim: stylize(2, 22),
    italic: stylize(3, 23),
    underline: stylize(4, 24),
    overline: stylize(53, 55),
    inverse: stylize(7, 27),
    hidden: stylize(8, 28),
    strikethrough: stylize(9, 29),

    black: stylize(30, 39),
    red: stylize(31, 39),
    green: stylize(32, 39),
    yellow: stylize(33, 39),
    blue: stylize(34, 39),
    magenta: stylize(35, 39),
    cyan: stylize(36, 39),
    white: stylize(37, 39),
    gray: stylize(90, 39),

    bgBlack: stylize(40, 49),
    bgRed: stylize(41, 49),
    bgGreen: stylize(42, 49),
    bgYellow: stylize(43, 49),
    bgBlue: stylize(44, 49),
    bgMagenta: stylize(45, 49),
    bgCyan: stylize(46, 49),
    bgWhite: stylize(47, 49),
    bgGray: stylize(100, 49),

    redBright: stylize(91, 39),
    greenBright: stylize(92, 39),
    yellowBright: stylize(93, 39),
    blueBright: stylize(94, 39),
    magentaBright: stylize(95, 39),
    cyanBright: stylize(96, 39),
    whiteBright: stylize(97, 39),

    bgRedBright: stylize(101, 49),
    bgGreenBright: stylize(102, 49),
    bgYellowBright: stylize(103, 49),
    bgBlueBright: stylize(104, 49),
    bgMagentaBright: stylize(105, 49),
    bgCyanBright: stylize(106, 49),
    bgWhiteBright: stylize(107, 49),
  };
})();

const unstyle: Style = (() => {
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

    bgBlack: unstyled,
    bgRed: unstyled,
    bgGreen: unstyled,
    bgYellow: unstyled,
    bgBlue: unstyled,
    bgMagenta: unstyled,
    bgCyan: unstyled,
    bgWhite: unstyled,
    bgGray: unstyled,

    redBright: unstyled,
    greenBright: unstyled,
    yellowBright: unstyled,
    blueBright: unstyled,
    magentaBright: unstyled,
    cyanBright: unstyled,
    whiteBright: unstyled,

    bgRedBright: unstyled,
    bgGreenBright: unstyled,
    bgYellowBright: unstyled,
    bgBlueBright: unstyled,
    bgMagentaBright: unstyled,
    bgCyanBright: unstyled,
    bgWhiteBright: unstyled,
  };
})();

export type { Stylize, Style };
export { style, unstyle };
