import { describe, expect, it } from "vitest";
import { isHexColor } from "./color";
import { BACKGROUND_PRESETS, TEXT_PRESETS } from "./palette";

describe.each([
  ["background", BACKGROUND_PRESETS],
  ["text", TEXT_PRESETS],
])("%s color presets", (_name, presets) => {
  it("provides exactly 10 unique six-digit HEX colors", () => {
    expect(presets).toHaveLength(10);
    expect(new Set(presets.map((preset) => preset.value)).size).toBe(10);
    for (const preset of presets) {
      expect(preset.name.length).toBeGreaterThan(0);
      expect(isHexColor(preset.value)).toBe(true);
    }
  });
});

describe("reference thumbnail accents", () => {
  it.each([
    ["핑크", "#EF9BA3"],
    ["옐로", "#F2E27A"],
    ["라벤더", "#B6AAFF"],
  ])("includes %s with the selected reference shade", (name, color) => {
    expect(TEXT_PRESETS).toContainEqual({ name, value: color });
  });
});
