import { describe, it, expect } from "vitest";
import { ellipsizeStart, ellipsizeEnd, ellipsize } from "./ellipsize.ts";

describe("ellipsizeStart", () => {
  it("should return the same string if the length is within maxWidth", () => {
    expect(ellipsizeStart("hello", 10)).toBe("hello");
  });

  it("should return an ellipsized string if the length exceeds maxWidth", () => {
    expect(ellipsizeStart("hello world", 8)).toBe("...world");
    expect(ellipsizeStart("abcdef", 4)).toBe("...f");
  });

  it("should correctly handle surrogate pairs", () => {
    expect(ellipsizeStart("a\uD83D\uDE00b\uD83D\uDE02c", 5)).toBe("...\uDE02c");
  });

  it("should return the original text if shorter than the ellipsis width", () => {
    expect(ellipsizeStart("hi", 2)).toBe("hi");
  });

  it("should truncate the ellipsis if maxWidth is less than the ellipsis width", () => {
    expect(ellipsizeStart("hello", 2)).toBe("..");
  });
});

describe("ellipsizeEnd", () => {
  it("should return the same string if the length is within maxWidth", () => {
    expect(ellipsizeEnd("hello", 10)).toBe("hello");
  });

  it("should return an ellipsized string if the length exceeds maxWidth", () => {
    expect(ellipsizeEnd("hello world", 8)).toBe("hello...");
    expect(ellipsizeEnd("abcdef", 4)).toBe("a...");
  });

  it("should correctly handle surrogate pairs", () => {
    expect(ellipsizeEnd("a\uD83D\uDE00b\uD83D\uDE02c", 5)).toBe("a...");
  });

  it("should return the original text if shorter than the ellipsis width", () => {
    expect(ellipsizeEnd("hi", 2)).toBe("hi");
  });

  it("should truncate the ellipsis if maxWidth is less than the ellipsis width", () => {
    expect(ellipsizeEnd("hello", 2)).toBe("..");
  });
});

describe("ellipsize", () => {
  it("should use ellipsizeEnd by default", () => {
    expect(ellipsize("hello world", 8)).toBe("hello...");
  });

  it("should use ellipsizeStart when direction is negative", () => {
    expect(ellipsize("hello world", 8, -1)).toBe("...world");
  });

  it("should handle ellipsizing with a direction of 0", () => {
    expect(ellipsize("hello world", 8, 0)).toBe("hello...");
  });
});
