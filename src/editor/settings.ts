import { FONTS } from "./fonts";
import { isHexColor } from "./color";
import type { Align } from "./model";
import type { OutlineStyle } from "./outline";

/**
 * Last-used editing settings, remembered in this browser (localStorage) and applied to
 * newly added elements and the background. Only preferences are stored — never the
 * document, text content or images — and nothing leaves the browser.
 */
export type RecentSettings = {
  backgroundColor?: string;
  text?: {
    fontFamily?: string;
    fontSize?: number;
    bold?: boolean;
    color?: string;
    align?: Align;
  };
  outline?: {
    style?: OutlineStyle;
    width?: number;
    color?: string;
  };
};

export const SETTINGS_KEY = "somenail:recent-settings:v1";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const color = (value: unknown) => (typeof value === "string" && isHexColor(value) ? value.toUpperCase() : undefined);
const number = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]) =>
  allowed.includes(value as T) ? (value as T) : undefined;
const clean = <T extends object>(value: T): T | undefined => {
  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  return entries.length ? (Object.fromEntries(entries) as T) : undefined;
};

/** Drops anything unknown or out of range, so stale or hand-edited storage cannot break the editor. */
export function sanitizeSettings(raw: unknown): RecentSettings {
  if (!isObject(raw)) return {};
  const text = isObject(raw.text) ? raw.text : {};
  const outline = isObject(raw.outline) ? raw.outline : {};
  const result: RecentSettings = {
    backgroundColor: color(raw.backgroundColor),
    text: clean({
      fontFamily: FONTS.find((font) => font.value === text.fontFamily)?.value,
      fontSize: number(text.fontSize, 8, 400),
      bold: typeof text.bold === "boolean" ? text.bold : undefined,
      color: color(text.color),
      align: oneOf(text.align, ["left", "center", "right"] as const),
    }),
    outline: clean({
      style: oneOf(outline.style, ["none", "clean", "rough"] as const),
      width: number(outline.width, 1, 200),
      color: color(outline.color),
    }),
  };
  return clean(result) ?? {};
}

export function loadSettings(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): RecentSettings {
  try {
    const stored = storage?.getItem(SETTINGS_KEY);
    return stored ? sanitizeSettings(JSON.parse(stored)) : {};
  } catch {
    return {};
  }
}

/** Merges a partial update into the stored settings. Storage may be blocked or full; that is not an error. */
export function saveSettings(
  patch: RecentSettings,
  storage: Pick<Storage, "getItem" | "setItem"> | undefined = safeStorage(),
): void {
  try {
    if (!storage) return;
    const current = loadSettings(storage);
    const next: RecentSettings = {
      ...current,
      ...patch,
      text: { ...current.text, ...patch.text },
      outline: { ...current.outline, ...patch.outline },
    };
    storage.setItem(SETTINGS_KEY, JSON.stringify(sanitizeSettings(next)));
  } catch {
    // Remembering settings is a convenience only.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
