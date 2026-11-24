import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CANVAS_UI } from "./tokens";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const TOKENS_CSS = join(SRC, "design", "tokens.css");
const tokensCss = readFileSync(TOKENS_CSS, "utf8");

function filesUnder(dir: string, ext: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path, ext);
    return path.endsWith(ext) ? [path] : [];
  });
}

/** Declarations in the first :root block (light theme defaults). */
function rootTokens(): Map<string, string> {
  const block = tokensCss.slice(tokensCss.indexOf(":root {"), tokensCss.indexOf("\n}\n"));
  const map = new Map<string, string>();
  for (const match of block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) map.set(match[1], match[2].trim());
  return map;
}

function resolve(tokens: Map<string, string>, name: string, depth = 0): string {
  const raw = tokens.get(name);
  if (raw === undefined) throw new Error(`Missing token ${name}`);
  const ref = raw.match(/^var\((--[a-z0-9-]+)\)$/);
  if (ref && depth < 10) return resolve(tokens, ref[1], depth + 1);
  return raw;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const tokens = rootTokens();
const color = (name: string) => resolve(tokens, name);

describe("design tokens", () => {
  it("define every token required by the msalt-studio shared contract (v0.2 §3.2)", () => {
    const required = [
      "--color-bg", "--color-surface", "--color-surface-subtle",
      "--color-text", "--color-text-muted", "--color-border", "--color-control-border",
      "--color-action", "--color-action-hover", "--color-on-action", "--color-action-wash",
      "--color-brand", "--color-focus",
      ...["info", "success", "warning", "error"].flatMap((status) =>
        ["bg", "text", "border"].map((part) => `--color-status-${status}-${part}`)),
      "--font-body", "--font-heading",
      ...Array.from({ length: 8 }, (_, i) => `--space-${i + 1}`),
      "--radius-control", "--radius-panel", "--control-height",
    ];
    const missing = required.filter((name) => !tokens.has(name));
    expect(missing).toEqual([]);
  });

  it("meet the shared contrast floors", () => {
    const text = [
      ["--color-text", "--color-surface"],
      ["--color-text", "--color-bg"],
      ["--color-text-muted", "--color-surface"],
      ["--color-text-muted", "--color-surface-subtle"],
      ["--color-text-muted", "--color-bg"],
      ["--color-on-action", "--color-action"],
      ["--color-on-action", "--color-action-hover"],
      ["--color-text", "--color-action-wash"],
      ["--color-on-brand", "--color-brand"],
      ...["info", "success", "warning", "error"].map((s) => [`--color-status-${s}-text`, `--color-status-${s}-bg`]),
      ["--color-status-error-text", "--color-surface"],
    ];
    const nonText = [
      ["--color-control-border", "--color-surface-subtle"],
      ["--color-control-border", "--color-surface"],
      ["--color-action", "--color-surface"],
      ["--color-focus", "--color-surface"],
      ["--color-focus", "--color-bg"],
    ];
    const failures = [
      ...text.filter(([fg, bg]) => contrast(color(fg), color(bg)) < 4.5).map((pair) => pair.join(" on ")),
      ...nonText.filter(([fg, bg]) => contrast(color(fg), color(bg)) < 3).map((pair) => pair.join(" on ")),
    ];
    expect(failures).toEqual([]);
  });

  it("keep canvas selection colors in sync with tokens.css", () => {
    expect(CANVAS_UI.selection).toBe(color("--sn-green-500"));
    expect(CANVAS_UI.anchorStroke).toBe(color("--sn-green-500"));
    expect(CANVAS_UI.selectionHalo).toBe(color("--sn-gray-0"));
    expect(CANVAS_UI.anchorFill).toBe(color("--sn-gray-0"));
  });

  it("never reuse a background preset as the selection color", async () => {
    const { BACKGROUND_PRESETS } = await import("../editor/palette");
    expect(BACKGROUND_PRESETS.map((preset) => preset.value)).not.toContain(CANVAS_UI.selection);
  });
});

describe("stylesheets outside tokens.css", () => {
  const sheets = filesUnder(SRC, ".css").filter((path) => path !== TOKENS_CSS);
  const sources = [...sheets, ...filesUnder(join(SRC, "ui"), ".tsx")];

  it("contain no raw color values", () => {
    const offenders = sources.flatMap((path) => {
      const text = readFileSync(path, "utf8");
      const hits = text.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g) ?? [];
      return hits.map((hit) => `${relative(SRC, path)}: ${hit}`);
    });
    expect(offenders).toEqual([]);
  });

  it("take font-size, border-radius, z-index and font-weight from tokens", () => {
    const offenders = sheets.flatMap((path) => {
      const text = readFileSync(path, "utf8");
      const hits = [...text.matchAll(/(font-size|border-radius|z-index|font-weight):\s*([^;]+);/g)]
        .filter(([, , value]) => !/^(var\(|calc\(var\(|0$|inherit$)/.test(value.trim()));
      return hits.map(([hit]) => `${relative(SRC, path)}: ${hit}`);
    });
    expect(offenders).toEqual([]);
  });

  it("draw every focus ring as 2px solid focus color with a 2px offset (shared §4)", () => {
    const offenders = sheets.flatMap((path) => {
      const text = readFileSync(path, "utf8");
      const outlines = [...text.matchAll(/outline:\s*([^;]+);/g)]
        .filter(([, value]) => value.includes("--color-focus"))
        .filter(([, value]) => value.trim() !== "2px solid var(--color-focus)");
      const offsets = [...text.matchAll(/outline-offset:\s*([^;]+);/g)]
        .filter(([, value]) => !["2px", "-2px"].includes(value.trim()));
      return [...outlines, ...offsets].map(([hit]) => `${relative(SRC, path)}: ${hit}`);
    });
    expect(offenders).toEqual([]);
  });
});
