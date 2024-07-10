import { getCharacterWidth } from "./width.ts";

const ellipsizeStart = (string: string, maxWidth: number): string => {
  if (string.length === 0) {
    return string;
  }

  let index = string.length - 1;
  let stringWidth = 0;

  while (true) {
    let character: string;
    let prevIndex: number;

    if (
      index > 0 &&
      string.charCodeAt(index - 1) >= 0xd800 &&
      string.charCodeAt(index - 1) <= 0xdbff &&
      string.charCodeAt(index) >= 0xdc00 &&
      string.charCodeAt(index) <= 0xdfff
    ) {
      character = String.fromCodePoint(
        ((string.charCodeAt(index - 1) - 0xd800) << 10) +
          (string.charCodeAt(index) - 0xdc00) +
          0x10000,
      );
      prevIndex = index - 2;
    } else {
      character = string[index]!;
      prevIndex = index - 1;
    }
    if (prevIndex < 0) {
      break;
    }

    const characterWidth = getCharacterWidth(character);
    if (stringWidth + characterWidth >= maxWidth - 3) {
      break;
    }
    index = prevIndex;
    stringWidth += characterWidth;
  }

  return index === 0 ? string : "..." + string.slice(index);
};

const ellipsizeEnd = (string: string, maxWidth: number): string => {
  if (string.length === 0) {
    return string;
  }

  let index = 0;
  let stringWidth = 0;

  while (true) {
    let character: string;
    let nextIndex: number;

    if (
      index < string.length - 1 &&
      string.charCodeAt(index) >= 0xd800 &&
      string.charCodeAt(index) <= 0xdbff &&
      string.charCodeAt(index + 1) >= 0xdc00 &&
      string.charCodeAt(index + 1) <= 0xdfff
    ) {
      character = String.fromCodePoint(
        ((string.charCodeAt(index) - 0xd800) << 10) +
          (string.charCodeAt(index + 1) - 0xdc00) +
          0x10000,
      );
      nextIndex = index + 2;
    } else {
      character = string[index]!;
      nextIndex = index + 1;
    }
    if (nextIndex > string.length) {
      break;
    }

    const characterWidth = getCharacterWidth(character);
    if (stringWidth + characterWidth >= maxWidth - 3) {
      break;
    }
    index = nextIndex;
    stringWidth += characterWidth;
  }

  return index === string.length ? string : string.slice(0, index) + "...";
};

const ellipsize = (
  string: string,
  maxWidth: number,
  direction?: number,
): string => {
  if (direction === undefined || direction >= 0) {
    return ellipsizeEnd(string, maxWidth);
  } else {
    return ellipsizeStart(string, maxWidth);
  }
};

export { ellipsizeStart, ellipsizeEnd, ellipsize };
