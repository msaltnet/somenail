/**
 * Canvas-side design tokens. Konva draws on <canvas> and cannot read CSS variables,
 * so the selection UI colors are mirrored here. tokens.test.ts keeps them equal to
 * the primitives in tokens.css.
 *
 * Selection is drawn on top of arbitrary user artwork, so a single color can never
 * be visible on every background. The border is therefore an action-colored line
 * with a white halo, and anchors are white with an action-colored stroke.
 */
export const CANVAS_UI = {
  selection: "#1E8A5E", // --sn-green-500
  selectionHalo: "#FFFFFF", // --sn-gray-0
  anchorFill: "#FFFFFF", // --sn-gray-0
  anchorStroke: "#1E8A5E", // --sn-green-500
  anchorShadow: "rgba(22, 23, 24, 0.45)",
  borderWidth: 2,
  haloWidth: 4,
  anchorSize: 12,
  anchorRadius: 3,
} as const;
