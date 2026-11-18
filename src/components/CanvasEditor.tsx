import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import {
  Group, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer,
} from "react-konva";
import type Konva from "konva";
import {
  CANVAS_HEIGHT, CANVAS_WIDTH, normalizeRotation,
  type EditorElement, type ImageElement, type ThumbnailDocument,
} from "../editor/model";
import { createOutlineBitmap } from "../editor/outline";
import type { ImageAsset } from "../editor/imageLoader";

type Props = {
  documentValue: ThumbnailDocument;
  assets: Map<string, ImageAsset>;
  selectedId: string | null;
  scale: number;
  stageRef: RefObject<Konva.Stage | null>;
  selectionLayerRef: RefObject<Konva.Layer | null>;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<EditorElement>) => void;
};

type ImageNodeProps = {
  element: ImageElement;
  asset: ImageAsset;
  bindNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<ImageElement>) => void;
};

function ImageNode({ element, asset, bindNode, onSelect, onChange }: ImageNodeProps) {
  // Cached by asset/size/style so dragging and rotating never re-rasterize the outline.
  const outline = useMemo(() => {
    if (element.outlineStyle === "none") return null;
    return createOutlineBitmap(
      asset.image,
      element.width,
      element.height,
      element.outlineWidth,
      element.outlineColor,
      element.outlineStyle,
    );
  }, [
    asset.image, element.width, element.height, element.outlineStyle,
    element.outlineWidth, element.outlineColor,
  ]);

  const onTransformEnd = (event: Konva.KonvaEventObject<Event>) => {
    const node = event.target as Konva.Group;
    const width = Math.max(20, element.width * Math.abs(node.scaleX()));
    const height = Math.max(20, element.height * Math.abs(node.scaleY()));
    const rotation = normalizeRotation(node.rotation());
    node.scale({ x: 1, y: 1 });
    onChange(element.id, {
      x: node.x() - width / 2, y: node.y() - height / 2,
      width, height, rotation,
    });
  };

  return (
    <Group
      ref={(node) => bindNode(element.id, node)}
      x={element.x + element.width / 2}
      y={element.y + element.height / 2}
      offsetX={element.width / 2}
      offsetY={element.height / 2}
      rotation={element.rotation}
      draggable
      onClick={() => onSelect(element.id)}
      onTap={() => onSelect(element.id)}
      onDragEnd={(event) => {
        onChange(element.id, {
          x: event.target.x() - element.width / 2,
          y: event.target.y() - element.height / 2,
        });
      }}
      onTransformEnd={onTransformEnd}
    >
      {outline && (
        <KonvaImage
          listening={false}
          image={outline.canvas}
          x={-outline.padding}
          y={-outline.padding}
          width={element.width + outline.padding * 2}
          height={element.height + outline.padding * 2}
        />
      )}
      <KonvaImage
        image={asset.image}
        x={0}
        y={0}
        width={element.width}
        height={element.height}
      />
    </Group>
  );
}

export default function CanvasEditor({
  documentValue,
  assets,
  selectedId,
  scale,
  stageRef,
  selectionLayerRef,
  onSelect,
  onChange,
}: Props) {
  const nodes = useRef(new Map<string, Konva.Node>());
  const transformerRef = useRef<Konva.Transformer>(null);
  const selected = documentValue.elements.find((element) => element.id === selectedId);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const node = selectedId ? nodes.current.get(selectedId) : undefined;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, documentValue.elements, assets]);

  const bindNode = (id: string, node: Konva.Node | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  };

  const updateTextWidth = (id: string, node: Konva.Node) => {
    const width = Math.max(80, node.width() * Math.abs(node.scaleX()));
    node.scale({ x: 1, y: 1 });
    onChange(id, { x: node.x(), y: node.y(), width });
  };

  return (
    <div
      className="canvas-frame"
      style={{ width: CANVAS_WIDTH * scale, height: CANVAS_HEIGHT * scale }}
      aria-label="썸네일 편집 캔버스"
    >
      <div className="canvas-scaled" style={{ transform: "scale(" + scale + ")" }}>
        <Stage
          ref={stageRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseDown={(event) => {
            if (event.target === event.target.getStage() || event.target.name() === "background") {
              onSelect(null);
            }
          }}
          onTouchStart={(event) => {
            if (event.target === event.target.getStage() || event.target.name() === "background") {
              onSelect(null);
            }
          }}
        >
          <Layer>
            <Rect
              name="background"
              x={0}
              y={0}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              fill={documentValue.backgroundColor}
            />
            {documentValue.elements.map((element) => {
              if (element.type === "image") {
                const asset = assets.get(element.assetId);
                if (!asset) return null;
                return (
                  <ImageNode
                    key={element.id}
                    element={element}
                    asset={asset}
                    bindNode={bindNode}
                    onSelect={(id) => onSelect(id)}
                    onChange={(id, patch) => onChange(id, patch)}
                  />
                );
              }
              return (
                <Text
                  key={element.id}
                  ref={(node) => bindNode(element.id, node)}
                  x={element.x}
                  y={element.y}
                  width={element.width}
                  text={element.text}
                  fontSize={element.fontSize}
                  fontFamily={element.fontFamily}
                  fontStyle={element.bold ? "bold" : "normal"}
                  fill={element.color}
                  align={element.align}
                  wrap="word"
                  lineHeight={1.16}
                  draggable
                  onClick={() => onSelect(element.id)}
                  onTap={() => onSelect(element.id)}
                  onDragEnd={(event) => {
                    onChange(element.id, {
                      x: event.target.x(),
                      y: event.target.y(),
                    });
                  }}
                  onTransformEnd={(event) => updateTextWidth(element.id, event.target)}
                />
              );
            })}
          </Layer>
          <Layer ref={selectionLayerRef}>
            <Transformer
              ref={transformerRef}
              rotateEnabled={selected?.type === "image"}
              flipEnabled={false}
              keepRatio={selected?.type === "image"}
              enabledAnchors={
                selected?.type === "text"
                  ? ["middle-left", "middle-right"]
                  : ["top-left", "top-right", "bottom-left", "bottom-right"]
              }
              borderStroke="#e99c81"
              anchorFill="#ffffff"
              anchorStroke="#e99c81"
              anchorSize={12}
              anchorCornerRadius={4}
              boundBoxFunc={(oldBox, newBox) => {
                if (Math.abs(newBox.width) < 30 || Math.abs(newBox.height) < 18) {
                  return oldBox;
                }
                return newBox;
              }}
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
