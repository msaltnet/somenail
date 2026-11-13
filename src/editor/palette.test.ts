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
