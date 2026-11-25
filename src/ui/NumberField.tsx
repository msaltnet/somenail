import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { clamp, commitDraft, parseWholeNumber } from "./number";

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
 */
export function NumberField({ id, label, value, min, max, step = 1, unit, stepper = false, onChange }: Props) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

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
    <div className={"number-field" + (stepper ? " number-field--stepper" : "")}>
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
