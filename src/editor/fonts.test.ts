import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FONTS, drawsBold, fontShorthand, previewFontFamily } from "./fonts";

const faces = readFileSync(join(__dirname, "fontFaces.ts"), "utf8");
const googleFamily = (value: string) => value.match(/^'([^']+)'/)?.[1];

describe("font list", () => {
  it("offers 16 self-hosted Google Fonts next to the 3 basic stacks", () => {
    expect(FONTS.filter((font) => font.category === "basic")).toHaveLength(3);
    expect(FONTS.filter((font) => googleFamily(font.value))).toHaveLength(16);
  });

  it("has unique values and labels", () => {
    expect(new Set(FONTS.map((font) => font.value)).size).toBe(FONTS.length);
    expect(new Set(FONTS.map((font) => font.label)).size).toBe(FONTS.length);
  });

  it("imports an @font-face for every Google Font it lists", () => {
    for (const font of FONTS) {
      const family = googleFamily(font.value);
      if (!family) continue;
      const slug = family.toLowerCase().replace(/ /g, "-");
      expect(faces, family).toContain(`@fontsource/${slug}/400.css`);
    }
  });

  it("lists every category together so the picker shows one heading per group", () => {
    const order = FONTS.map((font) => font.category).filter((category, index, all) => all[index - 1] !== category);
    expect(new Set(order).size).toBe(order.length);
  });

  it("offers bold only where a bold face is imported", () => {
    for (const font of FONTS) {
      const family = googleFamily(font.value);
      if (!family) continue;
      const slug = family.toLowerCase().replace(/ /g, "-");
      expect(faces.includes(`@fontsource/${slug}/700.css`), family).toBe(font.hasBold);
    }
  });

  it("keeps CSS variables out of canvas stacks", () => {
    for (const font of FONTS) expect(font.value).not.toContain("var(");
  });
});

describe("font helpers", () => {
  it("swaps the generic fallback for the UI font in previews", () => {
    expect(previewFontFamily("'Jua', sans-serif")).toBe("'Jua', var(--font-body)");
    expect(previewFontFamily("Consolas, monospace")).toBe("Consolas, var(--font-body)");
  });

  it("never draws a fake bold over single-weight faces", () => {
    expect(drawsBold("'Black Han Sans', sans-serif", true)).toBe(false);
    expect(drawsBold("'Noto Sans KR', sans-serif", true)).toBe(true);
    expect(drawsBold("'Noto Sans KR', sans-serif", false)).toBe(false);
    expect(drawsBold("Unknown, sans-serif", true)).toBe(true);
  });

  it("builds a font shorthand with the bold weight", () => {
    expect(fontShorthand("'Jua', sans-serif", true)).toBe("700 64px 'Jua', sans-serif");
    expect(fontShorthand("'Jua', sans-serif", false, 20)).toBe("400 20px 'Jua', sans-serif");
  });
});
