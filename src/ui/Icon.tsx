const PATHS = {
  download: "M12 4v11M7 10.5l5 5 5-5M5 20h14",
  image: "M4 5h16v14H4zM4 16l4.5-4.5 4 4 2.5-2.5L20 18M15.5 9.5h.01",
  text: "M5 7V5h14v2M12 5v14M9 19h6",
  background: "M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  forward: "M12 19V5M6 11l6-6 6 6",
  backward: "M12 5v14M6 13l6 6 6-6",
  reset: "M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5",
  close: "M6 6l12 12M18 6 6 18",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
} as const;

export type IconName = keyof typeof PATHS;

type Props = { name: IconName; size?: "sm" | "md"; label?: string };

/** Stroke icon drawn in currentColor. Decorative unless a label is given. */
export function Icon({ name, size = "sm", label }: Props) {
  return (
    <svg
      className={"icon" + (size === "md" ? " icon--md" : "")}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
