import { describe, expect, it } from "vitest";
import { distanceFromMask, outlineAlpha } from "./outline";

describe("alpha-aware cutout border", () => {
  it("traces transparency rather than drawing a filled rectangle", () => {
    const mask = new Uint8Array(9 * 9);
    mask[4 * 9 + 4] = 1;
    const outline = outlineAlpha(mask, 9, 9, 2, "clean");
    expect(outline[4 * 9 + 4]).toBe(0); // original image is rendered separately
    expect(outline[4 * 9 + 5]).toBe(255);
    expect(outline[0]).toBe(0);
    expect(outline[4 * 9 + 7]).toBe(0);
  });

  it("computes zero distances for source pixels", () => {
    const mask = Uint8Array.from([0, 0, 0, 1, 0]);
    const distance = distanceFromMask(mask, 5, 1);
    expect([...distance]).toEqual([3, 2, 1, 0, 1]);
  });

  it("keeps the same source and adds repeatable organic variation", () => {
    const width = 80;
    const height = 80;
    const mask = new Uint8Array(width * height);
    for (let y = 24; y < 56; y += 1) {
      for (let x = 23; x < 58; x += 1) mask[y * width + x] = 1;
    }
    const clean = outlineAlpha(mask, width, height, 9, "clean");
    const rough = outlineAlpha(mask, width, height, 9, "rough");
    expect([...rough]).toEqual([...outlineAlpha(mask, width, height, 9, "rough")]);
    expect([...rough]).not.toEqual([...clean]);
    expect(rough[40 * width + 40]).toBe(0);
    expect(rough[0]).toBe(0);
  });

  it("rejects incorrect mask dimensions", () => {
    expect(() => distanceFromMask(new Uint8Array(3), 2, 2)).toThrow();
  });
});
