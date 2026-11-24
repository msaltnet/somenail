import type { ReactNode } from "react";

type FieldProps = {
  label: ReactNode;
  htmlFor: string;
  /** Live value shown at the right of the label (e.g. slider px). */
  value?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
};

/** Label + control + hint/error. Ids for aria-describedby: `${htmlFor}-hint`, `${htmlFor}-error`. */
export function Field({ label, htmlFor, value, hint, error, children }: FieldProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        <span>{label}</span>
        {value !== undefined && <span className="field__value">{value}</span>}
      </label>
      {children}
      {error ? (
        <p className="field__error" id={`${htmlFor}-error`} role="alert">{error}</p>
      ) : hint ? (
        <p className="field__hint" id={`${htmlFor}-hint`}>{hint}</p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, hint?: unknown, error?: unknown): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type SegmentedProps<T extends string> = {
  legend: string;
  name: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T) => void;
};

/** Single choice among 2–4 options: fieldset + native radios (shared DS §6). */
export function SegmentedControl<T extends string>({ legend, name, value, options, onChange }: SegmentedProps<T>) {
  return (
    <fieldset className="field">
      <legend className="field__label">{legend}</legend>
      <div className="segmented">
        {options.map(([optionValue, optionLabel]) => (
          <label className="segmented__option" key={optionValue}>
            <input
              type="radio"
              name={name}
              value={optionValue}
              checked={value === optionValue}
              onChange={() => onChange(optionValue)}
            />
            <span>{optionLabel}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
