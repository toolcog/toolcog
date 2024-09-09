import { reduceLines, replaceLines } from "@toolcog/util";
import { styleCodes } from "./style.ts";
import { stripAnsi } from "./ansi.ts";
import { getCharacterWidth, getStringWidth } from "./width.ts";

const wrapWord = (lines: string[], word: string, maxWidth: number): void => {
  let isInsideEscape = false;
  let isInsideLinkEscape = false;
  let lineWidth = getStringWidth(stripAnsi(lines[lines.length - 1]!));

  let charIndex = 0;
  while (charIndex < word.length) {
    let codePoint: number;
    let nextCharIndex: number;
    if (
      word.charCodeAt(charIndex) >= 0xd800 &&
      word.charCodeAt(charIndex) <= 0xdbff &&
      charIndex + 1 < word.length &&
      word.charCodeAt(charIndex + 1) >= 0xdc00 &&
      word.charCodeAt(charIndex + 1) <= 0xdfff
    ) {
      codePoint =
        ((word.charCodeAt(charIndex) - 0xd800) << 10) +
        (word.charCodeAt(charIndex + 1) - 0xdc00) +
        0x10000;
      nextCharIndex = charIndex + 2;
    } else {
      codePoint = word.charCodeAt(charIndex);
      nextCharIndex = charIndex + 1;
    }

    const character = String.fromCodePoint(codePoint);
    const characterWidth = getCharacterWidth(codePoint, character);

    if (lineWidth + characterWidth <= maxWidth) {
      lines[lines.length - 1] += character;
    } else {
      lines.push(character);
      lineWidth = 0;
    }

    if (codePoint === 0x1b || codePoint === 0x9b) {
      isInsideEscape = true;
      isInsideLinkEscape =
        nextCharIndex + 3 < word.length &&
        word.charCodeAt(nextCharIndex) === 0x5d /*']'*/ &&
        word.charCodeAt(nextCharIndex + 1) === 0x38 /*'8'*/ &&
        word.charCodeAt(nextCharIndex + 2) === 0x3b /*';'*/ &&
        word.charCodeAt(nextCharIndex + 3) === 0x3b /*';'*/;
    }

    if (isInsideEscape) {
      if (isInsideLinkEscape) {
        if (codePoint === 0x07) {
          isInsideEscape = false;
          isInsideLinkEscape = false;
        }
      } else if (codePoint === 0x6d /*'m'*/) {
        isInsideEscape = false;
      }
    } else {
      lineWidth += characterWidth;
      if (lineWidth === maxWidth && charIndex < word.length - 1) {
        lines.push("");
        lineWidth = 0;
      }
    }

    charIndex = nextCharIndex;
  }

  // If the last line is zero-width but non-empty,
  // merge it into the previous line.
  if (
    lineWidth === 0 &&
    lines.length >= 2 &&
    lines[lines.length - 1]!.length !== 0
  ) {
    lines[lines.length - 2]! += lines.pop();
  }
};

const trimEnd = (input: string): string => {
  const words = input.split(" ");

  // Traverse backwards to find the last non-zero-width word.
  let last = words.length - 1;
  while (last >= 0 && getStringWidth(words[last]!) === 0) {
    last -= 1;
  }
  last += 1;

  // If the last word has non-zero-width, return the input string.
  if (last === words.length) {
    return input;
  }

  // Join words up to the last non-zero-width word with spaces,
  // preserving any trailing ANSI escape sequences.
  return words.slice(0, last).join(" ") + words.slice(last).join("");
};

interface WrapState {
  openCode?: number | undefined;
  closeCode?: number | undefined;
  url?: string | undefined;
}

const wrapLine = (
  input: string,
  maxWidth: number,
  eol: string,
  state: WrapState = {},
): string => {
  if (input.length === 0 || maxWidth === Infinity) {
    return input;
  }

  const lines = [""];
  const words = input.split(" ");

  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const word = words[wordIndex]!;
    const wordWidth = getStringWidth(word);

    let lineWidth = getStringWidth(lines[lines.length - 1]!);

    if (wordIndex !== 0) {
      // Add a space to separate words.
      lines[lines.length - 1] += " ";
      lineWidth += 1;
    }

    if (wordWidth > maxWidth) {
      // Start a new line, if doing so would require fewer line breaks.
      const remainingWidth = maxWidth - lineWidth;
      const breaksStartingThisLine =
        1 + Math.floor((wordWidth - remainingWidth - 1) / maxWidth);
      const breaksStartingNextLine = Math.floor((wordWidth - 1) / maxWidth);
      if (breaksStartingNextLine < breaksStartingThisLine) {
        lines.push("");
      }
      wrapWord(lines, word, maxWidth);
      continue;
    }

    // Check if adding the word to the current line would overflow.
    if (
      lineWidth + wordWidth > maxWidth &&
      lineWidth !== 0 &&
      wordWidth !== 0
    ) {
      lines.push("");
    }

    // Add the word to the current line.
    lines[lines.length - 1] += word;
  }

  let output = "";

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = trimEnd(lines[lineIndex]!);

    // Re-open any running escape sequences on the new line
    // to ensure that each line is independently formatted.
    if (state.openCode !== undefined) {
      output += "\x1B[" + state.openCode + "m";
    }
    if (state.url !== undefined) {
      output += "\x1B]8;;" + state.url + "\x07";
    }

    // Append the line to the output.
    output += line;

    // Search the line for unclosed escape sequences and hyperlinks.
    for (let charIndex = 0; charIndex < line.length; charIndex += 1) {
      // Check for the start of an escape sequence.
      if (
        charIndex + 1 < line.length &&
        (line.charCodeAt(charIndex) === 0x1b ||
          line.charCodeAt(charIndex) === 0x9b) &&
        line.charCodeAt(charIndex + 1) === 0x5b /*'['*/
      ) {
        let code = 0;
        let codeIndex = charIndex + 2;
        let codeChar: number | undefined;
        while (codeIndex < line.length) {
          codeChar = line.charCodeAt(codeIndex);
          if (codeChar < 0x30 /*'0'*/ || codeChar > 0x39 /*'9'*/) {
            break;
          }
          const digit = codeChar - 0x30;
          code = 10 * code + digit;
          codeIndex += 1;
        }
        if (codeChar === 0x6d /*'m'*/) {
          state.closeCode = styleCodes.get(code);
          state.openCode = state.closeCode !== undefined ? code : undefined;
        }
      }

      // Check for the start of a hyperlink.
      if (
        charIndex + 4 < line.length &&
        (line.charCodeAt(charIndex) === 0x1b ||
          line.charCodeAt(charIndex) === 0x9b) &&
        line.charCodeAt(charIndex + 1) === 0x5d /*']'*/ &&
        line.charCodeAt(charIndex + 2) === 0x38 /*'8'*/ &&
        line.charCodeAt(charIndex + 3) === 0x3b /*';'*/ &&
        line.charCodeAt(charIndex + 4) === 0x3b /*';'*/
      ) {
        const bellIndex = line.indexOf("\x07", charIndex + 5);
        if (bellIndex >= 0) {
          state.url =
            bellIndex > charIndex + 5 ?
              line.slice(charIndex + 5, bellIndex)
            : undefined;
        }
      }
    }

    // Close any open escape sequences at the end of each line
    // to ensure that each line is independently formatted.
    if (state.url !== undefined) {
      output += "\x1B]8;;\x07";
    }
    if (state.closeCode !== undefined) {
      output += "\x1B[" + state.closeCode + "m";
    }

    // Append an end-of-line sequence if this is not the last line.
    if (lineIndex < lines.length - 1) {
      output += eol;
    }
  }

  return output;
};

const wrapLines = (input: string, maxWidth: number): string[] => {
  if (maxWidth === Infinity) {
    return [input];
  }
  const state: WrapState = {};
  return reduceLines(
    input,
    (output: string[], line: string, eol: string): string[] => {
      output.push(wrapLine(line, maxWidth, eol, state));
      return output;
    },
    [],
  );
};

const wrapText = (input: string, maxWidth: number): string => {
  if (maxWidth === Infinity) {
    return input;
  }
  const state: WrapState = {};
  return replaceLines(input, (line: string, eol: string): string => {
    return wrapLine(line, maxWidth, eol, state);
  });
};

export type { WrapState };
export { wrapLine, wrapLines, wrapText };
