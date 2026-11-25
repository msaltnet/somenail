/** Parses what the user typed into a number field. Returns null for anything that is not a whole number. */
export function parseWholeNumber(draft: string): number | null {
  const trimmed = draft.trim().replace(/^\+/, "").replace(/^−/, "-");
  if (!/^-?\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Value to commit when the field loses focus: valid numbers are clamped into range,
 * anything else falls back to the current value.
 */
export function commitDraft(draft: string, current: number, min: number, max: number): number {
  const parsed = parseWholeNumber(draft);
  return parsed === null ? current : clamp(parsed, min, max);
}
