import { describe, expect, it } from "vitest";
import {
  curvePath,
  simplifyContour,
  traceContours,
  vectorPathsFromMask,
} from "./outline";

function maskFromRect(
  width: number, height: number,
  x0: number, y0: number, x1: number, y1: number,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) mask[y * width + x] = 1;
  }
  return mask;
}

describe("vector silhouette tracing", () => {
  it("traces an opaque rectangle as four clean geometric corners", () => {
    const mask = maskFromRect(30, 24, 5, 4, 25, 18);
    const loops = traceContours(mask, 30, 24);
    expect(loops).toHaveLength(1);
    const simplified = simplifyContour(loops[0], 1.3);
    expect(simplified).toHaveLength(4);
    const clean = vectorPathsFromMask(mask, 30, 24, "clean", 10);
    expect(clean).toHaveLength(1);
    expect(clean[0]).toMatch(/^M /);
    expect(clean[0]).toContain(" Q ");
    expect(clean[0].endsWith(" Z")).toBe(true);
  });

  it("retains separate contours around transparent holes", () => {
    const mask = maskFromRect(32, 32, 3, 3, 29, 29);
    for (let y = 12; y < 20; y += 1) {
      for (let x = 12; x < 20; x += 1) mask[y * 32 + x] = 0;
    }
    expect(traceContours(mask, 32, 32)).toHaveLength(2);
    expect(vectorPathsFromMask(mask, 32, 32, "clean", 8)).toHaveLength(2);
  });

  it("does not connect two subjects touching only diagonally", () => {
    const mask = maskFromRect(20, 20, 2, 2, 8, 8);
    for (let y = 8; y < 14; y += 1) {
      for (let x = 8; x < 14; x += 1) mask[y * 20 + x] = 1;
    }
    expect(traceContours(mask, 20, 20)).toHaveLength(2);
  });

  it("makes a stable hand-cut path, distinct from the clean path", () => {
    const mask = maskFromRect(160, 120, 20, 20, 140, 100);
    const clean = vectorPathsFromMask(mask, 160, 120, "clean", 12);
    const rough = vectorPathsFromMask(mask, 160, 120, "rough", 12);
    expect(rough).toHaveLength(1);
    expect(rough).toEqual(vectorPathsFromMask(mask, 160, 120, "rough", 12));
    expect(rough[0]).not.toBe(clean[0]);
    expect(rough[0].length).toBeGreaterThan(clean[0].length);
  });

  it("drops negligible speckles and handles an empty mask", () => {
    const mask = new Uint8Array(20 * 20);
    mask[3 * 20 + 4] = 1;
    expect(traceContours(mask, 20, 20)).toEqual([]);
    expect(traceContours(new Uint8Array(20 * 20), 20, 20)).toEqual([]);
  });

  it("validates the mask dimensions", () => {
    expect(() => traceContours(new Uint8Array(3), 2, 2)).toThrow();
  });
});

describe("smooth SVG paths", () => {
  it("rounds corners using quadratic curves", () => {
    const path = curvePath([
      { x: 0, y: 0 }, { x: 80, y: 0 },
      { x: 80, y: 60 }, { x: 0, y: 60 },
    ], 2);
    expect(path).toContain(" Q ");
    expect(path).toContain(" Z");
    expect(path).not.toContain("NaN");
  });
});
