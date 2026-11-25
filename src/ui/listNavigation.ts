export type ListKey = "ArrowDown" | "ArrowUp" | "Home" | "End" | "PageDown" | "PageUp";

const PAGE = 8;

/** Active option after a navigation key. Stops at both ends instead of wrapping (ARIA APG select-only combobox). */
export function nextActiveIndex(current: number, key: ListKey, count: number): number {
  if (count <= 0) return 0;
  const last = count - 1;
  switch (key) {
    case "ArrowDown": return Math.min(last, current + 1);
    case "ArrowUp": return Math.max(0, current - 1);
    case "Home": return 0;
    case "End": return last;
    case "PageDown": return Math.min(last, current + PAGE);
    case "PageUp": return Math.max(0, current - PAGE);
  }
}
