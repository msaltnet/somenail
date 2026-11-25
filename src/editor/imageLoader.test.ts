import { describe, expect, it } from "vitest";
import { hasTransparentPixel } from "./imageLoader";

describe("hasTransparentPixel", () => {
  it("is false when every pixel is fully opaque", () => {
    expect(hasTransparentPixel(new Uint8ClampedArray([10, 20, 30, 255, 0, 0, 0, 255]))).toBe(false);
  });

  it("is true when any pixel has alpha below 255", () => {
    expect(hasTransparentPixel(new Uint8ClampedArray([10, 20, 30, 255, 0, 0, 0, 254]))).toBe(true);
    expect(hasTransparentPixel(new Uint8ClampedArray([0, 0, 0, 0]))).toBe(true);
  });
});
