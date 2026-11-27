import { describe, expect, it } from "vitest";
import { DEFAULT_FONT, FONTS } from "./fonts";
import { SETTINGS_KEY, loadSettings, sanitizeSettings, saveSettings } from "./settings";

const memory = (initial?: string) => {
  const data = new Map<string, string>(initial === undefined ? [] : [[SETTINGS_KEY, initial]]);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe("recent settings", () => {
  it("returns nothing when storage is empty, missing or corrupt", () => {
    expect(loadSettings(memory())).toEqual({});
    expect(loadSettings(undefined)).toEqual({});
    expect(loadSettings(memory("{not json"))).toEqual({});
  });

  it("round-trips settings and merges partial updates", () => {
    const storage = memory();
    saveSettings({ backgroundColor: "#4069db" }, storage);
    saveSettings({ text: { fontSize: 120, bold: false } }, storage);
    saveSettings({ text: { color: "#F2E27A" } }, storage);
    expect(loadSettings(storage)).toEqual({
      backgroundColor: "#4069DB",
      text: { fontSize: 120, bold: false, color: "#F2E27A" },
    });
  });

  it("drops unknown fonts, bad colors and out-of-range values", () => {
    const font = FONTS[FONTS.length - 1].value;
    expect(
      sanitizeSettings({
        backgroundColor: "red",
        text: { fontFamily: "'Removed Font', serif", fontSize: -5, bold: "yes", color: "#12", align: "justify" },
        outline: { style: "glow", width: 9999, color: "#ffffff" },
      }),
    ).toEqual({ outline: { color: "#FFFFFF" } });
    expect(sanitizeSettings({ text: { fontFamily: font } })).toEqual({ text: { fontFamily: font } });
    expect(sanitizeSettings({ text: { fontFamily: DEFAULT_FONT.value, align: "center" } }).text).toEqual({
      fontFamily: DEFAULT_FONT.value,
      align: "center",
    });
    expect(sanitizeSettings(null)).toEqual({});
    expect(sanitizeSettings([])).toEqual({});
  });

  it("does not throw when storage rejects writes", () => {
    const full = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
    expect(() => saveSettings({ backgroundColor: "#000000" }, full)).not.toThrow();
  });
});
