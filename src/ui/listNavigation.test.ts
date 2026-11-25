import { describe, expect, it } from "vitest";
import { nextActiveIndex } from "./listNavigation";

describe("nextActiveIndex", () => {
  it("moves one step and stops at both ends", () => {
    expect(nextActiveIndex(0, "ArrowDown", 3)).toBe(1);
    expect(nextActiveIndex(2, "ArrowDown", 3)).toBe(2);
    expect(nextActiveIndex(0, "ArrowUp", 3)).toBe(0);
  });

  it("jumps to the ends and by pages", () => {
    expect(nextActiveIndex(5, "Home", 19)).toBe(0);
    expect(nextActiveIndex(5, "End", 19)).toBe(18);
    expect(nextActiveIndex(5, "PageDown", 19)).toBe(13);
    expect(nextActiveIndex(15, "PageDown", 19)).toBe(18);
    expect(nextActiveIndex(5, "PageUp", 19)).toBe(0);
  });

  it("handles an empty list", () => {
    expect(nextActiveIndex(0, "ArrowDown", 0)).toBe(0);
  });
});
