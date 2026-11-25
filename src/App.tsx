import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import type Konva from "konva";
import CanvasEditor from "./components/CanvasEditor";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  initialDocument,
  moveLayer,
  placeImage,
  normalizeRotation,
  type EditorElement,
  type ImageElement,
  type TextElement,
  type ThumbnailDocument,
} from "./editor/model";
import { BACKGROUND_PRESETS, TEXT_PRESETS } from "./editor/palette";
import { loadImageFile, releaseImage, type ImageAsset } from "./editor/imageLoader";
import { Button, IconButton } from "./ui/Button";
import { ColorField } from "./ui/ColorField";
import { Field, SegmentedControl, type SegmentedOption } from "./ui/Field";
import { Select, type SelectOption } from "./ui/Select";
import { DEFAULT_FONT, FONTS, FONT_CATEGORY_LABELS, drawsBold, ensureFontLoaded, findFont, previewFontFamily } from "./editor/fonts";
import { NumberField } from "./ui/NumberField";
import { Icon } from "./ui/Icon";

const FONT_OPTIONS: ReadonlyArray<SelectOption<string>> = FONTS.map((font) => ({
  value: font.value,
  label: font.label,
  group: FONT_CATEGORY_LABELS[font.category],
  labelStyle: {
    fontFamily: previewFontFamily(font.value),
    ["--preview-scale" as string]: font.previewScale ?? 1,
  },
}));

const ALIGN_OPTIONS: ReadonlyArray<SegmentedOption<TextElement["align"]>> = [
  { value: "left", label: "왼쪽 정렬", icon: "align-left" },
  { value: "center", label: "가운데 정렬", icon: "align-center" },
  { value: "right", label: "오른쪽 정렬", icon: "align-right" },
];

const OUTLINE_OPTIONS: ReadonlyArray<SegmentedOption<ImageElement["outlineStyle"]>> = [
  { value: "none", label: "테두리 없음", icon: "outline-none" },
  { value: "clean", label: "깔끔한 테두리", icon: "outline-clean" },
  { value: "rough", label: "종이 컷아웃 테두리", icon: "outline-cutout" },
];

const isTypingTarget = (target: EventTarget | null) => {
  return target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "요청을 처리하지 못했어요. 다시 시도해 주세요.";
}

export default function App() {
  const [documentValue, setDocumentValue] = useState<ThumbnailDocument>(initialDocument);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(0.65);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const selectionLayerRef = useRef<Konva.Layer>(null);
  const assetStoreRef = useRef(new Map<string, ImageAsset>());

  const selectedIndex = documentValue.elements.findIndex((element) => element.id === selectedId);
  const selected = selectedIndex >= 0 ? documentValue.elements[selectedIndex] : null;
  const isBottom = selectedIndex === 0;
  const isTop = selectedIndex === documentValue.elements.length - 1;
  const hasElements = documentValue.elements.length > 0;

  useEffect(() => {
    const host = canvasAreaRef.current;
    if (!host) return;
    const resize = () => {
      // Fit the paper inside the canvas area's content box (its padding comes from tokens).
      const style = getComputedStyle(host);
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const available = Math.max(150, host.clientWidth - padding);
      setScale(Math.min(1, available / CANVAS_WIDTH));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const assets = assetStoreRef.current;
    return () => {
      for (const asset of assets.values()) releaseImage(asset);
      assets.clear();
    };
  }, []);

  const updateElement = useCallback((id: string, patch: Partial<EditorElement>) => {
    setDocumentValue((previous) => ({
      ...previous,
      elements: previous.elements.map((element) =>
        element.id === id ? ({ ...element, ...patch } as EditorElement) : element,
      ),
    }));
  }, []);

  const changeBackground = (color: string) => {
    setDocumentValue((previous) => ({ ...previous, backgroundColor: color.toUpperCase() }));
  };

  const addText = () => {
    const element: TextElement = {
      id: crypto.randomUUID(),
      type: "text",
      text: "제목을 입력하세요",
      x: 90,
      y: 122,
      width: 830,
      fontSize: 88,
      bold: true,
      color: documentValue.backgroundColor === "#FFFFFF" ? "#111827" : "#FFFFFF",
      align: "left",
      fontFamily: DEFAULT_FONT.value,
    };
    setDocumentValue((previous) => ({ ...previous, elements: [...previous.elements, element] }));
    setSelectedId(element.id);
    setNotice(null);
  };

  const addFiles = async (files: File[]) => {
    for (const file of files) {
      try {
        const asset = await loadImageFile(file);
        const element: EditorElement = {
          id: crypto.randomUUID(),
          type: "image",
          assetId: asset.id,
          ...placeImage(asset.image.naturalWidth, asset.image.naturalHeight),
          rotation: 0,
          outlineStyle: "none",
          outlineWidth: 12,
          outlineColor: "#FFFFFF",
        };
        assetStoreRef.current.set(asset.id, asset);
        setDocumentValue((previous) => ({ ...previous, elements: [...previous.elements, element] }));
        setSelectedId(element.id);
        setNotice(null);
      } catch (error) {
        setNotice(getErrorMessage(error));
      }
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    void addFiles(files);
  };

  const onImageDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length) void addFiles(files);
  };

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    const element = documentValue.elements.find((item) => item.id === selectedId);
    if (element?.type === "image") {
      const asset = assetStoreRef.current.get(element.assetId);
      if (asset) {
        releaseImage(asset);
        assetStoreRef.current.delete(element.assetId);
      }
    }
    setDocumentValue((previous) => ({
      ...previous,
      elements: previous.elements.filter((item) => item.id !== selectedId),
    }));
    setSelectedId(null);
  }, [documentValue.elements, selectedId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        removeSelected();
      }
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [removeSelected, selectedId]);

  const shiftSelected = (direction: -1 | 1) => {
    if (!selectedId) return;
    setDocumentValue((previous) => ({
      ...previous,
      elements: moveLayer(previous.elements, selectedId, direction),
    }));
  };

  const exportPng = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    setStatus("PNG 만드는 중…");
    let saved = false;
    try {
      const stage = stageRef.current;
      if (!stage) throw new Error("편집 캔버스를 찾지 못했어요. 페이지를 새로고침해 주세요.");
      await Promise.all(
        documentValue.elements.map((element) =>
          element.type === "text"
            ? ensureFontLoaded(element.fontFamily, drawsBold(element.fontFamily, element.bold), element.text)
            : null,
        ),
      );
      await document.fonts.ready;
      // Selection handles live on their own layer, outside exported content.
      selectionLayerRef.current?.hide();
      stage.draw();
      const blob = await stage.toBlob({ mimeType: "image/png", pixelRatio: 1 });
      if (!blob || blob.type !== "image/png") {
        throw new Error("PNG를 만들지 못했어요. 다시 시도해 주세요.");
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "somenail-thumbnail.png";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      saved = true;
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      selectionLayerRef.current?.show();
      stageRef.current?.draw();
      setBusy(false);
      setStatus(saved ? "PNG 다운로드를 시작했어요." : "");
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">s</span>
          <span className="brand-name">somenail<span className="brand-dot">.</span></span>
        </div>
        <Button
          variant="primary"
          icon="download"
          onClick={() => void exportPng()}
          busy={busy}
          busyLabel="PNG 만드는 중…"
        >
          PNG 다운로드
        </Button>
      </header>

      <div className="studio">
        <aside className="sidebar" aria-label="편집 도구">
          <section className="panel panel--background" aria-labelledby="panel-bg-title">
            <div className="panel__header">
              <h2 className="panel__title" id="panel-bg-title">배경</h2>
            </div>
            <ColorField
              id="background-color"
              label="배경색"
              subject="배경색"
              hideLabel
              value={documentValue.backgroundColor}
              presets={BACKGROUND_PRESETS}
              onChange={changeBackground}
            />
          </section>

          <section className="panel panel--add" aria-labelledby="panel-add-title">
            <div className="panel__header">
              <h2 className="panel__title" id="panel-add-title">추가</h2>
            </div>
            <input
              ref={imageInputRef}
              className="visually-hidden"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              multiple
              onChange={onFileChange}
              aria-label="이미지 파일 선택"
              tabIndex={-1}
            />
            <div className="add-actions">
              <Button size="lg" icon="image" onClick={() => imageInputRef.current?.click()} aria-describedby="add-hint">
                이미지
              </Button>
              <Button size="lg" icon="text" onClick={addText}>
                텍스트
              </Button>
            </div>
            <p className="field__hint" id="add-hint">PNG·JPG·WebP, 20MB까지. 캔버스에 끌어다 놓아도 됩니다.</p>
          </section>

          {selected && (
            <section className="panel panel--selected" aria-labelledby="panel-selected-title">
              <div className="panel__header">
                <Icon name={selected.type === "text" ? "text" : "image"} size="md" />
                <h2 className="panel__title" id="panel-selected-title">
                  {selected.type === "text" ? "텍스트" : "이미지"}
                </h2>
                <div className="panel__actions" role="toolbar" aria-label="레이어">
                  <IconButton icon="layer-backward" label="뒤로 보내기" iconSize="md" disabled={isBottom} onClick={() => shiftSelected(-1)} />
                  <IconButton icon="layer-forward" label="앞으로 가져오기" iconSize="md" disabled={isTop} onClick={() => shiftSelected(1)} />
                  <IconButton icon="trash" variant="danger" label="삭제 (Delete)" onClick={removeSelected} />
                  <span className="panel__actions-divider" aria-hidden="true" />
                  <IconButton icon="close" label="선택 해제 (Esc)" onClick={() => setSelectedId(null)} />
                </div>
              </div>

              {selected.type === "text" ? (
                <div className="panel__body">
                  <Field label="텍스트 내용" htmlFor="text-content" hideLabel>
                    <textarea
                      id="text-content"
                      className="input"
                      rows={3}
                      value={selected.text}
                      onChange={(event) => updateElement(selected.id, { text: event.target.value })}
                    />
                  </Field>
                  <div className="control-row">
                    <Select
                      id="font-family"
                      label="글꼴"
                      className="control-row__grow"
                      value={selected.fontFamily}
                      options={FONT_OPTIONS}
                      onChange={(fontFamily) => updateElement(selected.id, { fontFamily })}
                    />
                    <Button
                      className="btn--square"
                      pressed={drawsBold(selected.fontFamily, selected.bold)}
                      disabled={findFont(selected.fontFamily)?.hasBold === false}
                      aria-label="굵게"
                      title={findFont(selected.fontFamily)?.hasBold === false ? "이 글꼴은 굵기가 하나예요" : "굵게"}
                      onClick={() => updateElement(selected.id, { bold: !selected.bold })}
                    >
                      <Icon name="bold" size="md" />
                    </Button>
                  </div>
                  <div className="control-row">
                    <NumberField
                      id="font-size"
                      label="글자 크기"
                      value={selected.fontSize}
                      min={12}
                      max={300}
                      step={4}
                      unit="px"
                      stepper
                      onChange={(fontSize) => updateElement(selected.id, { fontSize })}
                    />
                    <SegmentedControl
                      legend="정렬"
                      hideLegend
                      name="text-align"
                      value={selected.align}
                      options={ALIGN_OPTIONS}
                      onChange={(align) => updateElement(selected.id, { align })}
                    />
                  </div>
                  <ColorField
                    id="text-color"
                    label="글자색"
                    subject="글자색"
                    hideLabel
                    value={selected.color}
                    presets={TEXT_PRESETS}
                    onChange={(color) => updateElement(selected.id, { color })}
                  />
                </div>
              ) : (
                <div className="panel__body">
                  <div className="slider-row">
                    <span className="slider-row__icon" title="회전"><Icon name="angle" size="md" /></span>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      aria-label="회전 각도"
                      value={selected.rotation}
                      onChange={(event) => updateElement(selected.id, { rotation: Number(event.target.value) })}
                    />
                    <NumberField
                      id="image-rotation"
                      label="회전 각도"
                      value={selected.rotation}
                      min={-180}
                      max={180}
                      unit="°"
                      onChange={(rotation) => updateElement(selected.id, { rotation: normalizeRotation(rotation) })}
                    />
                    <IconButton
                      icon="reset"
                      label="회전 초기화"
                      disabled={selected.rotation === 0}
                      onClick={() => updateElement(selected.id, { rotation: 0 })}
                    />
                  </div>
                  <hr className="panel__divider" />
                  <SegmentedControl
                    legend="테두리"
                    name="outline-style"
                    value={selected.outlineStyle}
                    options={OUTLINE_OPTIONS}
                    onChange={(outlineStyle) => updateElement(selected.id, { outlineStyle })}
                  />
                  {selected.outlineStyle !== "none" && (
                    <>
                      <div className="slider-row">
                        <span className="slider-row__icon" title="두께"><Icon name="stroke-width" size="md" /></span>
                        <input
                          id="outline-width"
                          type="range"
                          min={3}
                          max={30}
                          step={1}
                          aria-label="테두리 두께"
                          aria-valuetext={`${selected.outlineWidth}px`}
                          value={selected.outlineWidth}
                          onChange={(event) => updateElement(selected.id, { outlineWidth: Number(event.target.value) })}
                        />
                        <output className="slider-row__value" htmlFor="outline-width">{selected.outlineWidth}px</output>
                      </div>
                      <ColorField
                        id="outline-color"
                        label="테두리 색"
                        subject="테두리 색"
                        hideLabel
                        value={selected.outlineColor}
                        onChange={(outlineColor) => updateElement(selected.id, { outlineColor })}
                      />
                      {assetStoreRef.current.get(selected.assetId)?.hasTransparency === false && (
                        <p className="field__hint">
                          배경이 있는 사진은 사각형을 따라 그려져요. 피사체만 두르려면 투명 배경 PNG·WebP를 쓰세요.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          <p className="sidebar-note">
            <Icon name="lock" />
            <span>이미지는 이 브라우저 안에서만 처리돼요. 새로고침하면 작업이 사라집니다.</span>
          </p>
        </aside>

        <main
          className={"workspace" + (isDragging ? " is-dragging" : "")}
          aria-label="캔버스"
          onDragOver={(event) => {
            event.preventDefault();
            if (event.dataTransfer.types.includes("Files")) setIsDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
          }}
          onDrop={onImageDrop}
        >
          <div className="workspace-content" ref={canvasAreaRef}>
            <div className="canvas-column" style={{ width: Math.round(CANVAS_WIDTH * scale) }}>
              <div className="workspace-bar">
                <span className="tabular">{CANVAS_WIDTH} × {CANVAS_HEIGHT} px</span>
                <span className="tabular">보기 {Math.round(scale * 100)}%</span>
              </div>
              <div className="canvas-paper">
                <CanvasEditor
                  documentValue={documentValue}
                  assets={assetStoreRef.current}
                  selectedId={selectedId}
                  scale={scale}
                  stageRef={stageRef}
                  selectionLayerRef={selectionLayerRef}
                  onSelect={setSelectedId}
                  onChange={updateElement}
                />
              </div>
              {hasElements ? (
                <p className="canvas-hint canvas-hint--keys"><kbd>Delete</kbd> 삭제 · <kbd>Esc</kbd> 선택 해제</p>
              ) : (
                <p className="canvas-hint">이미지나 텍스트를 추가해 시작하세요.</p>
              )}
            </div>
            {isDragging && <div className="drop-indicator">놓으면 이미지를 추가합니다</div>}
          </div>
        </main>
      </div>

      <p className="visually-hidden" role="status">{status}</p>

      {notice && (
        <div className="notice notice--error notice--toast" role="alert">
          <p className="notice__body">{notice}</p>
          <IconButton icon="close" label="알림 닫기" onClick={() => setNotice(null)} />
        </div>
      )}
    </div>
  );
}
