/**
 * Creates an alpha-aware outline behind an uploaded image.
 * The outline is rendered into a transparent canvas locally, without ML or a server.
 * PNG/WebP with transparent backgrounds produce a true silhouette; opaque JPEGs
 * naturally produce a rectangle because there is no subject alpha to follow.
 */
export type OutlineStyle = "none" | "clean" | "rough";

export interface OutlineBitmap {
  canvas: HTMLCanvasElement;
  padding: number; // canvas logical units on each side
}

function colorChannels(hex: string): [number, number, number] {
  const valid = /^#[\da-fA-F]{6}$/.test(hex) ? hex : "#FFFFFF";
  return [
    Number.parseInt(valid.slice(1, 3), 16),
    Number.parseInt(valid.slice(3, 5), 16),
    Number.parseInt(valid.slice(5, 7), 16),
  ];
}

function jitter(x: number, y: number): number {
  // Spatially smooth, deterministic variation rather than pixel-level random
  // speckling. The short-wave component gives the paper-cut edge its texture.
  return (
    Math.sin(x * 0.11 + Math.sin(y * 0.061) * 1.7) * 0.58 +
    Math.sin(y * 0.16 + Math.cos(x * 0.047) * 1.6) * 0.30 +
    Math.sin((x + y) * 0.39) * 0.12
  );
}

/** A fast two-pass chamfer distance transform from the opaque image pixels. */
export function distanceFromMask(
  mask: Uint8Array,
  width: number,
  height: number,
): Float32Array {
  if (mask.length !== width * height) throw new Error("Invalid alpha mask size");
  const result = new Float32Array(mask.length);
  const far = width + height + 1;
  for (let i = 0; i < mask.length; i += 1) result[i] = mask[i] ? 0 : far;
  const diagonal = Math.SQRT2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (result[i] === 0) continue;
      let value = result[i];
      if (x > 0) value = Math.min(value, result[i - 1] + 1);
      if (y > 0) {
        value = Math.min(value, result[i - width] + 1);
        if (x > 0) value = Math.min(value, result[i - width - 1] + diagonal);
        if (x < width - 1) value = Math.min(value, result[i - width + 1] + diagonal);
      }
      result[i] = value;
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const i = y * width + x;
      if (result[i] === 0) continue;
      let value = result[i];
      if (x + 1 < width) value = Math.min(value, result[i + 1] + 1);
      if (y + 1 < height) {
        value = Math.min(value, result[i + width] + 1);
        if (x > 0) value = Math.min(value, result[i + width - 1] + diagonal);
        if (x + 1 < width) value = Math.min(value, result[i + width + 1] + diagonal);
      }
      result[i] = value;
    }
  }
  return result;
}

/** Returns transparent/opaque border alpha, leaving the source image untouched. */
export function outlineAlpha(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
  style: Exclude<OutlineStyle, "none">,
): Uint8ClampedArray {
  const dist = distanceFromMask(mask, width, height);
  const result = new Uint8ClampedArray(mask.length);
  const variation = style === "rough" ? Math.min(radius * 0.42, 4) : 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (mask[i]) continue;
      const distance = dist[i];
      const limit = radius + variation * jitter(x, y);
      if (distance <= limit) result[i] = 255;
    }
  }
  return result;
}

export function createOutlineBitmap(
  image: HTMLImageElement,
  displayWidth: number,
  displayHeight: number,
  width: number,
  color: string,
  style: Exclude<OutlineStyle, "none">,
): OutlineBitmap | null {
  if (displayWidth <= 0 || displayHeight <= 0 || width <= 0) return null;

  // Limit CPU/memory use for large source photos; no image ever leaves the browser.
  const resolution = Math.min(1, 960 / Math.max(displayWidth, displayHeight));
  const pixelWidth = Math.max(1, Math.round(displayWidth * resolution));
  const pixelHeight = Math.max(1, Math.round(displayHeight * resolution));
  const radius = Math.max(1, Math.round(width * resolution));
  const paddingPixels = Math.ceil(radius + Math.min(radius * 0.42, 4) + 3);
  const rasterWidth = pixelWidth + paddingPixels * 2;
  const rasterHeight = pixelHeight + paddingPixels * 2;

  const source = document.createElement("canvas");
  source.width = rasterWidth;
  source.height = rasterHeight;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) return null;
  sourceContext.drawImage(image, paddingPixels, paddingPixels, pixelWidth, pixelHeight);
  const sourcePixels = sourceContext.getImageData(0, 0, rasterWidth, rasterHeight);
  const mask = new Uint8Array(rasterWidth * rasterHeight);
  let hasOpaquePixels = false;
  for (let i = 0; i < mask.length; i += 1) {
    if (sourcePixels.data[i * 4 + 3] > 32) {
      mask[i] = 1;
      hasOpaquePixels = true;
    }
  }
  if (!hasOpaquePixels) return null;

  const alpha = outlineAlpha(mask, rasterWidth, rasterHeight, radius, style);
  const [red, green, blue] = colorChannels(color);
  const canvas = document.createElement("canvas");
  canvas.width = rasterWidth;
  canvas.height = rasterHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const pixels = context.createImageData(rasterWidth, rasterHeight);
  for (let i = 0; i < alpha.length; i += 1) {
    if (alpha[i] === 0) continue;
    const offset = i * 4;
    pixels.data[offset] = red;
    pixels.data[offset + 1] = green;
    pixels.data[offset + 2] = blue;
    pixels.data[offset + 3] = alpha[i];
  }
  context.putImageData(pixels, 0, 0);

  return { canvas, padding: paddingPixels / resolution };
}
