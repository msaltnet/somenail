import { useEffect, useState } from "react";
import { normalizeHexColor } from "../editor/color";

export type ColorPreset = { readonly name: string; readonly value: string };

type Props = {
  id: string;
  label: string;
  /** Used in swatch names, e.g. "배경색" → "배경색 차콜 (HEX)". */
  subject: string;
  value: string;
  onChange: (hex: string) => void;
  presets?: ReadonlyArray<ColorPreset>;
};

const HEX_ERROR = "#RRGGBB 형식의 6자리 HEX로 입력하세요.";

/**
 * One color input for every color in the app: picker well + editable HEX + optional swatches.
 * Valid HEX applies while typing; an invalid value is reverted on blur with an inline error.
 */
export function ColorField({ id, label, subject, value, onChange, presets }: Props) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const current = value.toUpperCase();

  useEffect(() => {
    setDraft(value.toUpperCase());
  }, [value]);

  const typeDraft = (next: string) => {
    setDraft(next);
    const color = normalizeHexColor(next);
    if (color && next.trim().length >= 6) {
      setError(null);
      onChange(color);
    }
  };

  const commit = () => {
    const color = normalizeHexColor(draft);
    if (!color) {
      setDraft(current);
      setError(HEX_ERROR);
      return;
    }
    setError(null);
    setDraft(color);
    if (color !== current) onChange(color);
  };

  return (
    <div className="field color-field">
      <label className="field__label" htmlFor={id}>{label}</label>
      <div className="color-field__row">
        <span className="color-field__well" style={{ backgroundColor: current }}>
          <input
            type="color"
            aria-label={`${label} 고르기`}
            value={current.toLowerCase()}
            onChange={(event) => {
              setError(null);
              onChange(event.target.value.toUpperCase());
            }}
          />
        </span>
        <input
          id={id}
          className="input"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
          value={draft}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => typeDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </div>
      {error && <p className="field__error" id={`${id}-error`} role="alert">{error}</p>}
      {presets && (
        <div className="swatch-grid" role="group" aria-label={`추천 ${subject}`}>
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className="swatch"
              style={{ backgroundColor: preset.value }}
              title={`${preset.name} ${preset.value}`}
              aria-label={`${subject} ${preset.name} ${preset.value}`}
              aria-pressed={current === preset.value}
              onClick={() => {
                setError(null);
                onChange(preset.value);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
