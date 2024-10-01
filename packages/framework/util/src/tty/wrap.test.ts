import { describe, it, expect } from "vitest";
import { wrapText } from "./wrap.ts";

describe("wrapText", () => {
  it("should handle the empty string", () => {
    expect(wrapText("", 10)).toBe("");
  });

  it("should return the same text if shorter than maxWidth", () => {
    expect(wrapText("hello", 10)).toBe("hello");
  });

  it("should word wrap text when it exceeds maxWidth", () => {
    expect(wrapText("hello world", 5)).toBe("hello\nworld");
  });

  it("should wrap text at word boundaries", () => {
    expect(wrapText("The quick brown fox jumps over the lazy dog", 10)).toBe(
      "The quick\nbrown fox\njumps over\nthe lazy\ndog",
    );
  });

  it("should wrap words whose length exceeds maxWidth", () => {
    expect(wrapText("supercalifragilisticexpialidocious", 10)).toBe(
      "supercalif\nragilistic\nexpialidoc\nious",
    );
    expect(wrapText("abcdefghijk", 4)).toBe("abcd\nefgh\nijk");
  });

  it("should text with existing line breaks", () => {
    expect(wrapText("hello\nworld", 10)).toBe("hello\nworld");
    expect(wrapText("this is\na test", 4)).toBe("this\nis\na\ntest");
  });

  it("should wrap text with existing CR+LF line breaks", () => {
    expect(wrapText("hello\r\nworld", 10)).toBe("hello\r\nworld");
    expect(wrapText("this is\r\na test", 4)).toBe("this\r\nis\r\na\r\ntest");
  });

  it("should wrap text with ANSI escape sequences", () => {
    expect(wrapText("\x1B[31mhello\x1B[39m world", 5)).toBe(
      "\x1B[31mhello\x1B[39m\nworld",
    );
    expect(wrapText("this \x1B[32mis\x1B[39m a test", 4)).toBe(
      "this\n\x1B[32mis\x1B[39m a\ntest",
    );
  });

  it("should handle very narrow maxWidth values", () => {
    expect(wrapText("hello", 2)).toBe("he\nll\no");
    expect(wrapText("abc def ghi", 3)).toBe("abc\ndef\nghi");
  });

  it("should handle a maxWidth of 1", () => {
    expect(wrapText("hello", 1)).toBe("h\ne\nl\nl\no");
    expect(wrapText("abc def ghi", 1)).toBe("a\nb\nc\nd\ne\nf\ng\nh\ni");
  });

  it("should wrap full-width characters", () => {
    expect(wrapText("你好世界", 4)).toBe("你好\n世界");
    expect(wrapText("こんにちは世界", 8)).toBe("こんにち\nは世界");
  });

  it("should wrap mixed-width characters", () => {
    expect(wrapText("a你好b", 3)).toBe("a你\n好b");
    expect(wrapText("hello 你好 world", 8)).toBe("hello\n你好\nworld");
  });

  it("should preserve leading whitespace", () => {
    expect(wrapText("  indented text", 10)).toBe("  indented\ntext");
    expect(wrapText("    more indented text", 10)).toBe(
      "    more\nindented\ntext",
    );
  });

  it("should preserve formatting across existing line breaks", () => {
    expect(wrapText("\x1B[31mhello\nworld", 5)).toBe(
      "\x1B[31mhello\x1B[39m\n\x1B[31mworld\x1B[39m",
    );
  });

  it("should preserve formatting across broken lines", () => {
    expect(wrapText("\x1B[31mhello world", 5)).toBe(
      "\x1B[31mhello\x1B[39m\n\x1B[31mworld\x1B[39m",
    );
    expect(wrapText("\x1B[32mthis is a test", 4)).toBe(
      "\u001b[32mthis\u001b[39m\n\u001b[32mis a\u001b[39m\n\u001b[32mtest\u001b[39m",
    );
  });

  it("should preserve hyperlinks across broken lines", () => {
    expect(
      wrapText("\x1B]8;;https://example.com\u0007link\x1B]8;;\u0007 text", 4),
    ).toBe("\x1B]8;;https://example.com\u0007link\x1B]8;;\u0007\ntext");
    expect(
      wrapText(
        "this is \x1B]8;;https://example.com\u0007a link\x1B]8;;\u0007",
        10,
      ),
    ).toBe(
      "this is \x1B]8;;https://example.com\u0007a\x1B]8;;\u0007\n\x1B]8;;https://example.com\u0007link\x1B]8;;\u0007",
    );
  });
});
