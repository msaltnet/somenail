import { MAX_IMAGE_BYTES } from "./model";

const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type ImageAsset = {
  id: string;
  image: HTMLImageElement;
  url: string;
};

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
    return { id: crypto.randomUUID(), image, url };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("이미지를 열 수 없습니다. 다른 파일을 선택해 주세요.");
  }
}

export function releaseImage(asset: ImageAsset): void {
  URL.revokeObjectURL(asset.url);
}
