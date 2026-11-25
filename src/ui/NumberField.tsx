import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { clamp, commitDraft, parseWholeNumber, wheelStep } from "./number";

type Props = {
  id: string;
  /** Accessible name. Not shown: the unit and the context already say what the number is. */
  label: string;
  value: number;
  min: number;
  max: number;
  /** Step for the − / + buttons and the arrow keys. */
  step?: number;
  unit: string;
  /** Show − / + buttons around the input. */
  stepper?: boolean;
  onChange: (value: number) => void;
};

/**
 * Whole-number input drawn by the design system (no browser spinner).
 * Valid in-range values apply while typing; on blur the draft is clamped or reverted.
 * While the input has focus, the mouse wheel over the field steps the value (like the native number input).
 */
export function NumberField({ id, label, value, min, max, step = 1, unit, stepper = false, onChange }: Props) {
  const [draft, setDraft] = useState(String(value));
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The wheel listener is attached once; read the latest props through a ref.
  const latest = useRef({ value, min, max, step, onChange });
  latest.current = { value, min, max, step, onChange };

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let pixels = 0;
    const onWheel = (event: WheelEvent) => {
      if (document.activeElement !== inputRef.current) return;
      // React's onWheel is passive; a native listener can keep the sidebar from scrolling.
      event.preventDefault();
      // Shift + wheel arrives as horizontal scroll in most browsers.
      const shifted = event.shiftKey && event.deltaY === 0;
      const deltaX = shifted ? 0 : event.deltaX;
      let deltaY = shifted ? event.deltaX : event.deltaY;
      // Pixel-mode wheels (trackpads) send many small deltas: one step per 40px.
      if (event.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
        pixels += deltaY;
        if (Math.abs(pixels) < 40) return;
        deltaY = pixels;
        pixels = 0;
      }
      const { value: current, min: low, max: high, step: unit, onChange: emit } = latest.current;
      const change = wheelStep(deltaX, deltaY, unit, event.shiftKey);
      const next = clamp(current + change, low, high);
      if (change !== 0 && next !== current) emit(next);
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, []);

  const set = (next: number) => {
    const clamped = clamp(next, min, max);
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  const type = (next: string) => {
    setDraft(next);
    const parsed = parseWholeNumber(next);
    if (parsed !== null && parsed >= min && parsed <= max && parsed !== value) onChange(parsed);
  };

  return (
    <div ref={rootRef} className={"number-field" + (stepper ? " number-field--stepper" : "")}>
      {stepper && (
        <button
          type="button"
          className="number-field__step"
          aria-label={`${label} 줄이기`}
          title={`${label} 줄이기`}
          tabIndex={-1}
          disabled={value <= min}
          onClick={() => set(value - step)}
        >
          <Icon name="minus" />
        </button>
      )}
      <label className="number-field__box">
        <span className="visually-hidden">{label}</span>
        <input
          ref={inputRef}
          id={id}
          className="number-field__input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          role="spinbutton"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          value={draft}
          onChange={(event) => type(event.target.value)}
          onBlur={() => set(commitDraft(draft, value, min, max))}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              set(value + (event.key === "ArrowUp" ? step : -step) * (event.shiftKey ? 10 : 1));
            }
          }}
        />
        <span className="number-field__unit" aria-hidden="true">{unit}</span>
      </label>
      {stepper && (
        <button
          type="button"
          className="number-field__step"
          aria-label={`${label} 늘리기`}
          title={`${label} 늘리기`}
          tabIndex={-1}
          disabled={value >= max}
          onClick={() => set(value + step)}
        >
          <Icon name="plus" />
        </button>
      )}
    </div>
  );
}
