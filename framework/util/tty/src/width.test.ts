import { describe, expect, it } from "vitest";
import { getCharacterWidth, getStringWidth } from "./width.ts";

describe("getCharacterWidth", () => {
  it("should return 0 for control characters", () => {
    expect(getCharacterWidth(0x0000)).toBe(0); // Null
    expect(getCharacterWidth(0x001f)).toBe(0); // Unit Separator
    expect(getCharacterWidth(0x007f)).toBe(0); // Delete
    expect(getCharacterWidth(0x009f)).toBe(0); // Application Program Command
  });

  it("should return 0 for zero-width characters", () => {
    expect(getCharacterWidth(0x200b)).toBe(0); // Zero Width Space
    expect(getCharacterWidth(0x200d)).toBe(0); // Zero Width Joiner
    expect(getCharacterWidth(0xfeff)).toBe(0); // Zero Width No-Break Space
  });

  it("should return 0 for combining characters", () => {
    expect(getCharacterWidth(0x0300)).toBe(0); // Combining Grave Accent
    expect(getCharacterWidth(0x036f)).toBe(0); // Combining Latin Small Letter X
    expect(getCharacterWidth(0x1ab0)).toBe(0); // Combining Latin Letter Small Capital A
    expect(getCharacterWidth(0x1aff)).toBe(0); // Combining Latin Letter Small Capital Y
  });

  it("should return 0 for unpaired surrogates", () => {
    expect(getCharacterWidth(0xd800)).toBe(0); // High Surrogate
    expect(getCharacterWidth(0xdfff)).toBe(0); // Low Surrogate
  });

  it("should return 0 for variation selectors", () => {
    expect(getCharacterWidth(0xfe00)).toBe(0); // Variation Selector-1
    expect(getCharacterWidth(0xfe0f)).toBe(0); // Variation Selector-16
  });

  it("should return 1 for regular characters", () => {
    expect(getCharacterWidth(0x0041)).toBe(1); // Latin Capital Letter A
    expect(getCharacterWidth(0x0062)).toBe(1); // Latin Small Letter B
  });

  it("should return 2 for fullwidth forms", () => {
    expect(getCharacterWidth(0x3000)).toBe(2); // Ideographic Space
    expect(getCharacterWidth(0xff01)).toBe(2); // Fullwidth Exclamation Mark
  });

  it("should return 2 for wide forms", () => {
    expect(getCharacterWidth(0x1100)).toBe(2); // Hangul Choseong Kiyeok
    expect(getCharacterWidth(0x1f600)).toBe(2); // Grinning Face Emoji
  });

  it("should return 2 for emoji characters", () => {
    expect(getCharacterWidth(0x1f600, "😀")).toBe(2); // Grinning face
    expect(getCharacterWidth(0x1f44d, "👍")).toBe(2); // Thumbs up
  });
});

describe("getStringWidth", () => {
  it("should return 0 for the empty string", () => {
    expect(getStringWidth("")).toBe(0);
  });

  it("should return the correct width for strings without ANSI escapes", () => {
    expect(getStringWidth("abc")).toBe(3);
    expect(getStringWidth("hello world")).toBe(11);
    expect(getStringWidth("😀")).toBe(2);
  });

  it("should return the correct width for strings with ANSI escapes", () => {
    expect(getStringWidth("\x1B[31mhello\x1B[39m")).toBe(5);
  });

  it("should return the correct width for strings with mixed character widths", () => {
    expect(getStringWidth("a😀b")).toBe(4); // mixed width characters
    expect(getStringWidth("あいうえお")).toBe(10); // fullwidth characters
  });

  it("should return the correct width for strings with zero-width characters", () => {
    expect(getStringWidth("a\u200bb")).toBe(2); // zero-width space between characters
  });

  it("should return the correct width for strings with combining characters", () => {
    expect(getStringWidth("e\u0301")).toBe(1); // 'e' with combining acute accent
  });
});
