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
  type TextElement,
  type ThumbnailDocument,
} from "./editor/model";
import { BACKGROUND_PRESETS, TEXT_PRESETS } from "./editor/palette";
import { loadImageFile, releaseImage, type ImageAsset } from "./editor/imageLoader";
import { Button, IconButton } from "./ui/Button";
import { ColorField } from "./ui/ColorField";
import { Field, SegmentedControl } from "./ui/Field";
import { Icon } from "./ui/Icon";

const FONTS = [
  { label: "기본 고딕", value: "Arial, Apple SD Gothic Neo, Malgun Gothic, sans-serif" },
  { label: "명조", value: "Georgia, Batang, serif" },
  { label: "모노", value: "Consolas, monospace" },
];

const ALIGN_OPTIONS = [
  ["left", "왼쪽"],
  ["center", "가운데"],
  ["right", "오른쪽"],
] as const;

const OUTLINE_OPTIONS = [
  ["none", "없음"],
  ["clean", "깔끔하게"],
  ["rough", "손그림 컷아웃"],
] as const;

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
  const [isDragging, setIsDragging] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const selectionLayerRef = useRef<Konva.Layer>(null);
  const assetStoreRef = useRef(new Map<string, ImageAsset>());

  const selected = documentValue.elements.find((element) => element.id === selectedId) ?? null;
  const hasElements = documentValue.elements.length > 0;

  useEffect(() => {
    const host = workspaceRef.current;
    if (!host) return;
    const resize = () => {
      const available = Math.max(150, host.clientWidth - 80);
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
      fontFamily: FONTS[0].value,
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
    try {
      const stage = stageRef.current;
      if (!stage) throw new Error("편집 캔버스를 찾지 못했어요. 페이지를 새로고침해 주세요.");
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
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      selectionLayerRef.current?.show();
      stageRef.current?.draw();
      setBusy(false);
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
                <div className="panel__actions">
                  <IconButton icon="close" label="선택 해제 (Esc)" onClick={() => setSelectedId(null)} />
                </div>
              </div>

              {selected.type === "text" ? (
                <div className="panel__body">
                  <Field label="내용" htmlFor="text-content">
                    <textarea
                      id="text-content"
                      className="input"
                      rows={3}
                      value={selected.text}
                      onChange={(event) => updateElement(selected.id, { text: event.target.value })}
                    />
                  </Field>
                  <div className="field-row">
                    <Field label="크기" htmlFor="font-size">
                      <div className="input-addon">
                        <input
                          id="font-size"
                          className="input input--number"
                          type="number"
                          min={12}
                          max={300}
                          value={selected.fontSize}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (Number.isFinite(value) && value >= 12 && value <= 300) {
                              updateElement(selected.id, { fontSize: value });
                            }
                          }}
                        />
                        <span className="input-addon__suffix" aria-hidden="true">px</span>
                      </div>
                    </Field>
                    <Field label="글꼴" htmlFor="font-family">
                      <select
                        id="font-family"
                        className="input"
                        value={selected.fontFamily}
                        onChange={(event) => updateElement(selected.id, { fontFamily: event.target.value })}
                      >
                        {FONTS.map((font) => <option value={font.value} key={font.label}>{font.label}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="align-row">
                    <SegmentedControl
                      legend="정렬"
                      name="text-align"
                      value={selected.align}
                      options={ALIGN_OPTIONS}
                      onChange={(align) => updateElement(selected.id, { align })}
                    />
                    <Button
                      className="bold-toggle"
                      pressed={selected.bold}
                      aria-label="굵게"
                      title="굵게"
                      onClick={() => updateElement(selected.id, { bold: !selected.bold })}
                    >
                      <span aria-hidden="true" className="bold-toggle__glyph">B</span>
                    </Button>
                  </div>
                  <ColorField
                    id="text-color"
                    label="글자색"
                    subject="글자색"
                    value={selected.color}
                    presets={TEXT_PRESETS}
                    onChange={(color) => updateElement(selected.id, { color })}
                  />
                </div>
              ) : (
                <div className="panel__body">
                  <Field label="회전" htmlFor="image-rotation" hint="캔버스의 회전 핸들을 끌어도 됩니다.">
                    <div className="rotation-controls">
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={1}
                        aria-label="회전 각도 슬라이더"
                        value={selected.rotation}
                        onChange={(event) => updateElement(selected.id, { rotation: Number(event.target.value) })}
                      />
                      <div className="input-addon rotation-number">
                        <input
                          id="image-rotation"
                          className="input input--number"
                          type="number"
                          min={-180}
                          max={180}
                          step={1}
                          value={selected.rotation}
                          aria-describedby="image-rotation-hint"
                          onChange={(event) => {
                            const angle = Number(event.target.value);
                            if (Number.isFinite(angle)) {
                              updateElement(selected.id, { rotation: normalizeRotation(angle) });
                            }
                          }}
                        />
                        <span className="input-addon__suffix" aria-hidden="true">°</span>
                      </div>
                      <IconButton
                        icon="reset"
                        label="회전 초기화"
                        disabled={selected.rotation === 0}
                        onClick={() => updateElement(selected.id, { rotation: 0 })}
                      />
                    </div>
                  </Field>
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
                      <Field label="두께" htmlFor="outline-width" value={`${selected.outlineWidth}px`}>
                        <input
                          id="outline-width"
                          type="range"
                          min={3}
                          max={30}
                          step={1}
                          value={selected.outlineWidth}
                          onChange={(event) => updateElement(selected.id, { outlineWidth: Number(event.target.value) })}
                        />
                      </Field>
                      <ColorField
                        id="outline-color"
                        label="테두리 색"
                        subject="테두리 색"
                        value={selected.outlineColor}
                        onChange={(outlineColor) => updateElement(selected.id, { outlineColor })}
                      />
                      <p className="field__hint">
                        투명 배경 PNG·WebP는 피사체 윤곽을 따라 그려집니다. JPG는 사진 사각형을 따라 그려집니다.
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="layer-actions" role="group" aria-label="레이어">
                <Button size="sm" icon="backward" onClick={() => shiftSelected(-1)}>뒤로 보내기</Button>
                <Button size="sm" icon="forward" onClick={() => shiftSelected(1)}>앞으로 가져오기</Button>
                <IconButton icon="trash" variant="danger" label="삭제 (Delete)" onClick={removeSelected} />
              </div>
            </section>
          )}

          <section className="panel panel--background" aria-labelledby="panel-bg-title">
            <div className="panel__header">
              <h2 className="panel__title" id="panel-bg-title">배경</h2>
            </div>
            <ColorField
              id="background-color"
              label="배경색"
              subject="배경색"
              value={documentValue.backgroundColor}
              presets={BACKGROUND_PRESETS}
              onChange={changeBackground}
            />
          </section>

          <p className="sidebar-note">
            <Icon name="lock" />
            <span>이미지는 이 브라우저 안에서만 처리돼요. 새로고침하면 작업이 사라집니다.</span>
          </p>
        </aside>

        <main
          className={"workspace" + (isDragging ? " is-dragging" : "")}
          ref={workspaceRef}
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
          <div className="workspace-bar">
            <span className="tabular">{CANVAS_WIDTH} × {CANVAS_HEIGHT} px</span>
            <span className="tabular">보기 {Math.round(scale * 100)}%</span>
          </div>

          <div className="workspace-content">
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
            <p className="canvas-hint">
              {hasElements
                ? <><kbd>Delete</kbd> 삭제 · <kbd>Esc</kbd> 선택 해제</>
                : "이미지나 텍스트를 추가해 시작하세요."}
            </p>
            {isDragging && <div className="drop-indicator">놓으면 이미지를 추가합니다</div>}
          </div>
        </main>
      </div>

      {notice && (
        <div className="notice notice--error notice--toast" role="alert">
          <p className="notice__body">{notice}</p>
          <IconButton icon="close" label="알림 닫기" onClick={() => setNotice(null)} />
        </div>
      )}
    </div>
  );
}
