import { describe, it, expect } from "vitest";
import { stripAnsi } from "./ansi.ts";

describe("stripAnsi", () => {
  it("should return an empty string when input is an empty string", () => {
    expect(stripAnsi("")).toBe("");
  });

  it("should return the same string when there are no ANSI escapes", () => {
    expect(stripAnsi("hello")).toBe("hello");
    expect(stripAnsi("plain text")).toBe("plain text");
  });

  it("should remove ANSI escapes for color", () => {
    expect(stripAnsi("\x1B[31mhello\x1B[39m")).toBe("hello");
    expect(stripAnsi("\x1B[32mworld\x1B[39m")).toBe("world");
  });

  it("should remove ANSI escapes for background color", () => {
    expect(stripAnsi("\x1B[41mhello\x1B[49m")).toBe("hello");
    expect(stripAnsi("\x1B[42mworld\x1B[49m")).toBe("world");
  });

  it("should remove ANSI escapes for bold text", () => {
    expect(stripAnsi("\x1B[1mhello\x1B[22m")).toBe("hello");
  });

  it("should remove ANSI escapes for underlined text", () => {
    expect(stripAnsi("\x1B[4mhello\x1B[24m")).toBe("hello");
  });

  it("should remove ANSI escapes for blinking text", () => {
    expect(stripAnsi("\x1B[5mhello\x1B[25m")).toBe("hello");
  });

  it("should remove ANSI escapes for invisible text", () => {
    expect(stripAnsi("\x1B[8mhello\x1B[28m")).toBe("hello");
  });

  it("should handle text with multiple ANSI escapes", () => {
    expect(stripAnsi("\x1B[31mhello \x1B[32mworld\x1B[39m")).toBe(
      "hello world",
    ); // mixed color text
    expect(stripAnsi("\x1B[1m\x1B[4mhello\x1B[24m\x1B[22m")).toBe("hello"); // bold and underlined text
  });

  it("should handle text with nested ANSI escapes", () => {
    expect(stripAnsi("\x1B[31mhello \x1B[4mworld\x1B[24m\x1B[39m")).toBe(
      "hello world",
    ); // colored and underlined text
  });

  it("should handle text with invalid or incomplete ANSI escapes", () => {
    expect(stripAnsi("\x1B[31mhello\x1B")).toBe("hello\x1B");
    expect(stripAnsi("hello\x1B[")).toBe("hello\x1B[");
  });

  it("should handle text with cursor movement ANSI escapes", () => {
    expect(stripAnsi("\x1B[2J")).toBe(""); // clear screen
    expect(stripAnsi("hello\x1B[1A")).toBe("hello"); // move cursor up
  });

  it("should handle text with SGR parameters", () => {
    expect(stripAnsi("\x1B[31;1mhello\x1B[0m")).toBe("hello"); // red and bold text
    expect(stripAnsi("\x1B[32;4mworld\x1B[0m")).toBe("world"); // green and underlined text
  });

  it("should handle text with embedded ANSI escapes", () => {
    expect(stripAnsi("hello \x1B[31mworld\x1B[39m")).toBe("hello world"); // mixed text
  });

  it("should handle text with multiple ANSI escapes", () => {
    expect(stripAnsi("\x1B[31mhello\x1B[0m \x1B[32mworld\x1B[0m")).toBe(
      "hello world",
    ); // mixed color text
  });
});
