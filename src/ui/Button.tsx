import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  block?: boolean;
  /** Shows the busy label, blocks repeat clicks and sets aria-busy. */
  busy?: boolean;
  busyLabel?: ReactNode;
  /** Renders an aria-pressed toggle. */
  pressed?: boolean;
};

export function buttonClassName(variant: ButtonVariant, size: ButtonSize, extra = ""): string {
  return ["btn", `btn--${variant}`, size === "md" ? "" : `btn--${size}`, extra]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  block,
  busy = false,
  busyLabel,
  pressed,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  const extra = [block ? "btn--block" : "", pressed !== undefined ? "btn--toggle" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={buttonClassName(variant, size, extra)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-pressed={pressed}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

type IconButtonProps = Omit<Props, "icon" | "children" | "size" | "block"> & {
  icon: IconName;
  /** Required: icon-only buttons need an accessible name. */
  label: string;
};

export function IconButton({ icon, label, variant = "ghost", className, ...rest }: IconButtonProps) {
  return (
    <Button
      variant={variant}
      size="sm"
      className={["btn--icon", className ?? ""].filter(Boolean).join(" ")}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} />
    </Button>
  );
}
