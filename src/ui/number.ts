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

/**
 * Change for one wheel notch over a focused number field: wheel up increases, Shift ×10.
 * Returns 0 for horizontal or zero movement so trackpad side-swipes never change the value.
 */
export function wheelStep(deltaX: number, deltaY: number, step: number, fast: boolean): number {
  if (deltaY === 0 || Math.abs(deltaX) > Math.abs(deltaY)) return 0;
  return (deltaY < 0 ? step : -step) * (fast ? 10 : 1);
}
