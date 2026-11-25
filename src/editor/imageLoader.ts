import { MAX_IMAGE_BYTES } from "./model";

const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type ImageAsset = {
  id: string;
  image: HTMLImageElement;
  url: string;
  /** False for opaque photos: their border follows the image rectangle, not a silhouette. */
  hasTransparency: boolean;
};

/** True when any pixel in RGBA data is not fully opaque. */
export function hasTransparentPixel(rgba: Uint8ClampedArray): boolean {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 255) return true;
  return false;
}

/** Samples the image at up to 256px; JPEG never has alpha. */
function detectTransparency(image: HTMLImageElement, type: string): boolean {
  if (type === "image/jpeg") return false;
  const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  // If pixels cannot be read, assume a silhouette so no misleading hint is shown.
  if (!context) return true;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return hasTransparentPixel(context.getImageData(0, 0, canvas.width, canvas.height).data);
}

export async function loadImageFile(file: File): Promise<ImageAsset> {
  if (!SUPPORTED_TYPES.has(file.type)) {
    throw new Error("PNG, JPG, WebP 이미지만 업로드할 수 있습니다.");
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("이미지 파일 크기는 20MB 이하여야 합니다.");
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("이미지 크기를 확인할 수 없습니다.");
    }
    return { id: crypto.randomUUID(), image, url, hasTransparency: detectTransparency(image, file.type) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("이미지를 열 수 없습니다. 다른 파일을 선택해 주세요.");
  }
}

export function releaseImage(asset: ImageAsset): void {
  URL.revokeObjectURL(asset.url);
}
