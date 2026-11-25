import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type FieldProps = {
  label: ReactNode;
  htmlFor: string;
  /** Live value shown at the right of the label (e.g. slider px). */
  value?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /** Keep the label for assistive tech only, when the control already explains itself. */
  hideLabel?: boolean;
  children: ReactNode;
};

/** Label + control + hint/error. Ids for aria-describedby: `${htmlFor}-hint`, `${htmlFor}-error`. */
export function Field({ label, htmlFor, value, hint, error, hideLabel, children }: FieldProps) {
  return (
    <div className="field">
      <label className={hideLabel ? "visually-hidden" : "field__label"} htmlFor={htmlFor}>
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

export type SegmentedOption<T extends string> = {
  value: T;
  /** Visible text, or — with `icon` — the accessible name and tooltip. */
  label: string;
  icon?: IconName;
  /** e.g. render a font option in its own typeface. */
  labelStyle?: CSSProperties;
};

type SegmentedProps<T extends string> = {
  legend: string;
  hideLegend?: boolean;
  name: string;
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
  className?: string;
};

/**
 * Single choice among 2–4 options: fieldset + native radios (shared DS §6).
 * Icon options show only the icon; the label stays as the radio's name and the tooltip.
 */
export function SegmentedControl<T extends string>({
  legend,
  hideLegend,
  name,
  value,
  options,
  onChange,
  className,
}: SegmentedProps<T>) {
  const iconOnly = options.every((option) => option.icon);
  return (
    <fieldset className={["field", className ?? ""].filter(Boolean).join(" ")}>
      <legend className={hideLegend ? "visually-hidden" : "field__label"}>{legend}</legend>
      <div className={"segmented" + (iconOnly ? " segmented--icons" : "")}>
        {options.map((option) => (
          <label className="segmented__option" key={option.value} title={option.icon ? option.label : undefined}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              aria-label={option.icon ? option.label : undefined}
              onChange={() => onChange(option.value)}
            />
            <span style={option.labelStyle}>
              {option.icon ? <Icon name={option.icon} size="md" /> : option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
