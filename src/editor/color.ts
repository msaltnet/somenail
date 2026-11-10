const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

export function normalizeHexColor(value: string): string | null {
  const candidate = value.trim().startsWith("#")
    ? value.trim()
    : "#" + value.trim();
  return isHexColor(candidate) ? candidate.toUpperCase() : null;
}
