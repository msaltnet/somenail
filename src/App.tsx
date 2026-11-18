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
import { isHexColor, normalizeHexColor } from "./editor/color";
import { BACKGROUND_PRESETS, TEXT_PRESETS } from "./editor/palette";
import { loadImageFile, releaseImage, type ImageAsset } from "./editor/imageLoader";

const FONTS = [
  { label: "기본 고딕", value: "Arial, Apple SD Gothic Neo, Malgun Gothic, sans-serif" },
  { label: "명조", value: "Georgia, Batang, serif" },
  { label: "모노", value: "Consolas, monospace" },
];

const isTypingTarget = (target: EventTarget | null) => {
  return target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

export default function App() {
  const [documentValue, setDocumentValue] = useState<ThumbnailDocument>(initialDocument);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [colorDraft, setColorDraft] = useState(initialDocument.backgroundColor);
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
      const available = Math.max(150, host.clientWidth - 88);
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
    setColorDraft(color);
    if (isHexColor(color)) {
      setDocumentValue((previous) => ({ ...previous, backgroundColor: color.toUpperCase() }));
    }
  };

  const commitBackground = () => {
    const color = normalizeHexColor(colorDraft);
    if (!color) {
      setColorDraft(documentValue.backgroundColor);
      setNotice("HEX 색상은 #RRGGBB 형태로 입력해 주세요.");
      return;
    }
    setColorDraft(color);
    setDocumentValue((previous) => ({ ...previous, backgroundColor: color }));
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
      if (!stage) throw new Error("편집 캔버스를 찾을 수 없습니다.");
      await document.fonts.ready;
      // Selection handles live on their own layer, outside exported content.
      selectionLayerRef.current?.hide();
      stage.draw();
      const blob = await stage.toBlob({ mimeType: "image/png", pixelRatio: 1 });
      if (!blob || blob.type !== "image/png") {
        throw new Error("PNG 파일을 만들지 못했습니다.");
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
      setNotice("다운로드 실패: " + getErrorMessage(error));
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
          <span className="brand-symbol" aria-hidden="true">s.</span>
          <span className="brand-title">somenail<span className="brand-dot">.</span></span>
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-subtitle">썸네일 스튜디오</span>
        </div>
        <div className="top-actions">
          <span className="top-status"><span className="status-dot" /> 브라우저에서만 편집</span>
          <button className="export-button" onClick={() => void exportPng()} disabled={busy} type="button">
            <span aria-hidden="true">↓</span> {busy ? "이미지 생성 중..." : "PNG 다운로드"}
          </button>
        </div>
      </header>

      <div className="studio">
        <aside className="sidebar" aria-label="썸네일 편집 도구">
          <div className="sidebar-heading">
            <span className="eyebrow">CREATE SOMETHING</span>
            <h1>당신의 썸네일,<br /><em>아주 간단하게.</em></h1>
            <p>세 가지만 고르면 준비 끝. 디자인은 복잡할 필요 없으니까요.</p>
          </div>

          <section className="editor-section">
            <div className="section-title"><span className="section-number">01</span><h2>배경색</h2></div>
            <div className="color-field">
              <label className="color-sample" htmlFor="background-color" title="배경색 고르기">
                <input
                  id="background-color"
                  type="color"
                  aria-label="배경 색상 선택"
                  value={documentValue.backgroundColor}
                  onChange={(event) => changeBackground(event.target.value)}
                />
              </label>
              <div className="text-field-grow">
                <label htmlFor="background-hex">HEX 색상 코드</label>
                <input
                  id="background-hex"
                  className="hex-input"
                  type="text"
                  value={colorDraft}
                  onChange={(event) => changeBackground(event.target.value)}
                  onBlur={commitBackground}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                  maxLength={7}
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="swatch-row" aria-label="추천 배경색">
              {BACKGROUND_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={"swatch" + (documentValue.backgroundColor.toUpperCase() === preset.value ? " active" : "")}
                  style={{ backgroundColor: preset.value }}
                  title={preset.name + " · " + preset.value}
                  aria-label={"배경색 " + preset.name + " " + preset.value}
                  aria-pressed={documentValue.backgroundColor.toUpperCase() === preset.value}
                  onClick={() => changeBackground(preset.value)}
                />
              ))}
            </div>
          </section>

          <section className="editor-section">
            <div className="section-title"><span className="section-number">02</span><h2>오브젝트</h2></div>
            <input
              ref={imageInputRef}
              className="visually-hidden"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              multiple
              onChange={onFileChange}
              aria-label="이미지 파일 업로드"
            />
            <button type="button" className="upload-button" onClick={() => imageInputRef.current?.click()}>
              <span className="upload-icon" aria-hidden="true">＋</span>
              <span><strong>이미지 업로드</strong><small>PNG · JPG · WebP / 20MB 이하</small></span>
              <span className="upload-arrow" aria-hidden="true">↗</span>
            </button>
            <p className="helper">파일을 캔버스 위에 끌어다 놓아도 됩니다.</p>
          </section>

          <section className="editor-section">
            <div className="section-title"><span className="section-number">03</span><h2>텍스트</h2></div>
            <button type="button" className="add-text-button" onClick={addText}>
              <span className="text-icon" aria-hidden="true">T</span>
              <span>텍스트 추가하기</span>
              <span aria-hidden="true">＋</span>
            </button>
            <p className="helper">텍스트를 선택하면 아래에서 내용을 편집할 수 있어요.</p>
          </section>

          {selected && (
            <section className="editor-section selected-panel">
              <div className="section-title"><span className="section-number selected-indicator">✦</span><h2>선택한 오브젝트</h2></div>
              <div className="selected-tag">{selected.type === "text" ? "텍스트 레이어" : "이미지 레이어"}</div>
              {selected.type === "text" ? (
                <div className="property-fields">
                  <label className="form-label" htmlFor="text-content">텍스트 내용</label>
                  <textarea
                    id="text-content"
                    rows={3}
                    value={selected.text}
                    onChange={(event) => updateElement(selected.id, { text: event.target.value })}
                  />
                  <div className="property-grid">
                    <div>
                      <label className="form-label" htmlFor="font-size">글자 크기</label>
                      <input
                        id="font-size"
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
                    </div>
                    <div>
                      <label className="form-label" htmlFor="text-color">글자 색상</label>
                      <div className="text-color-control">
                        <input
                          id="text-color"
                          type="color"
                          value={selected.color}
                          onChange={(event) => updateElement(selected.id, { color: event.target.value })}
                        />
                        <span>{selected.color.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-presets">
                    <span className="form-label">추천 글자색</span>
                    <div className="swatch-row text-swatch-row" role="group" aria-label="추천 글자색">
                      {TEXT_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          className={"swatch" + (selected.color.toUpperCase() === preset.value ? " active" : "")}
                          style={{ backgroundColor: preset.value }}
                          title={preset.name + " · " + preset.value}
                          aria-label={"글자색 " + preset.name + " " + preset.value}
                          aria-pressed={selected.color.toUpperCase() === preset.value}
                          onClick={() => updateElement(selected.id, { color: preset.value })}
                        />
                      ))}
                    </div>
                  </div>
                  <label className="form-label" htmlFor="font-family">글꼴</label>
                  <select
                    id="font-family"
                    value={selected.fontFamily}
                    onChange={(event) => updateElement(selected.id, { fontFamily: event.target.value })}
                  >
                    {FONTS.map((font) => <option value={font.value} key={font.label}>{font.label}</option>)}
                  </select>
                  <div className="property-grid">
                    <div>
                      <label className="form-label" htmlFor="text-align">정렬</label>
                      <select
                        id="text-align"
                        value={selected.align}
                        onChange={(event) => updateElement(selected.id, { align: event.target.value as TextElement["align"] })}
                      >
                        <option value="left">왼쪽</option>
                        <option value="center">가운데</option>
                        <option value="right">오른쪽</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">굵기</label>
                      <button
                        type="button"
                        className={"toggle-bold" + (selected.bold ? " pressed" : "")}
                        aria-pressed={selected.bold}
                        onClick={() => updateElement(selected.id, { bold: !selected.bold })}
                      >굵게 B</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="image-properties">
                  <label className="form-label" htmlFor="image-rotation">오브젝트 회전</label>
                  <div className="rotation-controls">
                    <input
                      id="image-rotation-range"
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      aria-label="이미지 회전 각도"
                      value={selected.rotation}
                      onChange={(event) => updateElement(selected.id, { rotation: Number(event.target.value) })}
                    />
                    <div className="rotation-number">
                      <input
                        id="image-rotation"
                        type="number"
                        min={-180}
                        max={180}
                        step={1}
                        value={selected.rotation}
                        onChange={(event) => {
                          const angle = Number(event.target.value);
                          if (Number.isFinite(angle)) {
                            updateElement(selected.id, { rotation: normalizeRotation(angle) });
                          }
                        }}
                        aria-label="회전 각도"
                      />
                      <span>°</span>
                    </div>
                    <button
                      type="button"
                      className="reset-rotation"
                      title="회전 초기화"
                      onClick={() => updateElement(selected.id, { rotation: 0 })}
                    >초기화</button>
                  </div>
                  <p className="helper">캔버스의 회전 핸들을 드래그할 수도 있습니다.</p>
                  <div className="image-option-divider" />
                  <span className="form-label">테두리 스타일</span>
                  <div className="outline-style-picker" role="group" aria-label="이미지 테두리 스타일">
                    {([
                      ["none", "없음"],
                      ["clean", "깔끔하게"],
                      ["rough", "손그림 컷아웃"],
                    ] as const).map(([style, label]) => (
                      <button
                        type="button"
                        key={style}
                        className={selected.outlineStyle === style ? "active" : ""}
                        aria-pressed={selected.outlineStyle === style}
                        onClick={() => updateElement(selected.id, { outlineStyle: style })}
                      >{label}</button>
                    ))}
                  </div>
                  {selected.outlineStyle !== "none" && (
                    <>
                      <div className="outline-settings">
                        <div className="outline-width-control">
                          <label className="form-label" htmlFor="outline-width">테두리 두께 <strong>{selected.outlineWidth}px</strong></label>
                          <input
                            id="outline-width"
                            type="range"
                            min={3}
                            max={30}
                            step={1}
                            value={selected.outlineWidth}
                            onChange={(event) => updateElement(selected.id, { outlineWidth: Number(event.target.value) })}
                          />
                        </div>
                        <div className="outline-color-control">
                          <label className="form-label" htmlFor="outline-color">테두리 색상</label>
                          <div className="text-color-control">
                            <input
                              id="outline-color"
                              type="color"
                              value={selected.outlineColor}
                              onChange={(event) => updateElement(selected.id, { outlineColor: event.target.value })}
                            />
                            <span>{selected.outlineColor.toUpperCase()}</span>
                          </div>
                        </div>
                      </div>
                      <p className="helper">피사체 윤곽을 따라가는 테두리입니다. 투명 배경 PNG/WebP 사용을 권장하며, 일반 JPG는 사각형 테두리로 표현됩니다.</p>
                    </>
                  )}
                </div>
              )}
              <div className="layer-actions">
                <button type="button" onClick={() => shiftSelected(-1)}>← 뒤로</button>
                <button type="button" onClick={() => shiftSelected(1)}>앞으로 →</button>
                <button type="button" className="delete-button" onClick={removeSelected}>삭제</button>
              </div>
            </section>
          )}

          <div className="sidebar-bottom">
            <span aria-hidden="true">◇</span>
            <span>작업 내용은 서버에 저장되지 않아요.<br />새로고침하면 편집 내용이 사라집니다.</span>
          </div>
        </aside>

        <main
          className={"workspace" + (isDragging ? " is-dragging" : "")}
          ref={workspaceRef}
          onDragOver={(event) => {
            event.preventDefault();
            if (event.dataTransfer.types.includes("Files")) setIsDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
          }}
          onDrop={onImageDrop}
        >
          <div className="workspace-toolbar">
            <div className="workspace-label">
              <span className="eyebrow">LIVE PREVIEW</span>
              <strong>캔버스</strong>
            </div>
            <div className="workspace-pills">
              <span>16:9</span>
              <span>{CANVAS_WIDTH} × {CANVAS_HEIGHT}</span>
            </div>
          </div>

          <div className="workspace-content">
            <div className="canvas-shadow">
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
            {!hasElements && (
              <p className="canvas-hint">왼쪽에서 이미지나 텍스트를 추가해 보세요 <span aria-hidden="true">↗</span></p>
            )}
            {hasElements && (
              <p className="canvas-hint">캔버스 위의 요소를 클릭하거나 드래그해서 자유롭게 배치하세요.</p>
            )}
            {isDragging && <div className="drop-indicator">이미지를 놓아 추가하기</div>}
          </div>

          <div className="workspace-footer">
            <span>DESIGNED IN YOUR BROWSER</span>
            <span>비율 16:9 · 이미지 출력 PNG</span>
          </div>
        </main>
      </div>

      {notice && (
        <div className="notice" role="alert">
          <span>{notice}</span>
          <button type="button" aria-label="안내 닫기" onClick={() => setNotice(null)}>×</button>
        </div>
      )}
    </div>
  );
}
