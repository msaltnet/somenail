/**
 * Fonts the user can pick for canvas text.
 *
 * `value` is the CSS font stack stored on the text element and handed to Konva as-is,
 * so it must not contain CSS variables. Every face is a self-hosted web font (OFL-1.1),
 * so a PNG looks the same on every OS: Pretendard comes from the `pretendard` package
 * (imported in `main.tsx`, shared with the UI), the rest from @fontsource (`fontFaces.ts`).
 */
export type FontCategory = "sans" | "serif" | "display" | "handwriting";

export type FontOption = {
  /** Korean name shown in the picker, rendered in the font itself. */
  label: string;
  value: string;
  category: FontCategory;
  /** False for single-weight faces: the browser would smear a fake bold over them. */
  hasBold: boolean;
  /** Some faces draw small glyphs for their size; enlarge only the name shown in the picker. */
  previewScale?: number;
};

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  sans: "고딕",
  serif: "명조",
  display: "제목용",
  handwriting: "손글씨",
};

const webFont = (family: string, fallback: "sans-serif" | "serif" | "cursive") => `'${family}', ${fallback}`;

export const FONTS: readonly FontOption[] = [
  { label: "프리텐다드", value: webFont("Pretendard Variable", "sans-serif"), hasBold: true, category: "sans" },
  { label: "본고딕", value: webFont("Noto Sans KR", "sans-serif"), hasBold: true, category: "sans" },
  { label: "나눔고딕", value: webFont("Nanum Gothic", "sans-serif"), hasBold: true, category: "sans" },
  { label: "IBM 플렉스", value: webFont("IBM Plex Sans KR", "sans-serif"), hasBold: true, category: "sans" },
  { label: "고운돋움", value: webFont("Gowun Dodum", "sans-serif"), hasBold: false, category: "sans" },
  { label: "도현", value: webFont("Do Hyeon", "sans-serif"), hasBold: false, category: "sans" },
  { label: "주아", value: webFont("Jua", "sans-serif"), hasBold: false, category: "sans" },
  { label: "동글", value: webFont("Dongle", "sans-serif"), hasBold: true, category: "sans", previewScale: 1.6 },

  { label: "본명조", value: webFont("Noto Serif KR", "serif"), hasBold: true, category: "serif" },
  { label: "나눔명조", value: webFont("Nanum Myeongjo", "serif"), hasBold: true, category: "serif" },
  { label: "함렛", value: webFont("Hahmlet", "serif"), hasBold: true, category: "serif" },
  { label: "고운바탕", value: webFont("Gowun Batang", "serif"), hasBold: true, category: "serif" },

  { label: "검은고딕", value: webFont("Black Han Sans", "sans-serif"), hasBold: false, category: "display" },
  { label: "스타일리시", value: webFont("Stylish", "sans-serif"), hasBold: false, category: "display" },

  { label: "나눔손글씨 펜", value: webFont("Nanum Pen Script", "cursive"), hasBold: false, category: "handwriting", previewScale: 1.3 },
  { label: "나눔손글씨 붓", value: webFont("Nanum Brush Script", "cursive"), hasBold: false, category: "handwriting", previewScale: 1.3 },
  { label: "독도", value: webFont("Dokdo", "cursive"), hasBold: false, category: "handwriting", previewScale: 1.15 },
];

export const DEFAULT_FONT = FONTS[0];

export function findFont(value: string): FontOption | undefined {
  return FONTS.find((font) => font.value === value);
}

/** Whether text in this font is drawn bold. Unknown stacks keep the user's choice. */
export function drawsBold(family: string, bold: boolean): boolean {
  return bold && (findFont(family)?.hasBold ?? true);
}

/**
 * Font stack for showing a font's name in the UI: the generic fallback is replaced by the
 * UI font, so a label never shows empty boxes or a random system face while its file loads.
 */
export function previewFontFamily(value: string): string {
  const stack = value.replace(/,\s*(sans-serif|serif|cursive|monospace)\s*$/, "");
  return `${stack}, var(--font-body)`;
}

/** CSS `font` shorthand for loading or measuring a text element's face. */
export function fontShorthand(family: string, bold: boolean, size = 64): string {
  return `${bold ? 700 : 400} ${size}px ${family}`;
}

/**
 * Loads the glyph subsets a text needs. Google Fonts are split by unicode-range,
 * and a canvas never triggers those downloads by itself, so call this before drawing.
 * Resolves true when at least one matching face is ready.
 */
export async function ensureFontLoaded(family: string, bold: boolean, text: string): Promise<boolean> {
  if (typeof document === "undefined" || !document.fonts) return false;
  try {
    const faces = await document.fonts.load(fontShorthand(family, bold), text || "가A");
    return faces.length > 0;
  } catch {
    return false;
  }
}
