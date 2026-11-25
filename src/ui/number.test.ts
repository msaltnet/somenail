import { describe, expect, it } from "vitest";
import { clamp, commitDraft, parseWholeNumber, wheelStep } from "./number";

describe("number field helpers", () => {
  it("parses whole numbers, including signs and surrounding spaces", () => {
    expect(parseWholeNumber(" 88 ")).toBe(88);
    expect(parseWholeNumber("-45")).toBe(-45);
    expect(parseWholeNumber("−45")).toBe(-45);
    expect(parseWholeNumber("+12")).toBe(12);
  });

  it("rejects empty, partial and decimal input", () => {
    for (const draft of ["", "-", "1.5", "12px", "abc"]) expect(parseWholeNumber(draft)).toBeNull();
  });

  it("clamps into range", () => {
    expect(clamp(5, 12, 300)).toBe(12);
    expect(clamp(999, 12, 300)).toBe(300);
    expect(clamp(88, 12, 300)).toBe(88);
  });

  it("commits a clamped value, or keeps the current one when the draft is not a number", () => {
    expect(commitDraft("1", 88, 12, 300)).toBe(12);
    expect(commitDraft("", 88, 12, 300)).toBe(88);
    expect(commitDraft("120", 88, 12, 300)).toBe(120);
  });

  it("turns vertical wheel movement into one step, ignoring sideways swipes", () => {
    expect(wheelStep(0, -100, 4, false)).toBe(4);
    expect(wheelStep(0, 3, 4, false)).toBe(-4);
    expect(wheelStep(0, -100, 4, true)).toBe(40);
    expect(wheelStep(50, 10, 4, false)).toBe(0);
    expect(wheelStep(0, 0, 4, false)).toBe(0);
  });
});
