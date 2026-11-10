export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export type Align = "left" | "center" | "right";

export type ImageElement = {
  id: string;
  type: "image";
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TextElement = {
  id: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  bold: boolean;
  color: string;
  align: Align;
  fontFamily: string;
};

export type EditorElement = ImageElement | TextElement;

export type ThumbnailDocument = {
  backgroundColor: string;
  elements: EditorElement[];
};

export const initialDocument: ThumbnailDocument = {
  backgroundColor: "#111827",
  elements: [],
};

export function placeImage(
  imageWidth: number,
  imageHeight: number,
): Pick<ImageElement, "x" | "y" | "width" | "height"> {
  if (!(imageWidth > 0 && imageHeight > 0)) {
    throw new Error("이미지 크기를 확인할 수 없습니다.");
  }
  const ratio = Math.min(1, 640 / imageWidth, 570 / imageHeight);
  const width = Math.round(imageWidth * ratio);
  const height = Math.round(imageHeight * ratio);
  return {
    x: Math.round((CANVAS_WIDTH - width) / 2),
    y: Math.round((CANVAS_HEIGHT - height) / 2),
    width,
    height,
  };
}

export function moveLayer(
  elements: EditorElement[],
  id: string,
  direction: -1 | 1,
): EditorElement[] {
  const index = elements.findIndex((item) => item.id === id);
  const other = index + direction;
  if (index < 0 || other < 0 || other >= elements.length) return elements;
  const next = [...elements];
  [next[index], next[other]] = [next[other], next[index]];
  return next;
}
