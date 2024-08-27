import { stripAnsi } from "./ansi.ts";
import { getCharacterWidth, getStringWidth } from "./width.ts";

const ellipsizeStart = (
  text: string,
  maxWidth: number,
  ellipsis: string = "...",
): string => {
  const ellipsisWidth = getStringWidth(ellipsis);
  if (maxWidth <= ellipsisWidth) {
    if (text.length <= maxWidth) {
      return text;
    } else {
      return stripAnsi(ellipsis).slice(0, maxWidth);
    }
  }

  let textWidth = 0;
  let index = text.length - 1;
  while (index >= 0) {
    let codePoint: number;
    let prevIndex: number;
    if (
      text.charCodeAt(index) >= 0xdc00 &&
      text.charCodeAt(index) <= 0xdfff &&
      index - 1 >= 0 &&
      text.charCodeAt(index - 1) >= 0xd800 &&
      text.charCodeAt(index - 1) <= 0xdbff
    ) {
      codePoint =
        ((text.charCodeAt(index - 1) - 0xd800) << 10) +
        (text.charCodeAt(index) - 0xdc00) +
        0x10000;
      prevIndex = index - 2;
    } else {
      codePoint = text.charCodeAt(index);
      prevIndex = index - 1;
    }

    const characterWidth = getCharacterWidth(codePoint);
    if (textWidth + characterWidth >= maxWidth - ellipsisWidth) {
      break;
    }

    textWidth += characterWidth;
    index = prevIndex;
  }

  return index === -1 ? text : ellipsis + text.slice(index);
};

const ellipsizeEnd = (
  text: string,
  maxWidth: number,
  ellipsis: string = "...",
): string => {
  const ellipsisWidth = getStringWidth(ellipsis);
  if (maxWidth <= ellipsisWidth) {
    if (text.length <= maxWidth) {
      return text;
    } else {
      return stripAnsi(ellipsis).slice(0, maxWidth);
    }
  }

  let textWidth = 0;
  let index = 0;
  while (index < text.length) {
    let codePoint: number;
    let nextIndex: number;
    if (
      text.charCodeAt(index) >= 0xd800 &&
      text.charCodeAt(index) <= 0xdbff &&
      index + 1 < text.length &&
      text.charCodeAt(index + 1) >= 0xdc00 &&
      text.charCodeAt(index + 1) <= 0xdfff
    ) {
      codePoint =
        ((text.charCodeAt(index) - 0xd800) << 10) +
        (text.charCodeAt(index + 1) - 0xdc00) +
        0x10000;
      nextIndex = index + 2;
    } else {
      codePoint = text.charCodeAt(index);
      nextIndex = index + 1;
    }

    const characterWidth = getCharacterWidth(codePoint);
    if (textWidth + characterWidth > maxWidth - ellipsisWidth) {
      break;
    }

    textWidth += characterWidth;
    index = nextIndex;
  }

  return index === text.length ? text : text.slice(0, index) + ellipsis;
};

const ellipsize = (
  text: string,
  maxWidth: number,
  direction?: number,
  ellipsis: string = "...",
): string => {
  if (direction === undefined || direction >= 0) {
    return ellipsizeEnd(text, maxWidth, ellipsis);
  } else {
    return ellipsizeStart(text, maxWidth, ellipsis);
  }
};

export { ellipsizeStart, ellipsizeEnd, ellipsize };
