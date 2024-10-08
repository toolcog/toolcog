import { EOL } from "node:os";

const countLines = (text: string): number => {
  let count = 0;
  let position = 0;
  do {
    count += 1;
    position = text.indexOf("\n", position);
    if (position >= 0) {
      position += 1;
    } else {
      position = text.length;
    }
  } while (position < text.length);
  return count;
};

const reduceLines = <T>(
  text: string,
  callback: (
    value: T,
    line: string,
    eol: string,
    lineno: number,
    text: string,
  ) => T,
  value: T,
): T => {
  let eol = EOL;
  let lineno = 0;
  let position = 0;

  do {
    let nextIndex: number;
    let endIndex = text.indexOf("\n", position);
    if (endIndex >= 0) {
      nextIndex = endIndex + 1;
      if (endIndex > 1 && text.charCodeAt(endIndex - 1) === 0x0d /*'\r'*/) {
        endIndex -= 1;
        eol = "\r\n";
      } else {
        eol = "\n";
      }
    } else {
      nextIndex = text.length;
      endIndex = text.length;
    }

    const line = text.slice(position, endIndex);
    value = callback(value, line, eol, lineno, text);

    lineno += 1;
    position = nextIndex;
  } while (position < text.length);

  return value;
};

const replaceLines = (
  text: string,
  callback: (
    line: string,
    eol: string,
    lineno: number,
    text: string,
  ) => string | undefined,
): string => {
  return reduceLines(
    text,
    (
      output: string,
      line: string,
      eol: string,
      lineno: number,
      text: string,
    ): string => {
      const replacement = callback(line, eol, lineno, text);
      if (replacement !== undefined) {
        if (output.length !== 0) {
          output += eol;
        }
        output += replacement;
      }
      return output;
    },
    "",
  );
};

const splitLines = (text: string): string[] => {
  return reduceLines(
    text,
    (output: string[], line: string): string[] => {
      output.push(line);
      return output;
    },
    [],
  );
};

const getLastLine = (text: string): string => {
  const index = text.lastIndexOf("\n");
  return index >= 0 ? text.slice(index + 1) : text;
};

const getLastNonEmptyLine = (text: string): string => {
  // Start at the end of the string.
  let index = text.length - 1;

  // Traverse backwards to find the last non-whitespace character.
  while (index >= 0) {
    switch (text.charCodeAt(index)) {
      case 0x09: // '\t'
      case 0x0a: // '\n'
      case 0x0d: // '\r'
      case 0x20: // ' '
        index -= 1;
        continue;
      default:
        break;
    }
    break;
  }

  // Record the index of the last non-whitespace character.
  const lastIndex = index;

  // Traverse backwards to find the start of the last non-empty line.
  while (index >= 0) {
    switch (text.charCodeAt(index)) {
      case 0x0a: // '\n'
      case 0x0d: // '\r'
        break;
      default:
        index -= 1;
        continue;
    }
    break;
  }

  return text.slice(index + 1, lastIndex + 1);
};

export {
  countLines,
  reduceLines,
  replaceLines,
  splitLines,
  getLastLine,
  getLastNonEmptyLine,
};
