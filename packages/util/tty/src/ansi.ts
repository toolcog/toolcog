// ansi-regex v5.0.1
const ansiRegex =
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

const stripAnsi = (text: string): string => text.replace(ansiRegex, "");

const cursorTo = (x: number, y?: number): string => {
  if (y !== undefined) {
    return "\x1B[" + (y + 1) + ";" + (x + 1) + "H";
  }
  return "\x1B[" + (x + 1) + "G";
};

const cursorMove = (x: number, y?: number): string => {
  let sequence = "";
  if (x < 0) {
    sequence += "\x1B[" + -x + "D";
  } else if (x > 0) {
    sequence += "\x1B[" + x + "C";
  }
  if (y !== undefined) {
    if (y < 0) {
      sequence += "\x1B[" + -y + "A";
    } else if (y > 0) {
      sequence += "\x1B[" + y + "B";
    }
  }
  return sequence;
};

const cursorUp = (count: number = 1): string => "\x1B[" + count + "A";
const cursorDown = (count: number = 1): string => "\x1B[" + count + "B";
const cursorForward = (count: number = 1): string => "\x1B[" + count + "C";
const cursorBackward = (count: number = 1): string => "\x1B[" + count + "D";

const cursorLeft: string = "\x1B[G";
const cursorGetPosition: string = "\x1B[6n";
const cursorNextLine: string = "\x1B[E";
const cursorPrevLine: string = "\x1B[F";
const cursorHide: string = "\x1B[?25l";
const cursorShow: string = "\x1B[?25h";

const eraseLines = (count: number): string => {
  let sequence = "";
  for (let i = 0; i < count; i += 1) {
    sequence += eraseLine + (i < count - 1 ? cursorUp() : "");
  }
  if (count !== 0) {
    sequence += cursorLeft;
  }
  return sequence;
};

const eraseEndLine: string = "\x1B[K";
const eraseStartLine: string = "\x1B[1K";
const eraseLine: string = "\x1B[2K";
const eraseDown: string = "\x1B[J";
const eraseUp: string = "\x1B[1J";
const eraseScreen: string = "\x1B[2J";
const scrollUp: string = "\x1B[S";
const scrollDown: string = "\x1B[T";

const clearScreen: string = "\x1Bc";

const beep: string = "\x07";

const link = (text: string, url: string): string =>
  "\x1B]8;;" + url + "\x07" + text + "\x1B]8;;\x07";

export {
  ansiRegex,
  stripAnsi,
  cursorTo,
  cursorMove,
  cursorUp,
  cursorDown,
  cursorForward,
  cursorBackward,
  cursorLeft,
  cursorGetPosition,
  cursorNextLine,
  cursorPrevLine,
  cursorHide,
  cursorShow,
  eraseLines,
  eraseEndLine,
  eraseStartLine,
  eraseLine,
  eraseDown,
  eraseUp,
  eraseScreen,
  scrollUp,
  scrollDown,
  clearScreen,
  beep,
  link,
};
