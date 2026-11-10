import { describe, expect, it } from "vitest";
import { isHexColor, normalizeHexColor } from "./color";

describe("color utilities", () => {
  it("accepts valid six digit HEX colors", () => {
    expect(isHexColor("#1A2b3C")).toBe(true);
    expect(isHexColor("1A2B3C")).toBe(false);
    expect(isHexColor("#fff")).toBe(false);
    expect(isHexColor("#gg00ff")).toBe(false);
  });
  it("normalizes user input", () => {
    expect(normalizeHexColor(" ffaa88 ")).toBe("#FFAA88");
    expect(normalizeHexColor("#aabbcc")).toBe("#AABBCC");
    expect(normalizeHexColor("invalid")).toBe(null);
  });
});
